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


_PREFIXO_SESSOES_DESDE = "jwt:sessoes_desde:"


def invalidar_sessoes_do_usuario(usuario_id) -> None:
    """Invalida todos os tokens já emitidos para o usuário (access e refresh).

    Use ao redefinir/trocar a senha e ao desativar a conta. Só valem os tokens
    emitidos depois deste momento. A chave expira com o último refresh possível.
    """
    ttl = settings.refresh_token_expire_days * 86400
    _redis.setex(f"{_PREFIXO_SESSOES_DESDE}{usuario_id}", ttl, int(time.time() * 1000))


def sessao_invalidada(usuario_id, payload: dict) -> bool:
    """True se o token foi emitido antes da última invalidação do usuário."""
    desde = _redis.get(f"{_PREFIXO_SESSOES_DESDE}{usuario_id}")
    if desde is None:
        return False
    emitido_ms = payload.get("emitido_ms", int(payload["iat"]) * 1000)
    return emitido_ms < int(desde)
