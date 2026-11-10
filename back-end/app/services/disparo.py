"""Disparo da régua (RF06, RF07, RN03, RN05, RN07, RN08).

Fluxo (a cada ciclo do Celery Beat, dentro da janela da RN05):

1. `agendar_jobs`: para cada regra ativa cujo horário já chegou, cria UM job do
   dia e uma comunicação "pendente" para cada devedor elegível.
2. `processar_fila`: envia as comunicações vencidas (novas ou reenvios) pelo
   cliente do canal e grava o resultado de cada tentativa.

Estados da comunicação:

- pendente                       aguardando a 1ª tentativa
- falha + proxima_tentativa_em   falhou, tem reenvio agendado (RN07)
- enviado / entregue             sucesso
- bounce                         destino inválido, definitivo (RN08)
- falha sem proxima_tentativa_em tentativas esgotadas, definitivo (RN07)
"""
import logging
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from zoneinfo import ZoneInfo

from sqlalchemy import and_, func, insert, or_, select
from sqlalchemy.orm import Session

from app.clients import ClienteCanal, ResultadoEnvio, StatusEnvio, obter_cliente
from app.core.config import settings
from app.core.crypto import descriptografar_decimal
from app.core.janela import dentro_da_janela, proxima_janela_valida
from app.core.templates import contexto_do_devedor, renderizar
from app.models.domain import (
    CanalEnum,
    Comunicacao,
    Devedor,
    Job,
    RegraCobranca,
    StatusComunicacaoEnum,
    StatusDevedorEnum,
    StatusJobEnum,
)
from app.services.regua import consulta_elegiveis

logger = logging.getLogger(__name__)

_SUCESSO = (StatusComunicacaoEnum.enviado, StatusComunicacaoEnum.entregue)


@dataclass
class ResumoCiclo:
    jobs_criados: int = 0
    enviados: int = 0
    reenvios_agendados: int = 0
    falhas_definitivas: int = 0
    bounces: int = 0
    fora_da_janela: bool = False


def _utc(momento: datetime) -> datetime:
    return momento.astimezone(timezone.utc)


# --------------------------------------------------------------------------
# 1. Criação dos jobs
# --------------------------------------------------------------------------
def criar_job(db: Session, regra: RegraCobranca, dia: date, agora: datetime) -> Job | None:
    """Cria o job da regra para o dia, com as comunicações dos elegíveis.

    Idempotente: se já existe job da regra para o dia, devolve None. Dois
    workers simultâneos não duplicam (trava na regra + restrição única no banco).
    """
    db.execute(select(RegraCobranca.id).where(RegraCobranca.id == regra.id).with_for_update())
    if db.execute(
        select(Job.id).where(Job.regra_id == regra.id, Job.dia_referencia == dia)
    ).first():
        db.rollback()
        return None

    job = Job(
        regra_id=regra.id,
        dia_referencia=dia,
        status=StatusJobEnum.executando,
        inicio_em=_utc(agora),
    )
    db.add(job)
    db.flush()

    ids = db.execute(consulta_elegiveis(regra, dia).with_only_columns(Devedor.id)).scalars().all()
    if ids:
        db.execute(
            insert(Comunicacao),
            [
                {
                    "id": uuid.uuid4(),
                    "devedor_id": devedor_id,
                    "job_id": job.id,
                    "canal": regra.canal,
                    "status": StatusComunicacaoEnum.pendente,
                    "tentativas": 0,
                }
                for devedor_id in ids
            ],
        )
    job.total_alvos = len(ids)
    if not ids:
        job.status = StatusJobEnum.concluido
        job.fim_em = _utc(agora)
    db.commit()
    return job


def agendar_jobs(db: Session, agora: datetime) -> list[Job]:
    """Cria os jobs de hoje das regras ativas cujo horário já chegou (RN05)."""
    if not dentro_da_janela(agora):
        return []

    local = agora.astimezone(ZoneInfo(settings.fuso_horario))
    regras = (
        db.execute(
            select(RegraCobranca)
            .where(RegraCobranca.ativa.is_(True), RegraCobranca.horario_disparo <= local.time())
            .order_by(RegraCobranca.dias_atraso, RegraCobranca.canal)
        )
        .scalars()
        .all()
    )

    criados = []
    for regra in regras:
        try:
            job = criar_job(db, regra, local.date(), agora)
        except Exception:
            db.rollback()
            logger.exception("Falha ao criar o job da regra %s", regra.id)
            continue
        if job:
            criados.append(job)
    return criados


# --------------------------------------------------------------------------
# 2. Envio
# --------------------------------------------------------------------------
def _vencidas(agora_utc: datetime):
    """Comunicações cujo envio (ou reenvio) já pode acontecer."""
    return and_(
        Comunicacao.tentativas < settings.max_tentativas_envio,
        or_(
            and_(
                Comunicacao.status == StatusComunicacaoEnum.pendente,
                or_(
                    Comunicacao.proxima_tentativa_em.is_(None),
                    Comunicacao.proxima_tentativa_em <= agora_utc,
                ),
            ),
            and_(
                Comunicacao.status == StatusComunicacaoEnum.falha,
                Comunicacao.proxima_tentativa_em.is_not(None),
                Comunicacao.proxima_tentativa_em <= agora_utc,
            ),
        ),
    )


def contato_do_canal(devedor: Devedor, canal: CanalEnum) -> str | None:
    return {
        CanalEnum.email: devedor.email,
        CanalEnum.sms: devedor.telefone,
        CanalEnum.whatsapp: devedor.whatsapp,
    }[canal]


def _enviar_uma(
    db: Session,
    comunicacao_id: uuid.UUID,
    agora: datetime,
    cliente_do_canal: Callable[[CanalEnum], ClienteCanal],
    resumo: ResumoCiclo,
) -> bool:
    """Envia uma comunicação e grava o resultado. False se outro worker a pegou."""
    # Trava a linha: se outro worker já a pegou, passa adiante (sem duplicar envio)
    comunicacao = db.execute(
        select(Comunicacao)
        .where(Comunicacao.id == comunicacao_id, _vencidas(_utc(agora)))
        .with_for_update(skip_locked=True)
    ).scalar_one_or_none()
    if comunicacao is None:
        db.rollback()
        return False

    devedor = comunicacao.devedor
    regra = comunicacao.job.regra
    destino = contato_do_canal(devedor, comunicacao.canal)

    if not destino:
        resultado_status, codigo, mensagem_erro, id_externo = (
            StatusEnvio.BOUNCE, "SEM_CONTATO", "Devedor sem contato para o canal", None,
        )
    else:
        try:
            texto = renderizar(
                regra.template_mensagem,
                contexto_do_devedor(
                    devedor,
                    descriptografar_decimal(devedor.valor_divida_enc),
                    dia=agora.astimezone(ZoneInfo(settings.fuso_horario)).date(),
                ),
            )
            resultado = cliente_do_canal(comunicacao.canal).enviar(
                destino, texto, settings.email_assunto if comunicacao.canal == CanalEnum.email else None
            )
        except Exception as erro:
            # Nunca loga o conteúdo da mensagem nem o destino (dados pessoais)
            logger.error("Erro inesperado no envio da comunicação %s: %s", comunicacao.id, type(erro).__name__)
            resultado = ResultadoEnvio.temporaria("ERRO_INTERNO", type(erro).__name__)
        resultado_status = resultado.status
        codigo, mensagem_erro, id_externo = resultado.codigo_erro, resultado.mensagem_erro, resultado.id_externo

    comunicacao.tentativas += 1
    if resultado_status == StatusEnvio.ENVIADO:
        comunicacao.status = StatusComunicacaoEnum.enviado
        comunicacao.enviado_em = _utc(agora)
        comunicacao.id_externo = id_externo
        comunicacao.codigo_erro = comunicacao.mensagem_erro = comunicacao.proxima_tentativa_em = None
        if devedor.status == StatusDevedorEnum.ativo:
            devedor.status = StatusDevedorEnum.comunicado
        resumo.enviados += 1
    elif resultado_status == StatusEnvio.BOUNCE:  # RN08: definitivo na hora
        comunicacao.status = StatusComunicacaoEnum.bounce
        comunicacao.codigo_erro, comunicacao.mensagem_erro = codigo, mensagem_erro
        comunicacao.proxima_tentativa_em = None
        resumo.bounces += 1
    else:  # RN07
        comunicacao.status = StatusComunicacaoEnum.falha
        comunicacao.codigo_erro, comunicacao.mensagem_erro = codigo, mensagem_erro
        if comunicacao.tentativas >= settings.max_tentativas_envio:
            comunicacao.proxima_tentativa_em = None  # esgotou: falha definitiva
            resumo.falhas_definitivas += 1
        else:
            # RN05: reenvio fora da janela vai para a próxima abertura
            proxima = proxima_janela_valida(agora + timedelta(minutes=settings.intervalo_reenvio_minutos))
            comunicacao.proxima_tentativa_em = _utc(proxima)
            resumo.reenvios_agendados += 1

    db.commit()  # grava já: se o worker cair depois, o envio não se repete
    return True


def processar_fila(
    db: Session,
    agora: datetime,
    cliente_do_canal: Callable[[CanalEnum], ClienteCanal] = obter_cliente,
    orcamento_segundos: float = 600.0,
    tamanho_lote: int = 200,
) -> ResumoCiclo:
    """Envia as comunicações vencidas. Fora da janela da RN05, não faz nada."""
    resumo = ResumoCiclo()
    if not dentro_da_janela(agora):
        resumo.fora_da_janela = True
        return resumo

    inicio = time.monotonic()
    while time.monotonic() - inicio < orcamento_segundos:
        ids = (
            db.execute(
                select(Comunicacao.id)
                .where(_vencidas(_utc(agora)))
                .order_by(Comunicacao.criado_em, Comunicacao.id)
                .limit(tamanho_lote)
            )
            .scalars()
            .all()
        )
        if not ids:
            break
        processadas = 0
        for comunicacao_id in ids:
            if time.monotonic() - inicio >= orcamento_segundos:
                break
            if _enviar_uma(db, comunicacao_id, agora, cliente_do_canal, resumo):
                processadas += 1
        if processadas == 0:  # tudo travado por outro worker: evita laço infinito
            break

    atualizar_jobs(db, agora)  # todos os jobs em andamento, não só os tocados agora
    return resumo


# --------------------------------------------------------------------------
# 3. Contadores e fechamento dos jobs (RF06, passo 6)
# --------------------------------------------------------------------------
def atualizar_jobs(db: Session, agora: datetime) -> None:
    """Recalcula os contadores e conclui os jobs sem nada pendente.

    Recalcular (em vez de somar) torna a operação segura para repetir.
    """
    jobs = db.execute(select(Job).where(Job.status == StatusJobEnum.executando)).scalars().all()

    for job in jobs:
        status_com = Comunicacao.status
        sem_reenvio = Comunicacao.proxima_tentativa_em.is_(None)
        sucesso, falhas, pendentes = db.execute(
            select(
                func.count().filter(status_com.in_(_SUCESSO)),
                func.count().filter(
                    or_(
                        status_com == StatusComunicacaoEnum.bounce,
                        and_(status_com == StatusComunicacaoEnum.falha, sem_reenvio),
                    )
                ),
                func.count().filter(
                    or_(
                        status_com == StatusComunicacaoEnum.pendente,
                        and_(status_com == StatusComunicacaoEnum.falha, ~sem_reenvio),
                    )
                ),
            ).where(Comunicacao.job_id == job.id)
        ).one()

        job.total_sucesso, job.total_falhas = sucesso, falhas
        if pendentes == 0:
            job.fim_em = _utc(agora)
            job.status = (
                StatusJobEnum.falhou if job.total_alvos > 0 and sucesso == 0 else StatusJobEnum.concluido
            )
    db.commit()
