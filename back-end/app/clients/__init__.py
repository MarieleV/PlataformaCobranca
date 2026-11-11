"""Clientes dos canais de disparo. `obter_cliente` escolhe o simulado ou o real."""
from app.clients.base import ClienteCanal, ResultadoEnvio, StatusEnvio
from app.clients.simulado import ClienteSimulado
from app.core.config import settings
from app.models.domain import CanalEnum

__all__ = ["ClienteCanal", "ResultadoEnvio", "StatusEnvio", "obter_cliente"]


def obter_cliente(canal: CanalEnum) -> ClienteCanal:
    if settings.envio_simulado:
        return ClienteSimulado(canal.value)

    # Imports tardios: o httpx só é necessário no modo real
    if canal == CanalEnum.email:
        from app.clients.sendgrid import EmailClient

        return EmailClient(settings.sendgrid_api_key, settings.email_remetente)

    from app.clients.twilio import SMSClient, WhatsAppClient

    if canal == CanalEnum.sms:
        return SMSClient(settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_sms_from)
    return WhatsAppClient(settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_whatsapp_from)
