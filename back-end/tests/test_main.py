import app.main as main


def test_raiz_retorna_online(client):
    resposta = client.get("/")

    assert resposta.status_code == 200
    dados = resposta.json()
    assert dados["status"] == "online"
    assert "version" in dados


def _simular_dependencias(monkeypatch, postgres=True, redis=True, rabbitmq=True):
    monkeypatch.setattr(main, "_banco_ok", lambda: postgres)
    monkeypatch.setattr(main, "_redis_ok", lambda: redis)
    monkeypatch.setattr(main, "_rabbitmq_ok", lambda: rabbitmq)


def test_health_ok_quando_todas_as_dependencias_respondem(client, monkeypatch):
    _simular_dependencias(monkeypatch)

    resposta = client.get("/health")

    assert resposta.status_code == 200
    assert resposta.json() == {
        "status": "ok",
        "dependencias": {"postgres": True, "redis": True, "rabbitmq": True},
    }


def test_health_retorna_503_quando_uma_dependencia_cai(client, monkeypatch):
    _simular_dependencias(monkeypatch, rabbitmq=False)

    resposta = client.get("/health")

    assert resposta.status_code == 503
    corpo = resposta.json()
    assert corpo["status"] == "degradado"
    assert corpo["dependencias"]["rabbitmq"] is False
    assert corpo["dependencias"]["postgres"] is True


def test_health_com_banco_de_teste_e_redis_simulado(client, monkeypatch):
    """Banco (SQLite) e Redis (fakeredis) reais dos testes; só o RabbitMQ é simulado."""
    monkeypatch.setattr(main, "_rabbitmq_ok", lambda: True)

    resposta = client.get("/health")

    assert resposta.status_code == 200


def test_cors_permite_a_origem_do_frontend_com_credenciais(client):
    resposta = client.options(
        "/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert resposta.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert resposta.headers["access-control-allow-credentials"] == "true"


def test_cors_nao_libera_origem_desconhecida(client):
    resposta = client.options(
        "/auth/login",
        headers={
            "Origin": "http://site-malicioso.com",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert "access-control-allow-origin" not in resposta.headers