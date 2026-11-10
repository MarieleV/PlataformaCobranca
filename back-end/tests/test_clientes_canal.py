import json
from urllib.parse import parse_qs

import httpx
import pytest

from app.clients import StatusEnvio, obter_cliente
from app.clients.sendgrid import EmailClient
from app.clients.simulado import ClienteSimulado
from app.clients.twilio import CODIGOS_BOUNCE, SMSClient, WhatsAppClient, para_e164
from app.core.config import settings
from app.models.domain import CanalEnum


def _transporte(status: int, corpo=None, cabecalhos=None, registro: list | None = None):
    def tratar(request: httpx.Request) -> httpx.Response:
        if registro is not None:
            registro.append(request)
        return httpx.Response(status, json=corpo if corpo is not None else {}, headers=cabecalhos or {})

    return httpx.MockTransport(tratar)


def _transporte_com_erro(erro: Exception):
    def tratar(request: httpx.Request):
        raise erro

    return httpx.MockTransport(tratar)


# --------------------------------------------------------------------------
# Simulado
# --------------------------------------------------------------------------


def test_simulado_envia_e_devolve_id_unico():
    cliente = ClienteSimulado("email")

    a = cliente.enviar("ana@exemplo.com", "Oi")
    b = cliente.enviar("ana@exemplo.com", "Oi")

    assert a.status == StatusEnvio.ENVIADO
    assert a.id_externo.startswith("sim-") and a.id_externo != b.id_externo


@pytest.mark.parametrize("destino", ["bounce@exemplo.com", "BOUNCE@exemplo.com", "47999990000"])
def test_simulado_bounce(destino):
    resultado = ClienteSimulado("email").enviar(destino, "Oi")

    assert resultado.status == StatusEnvio.BOUNCE
    assert resultado.codigo_erro == "SIMULADO_BOUNCE"


@pytest.mark.parametrize("destino", ["falha@exemplo.com", "47999999999"])
def test_simulado_falha_temporaria(destino):
    resultado = ClienteSimulado("sms").enviar(destino, "Oi")

    assert resultado.status == StatusEnvio.FALHA_TEMPORARIA
    assert resultado.codigo_erro == "SIMULADO_FALHA"


def test_modo_simulado_e_o_padrao_de_seguranca():
    assert settings.envio_simulado is True
    for canal in CanalEnum:
        assert isinstance(obter_cliente(canal), ClienteSimulado)


def test_modo_real_entrega_os_clientes_de_verdade(monkeypatch):
    monkeypatch.setattr(settings, "envio_simulado", False)
    monkeypatch.setattr(settings, "sendgrid_api_key", "SG.chave")
    monkeypatch.setattr(settings, "email_remetente", "cobranca@empresa.com")
    monkeypatch.setattr(settings, "twilio_account_sid", "ACxxx")
    monkeypatch.setattr(settings, "twilio_auth_token", "token")
    monkeypatch.setattr(settings, "twilio_sms_from", "+15550001111")
    monkeypatch.setattr(settings, "twilio_whatsapp_from", "+15550002222")

    assert isinstance(obter_cliente(CanalEnum.email), EmailClient)
    assert isinstance(obter_cliente(CanalEnum.sms), SMSClient)
    assert isinstance(obter_cliente(CanalEnum.whatsapp), WhatsAppClient)


# --------------------------------------------------------------------------
# SendGrid
# --------------------------------------------------------------------------


def test_email_enviado_com_id_do_provedor_e_payload_correto():
    chamadas = []
    cliente = EmailClient(
        "SG.chave", "cobranca@empresa.com", transport=_transporte(202, cabecalhos={"X-Message-Id": "abc123"}, registro=chamadas)
    )

    resultado = cliente.enviar("ana@exemplo.com", "Olá, Ana", assunto="Aviso")

    assert resultado.status == StatusEnvio.ENVIADO
    assert resultado.id_externo == "abc123"
    requisicao = chamadas[0]
    assert requisicao.headers["Authorization"] == "Bearer SG.chave"
    corpo = json.loads(requisicao.content)
    assert corpo["personalizations"][0]["to"] == [{"email": "ana@exemplo.com"}]
    assert corpo["from"] == {"email": "cobranca@empresa.com"}
    assert corpo["subject"] == "Aviso"
    assert corpo["content"][0]["value"] == "Olá, Ana"


def test_email_com_endereco_invalido_e_bounce():
    corpo = {"errors": [{"field": "personalizations.0.to.0.email", "message": "Does not contain a valid address."}]}
    cliente = EmailClient("k", "a@b.com", transport=_transporte(400, corpo))

    resultado = cliente.enviar("lixo", "Oi")

    assert resultado.status == StatusEnvio.BOUNCE
    assert resultado.codigo_erro == "400"


def test_email_400_de_outro_campo_nao_e_bounce():
    corpo = {"errors": [{"field": "subject", "message": "obrigatório"}]}

    resultado = EmailClient("k", "a@b.com", transport=_transporte(400, corpo)).enviar("a@b.com", "Oi")

    assert resultado.status == StatusEnvio.FALHA_TEMPORARIA


@pytest.mark.parametrize("codigo", [401, 403, 429, 500, 503])
def test_email_erros_do_provedor_sao_temporarios(codigo):
    resultado = EmailClient("k", "a@b.com", transport=_transporte(codigo)).enviar("a@b.com", "Oi")

    assert resultado.status == StatusEnvio.FALHA_TEMPORARIA
    assert resultado.codigo_erro == str(codigo)


def test_email_resposta_de_erro_sem_json():
    transporte = httpx.MockTransport(lambda request: httpx.Response(502, content=b"<html>Bad Gateway</html>"))

    resultado = EmailClient("k", "a@b.com", transport=transporte).enviar("a@b.com", "Oi")

    assert resultado.status == StatusEnvio.FALHA_TEMPORARIA


def test_email_falha_de_rede_e_temporaria():
    cliente = EmailClient("k", "a@b.com", transport=_transporte_com_erro(httpx.ConnectError("sem rede")))

    resultado = cliente.enviar("a@b.com", "Oi")

    assert resultado.status == StatusEnvio.FALHA_TEMPORARIA
    assert resultado.codigo_erro == "REDE"


# --------------------------------------------------------------------------
# Twilio
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "entrada, esperado",
    [("47999991234", "+5547999991234"), ("4733331234", "+554733331234"), ("+5547999991234", "+5547999991234")],
)
def test_telefone_vira_e164(entrada, esperado):
    assert para_e164(entrada) == esperado


def test_sms_enviado_com_sid_e_formulario_correto():
    chamadas = []
    cliente = SMSClient("ACxxx", "token", "+15550001111", transport=_transporte(201, {"sid": "SM123"}, registro=chamadas))

    resultado = cliente.enviar("47999991234", "Olá")

    assert resultado.status == StatusEnvio.ENVIADO
    assert resultado.id_externo == "SM123"
    requisicao = chamadas[0]
    assert str(requisicao.url) == "https://api.twilio.com/2010-04-01/Accounts/ACxxx/Messages.json"
    assert requisicao.headers["Authorization"].startswith("Basic ")
    formulario = parse_qs(requisicao.content.decode())
    assert formulario == {"To": ["+5547999991234"], "From": ["+15550001111"], "Body": ["Olá"]}


def test_whatsapp_usa_o_prefixo_nos_dois_numeros():
    chamadas = []
    cliente = WhatsAppClient("ACxxx", "token", "+15550002222", transport=_transporte(201, {"sid": "SM9"}, registro=chamadas))

    cliente.enviar("47999991234", "Olá")

    formulario = parse_qs(chamadas[0].content.decode())
    assert formulario["To"] == ["whatsapp:+5547999991234"]
    assert formulario["From"] == ["whatsapp:+15550002222"]


def test_whatsapp_nao_duplica_o_prefixo_do_remetente():
    chamadas = []
    cliente = WhatsAppClient("ACxxx", "t", "whatsapp:+14155238886", transport=_transporte(201, {"sid": "S"}, registro=chamadas))

    cliente.enviar("47999991234", "Oi")

    assert parse_qs(chamadas[0].content.decode())["From"] == ["whatsapp:+14155238886"]


@pytest.mark.parametrize("codigo", sorted(CODIGOS_BOUNCE))
def test_twilio_codigos_de_destino_invalido_sao_bounce(codigo):
    corpo = {"code": codigo, "message": "destino inválido", "status": 400}

    resultado = SMSClient("A", "t", "+1", transport=_transporte(400, corpo)).enviar("47999991234", "Oi")

    assert resultado.status == StatusEnvio.BOUNCE
    assert resultado.codigo_erro == str(codigo)
    assert resultado.mensagem_erro == "destino inválido"


def test_twilio_outro_codigo_de_erro_e_temporario():
    corpo = {"code": 30003, "message": "Unreachable destination handset", "status": 400}

    resultado = SMSClient("A", "t", "+1", transport=_transporte(400, corpo)).enviar("47999991234", "Oi")

    assert resultado.status == StatusEnvio.FALHA_TEMPORARIA
    assert resultado.codigo_erro == "30003"


@pytest.mark.parametrize("codigo", [429, 500, 503])
def test_twilio_limite_de_taxa_e_erro_do_servidor_sao_temporarios(codigo):
    resultado = SMSClient("A", "t", "+1", transport=_transporte(codigo)).enviar("47999991234", "Oi")

    assert resultado.status == StatusEnvio.FALHA_TEMPORARIA
    assert resultado.codigo_erro == str(codigo)


def test_twilio_falha_de_rede_e_temporaria():
    cliente = WhatsAppClient("A", "t", "+1", transport=_transporte_com_erro(httpx.ReadTimeout("lento")))

    resultado = cliente.enviar("47999991234", "Oi")

    assert resultado.status == StatusEnvio.FALHA_TEMPORARIA
    assert resultado.codigo_erro == "REDE"


def test_mensagem_de_erro_e_truncada_para_caber_no_banco():
    corpo = {"code": 30003, "message": "x" * 2000}

    resultado = SMSClient("A", "t", "+1", transport=_transporte(400, corpo)).enviar("47999991234", "Oi")

    assert len(resultado.mensagem_erro) == 500
