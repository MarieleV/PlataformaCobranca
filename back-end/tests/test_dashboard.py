import pytest
from sqlalchemy import select

from app.core.config import settings
from app.core.datas import hoje
from app.models.domain import (
    CanalEnum,
    CargoEnum,
    Comunicacao,
    Devedor,
    LogAuditoria,
    StatusComunicacaoEnum,
    StatusDevedorEnum,
)
from app.services import dashboard as servico
from app.services.disparo import criar_job, processar_fila
from tests.test_disparo import (  # noqa: F401  (fixtures reaproveitadas)
    BOUNCE,
    SEGUNDA,
    TEMP,
    ClienteFalso,
    brt,
    criar_devedor,
    criar_regra,
    lote,
    provedor,
)


@pytest.fixture
def cenario(db, criar_regra, criar_devedor):
    """Ana enviada, Bia com bounce, Caio em reenvio, Duda enviada (e quitada)."""
    ana = criar_devedor("Ana", email="ana@exemplo.com")
    criar_devedor("Bia", email="bia@exemplo.com")
    criar_devedor("Caio", email="caio@exemplo.com")
    duda = criar_devedor("Duda", email="duda@exemplo.com")
    regra = criar_regra()
    criar_job(db, regra, SEGUNDA, brt())
    processar_fila(
        db,
        brt(),
        provedor(ClienteFalso({"bia@exemplo.com": BOUNCE, "caio@exemplo.com": TEMP})),
    )
    duda.status = StatusDevedorEnum.quitado
    db.commit()
    # as comunicações foram criadas "em 2020"; traz para hoje para entrar no período
    return {"ana": ana, "duda": duda}


@pytest.fixture
def comunicacoes_de_hoje(db, cenario):
    """O cenário usa SEGUNDA fixa; aqui as comunicações passam a ser de hoje."""
    from datetime import datetime, timezone

    agora_utc = datetime.now(timezone.utc)
    for c in db.scalars(select(Comunicacao)):
        c.criado_em = agora_utc
    db.commit()


# ----------------------------------------------------------------------
# Definições de contagem
# ----------------------------------------------------------------------
def test_contagem_separa_sucesso_falha_e_aguardando(db, cenario, comunicacoes_de_hoje):
    inicio, fim = servico.limites_do_periodo(hoje(), 1)
    c = servico.contagem_total(db, inicio, fim)
    assert (c.sucesso, c.falhas, c.aguardando) == (2, 1, 1)
    assert c.disparos == 3  # aguardando ainda não tem desfecho
    assert c.taxa_entrega == 66.7


def test_percentual_sem_base_e_none():
    assert servico.percentual(0, 0) is None
    assert servico.percentual(1, 3) == 33.3


def test_conversao_so_conta_devedores_alcancados(db, cenario, comunicacoes_de_hoje):
    inicio, fim = servico.limites_do_periodo(hoje(), 7)
    assert servico.conversao(db, inicio, fim) == (2, 1)  # Ana e Duda; Duda quitou


def test_comunicacao_fora_do_periodo_nao_entra(db, cenario):
    # sem comunicacoes_de_hoje: criadas fora da janela de 7 dias? usa janela de hoje
    inicio, fim = servico.limites_do_periodo(hoje(), 1)
    c = servico.contagem_total(db, inicio, fim)
    # criar_job usa o relógio real para criado_em, então tudo cai em hoje:
    assert c.sucesso + c.falhas + c.aguardando == 4


# ----------------------------------------------------------------------
# GET /dashboard
# ----------------------------------------------------------------------
def test_dashboard_exige_login(client):
    assert client.get("/dashboard/").status_code == 401


@pytest.mark.parametrize("cargo", list(CargoEnum))
def test_dashboard_liberado_para_todos_os_perfis(como, cargo):
    assert como(cargo).get("/dashboard/").status_code == 200


def test_dashboard_vazio_tem_taxas_nulas(como):
    corpo = como(CargoEnum.operador).get("/dashboard/").json()
    assert corpo["dias"] == 7
    assert corpo["base"]["total"] == 0
    assert corpo["periodo"]["disparos"] == 0
    assert corpo["periodo"]["taxa_entrega"] is None
    assert corpo["periodo"]["taxa_conversao"] is None
    assert corpo["periodo"]["meta_taxa_entrega"] == settings.meta_taxa_entrega
    assert len(corpo["timeline"]) == 7
    assert [p["disparos"] for p in corpo["timeline"]] == [0] * 7
    assert {c["canal"] for c in corpo["por_canal"]} == {c.value for c in CanalEnum}


def test_dashboard_com_dados(como, cenario, comunicacoes_de_hoje):
    corpo = como(CargoEnum.gestor).get("/dashboard/").json()

    assert corpo["base"]["total"] == 4
    assert corpo["base"]["por_status"]["quitado"] == 1
    assert corpo["hoje"] == {
        "disparos": 3, "sucesso": 2, "falhas": 1, "aguardando": 1, "taxa_entrega": 66.7,
    }
    assert corpo["periodo"]["devedores_alcancados"] == 2
    assert corpo["periodo"]["devedores_quitados"] == 1
    assert corpo["periodo"]["taxa_conversao"] == 50.0

    email = next(c for c in corpo["por_canal"] if c["canal"] == "email")
    assert email["sucesso"] == 2 and email["falhas"] == 1
    sms = next(c for c in corpo["por_canal"] if c["canal"] == "sms")
    assert sms["disparos"] == 0 and sms["taxa_entrega"] is None

    assert corpo["timeline"][-1]["dia"] == hoje().isoformat()
    assert corpo["timeline"][-1]["disparos"] == 3
    assert len(corpo["ultimos_jobs"]) == 1
    assert corpo["ultimos_jobs"][0]["canal"] == "email"
    assert len(corpo["ultimos_lotes"]) == 1


def test_dashboard_janela_em_dias(como):
    cliente = como(CargoEnum.operador)
    assert len(cliente.get("/dashboard/?dias=30").json()["timeline"]) == 30
    assert cliente.get("/dashboard/?dias=0").status_code == 422
    assert cliente.get("/dashboard/?dias=31").status_code == 422


# ----------------------------------------------------------------------
# PATCH /devedores/{id}/status
# ----------------------------------------------------------------------
@pytest.mark.parametrize("cargo", list(CargoEnum))
def test_alterar_status_do_devedor(como, db, criar_devedor, cargo):
    devedor = criar_devedor("Ana")
    r = como(cargo).patch(f"/devedores/{devedor.id}/status", json={"status": "quitado"})
    assert r.status_code == 200
    assert r.json()["status"] == "quitado"
    db.expire_all()
    assert db.get(Devedor, devedor.id).status == StatusDevedorEnum.quitado
    acoes = [a.acao for a in db.scalars(select(LogAuditoria))]
    assert acoes.count("alterar_status_devedor") == 1


def test_alterar_para_o_mesmo_status_nao_audita(como, db, criar_devedor):
    devedor = criar_devedor("Ana")
    r = como(CargoEnum.operador).patch(f"/devedores/{devedor.id}/status", json={"status": "ativo"})
    assert r.status_code == 200
    acoes = [a.acao for a in db.scalars(select(LogAuditoria))]
    assert "alterar_status_devedor" not in acoes


def test_alterar_status_invalido_ou_inexistente(como, criar_devedor):
    cliente = como(CargoEnum.operador)
    devedor = criar_devedor("Ana")
    assert cliente.patch(f"/devedores/{devedor.id}/status", json={"status": "xyz"}).status_code == 422
    import uuid

    assert cliente.patch(f"/devedores/{uuid.uuid4()}/status", json={"status": "quitado"}).status_code == 404


def test_alterar_status_exige_login(client, criar_devedor):
    devedor = criar_devedor("Ana")
    assert client.patch(f"/devedores/{devedor.id}/status", json={"status": "quitado"}).status_code == 401


def test_devedor_quitado_sai_da_regua(db, como, criar_regra, criar_devedor):
    devedor = criar_devedor("Ana")
    como(CargoEnum.operador).patch(f"/devedores/{devedor.id}/status", json={"status": "quitado"})
    regra = criar_regra()
    from app.services.regua import contar_elegiveis

    assert contar_elegiveis(db, regra, SEGUNDA) == 0


# ----------------------------------------------------------------------
# /metrics
# ----------------------------------------------------------------------
def _valor(texto: str, prefixo: str) -> float:
    linhas = [l for l in texto.splitlines() if l.startswith(prefixo)]
    assert linhas, f"métrica ausente: {prefixo}"
    return float(linhas[0].rsplit(" ", 1)[1])


def test_metrics_formato_prometheus(client, cenario, comunicacoes_de_hoje):
    r = client.get("/metrics")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/plain")
    t = r.text
    assert "# TYPE cobranca_comunicacoes gauge" in t
    assert _valor(t, "cobranca_coleta_ok") == 1
    assert _valor(t, 'cobranca_devedores{status="quitado"}') == 1
    assert _valor(t, 'cobranca_comunicacoes{canal="email",resultado="sucesso"}') == 2
    assert _valor(t, 'cobranca_comunicacoes{canal="email",resultado="falha"}') == 1
    assert _valor(t, 'cobranca_comunicacoes_hoje{canal="email",resultado="aguardando"}') == 1
    assert _valor(t, 'cobranca_taxa_entrega_percent{canal="todos"}') == 66.7
    assert _valor(t, "cobranca_taxa_conversao_percent") == 50.0
    assert _valor(t, 'cobranca_jobs{status="executando"}') == 1


def test_metrics_sem_dados_omite_taxas(client):
    t = client.get("/metrics").text
    assert "cobranca_taxa_entrega_percent{" not in t
    assert "\ncobranca_taxa_conversao_percent " not in t
    assert _valor(t, "cobranca_coleta_ok") == 1


def test_metrics_conta_requisicoes_pela_rota_e_nao_pela_url(client, criar_devedor):
    import uuid

    client.get("/devedores/" + str(uuid.uuid4()))  # 401, rota /devedores/{devedor_id}
    client.get("/rota-que-nao-existe")
    t = client.get("/metrics").text
    assert 'rota="/devedores/{devedor_id}"' in t
    assert 'rota="nao_encontrada"' in t
    assert 'rota="/metrics"' not in t


def test_metrics_com_token(client, monkeypatch):
    monkeypatch.setattr(settings, "metrics_token", "segredo-do-prometheus")
    assert client.get("/metrics").status_code == 401
    assert client.get("/metrics", headers={"Authorization": "Bearer errado"}).status_code == 401
    ok = client.get("/metrics", headers={"Authorization": "Bearer segredo-do-prometheus"})
    assert ok.status_code == 200


def test_metrics_continua_respondendo_se_o_banco_falhar(client, monkeypatch):
    import app.core.metricas as metricas

    def quebrado():
        raise RuntimeError("banco fora")

    monkeypatch.setattr(metricas, "SessionLocal", quebrado)
    t = client.get("/metrics").text
    assert _valor(t, "cobranca_coleta_ok") == 0
    assert "cobranca_http_requests_total" in t
