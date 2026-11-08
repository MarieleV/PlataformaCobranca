import time

import redis

from app.core.config import settings

_redis = redis.Redis.from_url(settings.redis_url, decode_responses=True)

_PREFIXO_REVOGADO = "jwt:revogado:"


def get_redis() -> redis.Redis:
    return _redis


def revogar_token(payload: dict) -> None:
    """Coloca o `jti` do token em lista de revogados até ele expirar.

    Use no logout e na rotação do refresh token. `payload` é o retorno de
    `decode_token`.
    """
    ttl = int(payload["exp"]) - int(time.time())
    if ttl > 0:
        _redis.setex(f"{_PREFIXO_REVOGADO}{payload['jti']}", ttl, "1")


def token_revogado(jti: str) -> bool:
    return bool(_redis.exists(f"{_PREFIXO_REVOGADO}{jti}"))