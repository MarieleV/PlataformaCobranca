# back-end/tests/test_validador.py
import pytest
from app.utils.validador import validar_cpf_cnpj  # Ajuste o import conforme o caminho do seu arquivo de validação

def test_valida_cpf_valido():
    # Exemplo de CPF válido (substitua pelo nome real da sua função e de um CPF de teste)
    cpf_valido = "52998224725"  # Substitua por um CPF válido conhecido para teste
    assert validar_cpf_cnpj(cpf_valido) is True

def test_valida_cpf_invalido_sequencia():
    # CPFs com números repetidos devem falhar
    cpf_invalido = "11111111111"
    assert validar_cpf_cnpj(cpf_invalido) is False

def test_valida_cnpj_valido():
    # Exemplo de CNPJ válido (ex: matriz da receita ou gerado)
    cnpj_valido = "11222333000181" # Ajuste conforme a sua massa de testes
    # Se a sua função aceitar CNPJ e CPF na mesma ou em funções separadas, adapte a chamada:
    assert validar_cpf_cnpj(cnpj_valido) is True

def test_valida_documento_tamanho_errado():
    # Documento com menos ou mais dígitos deve retornar falso
    doc_curto = "123456"
    assert validar_cpf_cnpj(doc_curto) is False