"""Criptografia em nível de aplicação (RNF05 e LGPD).

Usada, por exemplo, para a coluna `devedores.valor_divida_enc` (BYTEA).
"""
from decimal import Decimal

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

_fernet = Fernet(settings.fernet_key)


def criptografar_texto(valor: str) -> bytes:
    return _fernet.encrypt(valor.encode("utf-8"))


def descriptografar_texto(valor: bytes) -> str:
    try:
        return _fernet.decrypt(valor).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Dado criptografado inválido ou chave incorreta.") from exc


def criptografar_decimal(valor: Decimal) -> bytes:
    return criptografar_texto(str(valor))


def descriptografar_decimal(valor: bytes) -> Decimal:
    return Decimal(descriptografar_texto(valor))