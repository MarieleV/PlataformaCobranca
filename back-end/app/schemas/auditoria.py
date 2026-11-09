from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class LogAuditoriaResponse(BaseModel):
    id: UUID
    usuario_id: UUID | None = None
    usuario_nome: str | None = None
    usuario_email: str | None = None
    acao: str
    entidade: str | None = None
    entidade_id: UUID | None = None
    ip: str | None = None
    criado_em: datetime


class PaginaAuditoria(BaseModel):
    total: int
    skip: int
    limit: int
    itens: list[LogAuditoriaResponse]
