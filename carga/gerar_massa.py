"""Gera um CSV de devedores FICTÍCIOS para teste de carga (RNF01/RNF02) e de volume (RNF03).

Formato aceito pela importação de lotes:
    cpf_cnpj,nome,email,valor_divida,data_vencimento,telefone,whatsapp

- CPFs com dígitos verificadores válidos (gerados, não pertencem a ninguém de propósito,
  mas podem coincidir com CPFs reais por acaso: use só em ambiente de teste);
- e-mails no domínio reservado example.com (RFC 2606: nunca entrega a ninguém);
- vencimentos espalhados de 0 a 120 dias atrás, com parte exatamente em D+1, D+5 e D+15
  (para a régua ter elegíveis);
- sem e-mails "bounce..."/"falha..." e sem telefones terminados em 0000/9999, que o envio
  simulado trata como falha.

Uso (só biblioteca padrão; qualquer Python 3.10+):
    python carga/gerar_massa.py                       # 5.000 devedores -> carga/massa-5000.csv
    python carga/gerar_massa.py --quantidade 50000    # lote do RNF03 (limite de 50.000 registros)
"""
import argparse
import csv
import random
from datetime import date, timedelta
from pathlib import Path

NOMES = [
    "Ana", "Bruno", "Carla", "Carlos", "Daniela", "Eduardo", "Fernanda", "Gabriel", "Helena", "Igor",
    "Juliana", "Lucas", "Maria", "Marcos", "Natália", "Otávio", "Patrícia", "Rafael", "Sabrina", "Tiago",
]
SOBRENOMES = [
    "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes",
    "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa",
]
DDDS = ["47", "48", "11", "21", "31", "41", "51", "61"]
# Atrasos "redondos" das réguas típicas, para haver elegíveis
ATRASOS_DA_REGUA = [1, 5, 15]


def cpf_valido(rng: random.Random, usados: set[str]) -> str:
    while True:
        base = [rng.randint(0, 9) for _ in range(9)]
        if len(set(base)) == 1:  # 111.111.111-xx e afins são inválidos
            continue
        for tamanho in (9, 10):
            soma = sum(d * (tamanho + 1 - i) for i, d in enumerate(base[:tamanho]))
            resto = (soma * 10) % 11
            base.append(0 if resto == 10 else resto)
        cpf = "".join(map(str, base))
        if cpf not in usados:
            usados.add(cpf)
            return cpf


def telefone(rng: random.Random) -> str:
    while True:
        numero = f"{rng.choice(DDDS)}9{rng.randint(0, 99_999_999):08d}"
        if not numero.endswith(("0000", "9999")):
            return numero


def gerar(quantidade: int, semente: int) -> list[dict[str, str]]:
    rng = random.Random(semente)
    hoje = date.today()
    usados: set[str] = set()
    linhas = []
    for i in range(quantidade):
        nome = f"{rng.choice(NOMES)} {rng.choice(SOBRENOMES)} {rng.choice(SOBRENOMES)}"
        primeiro, *_, ultimo = nome.lower().split()
        atraso = rng.choice(ATRASOS_DA_REGUA) if rng.random() < 0.2 else rng.randint(0, 120)
        tem_tel = rng.random() < 0.8
        linhas.append({
            "cpf_cnpj": cpf_valido(rng, usados),
            "nome": nome,
            "email": f"{primeiro}.{ultimo}.{i}@example.com",
            "valor_divida": f"{rng.uniform(80, 25_000):.2f}",
            "data_vencimento": (hoje - timedelta(days=atraso)).strftime("%d/%m/%Y"),
            "telefone": telefone(rng) if tem_tel else "",
            "whatsapp": telefone(rng) if tem_tel and rng.random() < 0.6 else "",
        })
    return linhas


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--quantidade", type=int, default=5000, help="número de devedores (máx. 50.000 por lote)")
    parser.add_argument("--semente", type=int, default=42, help="mesma semente = mesmo arquivo")
    parser.add_argument("--saida", type=Path, help="arquivo de saída (padrão: carga/massa-QUANTIDADE.csv)")
    args = parser.parse_args()
    if not 1 <= args.quantidade <= 50_000:
        parser.error("--quantidade deve estar entre 1 e 50.000 (limite de registros por lote).")

    saida = args.saida or Path(__file__).parent / f"massa-{args.quantidade}.csv"
    linhas = gerar(args.quantidade, args.semente)
    with saida.open("w", newline="", encoding="utf-8") as arquivo:
        escritor = csv.DictWriter(arquivo, fieldnames=list(linhas[0]))
        escritor.writeheader()
        escritor.writerows(linhas)
    tamanho_mb = saida.stat().st_size / 1_048_576
    print(f"{len(linhas)} devedores fictícios em {saida} ({tamanho_mb:.1f} MB).")


if __name__ == "__main__":
    main()
