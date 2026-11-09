"""Testes da task de ingestão de lotes (RF02, RF03, RNF03).

Usam o banco SQLite de teste e arquivos reais em disco, no lugar de mocks:
assim o teste pega divergências entre a task e os models.
"""
import uuid
from decimal import Decimal
from pathlib import Path

import pandas as pd
import pytest
from sqlalchemy import select

import app.worker.tasks as tasks
from app.core.config import settings
from app.core.crypto import descriptografar_decimal
from app.models.domain import (
    Devedor,
    ErroLote,
    Lote,
    StatusDevedorEnum,
    StatusLoteEnum,
)
from app.worker.tasks import processar_lote_task

CABECALHO = "cpf_cnpj,nome,email,valor_divida,data_vencimento,telefone"
LINHA_OK = "529.982.247-25,Maria Silva,maria@exemplo.com,1500.00,12/04/2026,47999990000"
LINHA_OK_2 = "111.444.777-35,Joao Souza,joao@exemplo.com,890.00,2026-03-10,"
LINHA_OK_3 = "390.533.447-05,Pedro Lima,pedro@exemplo.com,4200.00,15/02/2026,"
LINHA_CNPJ = "11.222.333/0001-81,Empresa ABC,contato@abc.com.br,2500.50,01/03/2026,"
LINHA_CPF_INVALIDO = "123.456.789-00,CPF Invalido,x@exemplo.com,100.00,12/04/2026,"


@pytest.fixture
def novo_lote(db, criar_usuario):
    usuario = criar_usuario()

    def _criar(status=StatusLoteEnum.pendente) -> Lote:
        lote = Lote(
            id=uuid.uuid4(),
            usuario_id=usuario.id,
            nome_arquivo="teste.csv",
            status=status,
        )
        db.add(lote)
        db.commit()
        return lote

    return _criar


@pytest.fixture
def escrever_csv(tmp_path):
    def _escrever(linhas: list[str], nome="lote.csv", separador=",", codificacao="utf-8") -> str:
        texto = "\n".join(linhas).replace(",", separador) + "\n"
        caminho = tmp_path / nome
        caminho.write_bytes(texto.encode(codificacao))
        return str(caminho)

    return _escrever


@pytest.fixture
def processar(db):
    """Roda a task e devolve (mensagem, lote_recarregado)."""

    def _processar(lote: Lote, caminho: str):
        mensagem = processar_lote_task(str(lote.id), caminho)
        db.expire_all()
        return mensagem, db.get(Lote, lote.id)

    return _processar


def _devedores(db, lote_id) -> list[Devedor]:
    return list(db.scalars(select(Devedor).where(Devedor.lote_id == lote_id)))


def _erros(db, lote_id) -> list[ErroLote]:
    return list(
        db.scalars(
            select(ErroLote)
            .where(ErroLote.lote_id == lote_id)
            .order_by(ErroLote.numero_linha, ErroLote.campo)
        )
    )


# --------------------------------------------------------------------------
# Caminho feliz e linhas rejeitadas
# --------------------------------------------------------------------------


def test_linhas_validas_e_invalidas(db, novo_lote, escrever_csv, processar):
    lote = novo_lote()
    caminho = escrever_csv([CABECALHO, LINHA_OK, LINHA_CPF_INVALIDO, LINHA_CNPJ])

    mensagem, lote = processar(lote, caminho)

    assert lote.status == StatusLoteEnum.concluido
    assert (lote.total_registros, lote.total_importados, lote.total_rejeitados) == (3, 2, 1)
    assert "2 importados, 1 rejeitados" in mensagem
    assert lote.iniciado_em is not None and lote.finalizado_em is not None
    assert len(_devedores(db, lote.id)) == 2


def test_lote_com_linhas_rejeitadas_fica_concluido_e_nao_com_erro(
    db, novo_lote, escrever_csv, processar
):
    """'erro' é só para falha do arquivo; linha rejeitada vai para o relatório."""
    lote = novo_lote()

    _, lote = processar(lote, escrever_csv([CABECALHO, LINHA_CPF_INVALIDO]))

    assert lote.status == StatusLoteEnum.concluido
    assert lote.total_importados == 0


def test_erros_guardam_linha_campo_regra_e_valor(db, novo_lote, escrever_csv, processar):
    lote = novo_lote()
    caminho = escrever_csv([CABECALHO, LINHA_OK, LINHA_CPF_INVALIDO])

    processar(lote, caminho)

    erro = _erros(db, lote.id)[0]
    assert erro.numero_linha == 3  # cabeçalho = 1, primeira linha de dados = 2
    assert erro.campo == "cpf_cnpj"
    assert "inválido" in erro.regra_violada
    assert erro.valor_informado == "123.456.789-00"


def test_varios_erros_na_mesma_linha_geram_varios_registros(
    db, novo_lote, escrever_csv, processar
):
    lote = novo_lote()
    linha_ruim = "123.456.789-00,Nome,sem-arroba,-10,31/13/2026,123"

    _, lote = processar(lote, escrever_csv([CABECALHO, linha_ruim]))

    campos = {e.campo for e in _erros(db, lote.id)}
    assert campos == {"cpf_cnpj", "email", "valor_divida", "data_vencimento", "telefone"}
    assert lote.total_rejeitados == 1  # conta linhas, não erros


def test_devedor_gravado_com_dados_normalizados(db, novo_lote, escrever_csv, processar):
    lote = novo_lote()

    processar(lote, escrever_csv([CABECALHO, LINHA_OK]))

    devedor = _devedores(db, lote.id)[0]
    assert devedor.cpf_cnpj == "52998224725"  # só dígitos
    assert devedor.nome == "Maria Silva"
    assert devedor.telefone == "47999990000"
    assert devedor.status == StatusDevedorEnum.ativo
    assert str(devedor.data_vencimento) == "2026-04-12"


def test_valor_da_divida_e_gravado_criptografado(db, novo_lote, escrever_csv, processar):
    """RNF05: o valor nunca fica legível no banco."""
    lote = novo_lote()

    processar(lote, escrever_csv([CABECALHO, LINHA_OK]))

    devedor = _devedores(db, lote.id)[0]
    assert b"1500" not in devedor.valor_divida_enc
    assert descriptografar_decimal(devedor.valor_divida_enc) == Decimal("1500.00")


# --------------------------------------------------------------------------
# Formatos de arquivo (RF01)
# --------------------------------------------------------------------------


def test_csv_com_ponto_e_virgula(db, novo_lote, escrever_csv, processar):
    lote = novo_lote()
    caminho = escrever_csv([CABECALHO, LINHA_OK, LINHA_OK_2], separador=";")

    _, lote = processar(lote, caminho)

    assert lote.total_importados == 2


def test_csv_em_latin1_como_o_excel_brasileiro_salva(db, novo_lote, escrever_csv, processar):
    lote = novo_lote()
    linha = "529.982.247-25,José da Conceição,jose@exemplo.com,100.00,12/04/2026,"
    caminho = escrever_csv([CABECALHO, linha], codificacao="latin-1")

    _, lote = processar(lote, caminho)

    assert lote.total_importados == 1
    assert _devedores(db, lote.id)[0].nome == "José da Conceição"


def test_csv_utf8_com_bom(db, novo_lote, escrever_csv, processar):
    lote = novo_lote()
    caminho = escrever_csv([CABECALHO, LINHA_OK], codificacao="utf-8-sig")

    _, lote = processar(lote, caminho)

    assert lote.total_importados == 1


def test_cabecalho_com_maiusculas_e_espacos(db, novo_lote, escrever_csv, processar):
    lote = novo_lote()
    cabecalho = "CPF_CNPJ,Nome,Email,Valor Divida,Data Vencimento,Telefone"
    caminho = escrever_csv([cabecalho, LINHA_OK])

    _, lote = processar(lote, caminho)

    assert lote.total_importados == 1


def test_arquivo_xlsx(db, novo_lote, tmp_path, processar):
    lote = novo_lote()
    caminho = tmp_path / "lote.xlsx"
    pd.DataFrame(
        [
            {
                "cpf_cnpj": "390.533.447-05",
                "nome": "Pedro Xlsx",
                "email": "pedro@exemplo.com",
                "valor_divida": "300.00",
                "data_vencimento": "2026-04-01 00:00:00",
            }
        ]
    ).to_excel(caminho, index=False)

    _, lote = processar(lote, str(caminho))

    assert lote.status == StatusLoteEnum.concluido
    assert lote.total_importados == 1
    assert _devedores(db, lote.id)[0].nome == "Pedro Xlsx"


def test_arquivo_xls(db, novo_lote, tmp_path, processar):
    xlwt = pytest.importorskip("xlwt")
    lote = novo_lote()
    planilha = xlwt.Workbook()
    aba = planilha.add_sheet("lote")
    for coluna, valor in enumerate(
        ["cpf_cnpj", "nome", "email", "valor_divida", "data_vencimento"]
    ):
        aba.write(0, coluna, valor)
    for coluna, valor in enumerate(
        ["11222333000181", "Empresa Xls", "e@abc.com.br", "700.00", "05/05/2026"]
    ):
        aba.write(1, coluna, valor)
    caminho = tmp_path / "lote.xls"
    planilha.save(str(caminho))

    _, lote = processar(lote, str(caminho))

    assert lote.status == StatusLoteEnum.concluido
    assert lote.total_importados == 1


def test_excel_que_perdeu_o_zero_do_cpf_ainda_e_aceito(db, novo_lote, tmp_path, processar):
    lote = novo_lote()
    caminho = tmp_path / "lote.xlsx"
    pd.DataFrame(
        [
            {
                "cpf_cnpj": 1234567890,  # número: o Excel removeu o zero de 01234567890
                "nome": "Zero Perdido",
                "email": "zero@exemplo.com",
                "valor_divida": "10.00",
                "data_vencimento": "01/04/2026",
            }
        ]
    ).to_excel(caminho, index=False)

    _, lote = processar(lote, str(caminho))

    assert lote.total_importados == 1
    assert _devedores(db, lote.id)[0].cpf_cnpj == "01234567890"


# --------------------------------------------------------------------------
# Duplicados
# --------------------------------------------------------------------------


def test_documento_duplicado_no_proprio_arquivo(db, novo_lote, escrever_csv, processar):
    lote = novo_lote()
    repetida = "529.982.247-25,Outro Nome,outro@exemplo.com,50.00,12/04/2026,"
    caminho = escrever_csv([CABECALHO, LINHA_OK, repetida])

    _, lote = processar(lote, caminho)

    assert (lote.total_importados, lote.total_rejeitados) == (1, 1)
    erro = _erros(db, lote.id)[0]
    assert erro.numero_linha == 3
    assert "duplicado no arquivo" in erro.regra_violada
    assert "linha 2" in erro.regra_violada  # aponta a primeira ocorrência


def test_documento_ja_cadastrado_em_outro_lote(db, novo_lote, escrever_csv, processar):
    primeiro = novo_lote()
    processar(primeiro, escrever_csv([CABECALHO, LINHA_OK], nome="a.csv"))

    segundo = novo_lote()
    _, segundo = processar(segundo, escrever_csv([CABECALHO, LINHA_OK, LINHA_OK_2], nome="b.csv"))

    assert (segundo.total_importados, segundo.total_rejeitados) == (1, 1)
    assert "já cadastrado" in _erros(db, segundo.id)[0].regra_violada


def test_mesmo_cpf_com_e_sem_mascara_conta_como_duplicado(
    db, novo_lote, escrever_csv, processar
):
    lote = novo_lote()
    sem_mascara = "52998224725,Mesmo CPF,m@exemplo.com,10.00,12/04/2026,"

    _, lote = processar(lote, escrever_csv([CABECALHO, LINHA_OK, sem_mascara]))

    assert (lote.total_importados, lote.total_rejeitados) == (1, 1)


# --------------------------------------------------------------------------
# Falhas do arquivo (lote vai para 'erro')
# --------------------------------------------------------------------------


def test_colunas_obrigatorias_ausentes(db, novo_lote, escrever_csv, processar):
    lote = novo_lote()

    mensagem, lote = processar(lote, escrever_csv(["a,b", "1,2"]))

    assert lote.status == StatusLoteEnum.erro
    assert "Colunas obrigatórias ausentes" in mensagem
    erro = _erros(db, lote.id)[0]
    assert erro.campo == "cabecalho"
    assert "cpf_cnpj" in erro.regra_violada


def test_arquivo_so_com_cabecalho(db, novo_lote, escrever_csv, processar):
    lote = novo_lote()

    _, lote = processar(lote, escrever_csv([CABECALHO]))

    assert lote.status == StatusLoteEnum.erro
    assert "não contém registros" in _erros(db, lote.id)[0].regra_violada


def test_arquivo_acima_do_limite_de_registros(db, novo_lote, escrever_csv, processar, monkeypatch):
    monkeypatch.setattr(settings, "max_registros_lote", 2)
    lote = novo_lote()

    _, lote = processar(lote, escrever_csv([CABECALHO, LINHA_OK, LINHA_OK_2, LINHA_OK_3]))

    assert lote.status == StatusLoteEnum.erro
    assert "excede o limite de 2 registros" in _erros(db, lote.id)[0].regra_violada
    assert _devedores(db, lote.id) == []


def test_limite_exato_de_registros_e_aceito(db, novo_lote, escrever_csv, processar, monkeypatch):
    monkeypatch.setattr(settings, "max_registros_lote", 2)
    lote = novo_lote()

    _, lote = processar(lote, escrever_csv([CABECALHO, LINHA_OK, LINHA_OK_2]))

    assert lote.status == StatusLoteEnum.concluido


def test_arquivo_corrompido(db, novo_lote, tmp_path, processar):
    lote = novo_lote()
    caminho = tmp_path / "quebrado.xlsx"
    caminho.write_bytes(b"isto nao e uma planilha")

    _, lote = processar(lote, str(caminho))

    assert lote.status == StatusLoteEnum.erro
    assert _erros(db, lote.id)[0].campo == "arquivo"


def test_extensao_nao_suportada(db, novo_lote, tmp_path, processar):
    lote = novo_lote()
    caminho = tmp_path / "lote.pdf"
    caminho.write_bytes(b"%PDF")

    _, lote = processar(lote, str(caminho))

    assert lote.status == StatusLoteEnum.erro


# --------------------------------------------------------------------------
# Blocos, progresso e robustez
# --------------------------------------------------------------------------


def test_processamento_em_varios_blocos(db, novo_lote, escrever_csv, processar, monkeypatch):
    """A cada bloco grava e atualiza o progresso; o resultado final não muda."""
    monkeypatch.setattr(tasks, "TAMANHO_BLOCO", 2)
    lote = novo_lote()
    caminho = escrever_csv(
        [CABECALHO, LINHA_OK, LINHA_CPF_INVALIDO, LINHA_OK_2, LINHA_CNPJ, LINHA_OK_3]
    )

    _, lote = processar(lote, caminho)

    assert (lote.total_registros, lote.total_importados, lote.total_rejeitados) == (5, 4, 1)
    assert len(_devedores(db, lote.id)) == 4
    assert [e.numero_linha for e in _erros(db, lote.id)] == [3]


def test_arquivo_e_apagado_depois_do_processamento(novo_lote, escrever_csv, processar):
    """Dados pessoais não podem ficar no disco."""
    lote = novo_lote()
    caminho = escrever_csv([CABECALHO, LINHA_OK])

    processar(lote, caminho)

    assert not Path(caminho).exists()


def test_arquivo_e_apagado_mesmo_quando_o_lote_falha(novo_lote, escrever_csv, processar):
    lote = novo_lote()
    caminho = escrever_csv(["a,b", "1,2"])

    processar(lote, caminho)

    assert not Path(caminho).exists()


def test_lote_inexistente(escrever_csv):
    caminho = escrever_csv([CABECALHO, LINHA_OK])

    mensagem = processar_lote_task(str(uuid.uuid4()), caminho)

    assert "não encontrado" in mensagem
    assert not Path(caminho).exists()


def test_task_e_idempotente_lote_ja_processado_nao_duplica(
    db, novo_lote, escrever_csv, processar
):
    """O Celery usa acks_late: a mesma mensagem pode ser entregue duas vezes."""
    lote = novo_lote()
    processar(lote, escrever_csv([CABECALHO, LINHA_OK], nome="a.csv"))

    mensagem, lote = processar(lote, escrever_csv([CABECALHO, LINHA_OK_2], nome="b.csv"))

    assert "já foi processado" in mensagem
    assert len(_devedores(db, lote.id)) == 1


def test_reentrega_depois_de_queda_recomeca_sem_duplicar(
    db, novo_lote, escrever_csv, processar
):
    """O worker caiu no meio (status 'processando', com dados parciais)."""
    lote = novo_lote(status=StatusLoteEnum.processando)
    parcial = Devedor(
        lote_id=lote.id,
        cpf_cnpj="52998224725",
        nome="Parcial",
        valor_divida_enc=b"x",
        data_vencimento=pd.Timestamp("2026-04-12").date(),
    )
    db.add(parcial)
    db.add(ErroLote(lote_id=lote.id, numero_linha=9, campo="x", regra_violada="resto"))
    db.commit()

    _, lote = processar(lote, escrever_csv([CABECALHO, LINHA_OK, LINHA_OK_2]))

    devedores = _devedores(db, lote.id)
    assert sorted(d.nome for d in devedores) == ["Joao Souza", "Maria Silva"]
    assert _erros(db, lote.id) == []
    assert lote.total_importados == 2


def test_erro_inesperado_marca_o_lote_como_erro_e_repropaga(
    db, novo_lote, escrever_csv, monkeypatch
):
    lote = novo_lote()
    caminho = escrever_csv([CABECALHO, LINHA_OK])

    def explodir(*args, **kwargs):
        raise RuntimeError("falha inesperada")

    monkeypatch.setattr(tasks, "_processar", explodir)

    with pytest.raises(RuntimeError):
        processar_lote_task(str(lote.id), caminho)

    db.expire_all()
    assert db.get(Lote, lote.id).status == StatusLoteEnum.erro
    assert not Path(caminho).exists()


def test_celulas_vazias_do_csv_nao_viram_a_palavra_nan(db, novo_lote, escrever_csv, processar):
    lote = novo_lote()

    processar(lote, escrever_csv([CABECALHO, LINHA_OK_2]))  # telefone vazio

    assert _devedores(db, lote.id)[0].telefone is None