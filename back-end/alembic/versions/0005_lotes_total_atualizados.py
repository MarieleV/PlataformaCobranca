"""lotes.total_atualizados (reimportação atualiza devedores existentes)

Revision ID: 0005
Revises: 0004
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "lotes",
        sa.Column("total_atualizados", sa.Integer(), nullable=False, server_default="0"),
    )
    # O default fica só no modelo (o ORM sempre informa o valor)
    op.alter_column("lotes", "total_atualizados", server_default=None)


def downgrade() -> None:
    op.drop_column("lotes", "total_atualizados")
