from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.core.datas import hoje
from app.core.templates import (
    LIMITE_POR_CANAL,
    TemplateInvalido,
    contexto_de_exemplo,
    contexto_do_devedor,
    formatar_valor,
    renderizar,
    validar_template,
    variaveis_usadas,
)
from app.models.domain import CanalEnum, Devedor


def test_variaveis_usadas_na_ordem_e_sem_repetir():
    assert variaveis_usadas("{nome}, {valor}... {nome} {dias_atraso}") == ["nome", "valor", "dias_atraso"]


def test_template_valido():
    validar_template("Olá, {primeiro_nome}! Sua dívida de {valor} venceu em {data_vencimento}.", CanalEnum.sms)


def test_template_sem_variaveis_tambem_vale():
    validar_template("Entre em contato conosco.", CanalEnum.email)


@pytest.mark.parametrize("texto", ["", "   ", "\n\t"])
def test_template_vazio(texto):
    with pytest.raises(TemplateInvalido, match="vazio"):
        validar_template(texto, CanalEnum.email)


def test_variavel_desconhecida_lista_as_disponiveis():
    with pytest.raises(TemplateInvalido) as erro:
        validar_template("Oi {cpf} e {telefone}", CanalEnum.email)

    mensagem = str(erro.value)
    assert "{cpf}" in mensagem and "{telefone}" in mensagem
    assert "{primeiro_nome}" in mensagem  # sugere as válidas


@pytest.mark.parametrize(
    "template",
    [
        "{nome.__class__}",  # acesso a atributo (injeção de formato)
        "{nome!r}",
        "{nome:>20}",
        "{0}",
        "{}",
        "{nome[0]}",
    ],
)
def test_sintaxe_de_formatacao_do_python_e_recusada(template):
    with pytest.raises(TemplateInvalido):
        validar_template(template, CanalEnum.email)


@pytest.mark.parametrize("template", ["Olá {nome", "Olá nome}", "{{nome}}", "{nome} }"])
def test_chaves_soltas(template):
    with pytest.raises(TemplateInvalido):
        validar_template(template, CanalEnum.email)


@pytest.mark.parametrize("canal", list(CanalEnum))
def test_limite_de_caracteres_por_canal(canal):
    limite = LIMITE_POR_CANAL[canal]

    validar_template("a" * limite, canal)
    with pytest.raises(TemplateInvalido, match=str(limite)):
        validar_template("a" * (limite + 1), canal)


def test_sms_tem_limite_menor_que_whatsapp_e_email():
    assert LIMITE_POR_CANAL[CanalEnum.sms] < LIMITE_POR_CANAL[CanalEnum.whatsapp] < LIMITE_POR_CANAL[CanalEnum.email]


@pytest.mark.parametrize(
    "valor, esperado",
    [
        (Decimal("0"), "R$ 0,00"),
        (Decimal("5"), "R$ 5,00"),
        (Decimal("1234.5"), "R$ 1.234,50"),
        (Decimal("1234567.891"), "R$ 1.234.567,89"),
    ],
)
def test_formato_brasileiro_do_valor(valor, esperado):
    assert formatar_valor(valor) == esperado


def test_renderizar_troca_todas_as_ocorrencias():
    assert renderizar("{nome} / {nome} / {valor}", {"nome": "Ana", "valor": "R$ 1,00"}) == "Ana / Ana / R$ 1,00"


def test_renderizar_nao_executa_o_que_vem_no_valor():
    """Um nome malicioso vindo do CSV não pode virar outra variável nem código."""
    resultado = renderizar("Olá, {nome}!", {"nome": "{valor}{0}__import__"})

    assert resultado == "Olá, {valor}{0}__import__!"


def test_renderizar_deixa_variavel_ausente_como_esta():
    assert renderizar("Oi {nome}", {}) == "Oi {nome}"


def test_contexto_de_exemplo_cobre_todas_as_variaveis():
    texto = renderizar("{nome}|{primeiro_nome}|{valor}|{data_vencimento}|{dias_atraso}", contexto_de_exemplo())

    assert "{" not in texto


def test_contexto_do_devedor():
    devedor = Devedor(nome="  Maria Silva Santos ", data_vencimento=hoje() - timedelta(days=15))

    contexto = contexto_do_devedor(devedor, Decimal("1234.5"))

    assert contexto["nome"] == "Maria Silva Santos"
    assert contexto["primeiro_nome"] == "Maria"
    assert contexto["valor"] == "R$ 1.234,50"
    assert contexto["dias_atraso"] == "15"
    assert contexto["data_vencimento"] == devedor.data_vencimento.strftime("%d/%m/%Y")


def test_dias_de_atraso_no_contexto_usa_o_dia_informado_e_nao_fica_negativo():
    devedor = Devedor(nome="Ana", data_vencimento=date(2026, 1, 10))

    assert contexto_do_devedor(devedor, Decimal("1"), dia=date(2026, 1, 20))["dias_atraso"] == "10"
    assert contexto_do_devedor(devedor, Decimal("1"), dia=date(2026, 1, 1))["dias_atraso"] == "0"
