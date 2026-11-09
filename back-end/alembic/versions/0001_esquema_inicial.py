"""esquema inicial

Cria todas as tabelas, tipos enumerados e índices do RFC v1.1 (seção 5.2).

Revision ID: 0001
Revises: 
Create Date: 2026-11-09 13:47:51.018798
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('usuarios',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('nome', sa.String(length=150), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('senha_hash', sa.String(length=255), nullable=False),
    sa.Column('cargo', sa.Enum('operador', 'gestor', 'administrador', name='cargo_usuario'), nullable=False),
    sa.Column('ativo', sa.Boolean(), nullable=False),
    sa.Column('criado_por', sa.UUID(), nullable=True),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['criado_por'], ['usuarios.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_usuarios_email'), 'usuarios', ['email'], unique=True)
    op.create_table('logs_auditoria',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('usuario_id', sa.UUID(), nullable=True),
    sa.Column('acao', sa.String(length=100), nullable=False),
    sa.Column('entidade', sa.String(length=50), nullable=True),
    sa.Column('entidade_id', sa.UUID(), nullable=True),
    sa.Column('ip', sa.String(length=45), nullable=True),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_auditoria_criado_em', 'logs_auditoria', [sa.literal_column('criado_em DESC')], unique=False)
    op.create_index('idx_auditoria_entidade', 'logs_auditoria', ['entidade', 'entidade_id'], unique=False)
    op.create_index('idx_auditoria_usuario', 'logs_auditoria', ['usuario_id', sa.literal_column('criado_em DESC')], unique=False)
    op.create_table('lotes',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('usuario_id', sa.UUID(), nullable=False),
    sa.Column('nome_arquivo', sa.String(length=255), nullable=False),
    sa.Column('status', sa.Enum('pendente', 'processando', 'concluido', 'erro', name='status_lote'), nullable=False),
    sa.Column('total_registros', sa.Integer(), nullable=False),
    sa.Column('total_importados', sa.Integer(), nullable=False),
    sa.Column('total_rejeitados', sa.Integer(), nullable=False),
    sa.Column('iniciado_em', sa.DateTime(timezone=True), nullable=True),
    sa.Column('finalizado_em', sa.DateTime(timezone=True), nullable=True),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_lotes_criado_em', 'lotes', [sa.literal_column('criado_em DESC')], unique=False)
    op.create_index('idx_lotes_usuario', 'lotes', ['usuario_id'], unique=False)
    op.create_table('regras_cobranca',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('usuario_id', sa.UUID(), nullable=False),
    sa.Column('nome', sa.String(length=150), nullable=False),
    sa.Column('dias_atraso', sa.Integer(), nullable=False),
    sa.Column('canal', sa.Enum('email', 'sms', 'whatsapp', name='canal_disparo'), nullable=False),
    sa.Column('template_mensagem', sa.Text(), nullable=False),
    sa.Column('horario_disparo', sa.Time(), nullable=False),
    sa.Column('ativa', sa.Boolean(), nullable=False),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('dias_atraso > 0', name='ck_regra_dias_atraso'),
    sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_regras_ativa_dias', 'regras_cobranca', ['ativa', 'dias_atraso'], unique=False)
    op.create_table('devedores',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('lote_id', sa.UUID(), nullable=False),
    sa.Column('cpf_cnpj', sa.String(length=18), nullable=False),
    sa.Column('nome', sa.String(length=255), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('telefone', sa.String(length=20), nullable=True),
    sa.Column('whatsapp', sa.String(length=20), nullable=True),
    sa.Column('valor_divida_enc', sa.LargeBinary(), nullable=False),
    sa.Column('data_vencimento', sa.Date(), nullable=False),
    sa.Column('status', sa.Enum('ativo', 'comunicado', 'negociando', 'quitado', 'inativo', name='status_devedor'), nullable=False),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('atualizado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['lote_id'], ['lotes.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('cpf_cnpj')
    )
    op.create_index('idx_devedores_lote', 'devedores', ['lote_id'], unique=False)
    op.create_index('idx_devedores_status_vencimento', 'devedores', ['status', 'data_vencimento'], unique=False)
    op.create_table('erros_lote',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('lote_id', sa.UUID(), nullable=False),
    sa.Column('numero_linha', sa.Integer(), nullable=False),
    sa.Column('campo', sa.String(length=100), nullable=False),
    sa.Column('regra_violada', sa.String(length=500), nullable=False),
    sa.Column('valor_informado', sa.String(length=500), nullable=True),
    sa.ForeignKeyConstraint(['lote_id'], ['lotes.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_erros_lote_lote_linha', 'erros_lote', ['lote_id', 'numero_linha'], unique=False)
    op.create_table('jobs',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('regra_id', sa.UUID(), nullable=False),
    sa.Column('lote_id', sa.UUID(), nullable=True),
    sa.Column('status', sa.Enum('agendado', 'executando', 'concluido', 'falhou', name='status_job'), nullable=False),
    sa.Column('total_alvos', sa.Integer(), nullable=False),
    sa.Column('total_sucesso', sa.Integer(), nullable=False),
    sa.Column('total_falhas', sa.Integer(), nullable=False),
    sa.Column('inicio_em', sa.DateTime(timezone=True), nullable=True),
    sa.Column('fim_em', sa.DateTime(timezone=True), nullable=True),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['lote_id'], ['lotes.id'], ),
    sa.ForeignKeyConstraint(['regra_id'], ['regras_cobranca.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_jobs_regra', 'jobs', ['regra_id'], unique=False)
    op.create_index('idx_jobs_status_criado', 'jobs', ['status', sa.literal_column('criado_em DESC')], unique=False)
    op.create_table('comunicacoes',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('devedor_id', sa.UUID(), nullable=False),
    sa.Column('job_id', sa.UUID(), nullable=False),
    sa.Column('canal', sa.Enum('email', 'sms', 'whatsapp', name='canal_disparo'), nullable=False),
    sa.Column('status', sa.Enum('pendente', 'enviado', 'entregue', 'falha', 'bounce', name='status_comunicacao'), nullable=False),
    sa.Column('tentativas', sa.SmallInteger(), nullable=False),
    sa.Column('proxima_tentativa_em', sa.DateTime(timezone=True), nullable=True),
    sa.Column('codigo_erro', sa.String(length=50), nullable=True),
    sa.Column('mensagem_erro', sa.String(length=500), nullable=True),
    sa.Column('id_externo', sa.String(length=100), nullable=True),
    sa.Column('enviado_em', sa.DateTime(timezone=True), nullable=True),
    sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['devedor_id'], ['devedores.id'], ),
    sa.ForeignKeyConstraint(['job_id'], ['jobs.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_comunicacoes_devedor', 'comunicacoes', ['devedor_id', sa.literal_column('criado_em DESC')], unique=False)
    op.create_index('idx_comunicacoes_job', 'comunicacoes', ['job_id'], unique=False)
    op.create_index('idx_comunicacoes_reenvio', 'comunicacoes', ['proxima_tentativa_em'], unique=False, postgresql_where=sa.text("status IN ('pendente', 'falha')"))


def downgrade() -> None:
    op.drop_index('idx_comunicacoes_reenvio', table_name='comunicacoes', postgresql_where=sa.text("status IN ('pendente', 'falha')"))
    op.drop_index('idx_comunicacoes_job', table_name='comunicacoes')
    op.drop_index('idx_comunicacoes_devedor', table_name='comunicacoes')
    op.drop_table('comunicacoes')
    op.drop_index('idx_jobs_status_criado', table_name='jobs')
    op.drop_index('idx_jobs_regra', table_name='jobs')
    op.drop_table('jobs')
    op.drop_index('idx_erros_lote_lote_linha', table_name='erros_lote')
    op.drop_table('erros_lote')
    op.drop_index('idx_devedores_status_vencimento', table_name='devedores')
    op.drop_index('idx_devedores_lote', table_name='devedores')
    op.drop_table('devedores')
    op.drop_index('idx_regras_ativa_dias', table_name='regras_cobranca')
    op.drop_table('regras_cobranca')
    op.drop_index('idx_lotes_usuario', table_name='lotes')
    op.drop_index('idx_lotes_criado_em', table_name='lotes')
    op.drop_table('lotes')
    op.drop_index('idx_auditoria_usuario', table_name='logs_auditoria')
    op.drop_index('idx_auditoria_entidade', table_name='logs_auditoria')
    op.drop_index('idx_auditoria_criado_em', table_name='logs_auditoria')
    op.drop_table('logs_auditoria')
    op.drop_index(op.f('ix_usuarios_email'), table_name='usuarios')
    op.drop_table('usuarios')

    # O DROP TABLE não remove os tipos enumerados do PostgreSQL
    for tipo in (
        'status_comunicacao', 'canal_disparo', 'status_job',
        'status_devedor', 'status_lote', 'cargo_usuario',
    ):
        op.execute(f'DROP TYPE IF EXISTS {tipo}')
