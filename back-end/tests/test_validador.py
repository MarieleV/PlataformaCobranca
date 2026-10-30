import pytest
from app.worker.tasks import validar_cpf_cnpj

def test_valida_cpf_valido():
    cpf_valido = "52998224725"
    assert validar_cpf_cnpj(cpf_valido) is True

def test_valida_cpf_invalido_sequencia():
    cpf_invalido = "11111111111"
    assert validar_cpf_cnpj(cpf_invalido) is False

def test_valida_cnpj_valido():
    cnpj_valido = "11222333000181"
    assert validar_cpf_cnpj(cnpj_valido) is True

def test_valida_documento_tamanho_errado():
    doc_curto = "123456"
    assert validar_cpf_cnpj(doc_curto) is False