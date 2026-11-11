"""Indicadores do dashboard (RF08) e base das métricas do Prometheus (RNF08).

Definições (valem para a API e para o /metrics, que usam estas mesmas funções):

* Comunicação **com sucesso**: `enviado` ou `entregue`.
* Comunicação **com falha**: `bounce` ou `falha` sem novo reenvio agendado
  (falha definitiva, RN07/RN08).
* Comunicação **aguardando**: `pendente` ou `falha` com reenvio agendado — ainda
  sem desfecho. Conta como disparo e entra no denominador da taxa: durante o dia
  a taxa sobe à medida que os envios se resolvem.
* **Disparos** = sucesso + falhas + aguardando (toda comunicação gerada).
* **Taxa de entrega** = sucesso / disparos.
* **Taxa de conversão** = dos devedores que receberam ao menos uma comunicação
  com sucesso no período, a parcela hoje com status `quitado`.
"""
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import and_, case, distinct, func, or_, select
from sqlalchemy.orm import Session

from app.core.datas import inicio_do_dia_utc
from app.models.domain import (
    CanalEnum,
    Comunicacao,
    Devedor,
    Job,
    Lote,
    RegraCobranca,
    StatusComunicacaoEnum as SC,
    StatusDevedorEnum,
)

DIAS_MAXIMO = 30
SUCESSO = (SC.enviado, SC.entregue)

_COND_SUCESSO = Comunicacao.status.in_(SUCESSO)
_COND_FALHA = or_(
    Comunicacao.status == SC.bounce,
    and_(Comunicacao.status == SC.falha, Comunicacao.proxima_tentativa_em.is_(None)),
)
_COND_AGUARDANDO = or_(
    Comunicacao.status == SC.pendente,
    and_(Comunicacao.status == SC.falha, Comunicacao.proxima_tentativa_em.is_not(None)),
)


@dataclass
class Contagem:
    sucesso: int = 0
    falhas: int = 0
    aguardando: int = 0

    @property
    def disparos(self) -> int:
        return self.sucesso + self.falhas + self.aguardando

    @property
    def taxa_entrega(self) -> float | None:
        return percentual(self.sucesso, self.disparos)

    def somar(self, outra: "Contagem") -> "Contagem":
        return Contagem(
            self.sucesso + outra.sucesso,
            self.falhas + outra.falhas,
            self.aguardando + outra.aguardando,
        )


def percentual(parte: int, total: int) -> float | None:
    """Percentual com 1 casa; None quando não há base de cálculo."""
    if total <= 0:
        return None
    return round(parte / total * 100, 1)


def limites_do_periodo(dia_final: date, dias: int) -> tuple[datetime, datetime]:
    """[início, fim) em UTC cobrindo `dias` dias de Brasília até `dia_final`."""
    return (
        inicio_do_dia_utc(dia_final - timedelta(days=dias - 1)),
        inicio_do_dia_utc(dia_final + timedelta(days=1)),
    )


def contagem_por_canal(
    db: Session, inicio: datetime, fim: datetime
) -> dict[CanalEnum, Contagem]:
    """Comunicações criadas em [inicio, fim), agrupadas por canal."""
    consulta = (
        select(
            Comunicacao.canal,
            func.coalesce(func.sum(case((_COND_SUCESSO, 1), else_=0)), 0),
            func.coalesce(func.sum(case((_COND_FALHA, 1), else_=0)), 0),
            func.coalesce(func.sum(case((_COND_AGUARDANDO, 1), else_=0)), 0),
        )
        .where(Comunicacao.criado_em >= inicio, Comunicacao.criado_em < fim)
        .group_by(Comunicacao.canal)
    )
    resultado = {canal: Contagem() for canal in CanalEnum}
    for canal, sucesso, falhas, aguardando in db.execute(consulta):
        resultado[canal] = Contagem(int(sucesso), int(falhas), int(aguardando))
    return resultado


def contagem_total(db: Session, inicio: datetime, fim: datetime) -> Contagem:
    total = Contagem()
    for contagem in contagem_por_canal(db, inicio, fim).values():
        total = total.somar(contagem)
    return total


def conversao(db: Session, inicio: datetime, fim: datetime) -> tuple[int, int]:
    """(devedores alcançados, destes quantos estão quitados) no período."""
    base = (
        select(func.count(distinct(Comunicacao.devedor_id)))
        .join(Devedor, Devedor.id == Comunicacao.devedor_id)
        .where(
            _COND_SUCESSO,
            Comunicacao.criado_em >= inicio,
            Comunicacao.criado_em < fim,
        )
    )
    alcancados = db.scalar(base) or 0
    quitados = db.scalar(base.where(Devedor.status == StatusDevedorEnum.quitado)) or 0
    return int(alcancados), int(quitados)


def devedores_por_status(db: Session) -> dict[StatusDevedorEnum, int]:
    resultado = {status: 0 for status in StatusDevedorEnum}
    for status, total in db.execute(
        select(Devedor.status, func.count()).group_by(Devedor.status)
    ):
        resultado[status] = int(total)
    return resultado


def timeline(db: Session, dia_final: date, dias: int) -> list[tuple[date, Contagem]]:
    """Um ponto por dia (do mais antigo ao mais recente), inclusive dias zerados."""
    pontos = []
    for deslocamento in range(dias - 1, -1, -1):
        dia = dia_final - timedelta(days=deslocamento)
        inicio, fim = limites_do_periodo(dia, 1)
        pontos.append((dia, contagem_total(db, inicio, fim)))
    return pontos


def ultimos_lotes(db: Session, limite: int = 5) -> list[Lote]:
    return list(db.scalars(select(Lote).order_by(Lote.criado_em.desc()).limit(limite)))


def ultimos_jobs(db: Session, limite: int = 5):
    """(Job, regra) mais recentes — já com a regra para o nome e o canal."""
    return list(
        db.execute(
            select(Job, RegraCobranca)
            .join(RegraCobranca, RegraCobranca.id == Job.regra_id)
            .order_by(Job.criado_em.desc())
            .limit(limite)
        ).all()
    )
