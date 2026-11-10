"""Regras de negócio da régua de cobrança, compartilhadas pela API e (no M4)
pelo job de disparo."""
from datetime import date, timedelta

from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

from app.core.datas import hoje, inicio_do_dia_utc
from app.models.domain import (
    CanalEnum,
    Comunicacao,
    Devedor,
    RegraCobranca,
    StatusComunicacaoEnum,
    StatusDevedorEnum,
)

# Devedores em negociação, quitados ou inativos não recebem cobrança
STATUS_COBRAVEIS = (StatusDevedorEnum.ativo, StatusDevedorEnum.comunicado)

_STATUS_COM_SUCESSO = (StatusComunicacaoEnum.enviado, StatusComunicacaoEnum.entregue)


def consulta_elegiveis(regra: RegraCobranca, dia: date | None = None) -> Select:
    """Devedores que a regra deve contatar no dia.

    - o atraso é exatamente o prazo da regra (5, 15, 30... dias);
    - status cobrável (ver STATUS_COBRAVEIS);
    - possui o contato do canal da regra (e-mail, telefone ou WhatsApp);
    - RN03: ainda não recebeu comunicação bem-sucedida do mesmo canal no dia.
    """
    dia = dia or hoje()
    contato = {
        CanalEnum.email: Devedor.email,
        CanalEnum.sms: Devedor.telefone,
        CanalEnum.whatsapp: Devedor.whatsapp,
    }[regra.canal]

    ja_recebeu_hoje = exists().where(
        Comunicacao.devedor_id == Devedor.id,
        Comunicacao.canal == regra.canal,
        Comunicacao.status.in_(_STATUS_COM_SUCESSO),
        Comunicacao.enviado_em >= inicio_do_dia_utc(dia),
        Comunicacao.enviado_em < inicio_do_dia_utc(dia + timedelta(days=1)),
    )

    return (
        select(Devedor)
        .where(
            Devedor.data_vencimento == dia - timedelta(days=regra.dias_atraso),
            Devedor.status.in_(STATUS_COBRAVEIS),
            contato.is_not(None),
            contato != "",
            ~ja_recebeu_hoje,
        )
        .order_by(Devedor.nome, Devedor.id)
    )


def contar_elegiveis(db: Session, regra: RegraCobranca, dia: date | None = None) -> int:
    subconsulta = consulta_elegiveis(regra, dia).subquery()
    return db.execute(select(func.count()).select_from(subconsulta)).scalar_one()


def status_da_regua(db: Session) -> dict:
    """RN02: a régua só está ativa se houver ao menos uma regra ativa e válida."""
    total = db.execute(select(func.count()).select_from(RegraCobranca)).scalar_one()
    ativas = db.execute(
        select(func.count()).select_from(RegraCobranca).where(RegraCobranca.ativa.is_(True))
    ).scalar_one()
    return {"regua_ativa": ativas > 0, "regras_ativas": ativas, "total_regras": total}
