from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.domain import CargoEnum


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UsuarioAutenticado(BaseModel):
    id: UUID
    nome: str
    email: str
    perfil: CargoEnum

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def de_modelo(cls, usuario) -> "UsuarioAutenticado":
        return cls(
            id=usuario.id, nome=usuario.nome, email=usuario.email, perfil=usuario.cargo
        )


class LoginResponse(BaseModel):
    message: str
    user: UsuarioAutenticado


class MensagemResponse(BaseModel):
    message: str