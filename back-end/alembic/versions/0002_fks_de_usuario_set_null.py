"""exclusão de usuário preserva auditoria e usuários criados

logs_auditoria.usuario_id e usuarios.criado_por passam a ser ON DELETE SET NULL,
para o administrador poder excluir um usuário (UC07-A4) sem perder o histórico.

Revision ID: 0002
Revises: 0001
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("logs_auditoria_usuario_id_fkey", "logs_auditoria", type_="foreignkey")
    op.create_foreign_key(
        "fk_logs_auditoria_usuario", "logs_auditoria", "usuarios",
        ["usuario_id"], ["id"], ondelete="SET NULL",
    )
    op.drop_constraint("usuarios_criado_por_fkey", "usuarios", type_="foreignkey")
    op.create_foreign_key(
        "fk_usuarios_criado_por", "usuarios", "usuarios",
        ["criado_por"], ["id"], ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_usuarios_criado_por", "usuarios", type_="foreignkey")
    op.create_foreign_key(
        "usuarios_criado_por_fkey", "usuarios", "usuarios", ["criado_por"], ["id"]
    )
    op.drop_constraint("fk_logs_auditoria_usuario", "logs_auditoria", type_="foreignkey")
    op.create_foreign_key(
        "logs_auditoria_usuario_id_fkey", "logs_auditoria", "usuarios", ["usuario_id"], ["id"]
    )
