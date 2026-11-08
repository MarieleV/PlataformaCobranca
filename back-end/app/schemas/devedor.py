from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.core.crypto import descriptografar_decimal
from app.core.datas import hoje
from app.models.domain import (
    CanalEnum,
    Devedor,
    StatusComunicacaoEnum,
    StatusDevedorEnum,
)


class DevedorResponse(BaseModel):
    id: UUID
    lote_id: UUID
    cpf_cnpj: str
    nome: str
    email: str | None = None
    telefone: str | None = None
    whatsapp: str | None = None
    valor_divida: Decimal
    data_vencimento: date
    dias_atraso: int
    status: StatusDevedorEnum
    criado_em: datetime

    @classmethod
    def de_modelo(cls, devedor: Devedor) -> "DevedorResponse":
        # O valor fica criptografado no banco: é descriptografado só aqui
        return cls(
            id=devedor.id,
            lote_id=devedor.lote_id,
            cpf_cnpj=devedor.cpf_cnpj,
            nome=devedor.nome,
            email=devedor.email,
            telefone=devedor.telefone,
            whatsapp=devedor.whatsapp,
            valor_divida=descriptografar_decimal(devedor.valor_divida_enc),
            data_vencimento=devedor.data_vencimento,
            dias_atraso=max((hoje() - devedor.data_vencimento).days, 0),
            status=devedor.status,
            criado_em=devedor.criado_em,
        )


class PaginaDevedores(BaseModel):
    total: int
    skip: int
    limit: int
    itens: list[DevedorResponse]


class ComunicacaoResponse(BaseModel):
    """Histórico de comunicações por devedor (UC06)."""

    id: UUID
    job_id: UUID
    canal: CanalEnum
    status: StatusComunicacaoEnum
    tentativas: int
    enviado_em: datetime | None = None
    codigo_erro: str | None = None
    mensagem_erro: str | None = None
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)