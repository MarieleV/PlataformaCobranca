"""Testes unitários das validações de negócio da ingestão (RF03 e RN04).

São funções puras, sem banco e sem Celery: rodam em milissegundos.
"""
from datetime import date
from decimal import Decimal

import pytest

from app.worker.validadores import (
    converter_data,
    converter_valor,
    normalizar_documento,
    normalizar_telefone,
    validar_cpf_cnpj,
    validar_email,
    validar_linha,
)

CPF_VALIDO = "52998224725"
CNPJ_VALIDO = "11222333000181"


# --------------------------------------------------------------------------
# CPF e CNPJ (RN04)
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "documento",
    [
        CPF_VALIDO,
        "529.982.247-25",  # com máscara
        " 529.982.247-25 ",  # com espaços
        "01234567890",  # começa com zero
        "1234567890",  # o Excel removeu o zero à esquerda
        CNPJ_VALIDO,
        "11.222.333/0001-81",  # com máscara
        "01222333000128",  # CNPJ começando com zero
        "1222333000128",  # o Excel removeu o zero à esquerda
    ],
)
def test_documentos_validos(documento):
    assert validar_cpf_cnpj(documento) is True


@pytest.mark.parametrize(
    "documento",
    [
        "11111111111",  # CPF com todos os dígitos iguais
        "00000000000",
        "11111111111111",  # CNPJ com todos os dígitos iguais
        "52998224724",  # CPF com dígito verificador errado
        "123.456.789-00",
        "11222333000180",  # CNPJ com dígito verificador errado
        "123456",  # curto demais
        "123456789012",  # 12 dígitos: nem CPF nem CNPJ
        "5299822472500",  # 13 dígitos que, completados, não fecham
        "abcdefghijk",  # sem dígitos
        "",
        None,
    ],
)
def test_documentos_invalidos(documento):
    assert validar_cpf_cnpj(documento) is False


def test_normalizar_documento_devolve_so_digitos():
    assert normalizar_documento("529.982.247-25") == CPF_VALIDO
    assert normalizar_documento("11.222.333/0001-81") == CNPJ_VALIDO


def test_normalizar_documento_restaura_zero_perdido_pelo_excel():
    assert normalizar_documento("1234567890") == "01234567890"
    assert normalizar_documento("1222333000128") == "01222333000128"


def test_normalizar_documento_vazio():
    assert normalizar_documento(None) == ""
    assert normalizar_documento("") == ""


# --------------------------------------------------------------------------
# E-mail
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "email", ["maria@exemplo.com", "contato@abc.com.br", "a.b+tag@dominio.org"]
)
def test_emails_validos(email):
    assert validar_email(email) is True


@pytest.mark.parametrize(
    "email", ["", None, "sem-arroba", "mariaconceicao@", "@dominio.com", "a b@c.com", "a@b"]
)
def test_emails_invalidos(email):
    assert validar_email(email) is False


# --------------------------------------------------------------------------
# Valor (Tela 3: numérico positivo, ex.: 1500.00)
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "texto, esperado",
    [
        ("1500.00", Decimal("1500.00")),
        ("1500", Decimal("1500")),
        ("1500.5", Decimal("1500.5")),
        ("0.01", Decimal("0.01")),
        (" 890.00 ", Decimal("890.00")),
    ],
)
def test_valores_validos(texto, esperado):
    assert converter_valor(texto) == esperado


@pytest.mark.parametrize(
    "texto",
    [
        "R$ 1.500,00",
        "1.500,00",
        "1500,00",
        "-250.00",
        "0",
        "0.00",
        "1500.555",  # mais de 2 casas decimais
        "abc",
        "",
        None,
        "99999999999999.99",  # estoura o Numeric(15, 2)
    ],
)
def test_valores_invalidos(texto):
    assert converter_valor(texto) is None


def test_valor_e_decimal_e_nao_float():
    assert isinstance(converter_valor("0.10"), Decimal)


# --------------------------------------------------------------------------
# Data (DD/MM/AAAA ou AAAA-MM-DD)
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "texto, esperado",
    [
        ("12/04/2026", date(2026, 4, 12)),
        ("2026-04-12", date(2026, 4, 12)),
        ("2026-04-01 00:00:00", date(2026, 4, 1)),  # como o Excel exporta
        ("01/04/2026 10:30", date(2026, 4, 1)),
        ("29/02/2028", date(2028, 2, 29)),  # ano bissexto
        (" 12/04/2026 ", date(2026, 4, 12)),
    ],
)
def test_datas_validas(texto, esperado):
    assert converter_data(texto) == esperado


@pytest.mark.parametrize(
    "texto",
    ["31/13/2026", "31/02/2026", "29/02/2027", "2026-13-01", "12-04-2026", "abc", "", None, "12/4/26"],
)
def test_datas_invalidas(texto):
    assert converter_data(texto) is None


# --------------------------------------------------------------------------
# Telefone (DDD + número)
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "texto, esperado",
    [
        ("47999990000", "47999990000"),  # celular
        ("4733334444", "4733334444"),  # fixo
        ("(47) 99999-0000", "47999990000"),
        ("5547999990000", "47999990000"),  # prefixo do país
        ("+55 (47) 99999-0000", "47999990000"),
    ],
)
def test_telefones_validos(texto, esperado):
    assert normalizar_telefone(texto) == esperado


@pytest.mark.parametrize("texto", ["123", "99999-0000", "479999900001234", "", None, "abc"])
def test_telefones_invalidos(texto):
    assert normalizar_telefone(texto) is None


# --------------------------------------------------------------------------
# Linha completa
# --------------------------------------------------------------------------


def _linha(**alteracoes) -> dict:
    base = {
        "cpf_cnpj": "529.982.247-25",
        "nome": "Maria Silva",
        "email": "Maria@Exemplo.com",
        "valor_divida": "1500.00",
        "data_vencimento": "12/04/2026",
        "telefone": "47999990000",
        "whatsapp": "",
    }
    base.update(alteracoes)
    return base


def test_linha_valida_devolve_dados_limpos():
    resultado = validar_linha(_linha())

    assert resultado.erros == []
    assert resultado.dados == {
        "cpf_cnpj": CPF_VALIDO,
        "nome": "Maria Silva",
        "email": "maria@exemplo.com",  # normalizado para minúsculas
        "telefone": "47999990000",
        "whatsapp": None,
        "valor_divida": Decimal("1500.00"),
        "data_vencimento": date(2026, 4, 12),
    }


def test_campos_opcionais_podem_faltar():
    linha = _linha()
    del linha["telefone"], linha["whatsapp"]

    resultado = validar_linha(linha)

    assert resultado.erros == []
    assert resultado.dados["telefone"] is None


def test_linha_invalida_nao_devolve_dados():
    resultado = validar_linha(_linha(cpf_cnpj="123.456.789-00"))

    assert resultado.dados is None
    assert len(resultado.erros) == 1


def test_erro_informa_campo_regra_e_valor_original():
    erro = validar_linha(_linha(cpf_cnpj="123.456.789-00")).erros[0]

    assert erro.campo == "cpf_cnpj"
    assert "inválido" in erro.regra
    assert erro.valor == "123.456.789-00"


def test_todos_os_erros_da_linha_sao_reportados_juntos():
    """Como na Tela 4: o analista corrige tudo de uma vez, sem reimportar várias vezes."""
    resultado = validar_linha(
        _linha(
            cpf_cnpj="111.222.333-44",
            email="mariaconceicao@",
            valor_divida="-250.00",
            data_vencimento="31/13/2026",
            telefone="123",
        )
    )

    assert {e.campo for e in resultado.erros} == {
        "cpf_cnpj",
        "email",
        "valor_divida",
        "data_vencimento",
        "telefone",
    }


@pytest.mark.parametrize("campo", ["cpf_cnpj", "nome", "email", "valor_divida", "data_vencimento"])
def test_campo_obrigatorio_vazio_e_rejeitado(campo):
    resultado = validar_linha(_linha(**{campo: ""}))

    assert [e.campo for e in resultado.erros] == [campo]
    assert "obrigatório" in resultado.erros[0].regra


@pytest.mark.parametrize("campo", ["cpf_cnpj", "nome", "email", "valor_divida", "data_vencimento"])
def test_campo_obrigatorio_ausente_ou_nulo_e_rejeitado(campo):
    linha = _linha(**{campo: None})

    resultado = validar_linha(linha)

    assert [e.campo for e in resultado.erros] == [campo]


def test_campo_so_com_espacos_conta_como_vazio():
    resultado = validar_linha(_linha(nome="   "))

    assert [e.campo for e in resultado.erros] == ["nome"]


def test_nome_acima_de_255_caracteres_e_rejeitado():
    resultado = validar_linha(_linha(nome="A" * 256))

    assert [e.campo for e in resultado.erros] == ["nome"]


def test_whatsapp_invalido_e_rejeitado_com_o_campo_certo():
    resultado = validar_linha(_linha(whatsapp="12345"))

    assert [e.campo for e in resultado.erros] == ["whatsapp"]


def test_valor_informado_no_erro_e_limitado_a_500_caracteres():
    resultado = validar_linha(_linha(email="x" * 800))

    assert len(resultado.erros[0].valor) <= 500


def test_nome_com_acentos_e_preservado():
    resultado = validar_linha(_linha(nome="José da Conceição"))

    assert resultado.dados["nome"] == "José da Conceição"