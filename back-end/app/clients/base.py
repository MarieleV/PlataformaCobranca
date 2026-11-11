"""Contrato comum dos clientes de canal (e-mail, SMS e WhatsApp)."""
from dataclasses import dataclass
from enum import Enum
from typing import Protocol


class StatusEnvio(str, Enum):
    ENVIADO = "enviado"
    # Pode dar certo numa nova tentativa: rede, limite de taxa, erro do provedor (RN07)
    FALHA_TEMPORARIA = "falha_temporaria"
    # Destino inválido (e-mail ou número inexistente): não reenviar (RN08)
    BOUNCE = "bounce"


@dataclass(frozen=True)
class ResultadoEnvio:
    status: StatusEnvio
    id_externo: str | None = None
    codigo_erro: str | None = None
    mensagem_erro: str | None = None

    @classmethod
    def enviado(cls, id_externo: str | None = None) -> "ResultadoEnvio":
        return cls(StatusEnvio.ENVIADO, id_externo=id_externo)

    @classmethod
    def temporaria(cls, codigo: str, mensagem: str) -> "ResultadoEnvio":
        return cls(StatusEnvio.FALHA_TEMPORARIA, codigo_erro=codigo[:50], mensagem_erro=mensagem[:500])

    @classmethod
    def bounce(cls, codigo: str, mensagem: str) -> "ResultadoEnvio":
        return cls(StatusEnvio.BOUNCE, codigo_erro=codigo[:50], mensagem_erro=mensagem[:500])


class ClienteCanal(Protocol):
    def enviar(self, destino: str, mensagem: str, assunto: str | None = None) -> ResultadoEnvio:
        """Envia a mensagem. Nunca levanta exceção por falha do provedor."""
