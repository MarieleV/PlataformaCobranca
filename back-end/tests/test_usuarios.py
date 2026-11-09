import uuid

import pytest
import redis
from fastapi.testclient import TestClient
from sqlalchemy import select

import app.core.redis_client as redis_client
from app.main import app
from app.models.domain import CargoEnum, Lote, LogAuditoria, RegraCobranca, CanalEnum, Usuario
from tests.conftest import SENHA_PADRAO

NOVA_SENHA = "NovaSenha@2026"


@pytest.fixture
def como(criar_usuario):
    """Devolve um client próprio (com cookies próprios) logado no cargo pedido."""

    def _como(cargo=CargoEnum.operador, **campos) -> TestClient:
        usuario = criar_usuario(cargo, **campos)
        cliente = TestClient(app)
        resposta = cliente.post(
            "/auth/login", json={"email": usuario.email, "password": SENHA_PADRAO}
        )
        assert resposta.status_code == 200, resposta.text
        cliente.usuario = usuario
        return cliente

    return _como


def _corpo(**campos) -> dict:
    base = {"nome": "Novo Usuario", "email": "novo@teste.com", "senha": "Senha@12345"}
    return {**base, **campos}


def _acoes(db) -> list[str]:
    db.expire_all()
    return sorted(a.acao for a in db.scalars(select(LogAuditoria)))


# --------------------------------------------------------------------------
# Acesso
# --------------------------------------------------------------------------

_ID = uuid.uuid4()
_ROTAS = [
    ("get", "/usuarios/", None),
    ("post", "/usuarios/", _corpo()),
    ("get", f"/usuarios/{_ID}", None),
    ("patch", f"/usuarios/{_ID}", {"nome": "X Y"}),
    ("post", f"/usuarios/{_ID}/ativar", None),
    ("post", f"/usuarios/{_ID}/desativar", None),
    ("post", f"/usuarios/{_ID}/redefinir-senha", {"nova_senha": NOVA_SENHA}),
    ("delete", f"/usuarios/{_ID}", None),
]


@pytest.mark.parametrize("metodo, caminho, corpo", _ROTAS)
def test_rotas_exigem_login(client, metodo, caminho, corpo):
    assert getattr(client, metodo)(caminho, **({"json": corpo} if corpo else {})).status_code == 401


@pytest.mark.parametrize("metodo, caminho, corpo", _ROTAS)
def test_operador_nao_gerencia_usuarios(como, metodo, caminho, corpo):
    cliente = como(CargoEnum.operador)

    resposta = getattr(cliente, metodo)(caminho, **({"json": corpo} if corpo else {}))

    assert resposta.status_code == 403


# --------------------------------------------------------------------------
# Listagem e detalhe
# --------------------------------------------------------------------------


def test_admin_ve_todos_os_usuarios(como, criar_usuario):
    criar_usuario(CargoEnum.operador)
    criar_usuario(CargoEnum.gestor)
    admin = como(CargoEnum.administrador)

    corpo = admin.get("/usuarios/").json()

    assert corpo["total"] == 3
    assert {u["perfil"] for u in corpo["itens"]} == {"operador", "gestor", "administrador"}


def test_gestor_ve_so_operadores(como, criar_usuario):
    criar_usuario(CargoEnum.operador)
    criar_usuario(CargoEnum.administrador)
    gestor = como(CargoEnum.gestor)

    itens = gestor.get("/usuarios/").json()["itens"]

    assert [u["perfil"] for u in itens] == ["operador"]


def test_gestor_nao_consegue_listar_admins_nem_com_filtro(como, criar_usuario):
    criar_usuario(CargoEnum.administrador)
    gestor = como(CargoEnum.gestor)

    assert gestor.get("/usuarios/?perfil=administrador").json()["total"] == 0


def test_listagem_nunca_expoe_a_senha(como):
    texto = como(CargoEnum.administrador).get("/usuarios/").text

    assert "senha" not in texto
    assert "$2b$" not in texto


def test_filtros_e_busca(como, criar_usuario):
    criar_usuario(CargoEnum.operador, email="ana@teste.com", ativo=False)
    criar_usuario(CargoEnum.operador, email="bia@teste.com")
    admin = como(CargoEnum.administrador)

    inativos = admin.get("/usuarios/?ativo=false").json()["itens"]
    por_email = admin.get("/usuarios/?busca=BIA@").json()["itens"]
    por_perfil = admin.get("/usuarios/?perfil=administrador").json()["itens"]

    assert [u["email"] for u in inativos] == ["ana@teste.com"]
    assert [u["email"] for u in por_email] == ["bia@teste.com"]
    assert [u["perfil"] for u in por_perfil] == ["administrador"]


def test_paginacao_de_usuarios(como, criar_usuario):
    for _ in range(4):
        criar_usuario()
    admin = como(CargoEnum.administrador)

    pagina = admin.get("/usuarios/?skip=1&limit=2").json()

    assert pagina["total"] == 5
    assert len(pagina["itens"]) == 2


@pytest.mark.parametrize("query", ["limit=0", "limit=201", "skip=-1", "perfil=chefe", "busca=a"])
def test_parametros_invalidos_na_listagem(como, query):
    assert como(CargoEnum.administrador).get(f"/usuarios/?{query}").status_code == 422


def test_detalhe_do_usuario(como, criar_usuario):
    alvo = criar_usuario(CargoEnum.operador)

    corpo = como(CargoEnum.gestor).get(f"/usuarios/{alvo.id}").json()

    assert corpo["id"] == str(alvo.id)
    assert corpo["perfil"] == "operador"


def test_detalhe_de_usuario_inexistente(como):
    assert como(CargoEnum.administrador).get(f"/usuarios/{uuid.uuid4()}").status_code == 404


@pytest.mark.parametrize("cargo_alvo", [CargoEnum.gestor, CargoEnum.administrador])
def test_gestor_nao_ve_detalhe_de_gestor_ou_admin(como, criar_usuario, cargo_alvo):
    alvo = criar_usuario(cargo_alvo)

    assert como(CargoEnum.gestor).get(f"/usuarios/{alvo.id}").status_code == 403


# --------------------------------------------------------------------------
# Criação
# --------------------------------------------------------------------------


def test_gestor_cria_operador(como, db):
    gestor = como(CargoEnum.gestor)

    resposta = gestor.post("/usuarios/", json=_corpo(email="Novo@Teste.COM"))

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["perfil"] == "operador"  # padrão
    assert corpo["email"] == "novo@teste.com"  # normalizado
    assert corpo["ativo"] is True
    assert corpo["criado_por"] == str(gestor.usuario.id)
    assert "senha" not in resposta.text
    assert _acoes(db) == ["criar_usuario", "login"]


def test_usuario_criado_consegue_entrar_com_a_senha_definida(como, client):
    como(CargoEnum.gestor).post("/usuarios/", json=_corpo(senha="Definida@123"))

    resposta = client.post("/auth/login", json={"email": "novo@teste.com", "password": "Definida@123"})

    assert resposta.status_code == 200


@pytest.mark.parametrize("perfil", ["gestor", "administrador"])
def test_gestor_nao_cria_gestor_nem_admin(como, perfil):
    gestor = como(CargoEnum.gestor)

    resposta = gestor.post("/usuarios/", json=_corpo(perfil=perfil))

    assert resposta.status_code == 403
    assert gestor.get("/usuarios/").json()["total"] == 0


@pytest.mark.parametrize("perfil", list(CargoEnum))
def test_admin_cria_qualquer_perfil(como, perfil):
    resposta = como(CargoEnum.administrador).post("/usuarios/", json=_corpo(perfil=perfil.value))

    assert resposta.status_code == 201
    assert resposta.json()["perfil"] == perfil.value


def test_email_duplicado_retorna_409_sem_diferenciar_maiusculas(como, criar_usuario):
    criar_usuario(email="existe@teste.com")

    resposta = como(CargoEnum.administrador).post("/usuarios/", json=_corpo(email="EXISTE@teste.com"))

    assert resposta.status_code == 409


@pytest.mark.parametrize(
    "campos",
    [
        {"senha": "curta1"},  # menos de 8 caracteres
        {"senha": "somenteletras"},  # sem número
        {"senha": "12345678"},  # sem letra
        {"senha": "a1" * 65},  # mais de 128 caracteres
        {"email": "nao-e-email"},
        {"nome": " "},
        {"perfil": "chefe"},
    ],
)
def test_dados_invalidos_na_criacao(como, campos):
    assert como(CargoEnum.administrador).post("/usuarios/", json=_corpo(**campos)).status_code == 422


# --------------------------------------------------------------------------
# Edição
# --------------------------------------------------------------------------


def test_gestor_edita_nome_e_email_de_operador(como, criar_usuario, db):
    alvo = criar_usuario()

    resposta = como(CargoEnum.gestor).patch(
        f"/usuarios/{alvo.id}", json={"nome": "  Nome Novo  ", "email": "Outro@Teste.com"}
    )

    assert resposta.status_code == 200
    assert resposta.json()["nome"] == "Nome Novo"
    assert resposta.json()["email"] == "outro@teste.com"
    assert "editar_usuario" in _acoes(db)


def test_gestor_nao_altera_perfil(como, criar_usuario):
    alvo = criar_usuario()

    resposta = como(CargoEnum.gestor).patch(f"/usuarios/{alvo.id}", json={"perfil": "gestor"})

    assert resposta.status_code == 403


def test_gestor_nao_edita_gestor_nem_admin(como, criar_usuario):
    gestor = como(CargoEnum.gestor)
    outro = criar_usuario(CargoEnum.gestor)
    admin = criar_usuario(CargoEnum.administrador)

    assert gestor.patch(f"/usuarios/{outro.id}", json={"nome": "Xx"}).status_code == 403
    assert gestor.patch(f"/usuarios/{admin.id}", json={"nome": "Xx"}).status_code == 403


def test_admin_altera_o_perfil_e_o_efeito_e_imediato(como, criar_usuario, db):
    operador = como(CargoEnum.operador)
    admin = como(CargoEnum.administrador)
    assert operador.get("/usuarios/").status_code == 403

    admin.patch(f"/usuarios/{operador.usuario.id}", json={"perfil": "gestor"})

    # O cargo vem do banco, não do token: vale sem novo login
    assert operador.get("/usuarios/").status_code == 200
    assert "alterar_perfil_usuario" in _acoes(db)


def test_admin_nao_altera_o_proprio_perfil(como):
    admin = como(CargoEnum.administrador)

    resposta = admin.patch(f"/usuarios/{admin.usuario.id}", json={"perfil": "operador"})

    assert resposta.status_code == 400


def test_admin_pode_editar_o_proprio_nome(como):
    admin = como(CargoEnum.administrador)

    resposta = admin.patch(f"/usuarios/{admin.usuario.id}", json={"nome": "Nome Atualizado"})

    assert resposta.status_code == 200


def test_editar_para_email_de_outro_retorna_409(como, criar_usuario):
    criar_usuario(email="ocupado@teste.com")
    alvo = criar_usuario()

    resposta = como(CargoEnum.administrador).patch(f"/usuarios/{alvo.id}", json={"email": "ocupado@teste.com"})

    assert resposta.status_code == 409


def test_regravar_o_mesmo_email_nao_e_conflito(como, criar_usuario):
    alvo = criar_usuario(email="mesmo@teste.com")

    resposta = como(CargoEnum.administrador).patch(f"/usuarios/{alvo.id}", json={"email": "MESMO@teste.com"})

    assert resposta.status_code == 200


def test_edicao_sem_mudanca_nao_gera_auditoria(como, criar_usuario, db):
    alvo = criar_usuario()
    como(CargoEnum.administrador).patch(f"/usuarios/{alvo.id}", json={"nome": alvo.nome})

    assert "editar_usuario" not in _acoes(db)


def test_edicao_sem_campos_retorna_422(como, criar_usuario):
    alvo = criar_usuario()

    assert como(CargoEnum.administrador).patch(f"/usuarios/{alvo.id}", json={}).status_code == 422


def test_editar_usuario_inexistente(como):
    assert como(CargoEnum.administrador).patch(f"/usuarios/{uuid.uuid4()}", json={"nome": "Xx"}).status_code == 404


# --------------------------------------------------------------------------
# Ativar / desativar
# --------------------------------------------------------------------------


def test_desativar_bloqueia_login_e_sessao_aberta(como, client, db):
    operador = como(CargoEnum.operador)
    gestor = como(CargoEnum.gestor)

    resposta = gestor.post(f"/usuarios/{operador.usuario.id}/desativar")

    assert resposta.status_code == 200
    assert resposta.json()["ativo"] is False
    assert operador.get("/auth/me").status_code in (401, 403)
    login = client.post("/auth/login", json={"email": operador.usuario.email, "password": SENHA_PADRAO})
    assert login.status_code == 403
    assert "desativar_usuario" in _acoes(db)


def test_reativar_libera_novo_login_mas_nao_a_sessao_antiga(como, client):
    operador = como(CargoEnum.operador)
    admin = como(CargoEnum.administrador)
    admin.post(f"/usuarios/{operador.usuario.id}/desativar")

    resposta = admin.post(f"/usuarios/{operador.usuario.id}/ativar")

    assert resposta.json()["ativo"] is True
    assert operador.get("/auth/me").status_code == 401  # token antigo morreu na desativação
    novo = client.post("/auth/login", json={"email": operador.usuario.email, "password": SENHA_PADRAO})
    assert novo.status_code == 200


def test_ativar_e_desativar_sao_idempotentes(como, criar_usuario, db):
    alvo = criar_usuario()
    admin = como(CargoEnum.administrador)

    admin.post(f"/usuarios/{alvo.id}/ativar")  # já ativo
    admin.post(f"/usuarios/{alvo.id}/desativar")
    admin.post(f"/usuarios/{alvo.id}/desativar")  # já inativo

    acoes = _acoes(db)
    assert "ativar_usuario" not in acoes
    assert acoes.count("desativar_usuario") == 1


def test_ninguem_desativa_a_propria_conta(como):
    admin = como(CargoEnum.administrador)

    assert admin.post(f"/usuarios/{admin.usuario.id}/desativar").status_code == 400


def test_gestor_nao_desativa_gestor_nem_admin(como, criar_usuario):
    gestor = como(CargoEnum.gestor)
    outro = criar_usuario(CargoEnum.gestor)

    assert gestor.post(f"/usuarios/{outro.id}/desativar").status_code == 403
    assert gestor.post(f"/usuarios/{outro.id}/ativar").status_code == 403


def test_desativar_com_redis_fora_do_ar_responde_503_e_nao_altera(como, criar_usuario, db, monkeypatch):
    alvo = criar_usuario()
    admin = como(CargoEnum.administrador)

    class RedisQuebrado:
        def setex(self, *args, **kwargs):
            raise redis.ConnectionError("fora do ar")

        def __getattr__(self, nome):
            return getattr(real, nome)

    real = redis_client._redis
    monkeypatch.setattr(redis_client, "_redis", RedisQuebrado())

    resposta = admin.post(f"/usuarios/{alvo.id}/desativar")

    assert resposta.status_code == 503
    db.expire_all()
    assert db.get(Usuario, alvo.id).ativo is True


# --------------------------------------------------------------------------
# Redefinir senha
# --------------------------------------------------------------------------


def test_gestor_redefine_senha_de_operador(como, client, db):
    operador = como(CargoEnum.operador)
    gestor = como(CargoEnum.gestor)

    resposta = gestor.post(
        f"/usuarios/{operador.usuario.id}/redefinir-senha", json={"nova_senha": NOVA_SENHA}
    )

    assert resposta.status_code == 200
    antigo = client.post("/auth/login", json={"email": operador.usuario.email, "password": SENHA_PADRAO})
    novo = client.post("/auth/login", json={"email": operador.usuario.email, "password": NOVA_SENHA})
    assert antigo.status_code == 401
    assert novo.status_code == 200
    assert "redefinir_senha" in _acoes(db)
    assert NOVA_SENHA not in resposta.text


def test_redefinir_senha_derruba_a_sessao_aberta_do_usuario(como):
    operador = como(CargoEnum.operador)
    assert operador.get("/auth/me").status_code == 200

    como(CargoEnum.administrador).post(
        f"/usuarios/{operador.usuario.id}/redefinir-senha", json={"nova_senha": NOVA_SENHA}
    )

    assert operador.get("/auth/me").status_code == 401


def test_redefinir_senha_derruba_tambem_o_refresh(como):
    operador = como(CargoEnum.operador)
    como(CargoEnum.administrador).post(
        f"/usuarios/{operador.usuario.id}/redefinir-senha", json={"nova_senha": NOVA_SENHA}
    )

    assert operador.post("/auth/refresh").status_code == 401


def test_gestor_nao_redefine_senha_de_gestor_nem_admin(como, criar_usuario):
    gestor = como(CargoEnum.gestor)
    admin = criar_usuario(CargoEnum.administrador)

    resposta = gestor.post(f"/usuarios/{admin.id}/redefinir-senha", json={"nova_senha": NOVA_SENHA})

    assert resposta.status_code == 403


def test_admin_redefine_senha_de_qualquer_perfil(como, criar_usuario):
    gestor = criar_usuario(CargoEnum.gestor)

    resposta = como(CargoEnum.administrador).post(
        f"/usuarios/{gestor.id}/redefinir-senha", json={"nova_senha": NOVA_SENHA}
    )

    assert resposta.status_code == 200


def test_redefinir_a_propria_senha_pede_o_endpoint_proprio(como):
    admin = como(CargoEnum.administrador)

    resposta = admin.post(f"/usuarios/{admin.usuario.id}/redefinir-senha", json={"nova_senha": NOVA_SENHA})

    assert resposta.status_code == 400
    assert "/auth/senha" in resposta.json()["detail"]


@pytest.mark.parametrize("senha", ["curta1", "semnumeroaqui", "123456789"])
def test_senha_fraca_na_redefinicao(como, criar_usuario, senha):
    alvo = criar_usuario()

    resposta = como(CargoEnum.administrador).post(f"/usuarios/{alvo.id}/redefinir-senha", json={"nova_senha": senha})

    assert resposta.status_code == 422


# --------------------------------------------------------------------------
# Exclusão (somente administrador)
# --------------------------------------------------------------------------


def test_admin_exclui_usuario_e_a_auditoria_permanece(como, criar_usuario, db):
    alvo = criar_usuario()
    alvo_id = alvo.id
    admin = como(CargoEnum.administrador)

    resposta = admin.delete(f"/usuarios/{alvo_id}")

    assert resposta.status_code == 204
    db.expire_all()
    assert db.get(Usuario, alvo_id) is None
    registro = db.scalars(select(LogAuditoria).where(LogAuditoria.acao == "excluir_usuario")).one()
    assert registro.entidade_id == alvo_id
    assert registro.usuario_id == admin.usuario.id


def test_gestor_nao_exclui_usuario(como, criar_usuario, db):
    alvo = criar_usuario()

    assert como(CargoEnum.gestor).delete(f"/usuarios/{alvo.id}").status_code == 403
    db.expire_all()
    assert db.get(Usuario, alvo.id) is not None


def test_ninguem_exclui_a_propria_conta(como):
    admin = como(CargoEnum.administrador)

    assert admin.delete(f"/usuarios/{admin.usuario.id}").status_code == 400


def test_nao_exclui_quem_tem_lotes(como, criar_usuario, db):
    alvo = criar_usuario()
    db.add(Lote(usuario_id=alvo.id, nome_arquivo="x.csv"))
    db.commit()

    resposta = como(CargoEnum.administrador).delete(f"/usuarios/{alvo.id}")

    assert resposta.status_code == 409
    assert "Desative" in resposta.json()["detail"]


def test_nao_exclui_quem_tem_regras(como, criar_usuario, db):
    alvo = criar_usuario()
    db.add(
        RegraCobranca(
            usuario_id=alvo.id, nome="R", dias_atraso=5, canal=CanalEnum.email, template_mensagem="Oi"
        )
    )
    db.commit()

    assert como(CargoEnum.administrador).delete(f"/usuarios/{alvo.id}").status_code == 409


def test_excluir_usuario_inexistente(como):
    assert como(CargoEnum.administrador).delete(f"/usuarios/{uuid.uuid4()}").status_code == 404


def test_sessao_de_usuario_excluido_deixa_de_valer(como):
    alvo = como(CargoEnum.operador)

    como(CargoEnum.administrador).delete(f"/usuarios/{alvo.usuario.id}")

    assert alvo.get("/auth/me").status_code == 401
