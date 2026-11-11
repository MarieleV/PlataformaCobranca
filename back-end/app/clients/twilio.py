"""SMS e WhatsApp pela API REST do Twilio (sem SDK: só HTTP)."""
import httpx

from app.clients.base import ResultadoEnvio

URL_TWILIO = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"

# Erros do Twilio que indicam destino inválido ou que não quer receber: não adianta reenviar
CODIGOS_BOUNCE = {
    21211,  # número 'To' inválido
    21214,  # 'To' não pode receber mensagens
    21217,  # não é um número de telefone válido
    21421,  # número de telefone inválido
    21610,  # destinatário pediu para não receber (STOP)
    21612,  # não há rota para o número
    21614,  # 'To' não é um celular válido
    63003,  # WhatsApp: canal não encontrou o endereço do destino
    63024,  # WhatsApp: destinatário inválido
}


def para_e164(telefone: str) -> str:
    """DDD + número (como o sistema guarda) -> +55DDDNÚMERO."""
    digitos = "".join(c for c in telefone if c.isdigit())
    return telefone if telefone.startswith("+") else f"+55{digitos}"


class _TwilioBase:
    prefixo = ""

    def __init__(
        self,
        account_sid: str,
        auth_token: str,
        remetente: str,
        transport: httpx.BaseTransport | None = None,
        timeout: float = 10.0,
    ):
        self._url = URL_TWILIO.format(sid=account_sid)
        self._remetente = self._com_prefixo(remetente)
        self._http = httpx.Client(transport=transport, timeout=timeout, auth=(account_sid, auth_token))

    def _com_prefixo(self, numero: str) -> str:
        return numero if numero.startswith(self.prefixo) else f"{self.prefixo}{numero}"

    def enviar(self, destino: str, mensagem: str, assunto: str | None = None) -> ResultadoEnvio:
        dados = {
            "To": self._com_prefixo(para_e164(destino)),
            "From": self._remetente,
            "Body": mensagem,
        }
        try:
            resposta = self._http.post(self._url, data=dados)
        except httpx.HTTPError as erro:
            return ResultadoEnvio.temporaria("REDE", type(erro).__name__)

        try:
            corpo = resposta.json()
        except ValueError:
            corpo = {}

        if resposta.status_code in (200, 201):
            return ResultadoEnvio.enviado(corpo.get("sid"))

        codigo = corpo.get("code")
        mensagem_erro = corpo.get("message") or resposta.reason_phrase
        codigo_texto = str(codigo or resposta.status_code)
        if codigo in CODIGOS_BOUNCE:
            return ResultadoEnvio.bounce(codigo_texto, mensagem_erro)
        return ResultadoEnvio.temporaria(codigo_texto, mensagem_erro)


class SMSClient(_TwilioBase):
    prefixo = ""


class WhatsAppClient(_TwilioBase):
    prefixo = "whatsapp:"
