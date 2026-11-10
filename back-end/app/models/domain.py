"""Models ORM da Plataforma de Cobrança.

Alinhados ao modelo de dados padronizado do RFC v1.1 (seção 5.2):
nomes em português, snake_case, tabelas no plural.
"""
import enum
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import time

from app.core.database import Base
from app.core.datas import hoje


# --------------------------------------------------------------------------
# Enums (valores idênticos ao RFC; nomes dos tipos no PostgreSQL padronizados)
# --------------------------------------------------------------------------
class CargoEnum(str, enum.Enum):
    operador = "operador"
    gestor = "gestor"
    administrador = "administrador"


class StatusLoteEnum(str, enum.Enum):
    pendente = "pendente"
    processando = "processando"
    concluido = "concluido"
    erro = "erro"


class CanalEnum(str, enum.Enum):
    email = "email"
    sms = "sms"
    whatsapp = "whatsapp"


class StatusDevedorEnum(str, enum.Enum):
    ativo = "ativo"
    comunicado = "comunicado"
    negociando = "negociando"
    quitado = "quitado"
    inativo = "inativo"


class StatusJobEnum(str, enum.Enum):
    agendado = "agendado"
    executando = "executando"
    concluido = "concluido"
    falhou = "falhou"


class StatusComunicacaoEnum(str, enum.Enum):
    pendente = "pendente"
    enviado = "enviado"
    entregue = "entregue"
    falha = "falha"
    bounce = "bounce"


def _enum(enum_cls: type[enum.Enum], nome_tipo: str) -> Enum:
    """Enum do PostgreSQL gravando o *valor* (e não o nome) do membro."""
    return Enum(
        enum_cls,
        name=nome_tipo,
        values_callable=lambda membros: [m.value for m in membros],
    )


def _uuid_pk() -> Column:
    return Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _criado_em() -> Column:
    return Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


# --------------------------------------------------------------------------
# Modelos
# --------------------------------------------------------------------------
class Usuario(Base):
    __tablename__ = "usuarios"

    id = _uuid_pk()
    nome = Column(String(150), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    senha_hash = Column(String(255), nullable=False)
    cargo = Column(
        _enum(CargoEnum, "cargo_usuario"), nullable=False, default=CargoEnum.operador
    )
    ativo = Column(Boolean, nullable=False, default=True)
    # Quem criou este usuário (rastreabilidade do UC07)
    # SET NULL: excluir quem criou não pode apagar nem bloquear os criados.
    criado_por = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL", name="fk_usuarios_criado_por"),
        nullable=True,
    )
    criado_em = _criado_em()
    atualizado_em = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    lotes = relationship("Lote", back_populates="usuario")
    regras = relationship("RegraCobranca", back_populates="usuario")


class Lote(Base):
    __tablename__ = "lotes"
    __table_args__ = (
        Index("idx_lotes_usuario", "usuario_id"),
        Index("idx_lotes_criado_em", text("criado_em DESC")),
    )

    id = _uuid_pk()
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    nome_arquivo = Column(String(255), nullable=False)
    status = Column(
        _enum(StatusLoteEnum, "status_lote"),
        nullable=False,
        default=StatusLoteEnum.pendente,
    )
    # Contadores: o dashboard não precisa de COUNT(*) pesado
    total_registros = Column(Integer, nullable=False, default=0)
    total_importados = Column(Integer, nullable=False, default=0)
    total_rejeitados = Column(Integer, nullable=False, default=0)
    iniciado_em = Column(DateTime(timezone=True))
    finalizado_em = Column(DateTime(timezone=True))
    criado_em = _criado_em()

    usuario = relationship("Usuario", back_populates="lotes")
    erros = relationship(
        "ErroLote", back_populates="lote", cascade="all, delete-orphan"
    )
    devedores = relationship("Devedor", back_populates="lote")
    jobs = relationship("Job", back_populates="lote")


class ErroLote(Base):
    __tablename__ = "erros_lote"
    __table_args__ = (
        Index("idx_erros_lote_lote_linha", "lote_id", "numero_linha"),
    )

    id = _uuid_pk()
    lote_id = Column(
        UUID(as_uuid=True), ForeignKey("lotes.id", ondelete="CASCADE"), nullable=False
    )
    numero_linha = Column(Integer, nullable=False)
    campo = Column(String(100), nullable=False)
    regra_violada = Column(String(500), nullable=False)
    valor_informado = Column(String(500))

    lote = relationship("Lote", back_populates="erros")


class Devedor(Base):
    __tablename__ = "devedores"
    __table_args__ = (
        Index("idx_devedores_status_vencimento", "status", "data_vencimento"),
        Index("idx_devedores_lote", "lote_id"),
    )

    id = _uuid_pk()
    lote_id = Column(UUID(as_uuid=True), ForeignKey("lotes.id"), nullable=False)
    # Guarde apenas os dígitos (11 para CPF, 14 para CNPJ) para a unicidade
    # funcionar independentemente da máscara usada no arquivo.
    cpf_cnpj = Column(String(18), unique=True, nullable=False)
    nome = Column(String(255), nullable=False)
    email = Column(String(255))
    telefone = Column(String(20))
    whatsapp = Column(String(20))
    # Criptografado em nível de aplicação (app.core.crypto). Impede SUM em SQL:
    # totais financeiros são calculados na aplicação.
    valor_divida_enc = Column(LargeBinary, nullable=False)
    # Em claro, para o cálculo de atraso usar índice
    data_vencimento = Column(Date, nullable=False)
    status = Column(
        _enum(StatusDevedorEnum, "status_devedor"),
        nullable=False,
        default=StatusDevedorEnum.ativo,
    )
    criado_em = _criado_em()
    atualizado_em = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    lote = relationship("Lote", back_populates="devedores")
    comunicacoes = relationship("Comunicacao", back_populates="devedor")


class RegraCobranca(Base):
    __tablename__ = "regras_cobranca"
    __table_args__ = (
        CheckConstraint("dias_atraso > 0", name="ck_regra_dias_atraso"),
        Index("idx_regras_ativa_dias", "ativa", "dias_atraso"),
        # Duas regras ativas para o mesmo canal e prazo mandariam a mesma
        # mensagem duas vezes (e a RN03 barraria a segunda): só uma por par.
        Index(
            "uq_regras_ativas_canal_dias",
            "canal",
            "dias_atraso",
            unique=True,
            postgresql_where=text("ativa"),
            sqlite_where=text("ativa"),
        ),
    )

    id = _uuid_pk()
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    nome = Column(String(150), nullable=False)
    dias_atraso = Column(Integer, nullable=False)
    canal = Column(_enum(CanalEnum, "canal_disparo"), nullable=False)
    template_mensagem = Column(Text, nullable=False)
    horario_disparo = Column(Time, nullable=False, default=time(9, 0))
    # Nasce desativada: nada é enviado até alguém ativar a regra (RN02)
    ativa = Column(Boolean, nullable=False, default=False)
    criado_em = _criado_em()

    usuario = relationship("Usuario", back_populates="regras")
    jobs = relationship("Job", back_populates="regra")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        # Um job por regra e por dia: a trava contra disparo em duplicidade
        UniqueConstraint("regra_id", "dia_referencia", name="uq_jobs_regra_dia"),
        Index("idx_jobs_regra", "regra_id"),
        Index("idx_jobs_status_criado", "status", text("criado_em DESC")),
    )

    id = _uuid_pk()
    regra_id = Column(
        UUID(as_uuid=True), ForeignKey("regras_cobranca.id"), nullable=False
    )
    # Dia (em Brasília) a que o job se refere: define quem era elegível
    dia_referencia = Column(Date, nullable=False, default=hoje)
    # Nulo = job da régua geral (não vinculado a um lote específico)
    lote_id = Column(UUID(as_uuid=True), ForeignKey("lotes.id"), nullable=True)
    status = Column(
        _enum(StatusJobEnum, "status_job"),
        nullable=False,
        default=StatusJobEnum.agendado,
    )
    total_alvos = Column(Integer, nullable=False, default=0)
    total_sucesso = Column(Integer, nullable=False, default=0)
    total_falhas = Column(Integer, nullable=False, default=0)
    inicio_em = Column(DateTime(timezone=True))
    fim_em = Column(DateTime(timezone=True))
    criado_em = _criado_em()

    regra = relationship("RegraCobranca", back_populates="jobs")
    lote = relationship("Lote", back_populates="jobs")
    comunicacoes = relationship("Comunicacao", back_populates="job")


class Comunicacao(Base):
    __tablename__ = "comunicacoes"
    __table_args__ = (
        Index("idx_comunicacoes_devedor", "devedor_id", text("criado_em DESC")),
        Index("idx_comunicacoes_job", "job_id"),
        # Fila de reenvios (RN07): só as comunicações ainda por tentar
        Index(
            "idx_comunicacoes_reenvio",
            "proxima_tentativa_em",
            postgresql_where=text("status IN ('pendente', 'falha')"),
        ),
    )

    id = _uuid_pk()
    devedor_id = Column(UUID(as_uuid=True), ForeignKey("devedores.id"), nullable=False)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    canal = Column(_enum(CanalEnum, "canal_disparo"), nullable=False)
    status = Column(
        _enum(StatusComunicacaoEnum, "status_comunicacao"),
        nullable=False,
        default=StatusComunicacaoEnum.pendente,
    )
    tentativas = Column(SmallInteger, nullable=False, default=0)  # RN07
    proxima_tentativa_em = Column(DateTime(timezone=True))
    codigo_erro = Column(String(50))
    mensagem_erro = Column(String(500))
    id_externo = Column(String(100))  # id da mensagem no SendGrid/Twilio
    enviado_em = Column(DateTime(timezone=True))
    criado_em = _criado_em()

    devedor = relationship("Devedor", back_populates="comunicacoes")
    job = relationship("Job", back_populates="comunicacoes")


class LogAuditoria(Base):
    """Log de auditoria de acessos e ações (UC07-A5 / RF11, exclusivo do admin)."""

    __tablename__ = "logs_auditoria"
    __table_args__ = (
        Index("idx_auditoria_criado_em", text("criado_em DESC")),
        Index("idx_auditoria_usuario", "usuario_id", text("criado_em DESC")),
        Index("idx_auditoria_entidade", "entidade", "entidade_id"),
    )

    id = _uuid_pk()
    # SET NULL: o registro sobrevive à exclusão do usuário (a própria exclusão
    # fica auditada, com o id do usuário removido em entidade_id).
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL", name="fk_logs_auditoria_usuario"),
        nullable=True,
    )
    acao = Column(String(100), nullable=False)
    entidade = Column(String(50))
    entidade_id = Column(UUID(as_uuid=True))
    ip = Column(String(45))  # cabe IPv6
    criado_em = _criado_em()
