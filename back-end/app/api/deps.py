import uuid

import jwt
import redis
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.redis_client import token_revogado
from app.core.security import ACCESS_COOKIE_NAME, ACCESS_TOKEN_TYPE, decode_token
from app.models.domain import Usuario


def get_token(request: Request) -> str:
    """Extrai o access token do cookie httpOnly (ou do header Authorization)."""
    token = request.cookies.get(ACCESS_COOKIE_NAME)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[len("Bearer "):]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado"
        )
    return token


def get_current_user(
    token: str = Depends(get_token), db: Session = Depends(get_db)
) -> Usuario:
    credenciais_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
    )

    try:
        payload = decode_token(token, ACCESS_TOKEN_TYPE)
        usuario_id = uuid.UUID(payload["sub"])
    except (jwt.InvalidTokenError, ValueError):
        raise credenciais_invalidas

    try:
        if token_revogado(payload["jti"]):  # token invalidado pelo logout
            raise credenciais_invalidas
    except redis.RedisError:
        # Sem o Redis não dá para garantir que o token não foi revogado
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço de sessão indisponível",
        )

    # O cargo vem sempre do banco, nunca do token: se o admin alterar o perfil
    # ou desativar o usuário, vale na hora.
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise credenciais_invalidas
    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Usuário inativo"
        )
    return usuario


def role_required(allowed_roles: list[str]):
    """Controle de acesso por perfil (RBAC)."""

    def role_checker(current_user: Usuario = Depends(get_current_user)) -> Usuario:
        if current_user.cargo.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: Perfil de acesso insuficiente",
            )
        return current_user

    return role_checker