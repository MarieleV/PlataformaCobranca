from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest

from app.clients.base import ResultadoEnvio
from app.core.config import Settings, settings
from app.core.feriados import eh_feriado, feriados_do_ano, pascoa
from app.core.janela import dentro_da_janela, dia_util, proxima_janela_valida
from app import testar_provedores

BRT = ZoneInfo("America/Sao_Paulo")


# ----------------------------------------------------------------------
# Calendário de feriados
# ----------------------------------------------------------------------
@pytest.mark.parametrize(
    "ano, esperada",
    [(2024, date(2024, 3, 31)), (2025, date(2025, 4, 20)), (2026, date(2026, 4, 5)), (2027, date(2027, 3, 28))],
)
def test_pascoa(ano, esperada):
    assert pascoa(ano) == esperada


@pytest.mark.parametrize(
    "dia",
    [
        date(2026, 1, 1), date(2026, 4, 3),   # Confraternização, Sexta-feira Santa
        date(2026, 4, 21), date(2026, 5, 1), date(2026, 9, 7), date(2026, 10, 12),
        date(2026, 11, 2), date(2026, 11, 15), date(2026, 11, 20), date(2026, 12, 25),
        date(2026, 2, 16), date(2026, 2, 17), date(2026, 6, 4),  # Carnaval e Corpus Christi
    ],
)
def test_feriados_de_2026(dia):
    assert eh_feriado(dia)


def test_dia_comum_nao_e_feriado():
    assert not eh_feriado(date(2026, 11, 9))


def test_consciencia_negra_so_vale_a_partir_de_2024():
    assert date(2023, 11, 20) not in feriados_do_ano(2023)
    assert date(2024, 11, 20) in feriados_do_ano(2024)


def test_facultativos_podem_ser_desligados(monkeypatch):
    monkeypatch.setattr(settings, "feriados_facultativos", False)
    assert not eh_feriado(date(2026, 2, 16))  # Carnaval
    assert eh_feriado(date(2026, 4, 3))  # Sexta-feira Santa continua


def test_feriados_extras(monkeypatch):
    monkeypatch.setattr(settings, "feriados_extras", "2026-11-09, 2026-03-19")
    assert eh_feriado(date(2026, 11, 9))
    assert eh_feriado(date(2026, 3, 19))


def test_feriados_extras_invalidos_sao_recusados():
    with pytest.raises(ValueError, match="FERIADOS_EXTRAS"):
        Settings(feriados_extras="09/11/2026", jwt_secret="x" * 40)
    assert Settings(feriados_extras="", jwt_secret="x" * 40).feriados_extras == ""


# ----------------------------------------------------------------------
# Janela de disparo com feriado (RN05)
# ----------------------------------------------------------------------
def test_feriado_nao_e_dia_util():
    assert not dia_util(date(2026, 11, 2))  # segunda-feira, Finados
    assert dia_util(date(2026, 11, 3))


def test_nao_dispara_em_feriado_dia_util():
    assert not dentro_da_janela(datetime(2026, 11, 2, 10, 0, tzinfo=BRT))
    assert dentro_da_janela(datetime(2026, 11, 3, 10, 0, tzinfo=BRT))


def test_reenvio_pula_o_feriado():
    # sexta 30/10 às 20h: o fim de semana e a segunda (Finados) ficam de fora
    proxima = proxima_janela_valida(datetime(2026, 10, 30, 20, 30, tzinfo=BRT))
    assert proxima == datetime(2026, 11, 3, 8, 0, tzinfo=BRT)


def test_madrugada_de_feriado_vai_para_o_proximo_dia_util():
    proxima = proxima_janela_valida(datetime(2026, 11, 2, 6, 0, tzinfo=BRT))
    assert proxima == datetime(2026, 11, 3, 8, 0, tzinfo=BRT)


# ----------------------------------------------------------------------
# Comando de teste dos provedores reais
# ----------------------------------------------------------------------
class _Cliente:
    def __init__(self, resultado):
        self.resultado = resultado
        self.chamadas = []

    def enviar(self, destino, mensagem, assunto=None):
        self.chamadas.append((destino, mensagem, assunto))
        return self.resultado


def _rodar(args, resultado=None, monkeypatch=None, **config):
    for nome, valor in config.items():
        monkeypatch.setattr(settings, nome, valor)
    cliente = _Cliente(resultado or ResultadoEnvio.enviado("abc-123"))
    linhas = []
    codigo = testar_provedores.main(args, lambda canal: cliente, linhas.append)
    return codigo, "\n".join(linhas), cliente


def test_comando_exige_credenciais(monkeypatch):
    codigo, texto, cliente = _rodar(["email", "a@b.com"], monkeypatch=monkeypatch, sendgrid_api_key="", email_remetente="")
    assert codigo == 2
    assert "SENDGRID_API_KEY" in texto and "EMAIL_REMETENTE" in texto
    assert cliente.chamadas == []


def test_comando_sucesso(monkeypatch):
    codigo, texto, cliente = _rodar(
        ["email", "eu@exemplo.com"], monkeypatch=monkeypatch,
        sendgrid_api_key="SG.x", email_remetente="cobranca@exemplo.com",
    )
    assert codigo == 0
    assert "abc-123" in texto
    destino, mensagem, assunto = cliente.chamadas[0]
    assert destino == "eu@exemplo.com" and "TESTE" in mensagem and "Teste" in assunto


@pytest.mark.parametrize("canal, campo", [("sms", "twilio_sms_from"), ("whatsapp", "twilio_whatsapp_from")])
def test_comando_twilio(monkeypatch, canal, campo):
    codigo, _, cliente = _rodar(
        [canal, "47999990000"], monkeypatch=monkeypatch,
        twilio_account_sid="AC1", twilio_auth_token="t", **{campo: "+15005550006"},
    )
    assert codigo == 0
    assert cliente.chamadas[0][0] == "47999990000"


def test_comando_mostra_a_falha(monkeypatch):
    codigo, texto, _ = _rodar(
        ["sms", "47999990000"], ResultadoEnvio.bounce("21211", "Número inválido"),
        monkeypatch=monkeypatch, twilio_account_sid="AC1", twilio_auth_token="t", twilio_sms_from="+1",
    )
    assert codigo == 1
    assert "21211" in texto and "bounce" in texto


def test_comando_falha_temporaria(monkeypatch):
    codigo, texto, _ = _rodar(
        ["email", "a@b.com"], ResultadoEnvio.temporaria("401", "Unauthorized"),
        monkeypatch=monkeypatch, sendgrid_api_key="SG.x", email_remetente="c@e.com",
    )
    assert codigo == 1 and "temporária" in texto


def test_comando_monta_o_cliente_real_correto(monkeypatch):
    from app.clients.sendgrid import EmailClient
    from app.clients.twilio import SMSClient, WhatsAppClient

    for nome in ("sendgrid_api_key", "email_remetente", "twilio_account_sid",
                 "twilio_auth_token", "twilio_sms_from", "twilio_whatsapp_from"):
        monkeypatch.setattr(settings, nome, "x")
    assert isinstance(testar_provedores._cliente_real("email"), EmailClient)
    assert isinstance(testar_provedores._cliente_real("sms"), SMSClient)
    assert isinstance(testar_provedores._cliente_real("whatsapp"), WhatsAppClient)
