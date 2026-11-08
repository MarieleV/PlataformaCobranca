import uuid

import jwt
import redis
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.auditoria import registrar_auditoria
from app.core.database import get_db
from app.core.rate_limit import (
    limpar_falhas_login,
    registrar_falha_login,
    verificar_limite_login,
)
from app.core.redis_client import revogar_token, token_revogado
from app.core.security import (
    ACCESS_COOKIE_NAME,
    ACCESS_TOKEN_TYPE,
    REFRESH_COOKIE_NAME,
    REFRESH_TOKEN_TYPE,
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    decode_token,
    set_auth_cookies,
    verify_password,
    verify_password_dummy,
)
from app.models.domain import Usuario
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    MensagemResponse,
    UsuarioAutenticado,
)

router = APIRouter(prefix="/auth", tags=["Autenticação"])


def _ip_cliente(request: Request) -> str:
    # Atrás do Nginx (produção), configure o uvicorn com --proxy-headers
    # para que este valor seja o IP real do usuário.
    return request.client.host if request.client else "desconhecido"


def _emitir_tokens(response: Response, usuario: Usuario) -> None:
    # "sub" é o id (imutável), não o e-mail. O cargo NÃO vai no token.
    access = create_access_token({"sub": str(usuario.id)})
    refresh = create_refresh_token({"sub": str(usuario.id)})
    set_auth_cookies(response, access, refresh)


@router.post("/login", response_model=LoginResponse)
def login(
    dados: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    email = dados.email.lower()
    ip = _ip_cliente(request)

    verificar_limite_login(ip, email)  # HTTP 429 se exceder o limite

    usuario = db.query(Usuario).filter(Usuario.email == email).first()

    if usuario is None:
        verify_password_dummy(dados.password)  # mesmo tempo de resposta
        senha_correta = False
    else:
        senha_correta = verify_password(dados.password, usuario.senha_hash)

    if not senha_correta:
        registrar_falha_login(ip, email)
        registrar_auditoria(
            db, usuario.id if usuario else None, "login_falha", "usuario",
            usuario.id if usuario else None, ip,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
        )

    if not usuario.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário inativo. O acesso foi revogado.",
        )

    limpar_falhas_login(ip, email)
    _emitir_tokens(response, usuario)
    registrar_auditoria(db, usuario.id, "login", "usuario", usuario.id, ip)
    db.commit()

    return LoginResponse(
        message="Login realizado com sucesso",
        user=UsuarioAutenticado.de_modelo(usuario),
    )


@router.post("/refresh", response_model=MensagemResponse)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    """Troca o refresh token por um novo par de tokens (com rotação)."""
    nao_autorizado = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão expirada"
    )
    token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not token:
        raise nao_autorizado

    try:
        payload = decode_token(token, REFRESH_TOKEN_TYPE)
        usuario_id = uuid.UUID(payload["sub"])
    except (jwt.InvalidTokenError, ValueError):
        raise nao_autorizado

    try:
        if token_revogado(payload["jti"]):
            raise nao_autorizado
        usuario = db.get(Usuario, usuario_id)
        if usuario is None or not usuario.ativo:
            raise nao_autorizado
        revogar_token(payload)  # rotação: o refresh usado deixa de valer
    except redis.RedisError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Serviço de sessão indisponível",
        )

    _emitir_tokens(response, usuario)
    return MensagemResponse(message="Sessão renovada")


@router.delete("/logout", response_model=MensagemResponse)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Encerra a sessão. Funciona mesmo com o access token já expirado."""
    usuario_id = None
    for cookie, tipo in (
        (ACCESS_COOKIE_NAME, ACCESS_TOKEN_TYPE),
        (REFRESH_COOKIE_NAME, REFRESH_TOKEN_TYPE),
    ):
        token = request.cookies.get(cookie)
        if not token:
            continue
        try:
            payload = decode_token(token, tipo)
            revogar_token(payload)
            usuario_id = uuid.UUID(payload["sub"])
        except (jwt.InvalidTokenError, ValueError, redis.RedisError):
            continue  # expirado/inválido: não há o que revogar

    if usuario_id:
        registrar_auditoria(
            db, usuario_id, "logout", "usuario", usuario_id, _ip_cliente(request)
        )
        db.commit()

    clear_auth_cookies(response)
    return MensagemResponse(message="Logout realizado com sucesso")


@router.get("/me", response_model=UsuarioAutenticado)
def me(current_user: Usuario = Depends(get_current_user)):
    """Dados do usuário logado (o front usa para restaurar a sessão)."""
    return UsuarioAutenticado.de_modelo(current_user)