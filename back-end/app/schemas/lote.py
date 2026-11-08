from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, computed_field

from app.models.domain import StatusLoteEnum


class ErroLoteResponse(BaseModel):
    """Uma linha com erro no relatório de validação (RF03)."""

    id: UUID
    numero_linha: int
    campo: str
    regra_violada: str
    valor_informado: str | None = None

    model_config = ConfigDict(from_attributes=True)


class LoteResponse(BaseModel):
    id: UUID
    nome_arquivo: str
    status: StatusLoteEnum
    usuario_id: UUID
    total_registros: int
    total_importados: int
    total_rejeitados: int
    iniciado_em: datetime | None = None
    finalizado_em: datetime | None = None
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def progresso_percentual(self) -> int:
        """Progresso do processamento (RF02): o front consulta este valor."""
        if self.status in (StatusLoteEnum.concluido, StatusLoteEnum.erro):
            return 100
        if self.total_registros <= 0:
            return 0
        processados = self.total_importados + self.total_rejeitados
        return min(100, int(processados * 100 / self.total_registros))


class UploadLoteResponse(BaseModel):
    message: str
    lote_id: UUID