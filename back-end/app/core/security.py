import base64
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache

import bcrypt
import jwt
from fastapi import Response

from app.core.config import settings

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"
ACCESS_COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"

# Aliases mantidos para não quebrar imports existentes (auth.py, testes).
SECRET_KEY = settings.jwt_secret
ALGORITHM = settings.jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes
REFRESH_TOKEN_EXPIRE_DAYS = settings.refresh_token_expire_days

_BCRYPT_MAX_BYTES = 72


# --------------------------------------------------------------------------
# Senhas
# --------------------------------------------------------------------------
def _preparar_senha(password: str) -> bytes:
    """O bcrypt 5.x lança ValueError para senhas com mais de 72 bytes.

    Senhas longas passam por SHA-256 antes. Senhas até 72 bytes seguem como
    estavam, então os hashes já gravados (ex.: do seed) continuam válidos.
    """
    raw = password.encode("utf-8")
    if len(raw) > _BCRYPT_MAX_BYTES:
        raw = base64.b64encode(hashlib.sha256(raw).digest())
    return raw


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)  # custo 12, conforme o RFC
    return bcrypt.hashpw(_preparar_senha(password), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            _preparar_senha(plain_password), hashed_password.encode("utf-8")
        )
    except (ValueError, TypeError):  # hash malformado ou ausente
        return False


@lru_cache(maxsize=1)
def _hash_falso() -> str:
    return get_password_hash("senha-inexistente")


def verify_password_dummy(plain_password: str) -> None:
    """Gasta o mesmo tempo de uma verificação real.

    Chame quando o e-mail não existir, para que o tempo de resposta não revele
    quais e-mails estão cadastrados (enumeração de usuários).
    """
    verify_password(plain_password, _hash_falso())


# --------------------------------------------------------------------------
# Tokens JWT
# --------------------------------------------------------------------------
def _criar_token(data: dict, token_type: str, expires_delta: timedelta) -> str:
    agora = datetime.now(timezone.utc)
    payload = {
        **data,
        "type": token_type,
        "iat": agora,
        "exp": agora + expires_delta,
        "jti": uuid.uuid4().hex,  # id único: permite revogar no logout
        # O "iat" padrão tem precisão de segundos; este permite invalidar as
        # sessões antigas de um usuário sem derrubar as que acabaram de nascer.
        "emitido_ms": int(agora.timestamp() * 1000),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(data: dict) -> str:
    return _criar_token(
        data, ACCESS_TOKEN_TYPE, timedelta(minutes=settings.access_token_expire_minutes)
    )


def create_refresh_token(data: dict) -> str:
    return _criar_token(
        data, REFRESH_TOKEN_TYPE, timedelta(days=settings.refresh_token_expire_days)
    )


def decode_token(token: str, expected_type: str = ACCESS_TOKEN_TYPE) -> dict:
    """Valida assinatura, expiração, claims obrigatórias e o tipo do token.

    Lança `jwt.InvalidTokenError` (ou subclasse, como ExpiredSignatureError).
    O tipo impede usar um refresh token como access token, e vice-versa.
    """
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        options={"require": ["exp", "iat", "sub", "jti", "type"]},
    )
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("Tipo de token inválido.")
    return payload


# --------------------------------------------------------------------------
# Cookies httpOnly
# --------------------------------------------------------------------------
def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    comuns = {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": settings.cookie_samesite,
    }
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access_token,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
        **comuns,
    )
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=settings.refresh_token_expire_days * 86400,
        path=settings.refresh_cookie_path,
        **comuns,
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(REFRESH_COOKIE_NAME, path=settings.refresh_cookie_path)
