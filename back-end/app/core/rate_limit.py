"""Limite de tentativas de login (mitiga força bruta, conforme o RFC).

A contagem é por combinação IP + e-mail e expira sozinha. Se o Redis estiver
fora do ar, o limite é ignorado para não impedir todos os logins.
"""
import logging

import redis
from fastapi import HTTPException, status

from app.core.config import settings
from app.core.redis_client import get_redis

logger = logging.getLogger(__name__)


def _chave(ip: str, email: str) -> str:
    return f"login:falhas:{ip}:{email}"


def verificar_limite_login(ip: str, email: str) -> None:
    """Lança HTTP 429 se já houve tentativas demais."""
    try:
        falhas = get_redis().get(_chave(ip, email))
    except redis.RedisError:
        logger.warning("Redis indisponível: limite de login ignorado.")
        return
    if falhas is not None and int(falhas) >= settings.login_max_tentativas:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de login. Tente novamente em alguns minutos.",
        )


def registrar_falha_login(ip: str, email: str) -> None:
    try:
        cliente = get_redis()
        chave = _chave(ip, email)
        total = cliente.incr(chave)
        if total == 1:  # a janela começa na primeira falha
            cliente.expire(chave, settings.login_janela_segundos)
    except redis.RedisError:
        logger.warning("Redis indisponível: falha de login não contabilizada.")


def limpar_falhas_login(ip: str, email: str) -> None:
    try:
        get_redis().delete(_chave(ip, email))
    except redis.RedisError:
        logger.warning("Redis indisponível: falhas de login não limpas.")