from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from app.core.janela import dentro_da_janela, dia_util, proxima_janela_valida

BRT = ZoneInfo("America/Sao_Paulo")


def _brt(dia: int, hora: int, minuto: int = 0) -> datetime:
    """Novembro de 2026: dia 9 é segunda, 13 sexta, 14 sábado, 15 domingo."""
    return datetime(2026, 11, dia, hora, minuto, tzinfo=BRT)


@pytest.mark.parametrize("dia, esperado", [(9, True), (10, True), (13, True), (14, False), (15, False)])
def test_dias_uteis(dia, esperado):
    assert dia_util(_brt(dia, 12).date()) is esperado


@pytest.mark.parametrize(
    "dia, hora, minuto, esperado",
    [
        (9, 7, 59, False),   # antes da abertura
        (9, 8, 0, True),     # abre às 08h00
        (9, 12, 30, True),
        (9, 19, 59, True),
        (9, 20, 0, False),   # fecha às 20h00
        (9, 23, 0, False),
        (14, 10, 0, False),  # sábado
        (15, 10, 0, False),  # domingo
    ],
)
def test_janela_da_rn05(dia, hora, minuto, esperado):
    assert dentro_da_janela(_brt(dia, hora, minuto)) is esperado


def test_janela_usa_o_horario_de_brasilia_e_nao_o_do_servidor():
    utc = ZoneInfo("UTC")
    # 10h00 UTC = 07h00 em Brasília: ainda fechada
    assert dentro_da_janela(datetime(2026, 11, 9, 10, 0, tzinfo=utc)) is False
    # 12h00 UTC = 09h00 em Brasília: aberta
    assert dentro_da_janela(datetime(2026, 11, 9, 12, 0, tzinfo=utc)) is True


def test_dentro_da_janela_o_proprio_momento():
    assert proxima_janela_valida(_brt(9, 10, 30)) == _brt(9, 10, 30)


def test_antes_da_abertura_espera_a_abertura_do_mesmo_dia():
    assert proxima_janela_valida(_brt(9, 6, 15)) == _brt(9, 8, 0)


def test_depois_do_fechamento_vai_para_o_dia_util_seguinte():
    assert proxima_janela_valida(_brt(9, 20, 5)) == _brt(10, 8, 0)


@pytest.mark.parametrize("dia, hora", [(13, 20), (13, 23), (14, 10), (15, 15), (14, 3)])
def test_sexta_a_noite_e_fim_de_semana_vao_para_a_segunda(dia, hora):
    assert proxima_janela_valida(_brt(dia, hora)) == datetime(2026, 11, 16, 8, 0, tzinfo=BRT)


def test_resultado_vem_em_horario_de_brasilia():
    resultado = proxima_janela_valida(datetime(2026, 11, 9, 23, 30, tzinfo=ZoneInfo("UTC")))  # 20h30 BRT

    assert resultado == _brt(10, 8, 0)
    assert resultado.utcoffset() == _brt(10, 8, 0).utcoffset()
