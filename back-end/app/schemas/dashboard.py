from datetime import date

from pydantic import BaseModel, computed_field

from app.core.config import settings
from app.models.domain import CanalEnum
from app.schemas.job import JobResponse
from app.schemas.lote import LoteResponse


class ContagemResponse(BaseModel):
    disparos: int
    sucesso: int
    falhas: int
    aguardando: int
    taxa_entrega: float | None = None


class CanalKPI(ContagemResponse):
    canal: CanalEnum


class PontoTimeline(BaseModel):
    dia: date
    disparos: int
    sucesso: int
    falhas: int


class KPIsPeriodo(ContagemResponse):
    devedores_alcancados: int
    devedores_quitados: int
    taxa_conversao: float | None = None

    @computed_field
    @property
    def meta_taxa_entrega(self) -> float:
        return settings.meta_taxa_entrega


class BaseDevedores(BaseModel):
    total: int
    por_status: dict[str, int]


class DashboardResponse(BaseModel):
    dias: int
    data_inicial: date
    data_final: date
    base: BaseDevedores
    hoje: ContagemResponse
    periodo: KPIsPeriodo
    por_canal: list[CanalKPI]
    timeline: list[PontoTimeline]
    ultimos_lotes: list[LoteResponse]
    ultimos_jobs: list[JobResponse]
