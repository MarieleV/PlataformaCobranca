"""Teste manual dos provedores reais (SendGrid e Twilio).

Envia UMA mensagem de teste, para o destino que você informar, ignorando
ENVIO_SIMULADO (o sistema continua simulado; só este comando usa o provedor
real). Não toca no banco nem em devedores.

    docker compose exec api python -m app.testar_provedores email voce@gmail.com
    docker compose exec api python -m app.testar_provedores sms 47999990000
    docker compose exec api python -m app.testar_provedores whatsapp 47999990000

Código de saída: 0 = o provedor aceitou; 1 = recusou ou deu erro; 2 = uso
incorreto ou credenciais ausentes no .env.
"""
import argparse
import sys
from collections.abc import Callable

from app.clients.base import ClienteCanal, StatusEnvio
from app.core.config import settings

TEXTO = (
    "TESTE da Plataforma de Cobrança: esta mensagem verifica a integração com o "
    "provedor. Pode ignorar."
)

_FALTAM = {
    "email": ("SENDGRID_API_KEY", "EMAIL_REMETENTE"),
    "sms": ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM"),
    "whatsapp": ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"),
}


def _ausentes(canal: str) -> list[str]:
    return [nome for nome in _FALTAM[canal] if not getattr(settings, nome.lower())]


def _cliente_real(canal: str) -> ClienteCanal:
    if canal == "email":
        from app.clients.sendgrid import EmailClient

        return EmailClient(settings.sendgrid_api_key, settings.email_remetente)

    from app.clients.twilio import SMSClient, WhatsAppClient

    if canal == "sms":
        return SMSClient(settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_sms_from)
    return WhatsAppClient(settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_whatsapp_from)


def main(
    argv: list[str] | None = None,
    cliente_do_canal: Callable[[str], ClienteCanal] = _cliente_real,
    saida: Callable[[str], None] = print,
) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.testar_provedores", description=__doc__.split("\n")[0])
    parser.add_argument("canal", choices=sorted(_FALTAM))
    parser.add_argument("destino", help="e-mail ou telefone (DDD+número, ou +55...) que vai receber o teste")
    args = parser.parse_args(argv)

    faltando = _ausentes(args.canal)
    if faltando:
        saida(f"Faltam no .env: {', '.join(faltando)}")
        return 2

    saida(f"Enviando teste por {args.canal} para {args.destino} ...")
    resultado = cliente_do_canal(args.canal).enviar(
        args.destino, TEXTO, assunto="Teste - Plataforma de Cobrança"
    )

    if resultado.status == StatusEnvio.ENVIADO:
        saida(f"OK: o provedor aceitou a mensagem (id: {resultado.id_externo or 'não informado'}).")
        saida("Confira a caixa de entrada (e o spam) ou o aparelho. 'Aceitou' não garante entrega.")
        return 0

    tipo = "destino inválido (bounce)" if resultado.status == StatusEnvio.BOUNCE else "falha temporária"
    saida(f"FALHOU - {tipo}: [{resultado.codigo_erro}] {resultado.mensagem_erro}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
