"""Registro no log de auditoria (UC07-A5 / RF11).

Não faz commit: o chamador decide, para o registro entrar na mesma transação
da ação auditada.
"""
import uuid

from sqlalchemy.orm import Session

from app.models.domain import LogAuditoria


def registrar_auditoria(
    db: Session,
    usuario_id: uuid.UUID | None,
    acao: str,
    entidade: str | None = None,
    entidade_id: uuid.UUID | None = None,
    ip: str | None = None,
) -> None:
    db.add(
        LogAuditoria(
            usuario_id=usuario_id,
            acao=acao,
            entidade=entidade,
            entidade_id=entidade_id,
            ip=ip,
        )
    )