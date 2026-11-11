"""job por regra e por dia (trava contra disparo em duplicidade)

Revision ID: 0004
Revises: 0003
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("dia_referencia", sa.Date(), nullable=True))
    # Jobs já existentes (se houver): o dia de criação, em horário de Brasília
    op.execute(
        "UPDATE jobs SET dia_referencia = (criado_em AT TIME ZONE 'America/Sao_Paulo')::date"
    )
    op.alter_column("jobs", "dia_referencia", nullable=False)
    op.create_unique_constraint("uq_jobs_regra_dia", "jobs", ["regra_id", "dia_referencia"])


def downgrade() -> None:
    op.drop_constraint("uq_jobs_regra_dia", "jobs", type_="unique")
    op.drop_column("jobs", "dia_referencia")
