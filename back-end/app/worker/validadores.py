"""Validações de negócio da ingestão de lotes (RF03, RN04 e regras da Tela 3).

Funções puras, sem banco e sem Celery, para serem testadas com pytest.
"""
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal

from email_validator import EmailNotValidError, validate_email

COLUNAS_OBRIGATORIAS = ("cpf_cnpj", "nome", "email", "valor_divida", "data_vencimento")
COLUNAS_OPCIONAIS = ("telefone", "whatsapp")
# Nomes antigos aceitos para não quebrar planilhas já existentes
ALIASES_COLUNAS = {"venc_orig_date": "data_vencimento"}

VALOR_MAXIMO = Decimal("9999999999999.99")  # Numeric(15, 2)
TAMANHO_MAXIMO_NOME = 255

MSG_OBRIGATORIO = "Campo obrigatório ausente"


@dataclass(frozen=True)
class ErroValidacao:
    campo: str
    regra: str
    valor: str


@dataclass
class ResultadoLinha:
    dados: dict | None = None
    erros: list[ErroValidacao] = field(default_factory=list)


# --------------------------------------------------------------------------
# Documento (RN04)
# --------------------------------------------------------------------------
def somente_digitos(texto: str | None) -> str:
    return re.sub(r"\D", "", texto or "")


def normalizar_documento(documento: str | None) -> str:
    """Devolve só os dígitos. O Excel remove zeros à esquerda de CPF/CNPJ
    gravados como número, então 10 dígitos viram CPF e 13 viram CNPJ."""
    digitos = somente_digitos(documento)
    if len(digitos) == 10:
        return digitos.zfill(11)
    if len(digitos) == 13:
        return digitos.zfill(14)
    return digitos


def _digito(soma: int) -> int:
    resto = soma % 11
    return 0 if resto < 2 else 11 - resto


def _cpf_valido(cpf: str) -> bool:
    d1 = _digito(sum(int(cpf[i]) * (10 - i) for i in range(9)))
    d2 = _digito(sum(int(cpf[i]) * (11 - i) for i in range(10)))
    return cpf[-2:] == f"{d1}{d2}"


def _cnpj_valido(cnpj: str) -> bool:
    pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    d1 = _digito(sum(int(cnpj[i]) * pesos1[i] for i in range(12)))
    d2 = _digito(sum(int(cnpj[i]) * pesos2[i] for i in range(13)))
    return cnpj[-2:] == f"{d1}{d2}"


def validar_cpf_cnpj(documento: str | None) -> bool:
    digitos = normalizar_documento(documento)
    if len(digitos) not in (11, 14) or len(set(digitos)) == 1:
        return False  # tamanho errado ou todos os dígitos iguais
    return _cpf_valido(digitos) if len(digitos) == 11 else _cnpj_valido(digitos)


# --------------------------------------------------------------------------
# Demais campos
# --------------------------------------------------------------------------
def validar_email(valor: str | None) -> bool:
    if not valor or "@" not in valor:
        return False
    try:
        validate_email(valor, check_deliverability=False)  # sem consulta de DNS
        return True
    except EmailNotValidError:
        return False


def converter_valor(valor: str | None) -> Decimal | None:
    """Numérico positivo com ponto decimal (ex.: 1500.00). Aceita até 2 casas."""
    texto = (valor or "").strip()
    if not re.fullmatch(r"\d+(\.\d{1,2})?", texto):
        return None
    numero = Decimal(texto)
    return numero if 0 < numero <= VALOR_MAXIMO else None


def converter_data(valor: str | None) -> date | None:
    """Aceita DD/MM/AAAA ou AAAA-MM-DD (com ou sem horário, como vem do Excel)."""
    texto = (valor or "").strip()[:10]
    if re.fullmatch(r"\d{2}/\d{2}/\d{4}", texto):
        formato = "%d/%m/%Y"
    elif re.fullmatch(r"\d{4}-\d{2}-\d{2}", texto):
        formato = "%Y-%m-%d"
    else:
        return None
    try:
        return datetime.strptime(texto, formato).date()
    except ValueError:  # ex.: 31/02/2026
        return None


def normalizar_telefone(valor: str | None) -> str | None:
    """DDD + número (10 ou 11 dígitos). Aceita o prefixo 55. None se inválido."""
    digitos = somente_digitos(valor)
    if len(digitos) in (12, 13) and digitos.startswith("55"):
        digitos = digitos[2:]
    return digitos if len(digitos) in (10, 11) else None


# --------------------------------------------------------------------------
# Linha completa
# --------------------------------------------------------------------------
def _texto(valor) -> str:
    return "" if valor is None else str(valor).strip()


def _limitar(texto: str) -> str:
    return texto[:500]  # cabe em erros_lote.valor_informado


def validar_linha(linha: dict) -> ResultadoLinha:
    """Valida uma linha e devolve os dados limpos ou todos os erros encontrados."""
    erros: list[ErroValidacao] = []

    def registrar(campo: str, regra: str, valor: str) -> None:
        erros.append(ErroValidacao(campo, regra, _limitar(valor)))

    documento_bruto = _texto(linha.get("cpf_cnpj"))
    documento = normalizar_documento(documento_bruto)
    if not documento_bruto:
        registrar("cpf_cnpj", MSG_OBRIGATORIO, "")
    elif not validar_cpf_cnpj(documento_bruto):
        registrar("cpf_cnpj", "CPF/CNPJ inválido (tamanho ou dígito verificador incorreto)", documento_bruto)

    nome = _texto(linha.get("nome"))
    if not nome:
        registrar("nome", MSG_OBRIGATORIO, "")
    elif len(nome) > TAMANHO_MAXIMO_NOME:
        registrar("nome", f"Nome excede {TAMANHO_MAXIMO_NOME} caracteres", nome)

    email = _texto(linha.get("email"))
    if not email:
        registrar("email", MSG_OBRIGATORIO, "")
    elif not validar_email(email):
        registrar("email", "Formato de e-mail inválido", email)

    valor_bruto = _texto(linha.get("valor_divida"))
    valor = converter_valor(valor_bruto)
    if not valor_bruto:
        registrar("valor_divida", MSG_OBRIGATORIO, "")
    elif valor is None:
        registrar("valor_divida", "Valor deve ser numérico positivo (ex: 1500.00)", valor_bruto)

    data_bruta = _texto(linha.get("data_vencimento"))
    vencimento = converter_data(data_bruta)
    if not data_bruta:
        registrar("data_vencimento", MSG_OBRIGATORIO, "")
    elif vencimento is None:
        registrar("data_vencimento", "Formato de data inválido (use DD/MM/AAAA ou AAAA-MM-DD)", data_bruta)

    telefones: dict[str, str | None] = {}
    for campo in COLUNAS_OPCIONAIS:
        bruto = _texto(linha.get(campo))
        telefones[campo] = normalizar_telefone(bruto) if bruto else None
        if bruto and telefones[campo] is None:
            registrar(campo, "Telefone inválido (use DDD + número, ex: 47999990000)", bruto)

    if erros:
        return ResultadoLinha(erros=erros)

    return ResultadoLinha(
        dados={
            "cpf_cnpj": documento,
            "nome": nome,
            "email": email.lower(),
            "telefone": telefones["telefone"],
            "whatsapp": telefones["whatsapp"],
            "valor_divida": valor,
            "data_vencimento": vencimento,
        }
    )