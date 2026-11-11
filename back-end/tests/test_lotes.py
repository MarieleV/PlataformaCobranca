import uuid
from pathlib import Path

import pytest
from kombu.exceptions import OperationalError
from sqlalchemy import select

import app.api.lotes as lotes_api
from app.core.config import settings
from app.models.domain import CargoEnum, Devedor, ErroLote, Lote, StatusLoteEnum
from app.worker.tasks import processar_lote_task

CSV_VALIDO = (
    "cpf_cnpj,nome,email,valor_divida,data_vencimento,telefone\n"
    "529.982.247-25,Maria Silva,maria@exemplo.com,1500.00,12/04/2026,47999990000\n"
    "123.456.789-00,CPF Invalido,x@exemplo.com,100.00,12/04/2026,\n"
).encode()


@pytest.fixture
def fila(monkeypatch):
    """Captura o que seria enviado ao RabbitMQ, sem enfileirar de verdade."""
    enviados: list[tuple[str, str]] = []
    monkeypatch.setattr(
        lotes_api.processar_lote_task,
        "delay",
        lambda lote_id, caminho: enviados.append((lote_id, caminho)),
    )
    return enviados


def _upload(client, conteudo=CSV_VALIDO, nome="lote.csv"):
    return client.post("/lotes/upload", files={"file": (nome, conteudo, "text/csv")})


# --------------------------------------------------------------------------
# Autenticação
# --------------------------------------------------------------------------


def test_acesso_lotes_sem_autenticacao_deve_falhar(client):
    resposta = client.get("/lotes/")

    assert resposta.status_code == 401
    assert resposta.json() == {"detail": "Não autenticado"}


@pytest.mark.parametrize(
    "metodo, caminho",
    [
        ("get", f"/lotes/{uuid.uuid4()}"),
        ("get", f"/lotes/{uuid.uuid4()}/erros"),
        ("get", f"/lotes/{uuid.uuid4()}/erros/csv"),
    ],
)
def test_rotas_de_lote_exigem_login(client, metodo, caminho):
    assert getattr(client, metodo)(caminho).status_code == 401


def test_upload_sem_login_retorna_401(client, fila):
    assert _upload(client).status_code == 401
    assert fila == []


# --------------------------------------------------------------------------
# Upload (RF01)
# --------------------------------------------------------------------------


def test_upload_enfileira_e_cria_lote_pendente(logar, db, fila, pasta_uploads):
    client = logar(CargoEnum.operador)

    resposta = _upload(client)

    assert resposta.status_code == 200
    lote_id = resposta.json()["lote_id"]
    assert "Processamento iniciado" in resposta.json()["message"]
    lote = db.get(Lote, uuid.UUID(lote_id))
    assert lote.status == StatusLoteEnum.pendente
    assert lote.nome_arquivo == "lote.csv"
    assert lote.usuario_id == client.usuario.id
    assert len(fila) == 1 and fila[0][0] == lote_id


@pytest.mark.parametrize("cargo", list(CargoEnum))
def test_todos_os_perfis_podem_importar(logar, fila, cargo):
    """RN01: operador ou superior."""
    assert _upload(logar(cargo)).status_code == 200


@pytest.mark.parametrize("nome", ["lote.csv", "lote.xlsx", "lote.xls", "LOTE.CSV", "lote.Xlsx"])
def test_extensoes_aceitas(logar, fila, nome):
    assert _upload(logar(), nome=nome).status_code == 200


@pytest.mark.parametrize("nome", ["lote.pdf", "lote.txt", "lote.exe", "lote", "lote.csv.exe"])
def test_formato_invalido_retorna_422_sem_enfileirar(logar, fila, nome):
    resposta = _upload(logar(), nome=nome)

    assert resposta.status_code == 422
    assert "Formato inválido" in resposta.json()["detail"]
    assert fila == []


def test_arquivo_vazio_retorna_422(logar, fila):
    resposta = _upload(logar(), conteudo=b"")

    assert resposta.status_code == 422
    assert fila == []


def test_arquivo_acima_do_limite_retorna_413(logar, fila, monkeypatch):
    monkeypatch.setattr(settings, "max_upload_mb", 0)

    resposta = _upload(logar())

    assert resposta.status_code == 413
    assert fila == []


def test_upload_sem_arquivo_retorna_422(logar):
    assert logar().post("/lotes/upload").status_code == 422


def test_arquivo_e_salvo_com_o_id_do_lote_e_nunca_com_o_nome_enviado(
    logar, fila, pasta_uploads
):
    """O nome vindo do usuário não pode virar caminho no disco (path traversal)."""
    client = logar()

    resposta = _upload(client, nome="../../../etc/passwd.csv")

    assert resposta.status_code == 200
    lote_id = resposta.json()["lote_id"]
    caminho = Path(fila[0][1])
    assert caminho.parent == pasta_uploads
    assert caminho.name == f"{lote_id}.csv"
    assert caminho.exists()
    assert "passwd" not in caminho.name


def test_broker_fora_do_ar_retorna_503_e_limpa(logar, db, pasta_uploads, monkeypatch):
    client = logar()

    def broker_fora(*args, **kwargs):
        raise OperationalError("RabbitMQ indisponível")

    monkeypatch.setattr(lotes_api.processar_lote_task, "delay", broker_fora)

    resposta = _upload(client)

    assert resposta.status_code == 503
    assert "indisponível" in resposta.json()["detail"]
    lote = db.scalars(select(Lote)).one()
    assert lote.status == StatusLoteEnum.erro
    assert list(pasta_uploads.glob("*.csv")) == []  # arquivo removido


# --------------------------------------------------------------------------
# Fluxo completo: upload → worker → consulta
# --------------------------------------------------------------------------


def test_fluxo_completo_upload_processamento_e_relatorio(logar, db, fila):
    client = logar()
    lote_id = _upload(client).json()["lote_id"]

    processar_lote_task(*fila[0])  # o worker processa a mensagem

    detalhe = client.get(f"/lotes/{lote_id}").json()
    assert detalhe["status"] == "concluido"
    assert detalhe["total_registros"] == 2
    assert detalhe["total_importados"] == 1
    assert detalhe["total_rejeitados"] == 1
    assert detalhe["progresso_percentual"] == 100
    erros = client.get(f"/lotes/{lote_id}/erros").json()
    assert erros[0]["numero_linha"] == 3
    assert erros[0]["campo"] == "cpf_cnpj"
    assert db.scalars(select(Devedor)).one().nome == "Maria Silva"


# --------------------------------------------------------------------------
# Consulta
# --------------------------------------------------------------------------


def _criar_lote(db, usuario_id, **campos) -> Lote:
    lote = Lote(usuario_id=usuario_id, nome_arquivo="x.csv", **campos)
    db.add(lote)
    db.commit()
    db.refresh(lote)
    return lote


def test_listar_lotes(logar, db):
    client = logar()
    _criar_lote(db, client.usuario.id)
    _criar_lote(db, client.usuario.id)

    resposta = client.get("/lotes/")

    assert resposta.status_code == 200
    assert len(resposta.json()) == 2


def test_listar_lotes_pagina(logar, db):
    client = logar()
    for _ in range(3):
        _criar_lote(db, client.usuario.id)

    assert len(client.get("/lotes/?limit=2").json()) == 2
    assert len(client.get("/lotes/?skip=2&limit=2").json()) == 1


@pytest.mark.parametrize("query", ["limit=0", "limit=501", "skip=-1"])
def test_paginacao_invalida_retorna_422(logar, query):
    assert logar().get(f"/lotes/?{query}").status_code == 422


def test_detalhe_do_lote(logar, db):
    client = logar()
    lote = _criar_lote(db, client.usuario.id, status=StatusLoteEnum.processando)

    resposta = client.get(f"/lotes/{lote.id}")

    assert resposta.status_code == 200
    assert resposta.json()["id"] == str(lote.id)
    assert resposta.json()["status"] == "processando"


def test_lote_inexistente_retorna_404(logar):
    assert logar().get(f"/lotes/{uuid.uuid4()}").status_code == 404


def test_id_de_lote_invalido_retorna_422(logar):
    assert logar().get("/lotes/123").status_code == 422


@pytest.mark.parametrize(
    "total, importados, rejeitados, status, esperado",
    [
        (0, 0, 0, StatusLoteEnum.pendente, 0),
        (100, 25, 25, StatusLoteEnum.processando, 50),
        (100, 0, 0, StatusLoteEnum.processando, 0),
        (10, 3, 0, StatusLoteEnum.processando, 30),
        (100, 100, 0, StatusLoteEnum.concluido, 100),
        (50, 0, 0, StatusLoteEnum.erro, 100),
    ],
)
def test_progresso_percentual(logar, db, total, importados, rejeitados, status, esperado):
    """RF02: o front usa este valor na barra de progresso."""
    client = logar()
    lote = _criar_lote(
        db,
        client.usuario.id,
        status=status,
        total_registros=total,
        total_importados=importados,
        total_rejeitados=rejeitados,
    )

    assert client.get(f"/lotes/{lote.id}").json()["progresso_percentual"] == esperado


# --------------------------------------------------------------------------
# Relatório de erros (RF03)
# --------------------------------------------------------------------------


def _erros_exemplo(db, lote):
    db.add_all(
        [
            ErroLote(lote_id=lote.id, numero_linha=5, campo="email", regra_violada="E-mail inválido", valor_informado="x"),
            ErroLote(lote_id=lote.id, numero_linha=2, campo="cpf_cnpj", regra_violada="CPF inválido", valor_informado="123"),
            ErroLote(lote_id=lote.id, numero_linha=2, campo="valor_divida", regra_violada="Valor inválido", valor_informado="-1"),
        ]
    )
    db.commit()


def test_erros_ordenados_por_linha(logar, db):
    client = logar()
    lote = _criar_lote(db, client.usuario.id)
    _erros_exemplo(db, lote)

    erros = client.get(f"/lotes/{lote.id}/erros").json()

    assert [(e["numero_linha"], e["campo"]) for e in erros] == [
        (2, "cpf_cnpj"),
        (2, "valor_divida"),
        (5, "email"),
    ]
    assert set(erros[0]) == {"id", "numero_linha", "campo", "regra_violada", "valor_informado"}


def test_filtrar_erros_por_campo(logar, db):
    client = logar()
    lote = _criar_lote(db, client.usuario.id)
    _erros_exemplo(db, lote)

    erros = client.get(f"/lotes/{lote.id}/erros?campo=email").json()

    assert [e["campo"] for e in erros] == ["email"]


def test_erros_de_lote_inexistente_retorna_404(logar):
    assert logar().get(f"/lotes/{uuid.uuid4()}/erros").status_code == 404


def test_lote_sem_erros_retorna_lista_vazia(logar, db):
    client = logar()
    lote = _criar_lote(db, client.usuario.id)

    assert client.get(f"/lotes/{lote.id}/erros").json() == []


def test_erros_nao_misturam_lotes(logar, db):
    client = logar()
    a = _criar_lote(db, client.usuario.id)
    b = _criar_lote(db, client.usuario.id)
    _erros_exemplo(db, a)

    assert client.get(f"/lotes/{b.id}/erros").json() == []


def test_download_do_relatorio_de_erros_em_csv(logar, db):
    client = logar()
    lote = _criar_lote(db, client.usuario.id)
    _erros_exemplo(db, lote)

    resposta = client.get(f"/lotes/{lote.id}/erros/csv")

    assert resposta.status_code == 200
    assert resposta.headers["content-type"].startswith("text/csv")
    assert f"erros_lote_{lote.id}.csv" in resposta.headers["content-disposition"]
    texto = resposta.content.decode("utf-8")
    assert texto.startswith("﻿")  # BOM: o Excel reconhece o UTF-8
    linhas = texto.lstrip("﻿").splitlines()
    assert linhas[0] == "linha;campo;regra_violada;valor_informado"  # ';' abre direto no Excel BR
    assert linhas[1].startswith("2;cpf_cnpj;")
    assert len(linhas) == 4


@pytest.mark.parametrize("perigoso", ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)"])
def test_csv_de_erros_neutraliza_injecao_de_formula(logar, db, perigoso):
    """O valor veio do arquivo do usuário e o CSV será aberto no Excel."""
    client = logar()
    lote = _criar_lote(db, client.usuario.id)
    db.add(ErroLote(lote_id=lote.id, numero_linha=2, campo="nome", regra_violada="x", valor_informado=perigoso))
    db.commit()

    texto = client.get(f"/lotes/{lote.id}/erros/csv").content.decode("utf-8")

    assert f"'{perigoso[0]}" in texto
    assert f";{perigoso[0]}" not in texto.replace(f";'{perigoso[0]}", "")


def test_csv_de_erros_de_lote_inexistente_retorna_404(logar):
    assert logar().get(f"/lotes/{uuid.uuid4()}/erros/csv").status_code == 404