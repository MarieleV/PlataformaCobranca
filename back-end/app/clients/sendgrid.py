"""E-mail pela API v3 do SendGrid (sem SDK: só HTTP)."""
import httpx

from app.clients.base import ResultadoEnvio

URL_SENDGRID = "https://api.sendgrid.com/v3/mail/send"


class EmailClient:
    def __init__(
        self,
        api_key: str,
        remetente: str,
        transport: httpx.BaseTransport | None = None,
        timeout: float = 10.0,
    ):
        self._remetente = remetente
        self._http = httpx.Client(
            transport=transport,
            timeout=timeout,
            headers={"Authorization": f"Bearer {api_key}"},
        )

    def enviar(self, destino: str, mensagem: str, assunto: str | None = None) -> ResultadoEnvio:
        corpo = {
            "personalizations": [{"to": [{"email": destino}]}],
            "from": {"email": self._remetente},
            "subject": assunto or "Comunicado",
            "content": [{"type": "text/plain", "value": mensagem}],
        }
        try:
            resposta = self._http.post(URL_SENDGRID, json=corpo)
        except httpx.HTTPError as erro:
            return ResultadoEnvio.temporaria("REDE", type(erro).__name__)

        if resposta.status_code in (200, 201, 202):
            return ResultadoEnvio.enviado(resposta.headers.get("X-Message-Id"))

        codigo = str(resposta.status_code)
        detalhe = self._detalhe(resposta)
        # 400 apontando o campo do e-mail do destinatário: endereço inválido
        if resposta.status_code == 400 and "email" in detalhe.lower():
            return ResultadoEnvio.bounce(codigo, detalhe)
        return ResultadoEnvio.temporaria(codigo, detalhe)

    @staticmethod
    def _detalhe(resposta: httpx.Response) -> str:
        try:
            erros = resposta.json().get("errors") or []
            return "; ".join(f"{e.get('field') or ''} {e.get('message') or ''}".strip() for e in erros) or resposta.reason_phrase
        except ValueError:
            return resposta.reason_phrase
