"""Dashboard (RF08): KPIs consolidados, distribuição por canal e linha do tempo."""
from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.jobs import _job_response
from app.core.database import get_db
from app.core.datas import hoje
from app.models.domain import Usuario
from app.schemas.dashboard import (
    BaseDevedores,
    CanalKPI,
    ContagemResponse,
    DashboardResponse,
    KPIsPeriodo,
    PontoTimeline,
)
from app.schemas.lote import LoteResponse
from app.services import dashboard as servico

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _contagem(c: servico.Contagem) -> dict:
    return {
        "disparos": c.disparos,
        "sucesso": c.sucesso,
        "falhas": c.falhas,
        "aguardando": c.aguardando,
        "taxa_entrega": c.taxa_entrega,
    }


@router.get("/", response_model=DashboardResponse)
def dashboard(
    dias: int = Query(7, ge=1, le=servico.DIAS_MAXIMO, description="Janela em dias"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    """KPIs do período (padrão: 7 dias, contando hoje). Todos os perfis podem ver."""
    dia_final = hoje()
    inicio, fim = servico.limites_do_periodo(dia_final, dias)
    inicio_hoje, fim_hoje = servico.limites_do_periodo(dia_final, 1)

    por_canal = servico.contagem_por_canal(db, inicio, fim)
    total_periodo = servico.Contagem()
    for contagem in por_canal.values():
        total_periodo = total_periodo.somar(contagem)

    alcancados, quitados = servico.conversao(db, inicio, fim)
    por_status = servico.devedores_por_status(db)

    return DashboardResponse(
        dias=dias,
        data_inicial=dia_final - timedelta(days=dias - 1),
        data_final=dia_final,
        base=BaseDevedores(
            total=sum(por_status.values()),
            por_status={status.value: total for status, total in por_status.items()},
        ),
        hoje=ContagemResponse(**_contagem(servico.contagem_total(db, inicio_hoje, fim_hoje))),
        periodo=KPIsPeriodo(
            **_contagem(total_periodo),
            devedores_alcancados=alcancados,
            devedores_quitados=quitados,
            taxa_conversao=servico.percentual(quitados, alcancados),
        ),
        por_canal=[
            CanalKPI(canal=canal, **_contagem(contagem))
            for canal, contagem in por_canal.items()
        ],
        timeline=[
            PontoTimeline(
                dia=dia,
                disparos=c.disparos,
                sucesso=c.sucesso,
                falhas=c.falhas,
            )
            for dia, c in servico.timeline(db, dia_final, dias)
        ],
        ultimos_lotes=[
            LoteResponse.model_validate(lote) for lote in servico.ultimos_lotes(db)
        ],
        ultimos_jobs=[_job_response(job, regra) for job, regra in servico.ultimos_jobs(db)],
    )
