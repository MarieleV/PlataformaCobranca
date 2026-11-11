import redis
from fastapi.testclient import TestClient
from sqlalchemy import select

import app.core.redis_client as redis_client
from app.main import app
from app.models.domain import CargoEnum, LogAuditoria, Usuario
from tests.conftest import SENHA_PADRAO


def _login(client, email, senha=SENHA_PADRAO):
    return client.post("/auth/login", json={"email": email, "password": senha})


def _acoes_auditadas(db) -> list[str]:
    db.expire_all()
    # Sem ordenar: o criado_em do SQLite tem precisão de segundos, então duas
    # ações seguidas empatam e a ordem do ORDER BY seria arbitrária. Os testes
    # que usam este helper comparam as ações sem depender da ordem.
    return sorted(a.acao for a in db.scalars(select(LogAuditoria)))


# --------------------------------------------------------------------------
# Login
# --------------------------------------------------------------------------


def test_login_sucesso_deve_retornar_cookies(client, criar_usuario):
    usuario = criar_usuario(CargoEnum.gestor, email="mariele@caj.com.br")

    resposta = _login(client, "mariele@caj.com.br")

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["message"] == "Login realizado com sucesso"
    assert corpo["user"]["id"] == str(usuario.id)
    assert corpo["user"]["perfil"] == "gestor"
    assert "senha_hash" not in resposta.text
    assert "access_token" in client.cookies
    assert "refresh_token" in client.cookies


def test_cookies_sao_httponly_e_o_token_nao_tem_prefixo_bearer(client, criar_usuario):
    criar_usuario(email="a@teste.com")

    resposta = _login(client, "a@teste.com")

    cabecalhos = resposta.headers.get_list("set-cookie")
    assert len(cabecalhos) == 2
    assert all("httponly" in c.lower() for c in cabecalhos)
    assert all("samesite=lax" in c.lower() for c in cabecalhos)
    access = next(c for c in cabecalhos if c.startswith("access_token="))
    assert not access.startswith("access_token=Bearer")


def test_refresh_token_fica_restrito_a_rota_de_autenticacao(client, criar_usuario):
    criar_usuario(email="a@teste.com")

    resposta = _login(client, "a@teste.com")

    refresh = next(
        c for c in resposta.headers.get_list("set-cookie") if c.startswith("refresh_token=")
    )
    assert "path=/auth" in refresh.lower()


def test_login_ignora_maiusculas_no_email(client, criar_usuario):
    criar_usuario(email="mariele@caj.com.br")

    assert _login(client, "MARIELE@CAJ.COM.BR").status_code == 200


def test_login_senha_incorreta_deve_falhar(client, criar_usuario):
    criar_usuario(email="mariele@caj.com.br")

    resposta = _login(client, "mariele@caj.com.br", "senha_errada_456")

    assert resposta.status_code == 401
    assert resposta.json()["detail"] == "E-mail ou senha incorretos"
    assert "access_token" not in client.cookies


def test_login_email_inexistente_responde_igual_a_senha_errada(client, criar_usuario):
    """A mensagem não pode revelar se o e-mail existe (enumeração de usuários)."""
    criar_usuario(email="existe@teste.com")

    inexistente = _login(client, "nao-existe@teste.com")
    senha_errada = _login(client, "existe@teste.com", "outra")

    assert inexistente.status_code == senha_errada.status_code == 401
    assert inexistente.json() == senha_errada.json()


def test_login_usuario_inativo_deve_ser_bloqueado(client, criar_usuario):
    criar_usuario(email="inativo@teste.com", ativo=False)

    resposta = _login(client, "inativo@teste.com")

    assert resposta.status_code == 403
    assert resposta.json()["detail"] == "Usuário inativo. O acesso foi revogado."
    assert "access_token" not in client.cookies


def test_login_com_senha_acima_de_72_bytes_retorna_401_e_nao_500(client, criar_usuario):
    criar_usuario(email="a@teste.com")

    assert _login(client, "a@teste.com", "x" * 200).status_code == 401


def test_login_exige_email_valido(client):
    resposta = client.post("/auth/login", json={"email": "nao-e-email", "password": "x"})

    assert resposta.status_code == 422


# --------------------------------------------------------------------------
# Limite de tentativas (força bruta)
# --------------------------------------------------------------------------


def test_bloqueia_login_depois_de_5_falhas(client, criar_usuario):
    criar_usuario(email="alvo@teste.com")

    codigos = [_login(client, "alvo@teste.com", "errada").status_code for _ in range(7)]

    assert codigos == [401, 401, 401, 401, 401, 429, 429]


def test_bloqueado_nem_a_senha_certa_entra(client, criar_usuario):
    criar_usuario(email="alvo@teste.com")
    for _ in range(5):
        _login(client, "alvo@teste.com", "errada")

    assert _login(client, "alvo@teste.com").status_code == 429


def test_login_com_sucesso_zera_o_contador_de_falhas(client, criar_usuario):
    criar_usuario(email="alvo@teste.com")
    for _ in range(4):
        _login(client, "alvo@teste.com", "errada")

    assert _login(client, "alvo@teste.com").status_code == 200
    # contador zerado: dá para errar de novo 5 vezes antes do bloqueio
    codigos = [_login(client, "alvo@teste.com", "errada").status_code for _ in range(6)]
    assert codigos == [401, 401, 401, 401, 401, 429]


def test_bloqueio_vale_por_email_e_nao_afeta_outro_usuario(client, criar_usuario):
    criar_usuario(email="alvo@teste.com")
    criar_usuario(email="outro@teste.com")
    for _ in range(5):
        _login(client, "alvo@teste.com", "errada")

    assert _login(client, "outro@teste.com").status_code == 200


def test_redis_fora_do_ar_nao_impede_o_login(client, criar_usuario, monkeypatch):
    criar_usuario(email="a@teste.com")

    class RedisQuebrado:
        def __getattr__(self, nome):
            def _falha(*args, **kwargs):
                raise redis.ConnectionError("fora do ar")

            return _falha

    monkeypatch.setattr(redis_client, "_redis", RedisQuebrado())

    # O login só grava/consulta o limite: falha de Redis não pode derrubá-lo
    assert _login(client, "a@teste.com").status_code == 200


# --------------------------------------------------------------------------
# /auth/me e acesso protegido
# --------------------------------------------------------------------------


def test_me_retorna_o_usuario_logado(logar):
    client = logar(CargoEnum.administrador)

    resposta = client.get("/auth/me")

    assert resposta.status_code == 200
    assert resposta.json()["perfil"] == "administrador"
    assert resposta.json()["email"] == client.usuario.email


def test_me_sem_login_retorna_401(client):
    resposta = client.get("/auth/me")

    assert resposta.status_code == 401
    assert resposta.json()["detail"] == "Não autenticado"


def test_aceita_token_pelo_header_authorization(client, logar):
    logado = logar()
    access = logado.cookies.get("access_token")
    outro = TestClient(app)

    resposta = outro.get("/auth/me", headers={"Authorization": f"Bearer {access}"})

    assert resposta.status_code == 200


def test_token_invalido_retorna_401(client):
    client.cookies.set("access_token", "lixo")

    assert client.get("/auth/me").status_code == 401


def test_refresh_token_nao_funciona_como_access_token(logar):
    client = logar()
    refresh = client.cookies.get("refresh_token")
    outro = TestClient(app)
    outro.cookies.set("access_token", refresh)

    assert outro.get("/auth/me").status_code == 401


def test_usuario_desativado_perde_acesso_na_hora(logar, db):
    client = logar()
    assert client.get("/auth/me").status_code == 200

    usuario = db.get(Usuario, client.usuario.id)
    usuario.ativo = False
    db.commit()

    resposta = client.get("/auth/me")
    assert resposta.status_code == 403
    assert resposta.json()["detail"] == "Usuário inativo"


def test_usuario_apagado_com_token_valido_retorna_401(logar, db):
    client = logar()
    db.delete(db.get(Usuario, client.usuario.id))
    db.commit()

    assert client.get("/auth/me").status_code == 401


def test_cargo_vem_do_banco_e_nao_do_token(logar, db):
    """Se o admin rebaixar o usuário, vale na hora, mesmo com o token antigo."""
    client = logar(CargoEnum.administrador)
    assert client.get("/auth/me").json()["perfil"] == "administrador"

    usuario = db.get(Usuario, client.usuario.id)
    usuario.cargo = CargoEnum.operador
    db.commit()

    assert client.get("/auth/me").json()["perfil"] == "operador"


def test_redis_fora_do_ar_responde_503_em_rota_protegida(logar, monkeypatch):
    """Sem o Redis não dá para garantir que o token não foi revogado."""
    client = logar()

    class RedisQuebrado:
        def exists(self, *args, **kwargs):
            raise redis.ConnectionError("fora do ar")

    monkeypatch.setattr(redis_client, "_redis", RedisQuebrado())

    assert client.get("/auth/me").status_code == 503


# --------------------------------------------------------------------------
# Refresh
# --------------------------------------------------------------------------


def test_refresh_renova_a_sessao(logar):
    client = logar()
    access_antigo = client.cookies.get("access_token")

    resposta = client.post("/auth/refresh")

    assert resposta.status_code == 200
    assert resposta.json()["message"] == "Sessão renovada"
    assert client.cookies.get("access_token") != access_antigo
    assert client.get("/auth/me").status_code == 200


def test_refresh_antigo_deixa_de_valer_depois_da_rotacao(logar):
    client = logar()
    refresh_antigo = client.cookies.get("refresh_token")
    assert client.post("/auth/refresh").status_code == 200

    atacante = TestClient(app)
    atacante.cookies.set("refresh_token", refresh_antigo, path="/auth")

    assert atacante.post("/auth/refresh").status_code == 401


def test_refresh_sem_cookie_retorna_401(client):
    assert client.post("/auth/refresh").status_code == 401


def test_access_token_nao_serve_para_renovar(logar):
    client = logar()
    outro = TestClient(app)
    outro.cookies.set("refresh_token", client.cookies.get("access_token"), path="/auth")

    assert outro.post("/auth/refresh").status_code == 401


def test_refresh_de_usuario_desativado_retorna_401(logar, db):
    client = logar()
    usuario = db.get(Usuario, client.usuario.id)
    usuario.ativo = False
    db.commit()

    assert client.post("/auth/refresh").status_code == 401


# --------------------------------------------------------------------------
# Logout
# --------------------------------------------------------------------------


def test_logout_deve_limpar_os_cookies(logar):
    client = logar()

    resposta = client.delete("/auth/logout")

    assert resposta.status_code == 200
    assert resposta.json()["message"] == "Logout realizado com sucesso"
    assert "access_token" not in client.cookies
    assert "refresh_token" not in client.cookies


def test_logout_revoga_o_access_token(logar):
    client = logar()
    access = client.cookies.get("access_token")
    client.delete("/auth/logout")

    copia = TestClient(app)
    copia.cookies.set("access_token", access)

    assert copia.get("/auth/me").status_code == 401


def test_logout_revoga_o_refresh_token(logar):
    client = logar()
    refresh = client.cookies.get("refresh_token")
    client.delete("/auth/logout")

    copia = TestClient(app)
    copia.cookies.set("refresh_token", refresh, path="/auth")

    assert copia.post("/auth/refresh").status_code == 401


def test_logout_sem_estar_logado_nao_da_erro(client):
    assert client.delete("/auth/logout").status_code == 200


def test_logout_funciona_com_token_invalido(client):
    client.cookies.set("access_token", "lixo")

    assert client.delete("/auth/logout").status_code == 200


# --------------------------------------------------------------------------
# Auditoria
# --------------------------------------------------------------------------


def test_login_e_logout_ficam_registrados_na_auditoria(logar, db):
    client = logar()
    client.delete("/auth/logout")

    assert _acoes_auditadas(db) == ["login", "logout"]


def test_falha_de_login_fica_registrada_na_auditoria(client, criar_usuario, db):
    usuario = criar_usuario(email="a@teste.com")
    _login(client, "a@teste.com", "errada")

    db.expire_all()
    registro = db.scalars(select(LogAuditoria)).one()
    assert registro.acao == "login_falha"
    assert registro.usuario_id == usuario.id


def test_falha_com_email_inexistente_e_auditada_sem_usuario(client, db):
    _login(client, "fantasma@teste.com")

    db.expire_all()
    registro = db.scalars(select(LogAuditoria)).one()
    assert registro.acao == "login_falha"
    assert registro.usuario_id is None


def test_auditoria_nao_grava_a_senha(client, criar_usuario, db):
    criar_usuario(email="a@teste.com")
    _login(client, "a@teste.com", "SenhaSecretaDoTeste")

    db.expire_all()
    for registro in db.scalars(select(LogAuditoria)):
        assert "SenhaSecretaDoTeste" not in str(registro.__dict__)
