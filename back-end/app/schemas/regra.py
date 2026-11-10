from datetime import datetime, time
from typing import Annotated
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.core.config import settings
from app.core.templates import TemplateInvalido, validar_template
from app.models.domain import CanalEnum, RegraCobranca

NomeRegra = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=150)]
DiasAtraso = Annotated[int, Field(ge=1, le=365)]


def validar_horario_na_janela(horario: time) -> time:
    """RN05: os disparos só acontecem entre 08h e 20h (horário de Brasília)."""
    inicio, fim = time(settings.janela_inicio_hora), time(settings.janela_fim_hora)
    if not (inicio <= horario < fim):
        raise ValueError(
            f"O horário deve estar entre {inicio:%H:%M} e {fim:%H:%M} (janela de disparo)"
        )
    return horario


class RegraCreate(BaseModel):
    nome: NomeRegra
    dias_atraso: DiasAtraso
    canal: CanalEnum
    template_mensagem: str
    horario_disparo: time = time(9, 0)
    ativa: bool = False  # nasce desativada: só dispara depois de ativada (RN02)

    @field_validator("horario_disparo")
    @classmethod
    def _horario(cls, valor: time) -> time:
        return validar_horario_na_janela(valor)

    @model_validator(mode="after")
    def _template(self) -> "RegraCreate":
        try:
            validar_template(self.template_mensagem, self.canal)
        except TemplateInvalido as erro:
            raise ValueError(str(erro))
        return self


class RegraUpdate(BaseModel):
    nome: NomeRegra | None = None
    dias_atraso: DiasAtraso | None = None
    canal: CanalEnum | None = None
    template_mensagem: str | None = None
    horario_disparo: time | None = None

    @field_validator("horario_disparo")
    @classmethod
    def _horario(cls, valor: time | None) -> time | None:
        return None if valor is None else validar_horario_na_janela(valor)

    @model_validator(mode="after")
    def _ao_menos_um_campo(self) -> "RegraUpdate":
        if all(getattr(self, campo) is None for campo in type(self).model_fields):
            raise ValueError("Informe ao menos um campo para alterar")
        return self


class RegraResponse(BaseModel):
    id: UUID
    usuario_id: UUID
    nome: str
    dias_atraso: int
    canal: CanalEnum
    template_mensagem: str
    horario_disparo: time
    ativa: bool
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def de_modelo(cls, regra: RegraCobranca) -> "RegraResponse":
        return cls.model_validate(regra)


class StatusReguaResponse(BaseModel):
    regua_ativa: bool
    regras_ativas: int
    total_regras: int
    mensagem: str


class VariavelResponse(BaseModel):
    nome: str
    placeholder: str
    descricao: str
    exemplo: str


class PreviewRequest(BaseModel):
    template_mensagem: str
    canal: CanalEnum = CanalEnum.email
    devedor_id: UUID | None = Field(
        None, description="Usa os dados deste devedor; sem ele, usa dados de exemplo"
    )


class PreviewResponse(BaseModel):
    mensagem: str
    tamanho: int
    limite: int
    variaveis_usadas: list[str]
