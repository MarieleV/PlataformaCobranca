"""Tasks do disparo da régua (M4): ciclo agendado pelo Celery Beat."""
import logging
import uuid
from datetime import date

from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.core.datas import agora
from app.core.redis_client import get_redis
from app.models.domain import RegraCobranca
from app.services.disparo import agendar_jobs, criar_job, processar_fila

import redis

logger = logging.getLogger(__name__)

_CHAVE_TRAVA = "disparo:ciclo_em_andamento"
_TRAVA_SEGUNDOS = 900  # um pouco acima do limite de tempo da task


def _adquirir_trava() -> str | None:
    """Evita dois ciclos ao mesmo tempo. Sem Redis, segue em frente: a trava de
    linha no banco (FOR UPDATE SKIP LOCKED) já impede o envio em duplicidade."""
    token = uuid.uuid4().hex
    try:
        return token if get_redis().set(_CHAVE_TRAVA, token, nx=True, ex=_TRAVA_SEGUNDOS) else None
    except redis.RedisError:
        logger.warning("Redis indisponível: ciclo de disparo segue sem a trava")
        return "sem-redis"


def _liberar_trava(token: str) -> None:
    try:
        if get_redis().get(_CHAVE_TRAVA) == token:
            get_redis().delete(_CHAVE_TRAVA)
    except redis.RedisError:
        pass


@celery_app.task(name="app.worker.disparo_tasks.ciclo_de_disparo")
def ciclo_de_disparo() -> dict:
    """Cria os jobs do dia e envia as comunicações vencidas (RF06)."""
    token = _adquirir_trava()
    if token is None:
        logger.info("Ciclo de disparo anterior ainda em andamento: ciclo ignorado")
        return {"ignorado": True}

    db = SessionLocal()
    try:
        momento = agora()
        jobs = agendar_jobs(db, momento)
        resumo = processar_fila(db, momento)
        resumo.jobs_criados = len(jobs)
        logger.info(
            "Ciclo de disparo: %s job(s) criado(s), %s enviado(s), %s reenvio(s) agendado(s), "
            "%s bounce(s), %s falha(s) definitiva(s)",
            len(jobs), resumo.enviados, resumo.reenvios_agendados, resumo.bounces, resumo.falhas_definitivas,
        )
        return vars(resumo)
    finally:
        db.close()
        _liberar_trava(token)


@celery_app.task(name="app.worker.disparo_tasks.executar_regua_task")
def executar_regua_task(regra_id: str, dia_iso: str) -> dict:
    """Execução manual de uma regra (UC03): cria o job do dia pedido.

    O envio em si acontece no próximo ciclo, respeitando a janela da RN05.
    """
    db = SessionLocal()
    try:
        regra = db.get(RegraCobranca, uuid.UUID(regra_id))
        if regra is None or not regra.ativa:
            return {"criado": False, "motivo": "regra inexistente ou inativa"}
        job = criar_job(db, regra, date.fromisoformat(dia_iso), agora())
        return {"criado": job is not None, "job_id": str(job.id) if job else None}
    finally:
        db.close()
