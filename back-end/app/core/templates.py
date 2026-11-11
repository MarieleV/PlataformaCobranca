"""Templates das mensagens da régua (RF04).

Formato: texto com variáveis entre chaves, ex.: "Olá, {primeiro_nome}!".
A substituição é feita por expressão regular e NÃO por str.format(): assim o
texto digitado por um usuário nunca consegue acessar atributos do Python
(ex.: "{nome.__class__}") nem executar nada.
"""
import re
from datetime import date
from decimal import Decimal

from app.core.datas import hoje
from app.models.domain import CanalEnum, Devedor

# nome da variável -> (descrição mostrada no editor, exemplo)
VARIAVEIS: dict[str, tuple[str, str]] = {
    "nome": ("Nome completo do devedor", "Maria Silva Santos"),
    "primeiro_nome": ("Primeiro nome do devedor", "Maria"),
    "valor": ("Valor da dívida", "R$ 1.234,56"),
    "data_vencimento": ("Data de vencimento da dívida", "15/10/2026"),
    "dias_atraso": ("Dias de atraso na data do envio", "15"),
}

# Limite de caracteres por canal (SMS concatenado em até 3 partes de 160)
LIMITE_POR_CANAL: dict[CanalEnum, int] = {
    CanalEnum.sms: 480,
    CanalEnum.whatsapp: 1024,
    CanalEnum.email: 5000,
}

_PADRAO_VARIAVEL = re.compile(r"\{([^{}]*)\}")


class TemplateInvalido(ValueError):
    """Mensagem de erro pronta para ser mostrada ao usuário."""


def variaveis_usadas(template: str) -> list[str]:
    """Variáveis do template, na ordem em que aparecem, sem repetição."""
    return list(dict.fromkeys(_PADRAO_VARIAVEL.findall(template)))


def validar_template(template: str, canal: CanalEnum) -> None:
    if not template.strip():
        raise TemplateInvalido("O template não pode ficar vazio")

    limite = LIMITE_POR_CANAL[canal]
    if len(template) > limite:
        raise TemplateInvalido(
            f"O template excede o limite de {limite} caracteres do canal {canal.value}"
        )

    desconhecidas = [v for v in variaveis_usadas(template) if v not in VARIAVEIS]
    if desconhecidas:
        nomes = ", ".join("{" + v + "}" for v in desconhecidas)
        validas = ", ".join("{" + v + "}" for v in VARIAVEIS)
        raise TemplateInvalido(f"Variável desconhecida: {nomes}. Disponíveis: {validas}")

    if "{" in _PADRAO_VARIAVEL.sub("", template) or "}" in _PADRAO_VARIAVEL.sub("", template):
        raise TemplateInvalido("Há chaves { } soltas ou mal fechadas no template")


def formatar_valor(valor: Decimal) -> str:
    """1234.5 -> 'R$ 1.234,50' (formato brasileiro)."""
    texto = f"{valor:,.2f}"
    return "R$ " + texto.replace(",", "X").replace(".", ",").replace("X", ".")


def renderizar(template: str, contexto: dict[str, str]) -> str:
    return _PADRAO_VARIAVEL.sub(lambda m: contexto.get(m.group(1), m.group(0)), template)


def contexto_de_exemplo() -> dict[str, str]:
    return {nome: exemplo for nome, (_, exemplo) in VARIAVEIS.items()}


def contexto_do_devedor(devedor: Devedor, valor: Decimal, dia: date | None = None) -> dict[str, str]:
    dia = dia or hoje()
    nome = devedor.nome.strip()
    return {
        "nome": nome,
        "primeiro_nome": nome.split()[0] if nome else "",
        "valor": formatar_valor(valor),
        "data_vencimento": devedor.data_vencimento.strftime("%d/%m/%Y"),
        "dias_atraso": str(max((dia - devedor.data_vencimento).days, 0)),
    }
