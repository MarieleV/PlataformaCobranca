"""Acompanhamento dos disparos (RF06/RF07): jobs e o resultado de cada tentativa."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.domain import (
    Comunicacao,
    Devedor,
    Job,
    RegraCobranca,
    StatusComunicacaoEnum,
    StatusJobEnum,
    Usuario,
)
from app.schemas.job import (
    ComunicacaoDoJobResponse,
    JobResponse,
    PaginaComunicacoesDoJob,
    PaginaJobs,
)

router = APIRouter(prefix="/jobs", tags=["Disparos"])


def _job_response(job: Job, regra: RegraCobranca) -> JobResponse:
    return JobResponse(
        id=job.id,
        regra_id=job.regra_id,
        regra_nome=regra.nome,
        canal=regra.canal,
        dia_referencia=job.dia_referencia,
        status=job.status,
        total_alvos=job.total_alvos,
        total_sucesso=job.total_sucesso,
        total_falhas=job.total_falhas,
        inicio_em=job.inicio_em,
        fim_em=job.fim_em,
        criado_em=job.criado_em,
    )


@router.get("/", response_model=PaginaJobs)
def listar_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_job: StatusJobEnum | None = Query(None, alias="status"),
    regra_id: uuid.UUID | None = Query(None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    filtros = []
    if status_job:
        filtros.append(Job.status == status_job)
    if regra_id:
        filtros.append(Job.regra_id == regra_id)

    total = db.execute(select(func.count()).select_from(Job).where(*filtros)).scalar_one()
    linhas = db.execute(
        select(Job, RegraCobranca)
        .join(RegraCobranca, RegraCobranca.id == Job.regra_id)
        .where(*filtros)
        .order_by(Job.dia_referencia.desc(), Job.criado_em.desc(), Job.id)
        .offset(skip)
        .limit(limit)
    ).all()
    return PaginaJobs(total=total, skip=skip, limit=limit, itens=[_job_response(j, r) for j, r in linhas])


def _buscar_job(db: Session, job_id: uuid.UUID) -> tuple[Job, RegraCobranca]:
    linha = db.execute(
        select(Job, RegraCobranca).join(RegraCobranca, RegraCobranca.id == Job.regra_id).where(Job.id == job_id)
    ).first()
    if linha is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Job não encontrado")
    return linha


@router.get("/{job_id}", response_model=JobResponse)
def detalhar_job(
    job_id: uuid.UUID, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
):
    return _job_response(*_buscar_job(db, job_id))


@router.get("/{job_id}/comunicacoes", response_model=PaginaComunicacoesDoJob)
def comunicacoes_do_job(
    job_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_comunicacao: StatusComunicacaoEnum | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    """Resultado de cada tentativa: status, nº de tentativas e código de erro (RF07)."""
    _buscar_job(db, job_id)
    filtros = [Comunicacao.job_id == job_id]
    if status_comunicacao:
        filtros.append(Comunicacao.status == status_comunicacao)

    total = db.execute(select(func.count()).select_from(Comunicacao).where(*filtros)).scalar_one()
    linhas = db.execute(
        select(Comunicacao, Devedor.nome)
        .join(Devedor, Devedor.id == Comunicacao.devedor_id)
        .where(*filtros)
        .order_by(Devedor.nome, Comunicacao.id)
        .offset(skip)
        .limit(limit)
    ).all()
    return PaginaComunicacoesDoJob(
        total=total,
        skip=skip,
        limit=limit,
        itens=[
            ComunicacaoDoJobResponse(
                id=c.id,
                devedor_id=c.devedor_id,
                devedor_nome=nome,
                canal=c.canal,
                status=c.status,
                tentativas=c.tentativas,
                proxima_tentativa_em=c.proxima_tentativa_em,
                codigo_erro=c.codigo_erro,
                mensagem_erro=c.mensagem_erro,
                enviado_em=c.enviado_em,
                criado_em=c.criado_em,
            )
            for c, nome in linhas
        ],
    )
