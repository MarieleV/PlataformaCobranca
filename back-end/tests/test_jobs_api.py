import uuid
from datetime import timedelta

import pytest
from kombu.exceptions import OperationalError
from sqlalchemy import select

import app.api.regras as api_regras
from app.core.datas import hoje
from app.models.domain import CanalEnum, CargoEnum, Job, LogAuditoria, StatusJobEnum
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

_ID = uuid.uuid4()


@pytest.fixture
def cenario(db, criar_regra, criar_devedor):
    """Um job de segunda com 3 devedores: um enviado, um com bounce, um em reenvio."""
    criar_devedor("Ana", email="ana@exemplo.com")
    criar_devedor("Bia", email="bia@exemplo.com")
    criar_devedor("Caio", email="caio@exemplo.com")
    regra = criar_regra()
    job = criar_job(db, regra, SEGUNDA, brt())
    processar_fila(db, brt(), provedor(ClienteFalso({"bia@exemplo.com": BOUNCE, "caio@exemplo.com": TEMP})))
    db.expire_all()
    return {"job": db.get(Job, job.id), "regra": regra}


# --------------------------------------------------------------------------
# Acesso
# --------------------------------------------------------------------------


@pytest.mark.parametrize("caminho", ["/jobs/", f"/jobs/{_ID}", f"/jobs/{_ID}/comunicacoes"])
def test_rotas_de_jobs_exigem_login(client, caminho):
    assert client.get(caminho).status_code == 401


@pytest.mark.parametrize("cargo", list(CargoEnum))
def test_todos_os_perfis_acompanham_os_jobs(como, cenario, cargo):
    cliente = como(cargo)

    assert cliente.get("/jobs/").status_code == 200
    assert cliente.get(f"/jobs/{cenario['job'].id}").status_code == 200
    assert cliente.get(f"/jobs/{cenario['job'].id}/comunicacoes").status_code == 200


# --------------------------------------------------------------------------
# Jobs
# --------------------------------------------------------------------------


def test_job_mostra_contadores_e_progresso(como, cenario):
    corpo = como().get(f"/jobs/{cenario['job'].id}").json()

    assert corpo["status"] == "executando"
    assert (corpo["total_alvos"], corpo["total_sucesso"], corpo["total_falhas"]) == (3, 1, 1)
    assert corpo["pendentes"] == 1
    assert corpo["progresso_percentual"] == 66.7
    assert corpo["regra_nome"] == cenario["regra"].nome
    assert corpo["canal"] == "email"
    assert corpo["dia_referencia"] == "2026-11-09"


def test_job_sem_alvos_tem_100_por_cento(db, como, criar_regra):
    job = criar_job(db, criar_regra(), SEGUNDA, brt())

    corpo = como().get(f"/jobs/{job.id}").json()

    assert corpo["status"] == "concluido" and corpo["progresso_percentual"] == 100.0


def test_listagem_mais_recentes_primeiro_e_total(db, como, criar_regra):
    antigo = criar_job(db, criar_regra(dias_atraso=5), SEGUNDA, brt())
    novo = criar_job(db, criar_regra(dias_atraso=15), SEGUNDA + timedelta(days=1), brt(10))

    corpo = como().get("/jobs/").json()

    assert corpo["total"] == 2
    assert [j["id"] for j in corpo["itens"]] == [str(novo.id), str(antigo.id)]


def test_filtros_e_paginacao_da_listagem(db, como, cenario, criar_regra):
    outra = criar_regra(dias_atraso=30)
    criar_job(db, outra, SEGUNDA, brt())  # sem alvos: concluído
    cliente = como()

    assert cliente.get("/jobs/?status=executando").json()["total"] == 1
    assert cliente.get("/jobs/?status=concluido").json()["total"] == 1
    assert cliente.get(f"/jobs/?regra_id={outra.id}").json()["total"] == 1
    pagina = cliente.get("/jobs/?skip=1&limit=1").json()
    assert pagina["total"] == 2 and len(pagina["itens"]) == 1


@pytest.mark.parametrize("query", ["limit=0", "limit=201", "skip=-1", "status=inexistente", "regra_id=abc"])
def test_parametros_invalidos_na_listagem_de_jobs(como, query):
    assert como().get(f"/jobs/?{query}").status_code == 422


def test_job_inexistente(como):
    assert como().get(f"/jobs/{uuid.uuid4()}").status_code == 404
    assert como().get(f"/jobs/{uuid.uuid4()}/comunicacoes").status_code == 404


# --------------------------------------------------------------------------
# Resultado de cada tentativa (RF07)
# --------------------------------------------------------------------------


def test_comunicacoes_mostram_status_tentativa_e_erro(como, cenario):
    itens = como().get(f"/jobs/{cenario['job'].id}/comunicacoes").json()["itens"]

    por_nome = {i["devedor_nome"]: i for i in itens}
    assert [i["devedor_nome"] for i in itens] == ["Ana", "Bia", "Caio"]  # ordem alfabética
    assert por_nome["Ana"]["status"] == "enviado" and por_nome["Ana"]["enviado_em"]
    assert por_nome["Bia"]["status"] == "bounce"
    assert por_nome["Bia"]["codigo_erro"] == "21211" and por_nome["Bia"]["mensagem_erro"] == "Número inválido"
    assert por_nome["Caio"]["status"] == "falha"
    assert por_nome["Caio"]["tentativas"] == 1 and por_nome["Caio"]["proxima_tentativa_em"]


def test_filtro_e_paginacao_das_comunicacoes(como, cenario):
    cliente = como()
    base = f"/jobs/{cenario['job'].id}/comunicacoes"

    assert [i["devedor_nome"] for i in cliente.get(f"{base}?status=bounce").json()["itens"]] == ["Bia"]
    pagina = cliente.get(f"{base}?skip=1&limit=1").json()
    assert pagina["total"] == 3 and [i["devedor_nome"] for i in pagina["itens"]] == ["Bia"]


def test_comunicacoes_nunca_expoem_a_mensagem_nem_contatos(como, cenario):
    texto = como().get(f"/jobs/{cenario['job'].id}/comunicacoes").text

    assert "ana@exemplo.com" not in texto and "47999991234" not in texto
    assert "Olá" not in texto


# --------------------------------------------------------------------------
# Execução manual: POST /regras/{id}/executar
# --------------------------------------------------------------------------


class _FilaFalsa:
    def __init__(self):
        self.pedidos = []

    def delay(self, regra_id, dia_iso):
        self.pedidos.append((regra_id, dia_iso))


@pytest.fixture
def fila(monkeypatch):
    falsa = _FilaFalsa()
    monkeypatch.setattr(api_regras, "executar_regua_task", falsa)
    return falsa


def _acoes(db):
    db.expire_all()
    return sorted(a.acao for a in db.scalars(select(LogAuditoria)))


@pytest.mark.parametrize("cargo", [CargoEnum.gestor, CargoEnum.administrador])
def test_gestor_e_admin_executam_a_regra(como, criar_regra, fila, db, cargo):
    regra = criar_regra()

    resposta = como(cargo).post(f"/regras/{regra.id}/executar")

    assert resposta.status_code == 202
    assert fila.pedidos == [(str(regra.id), hoje().isoformat())]
    assert "executar_regra" in _acoes(db)


def test_operador_nao_executa(como, criar_regra, fila):
    assert como(CargoEnum.operador).post(f"/regras/{criar_regra().id}/executar").status_code == 403
    assert fila.pedidos == []


def test_executar_exige_login(client):
    assert client.post(f"/regras/{_ID}/executar").status_code == 401


def test_executar_regra_de_um_dia_passado(como, criar_regra, fila):
    regra = criar_regra()
    anteontem = hoje() - timedelta(days=2)

    resposta = como(CargoEnum.gestor).post(f"/regras/{regra.id}/executar", json={"dia": anteontem.isoformat()})

    assert resposta.status_code == 202
    assert fila.pedidos == [(str(regra.id), anteontem.isoformat())]


def test_regra_inativa_nao_executa_rn02(como, criar_regra, fila):
    resposta = como(CargoEnum.gestor).post(f"/regras/{criar_regra(ativa=False).id}/executar")

    assert resposta.status_code == 409
    assert fila.pedidos == []


def test_data_futura_e_recusada(como, criar_regra, fila):
    amanha = (hoje() + timedelta(days=1)).isoformat()

    assert como(CargoEnum.gestor).post(f"/regras/{criar_regra().id}/executar", json={"dia": amanha}).status_code == 422


def test_data_muito_antiga_e_recusada(como, criar_regra, fila):
    antiga = (hoje() - timedelta(days=8)).isoformat()

    resposta = como(CargoEnum.gestor).post(f"/regras/{criar_regra().id}/executar", json={"dia": antiga})

    assert resposta.status_code == 422 and "7 dias" in resposta.json()["detail"]


def test_regra_ja_executada_no_dia_da_409(db, como, criar_regra, fila):
    regra = criar_regra()
    criar_job(db, regra, hoje(), brt())

    resposta = como(CargoEnum.gestor).post(f"/regras/{regra.id}/executar")

    assert resposta.status_code == 409 and fila.pedidos == []


def test_executar_regra_inexistente(como, fila):
    assert como(CargoEnum.gestor).post(f"/regras/{uuid.uuid4()}/executar").status_code == 404


def test_fila_fora_do_ar_responde_503_sem_auditar(como, criar_regra, db, monkeypatch):
    class FilaQuebrada:
        def delay(self, *args):
            raise OperationalError("broker fora do ar")

    monkeypatch.setattr(api_regras, "executar_regua_task", FilaQuebrada())

    resposta = como(CargoEnum.gestor).post(f"/regras/{criar_regra().id}/executar")

    assert resposta.status_code == 503
    assert "executar_regra" not in _acoes(db)


def test_corpo_invalido(como, criar_regra, fila):
    resposta = como(CargoEnum.gestor).post(f"/regras/{criar_regra().id}/executar", json={"dia": "ontem"})

    assert resposta.status_code == 422
