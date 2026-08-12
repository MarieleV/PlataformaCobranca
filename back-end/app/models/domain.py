import uuid
from sqlalchemy import Column, String, Integer, Numeric, Date, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
import enum

# --- Enums Baseados no RFC ---
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

# --- Modelos ORM ---

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    cargo = Column(Enum(CargoEnum), nullable=False)

    lotes = relationship("Lote", back_populates="usuario")
    regras = relationship("RegraColecao", back_populates="usuario")


class Lote(Base):
    __tablename__ = "lotes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    nome_arquivo = Column(String(255), nullable=False)
    status = Column(Enum(StatusLoteEnum), default=StatusLoteEnum.pendente)

    usuario = relationship("Usuario", back_populates="lotes")
    erros = relationship("ErroLote", back_populates="lote", cascade="all, delete-orphan")
    devedores = relationship("Devedor", back_populates="lote")


class ErroLote(Base):
    __tablename__ = "erro_lote"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lote_id = Column(UUID(as_uuid=True), ForeignKey("lotes.id", ondelete="CASCADE"), nullable=False)
    numero_linha = Column(Integer, nullable=False)
    campo = Column(String(100), nullable=False)
    error_message = Column(String(500), nullable=False)

    lote = relationship("Lote", back_populates="erros")


class Devedor(Base):
    __tablename__ = "devedores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lote_id = Column(UUID(as_uuid=True), ForeignKey("lotes.id"), nullable=False)
    cpf_cnpj = Column(String(18), nullable=False)
    nome = Column(String(255), nullable=False)
    email = Column(String(255))
    telefone = Column(String(20))
    valor_divida = Column(Numeric(15, 2), nullable=False)
    venc_orig_date = Column(Date, nullable=False)
    status = Column(Enum(StatusDevedorEnum), default=StatusDevedorEnum.ativo)

    lote = relationship("Lote", back_populates="devedores")
    comunicacoes = relationship("Comunicacao", back_populates="devedor")


class RegraColecao(Base):
    __tablename__ = "regras_colecao"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False)
    dias_atraso = Column(Integer, nullable=False)
    canal = Column(Enum(CanalEnum), nullable=False)

    usuario = relationship("Usuario", back_populates="regras")


class Comunicacao(Base):
    __tablename__ = "comunicacoes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    devedor_id = Column(UUID(as_uuid=True), ForeignKey("devedores.id"), nullable=False)
    regra_id = Column(UUID(as_uuid=True), ForeignKey("regras_colecao.id"), nullable=False)
    canal = Column(Enum(CanalEnum), nullable=False)
    
    devedor = relationship("Devedor", back_populates="comunicacoes")