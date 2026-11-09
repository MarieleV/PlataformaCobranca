import uuid
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.models.domain import CargoEnum, LogAuditoria
from tests.conftest import SENHA_PADRAO

NOVA_SENHA = "NovaSenha@2026"


@pytest.fixture
def como(criar_usuario):
    def _como(cargo=CargoEnum.operador, **campos) -> TestClient:
        usuario = criar_usuario(cargo, **campos)
        cliente = TestClient(app)
        resposta = cliente.post("/auth/login", json={"email": usuario.email, "password": SENHA_PADRAO})
        assert resposta.status_code == 200, resposta.text
        cliente.usuario = usuario
        return cliente

    return _como


def _trocar(cliente, atual=SENHA_PADRAO, nova=NOVA_SENHA):
    return cliente.put("/auth/senha", json={"senha_atual": atual, "nova_senha": nova})


# --------------------------------------------------------------------------
# Troca da própria senha
# --------------------------------------------------------------------------


def test_troca_de_senha_exige_login(client):
    assert _trocar(client).status_code == 401


@pytest.mark.parametrize("cargo", list(CargoEnum))
def test_todos_os_perfis_trocam_a_propria_senha(como, client, cargo):
    cliente = como(cargo)

    assert _trocar(cliente).status_code == 200

    outro = TestClient(app)
    assert outro.post("/auth/login", json={"email": cliente.usuario.email, "password": NOVA_SENHA}).status_code == 200
    assert outro.post("/auth/login", json={"email": cliente.usuario.email, "password": SENHA_PADRAO}).status_code == 401


def test_senha_atual_errada(como):
    cliente = como()

    resposta = _trocar(cliente, atual="errada123")

    assert resposta.status_code == 400
    assert "atual" in resposta.json()["detail"]


def test_nova_senha_igual_a_atual_e_recusada(como):
    assert _trocar(como(), nova=SENHA_PADRAO).status_code == 400


@pytest.mark.parametrize("nova", ["curta1", "semnumeroaqui", "123456789"])
def test_nova_senha_fraca(como, nova):
    assert _trocar(como(), nova=nova).status_code == 422


def test_quem_troca_a_senha_continua_logado(como):
    cliente = como()

    _trocar(cliente)

    assert cliente.get("/auth/me").status_code == 200


def test_trocar_a_senha_derruba_as_outras_sessoes(como):
    cliente = como()
    outro_aparelho = TestClient(app)
    outro_aparelho.post("/auth/login", json={"email": cliente.usuario.email, "password": SENHA_PADRAO})
    assert outro_aparelho.get("/auth/me").status_code == 200

    _trocar(cliente)

    assert outro_aparelho.get("/auth/me").status_code == 401
    assert outro_aparelho.post("/auth/refresh").status_code == 401


def test_troca_de_senha_fica_na_auditoria(como, db):
    cliente = como()
    _trocar(cliente)

    db.expire_all()
    registro = db.scalars(select(LogAuditoria).where(LogAuditoria.acao == "alterar_propria_senha")).one()
    assert registro.usuario_id == cliente.usuario.id


# --------------------------------------------------------------------------
# Consulta ao log de auditoria (RF11): exclusivo do administrador
# --------------------------------------------------------------------------


def test_auditoria_exige_login(client):
    assert client.get("/auditoria/").status_code == 401


@pytest.mark.parametrize("cargo", [CargoEnum.operador, CargoEnum.gestor])
def test_so_o_administrador_consulta_a_auditoria(como, cargo):
    assert como(cargo).get("/auditoria/").status_code == 403


def test_admin_consulta_a_auditoria_com_nome_de_quem_agiu(como):
    admin = como(CargoEnum.administrador)  # o login já gera um registro

    corpo = admin.get("/auditoria/").json()

    assert corpo["total"] == 1
    item = corpo["itens"][0]
    assert item["acao"] == "login"
    assert item["usuario_email"] == admin.usuario.email
    assert item["usuario_nome"] == admin.usuario.nome
    assert item["entidade"] == "usuario"


def test_mais_recentes_primeiro(como, db):
    admin = como(CargoEnum.administrador)
    admin.post("/usuarios/", json={"nome": "Novo Usuario", "email": "n@teste.com", "senha": "Senha@12345"})
    # SQLite grava segundos: separa os registros para a ordem ser verificável
    from datetime import datetime, timezone

    for i, log in enumerate(db.scalars(select(LogAuditoria).order_by(LogAuditoria.acao)).all()):
        log.criado_em = datetime(2026, 1, 1, 12, 0, i, tzinfo=timezone.utc)
    db.commit()

    itens = admin.get("/auditoria/").json()["itens"]

    datas = [i["criado_em"] for i in itens]
    assert datas == sorted(datas, reverse=True)


def test_filtros_da_auditoria(como):
    admin = como(CargoEnum.administrador)
    admin.post("/usuarios/", json={"nome": "Novo Usuario", "email": "n@teste.com", "senha": "Senha@12345"})

    por_acao = admin.get("/auditoria/?acao=criar_usuario").json()
    por_usuario = admin.get(f"/auditoria/?usuario_id={admin.usuario.id}").json()
    por_entidade = admin.get("/auditoria/?entidade=devedor").json()
    sem_resultado = admin.get(f"/auditoria/?usuario_id={uuid.uuid4()}").json()

    assert [i["acao"] for i in por_acao["itens"]] == ["criar_usuario"]
    assert por_usuario["total"] == 2  # login + criar_usuario
    assert por_entidade["total"] == 0
    assert sem_resultado["total"] == 0


def test_filtro_por_periodo_e_inclusivo(como):
    admin = como(CargoEnum.administrador)
    hoje_utc = date.today()

    dentro = admin.get(f"/auditoria/?de={hoje_utc - timedelta(days=1)}&ate={hoje_utc + timedelta(days=1)}").json()
    fora = admin.get(f"/auditoria/?ate={hoje_utc - timedelta(days=30)}").json()
    futuro = admin.get(f"/auditoria/?de={hoje_utc + timedelta(days=30)}").json()

    assert dentro["total"] == 1
    assert fora["total"] == 0
    assert futuro["total"] == 0


def test_paginacao_da_auditoria(como):
    admin = como(CargoEnum.administrador)
    for i in range(3):
        admin.post("/usuarios/", json={"nome": "Novo Usuario", "email": f"n{i}@teste.com", "senha": "Senha@12345"})

    pagina = admin.get("/auditoria/?skip=1&limit=2").json()

    assert pagina["total"] == 4
    assert len(pagina["itens"]) == 2


@pytest.mark.parametrize("query", ["limit=0", "limit=201", "skip=-1", "usuario_id=abc", "de=ontem"])
def test_parametros_invalidos_na_auditoria(como, query):
    assert como(CargoEnum.administrador).get(f"/auditoria/?{query}").status_code == 422


def test_auditoria_nunca_registra_senhas(como):
    admin = como(CargoEnum.administrador)
    admin.post("/usuarios/", json={"nome": "Novo Usuario", "email": "n@teste.com", "senha": "Segredo@999"})

    assert "Segredo@999" not in admin.get("/auditoria/").text
