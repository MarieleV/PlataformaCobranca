"""Cliente de mentira: não chama nenhum provedor e não envia nada a ninguém.

Serve para desenvolver, demonstrar e testar o fluxo inteiro sem contas no
SendGrid/Twilio. O destino controla o resultado (útil para demonstrar o reenvio):

- e-mail que começa com "bounce" ou telefone que termina em "0000" -> bounce (RN08)
- e-mail que começa com "falha" ou telefone que termina em "9999" -> falha temporária (RN07)
- qualquer outro -> enviado
"""
import uuid

from app.clients.base import ResultadoEnvio


class ClienteSimulado:
    def __init__(self, canal: str):
        self.canal = canal

    def enviar(self, destino: str, mensagem: str, assunto: str | None = None) -> ResultadoEnvio:
        destino = destino.strip().lower()
        if destino.startswith("bounce") or destino.endswith("0000"):
            return ResultadoEnvio.bounce("SIMULADO_BOUNCE", "Destino inválido (simulado)")
        if destino.startswith("falha") or destino.endswith("9999"):
            return ResultadoEnvio.temporaria("SIMULADO_FALHA", "Falha temporária (simulada)")
        return ResultadoEnvio.enviado(f"sim-{uuid.uuid4().hex[:16]}")
