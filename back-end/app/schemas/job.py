from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, computed_field

from app.models.domain import CanalEnum, StatusComunicacaoEnum, StatusJobEnum


class JobResponse(BaseModel):
    id: UUID
    regra_id: UUID
    regra_nome: str
    canal: CanalEnum
    dia_referencia: date
    status: StatusJobEnum
    total_alvos: int
    total_sucesso: int
    total_falhas: int
    inicio_em: datetime | None = None
    fim_em: datetime | None = None
    criado_em: datetime

    @computed_field
    @property
    def pendentes(self) -> int:
        return max(self.total_alvos - self.total_sucesso - self.total_falhas, 0)

    @computed_field
    @property
    def progresso_percentual(self) -> float:
        if self.total_alvos == 0:
            return 100.0
        return round((self.total_sucesso + self.total_falhas) / self.total_alvos * 100, 1)


class PaginaJobs(BaseModel):
    total: int
    skip: int
    limit: int
    itens: list[JobResponse]


class ComunicacaoDoJobResponse(BaseModel):
    id: UUID
    devedor_id: UUID
    devedor_nome: str
    canal: CanalEnum
    status: StatusComunicacaoEnum
    tentativas: int
    proxima_tentativa_em: datetime | None = None
    codigo_erro: str | None = None
    mensagem_erro: str | None = None
    enviado_em: datetime | None = None
    criado_em: datetime


class PaginaComunicacoesDoJob(BaseModel):
    total: int
    skip: int
    limit: int
    itens: list[ComunicacaoDoJobResponse]
