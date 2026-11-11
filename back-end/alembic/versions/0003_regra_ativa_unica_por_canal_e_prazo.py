"""uma regra ativa por canal e prazo de atraso

Revision ID: 0003
Revises: 0002
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_regras_ativas_canal_dias",
        "regras_cobranca",
        ["canal", "dias_atraso"],
        unique=True,
        postgresql_where=sa.text("ativa"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_regras_ativas_canal_dias",
        table_name="regras_cobranca",
        postgresql_where=sa.text("ativa"),
    )
