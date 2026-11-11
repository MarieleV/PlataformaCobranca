import re
from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    model_validator,
)

from app.models.domain import CargoEnum, Usuario


def _validar_forca_da_senha(senha: str) -> str:
    if not re.search(r"[A-Za-z]", senha) or not re.search(r"\d", senha):
        raise ValueError("A senha deve ter ao menos uma letra e um número")
    return senha


# 8 a 128 caracteres (o limite superior evita abuso do bcrypt com textos enormes)
SenhaForte = Annotated[
    str,
    Field(min_length=8, max_length=128),
    AfterValidator(_validar_forca_da_senha),
]

NomeUsuario = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=150)]


class UsuarioCreate(BaseModel):
    nome: NomeUsuario
    email: EmailStr
    senha: SenhaForte
    perfil: CargoEnum = CargoEnum.operador


class UsuarioUpdate(BaseModel):
    nome: NomeUsuario | None = None
    email: EmailStr | None = None
    perfil: CargoEnum | None = None

    @model_validator(mode="after")
    def _ao_menos_um_campo(self) -> "UsuarioUpdate":
        if self.nome is None and self.email is None and self.perfil is None:
            raise ValueError("Informe ao menos um campo para alterar")
        return self


class RedefinirSenhaRequest(BaseModel):
    nova_senha: SenhaForte


class UsuarioResponse(BaseModel):
    id: UUID
    nome: str
    email: str
    perfil: CargoEnum
    ativo: bool
    criado_por: UUID | None = None
    criado_em: datetime
    atualizado_em: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def de_modelo(cls, usuario: Usuario) -> "UsuarioResponse":
        return cls(
            id=usuario.id,
            nome=usuario.nome,
            email=usuario.email,
            perfil=usuario.cargo,
            ativo=usuario.ativo,
            criado_por=usuario.criado_por,
            criado_em=usuario.criado_em,
            atualizado_em=usuario.atualizado_em,
        )


class PaginaUsuarios(BaseModel):
    total: int
    skip: int
    limit: int
    itens: list[UsuarioResponse]
