"""Consulta ao log de auditoria (UC07-A5 / RF11): exclusivo do administrador."""
import uuid
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import role_required
from app.core.config import settings
from app.core.database import get_db
from app.models.domain import CargoEnum, LogAuditoria, Usuario
from app.schemas.auditoria import LogAuditoriaResponse, PaginaAuditoria

router = APIRouter(prefix="/auditoria", tags=["Auditoria"])


def _meia_noite_utc(dia: date) -> datetime:
    """00h00 de Brasília do dia informado, em UTC (como o banco grava)."""
    local = datetime.combine(dia, time.min, tzinfo=ZoneInfo(settings.fuso_horario))
    return local.astimezone(timezone.utc)


@router.get("/", response_model=PaginaAuditoria)
def consultar_auditoria(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    usuario_id: uuid.UUID | None = Query(None, description="Quem executou a ação"),
    acao: str | None = Query(None, max_length=100, description="Ex.: login, criar_usuario"),
    entidade: str | None = Query(None, max_length=50, description="Ex.: usuario, devedor"),
    de: date | None = Query(None, description="A partir deste dia (inclusive, horário de Brasília)"),
    ate: date | None = Query(None, description="Até este dia (inclusive, horário de Brasília)"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(role_required([CargoEnum.administrador.value])),
):
    filtros = []
    if usuario_id:
        filtros.append(LogAuditoria.usuario_id == usuario_id)
    if acao:
        filtros.append(LogAuditoria.acao == acao)
    if entidade:
        filtros.append(LogAuditoria.entidade == entidade)
    if de:
        filtros.append(LogAuditoria.criado_em >= _meia_noite_utc(de))
    if ate:
        filtros.append(LogAuditoria.criado_em < _meia_noite_utc(ate + timedelta(days=1)))

    total = db.execute(
        select(func.count()).select_from(LogAuditoria).where(*filtros)
    ).scalar_one()
    linhas = db.execute(
        select(LogAuditoria, Usuario.nome, Usuario.email)
        .outerjoin(Usuario, Usuario.id == LogAuditoria.usuario_id)
        .where(*filtros)
        .order_by(LogAuditoria.criado_em.desc(), LogAuditoria.id)
        .offset(skip)
        .limit(limit)
    ).all()

    return PaginaAuditoria(
        total=total,
        skip=skip,
        limit=limit,
        itens=[
            LogAuditoriaResponse(
                id=log.id,
                usuario_id=log.usuario_id,
                usuario_nome=nome,
                usuario_email=email,
                acao=log.acao,
                entidade=log.entidade,
                entidade_id=log.entidade_id,
                ip=log.ip,
                criado_em=log.criado_em,
            )
            for log, nome, email in linhas
        ],
    )
