import uuid

import pytest
import redis
from celery.schedules import crontab
from sqlalchemy import select

import app.worker.disparo_tasks as tarefas
from app.core.celery_app import celery_app
from app.models.domain import CanalEnum, Comunicacao, Job, StatusComunicacaoEnum, StatusJobEnum
from app.worker.disparo_tasks import ciclo_de_disparo, executar_regua_task
from tests.test_disparo import (  # noqa: F401  (fixtures reaproveitadas)
    SEGUNDA,
    brt,
    criar_devedor,
    criar_regra,
    lote,
)

CHAVE_TRAVA = "disparo:ciclo_em_andamento"


@pytest.fixture(autouse=True)
def segunda_as_10h(monkeypatch):
    monkeypatch.setattr(tarefas, "agora", lambda: brt(9, 10))


def _comunicacoes(db):
    db.expire_all()
    return list(db.scalars(select(Comunicacao)))


# --------------------------------------------------------------------------
# Ciclo do Beat (de ponta a ponta, com o cliente simulado)
# --------------------------------------------------------------------------


def test_ciclo_cria_o_job_e_envia(db, criar_regra, criar_devedor):
    criar_devedor("Ana", email="ana@exemplo.com")
    criar_regra()

    resultado = ciclo_de_disparo()

    assert resultado["jobs_criados"] == 1
    assert resultado["enviados"] == 1
    (comunicacao,) = _comunicacoes(db)
    assert comunicacao.status == StatusComunicacaoEnum.enviado
    assert comunicacao.id_externo.startswith("sim-")
    db.expire_all()
    assert db.scalars(select(Job)).one().status == StatusJobEnum.concluido


def test_ciclo_com_destino_invalido_registra_bounce(db, criar_regra, criar_devedor):
    criar_devedor("Ana", email="bounce@exemplo.com")
    criar_regra()

    resultado = ciclo_de_disparo()

    assert resultado["bounces"] == 1
    assert _comunicacoes(db)[0].status == StatusComunicacaoEnum.bounce


def test_ciclo_com_falha_simulada_agenda_reenvio(db, criar_regra, criar_devedor):
    criar_devedor("Ana", email="falha@exemplo.com")
    criar_regra()

    resultado = ciclo_de_disparo()

    assert resultado["reenvios_agendados"] == 1
    comunicacao = _comunicacoes(db)[0]
    assert comunicacao.status == StatusComunicacaoEnum.falha and comunicacao.proxima_tentativa_em is not None


def test_ciclo_repetido_nao_duplica_job_nem_envio(db, criar_regra, criar_devedor):
    criar_devedor("Ana", email="ana@exemplo.com")
    criar_regra()

    ciclo_de_disparo()
    segundo = ciclo_de_disparo()

    assert segundo["jobs_criados"] == 0 and segundo["enviados"] == 0
    assert len(_comunicacoes(db)) == 1


def test_ciclo_fora_da_janela_nao_faz_nada(db, criar_regra, criar_devedor, monkeypatch):
    monkeypatch.setattr(tarefas, "agora", lambda: brt(14, 10))  # sábado
    criar_devedor()
    criar_regra()

    resultado = ciclo_de_disparo()

    assert resultado["jobs_criados"] == 0 and resultado["fora_da_janela"] is True
    assert db.scalars(select(Job)).all() == []


# --------------------------------------------------------------------------
# Trava contra ciclos simultâneos
# --------------------------------------------------------------------------


def test_ciclo_ignorado_se_outro_ainda_esta_rodando(db, redis_falso, criar_regra, criar_devedor):
    criar_devedor()
    criar_regra()
    redis_falso.set(CHAVE_TRAVA, "outro-ciclo")

    assert ciclo_de_disparo() == {"ignorado": True}

    assert db.scalars(select(Job)).all() == []
    assert redis_falso.get(CHAVE_TRAVA) == "outro-ciclo"  # não solta a trava alheia


def test_trava_e_liberada_ao_final(redis_falso):
    ciclo_de_disparo()

    assert redis_falso.get(CHAVE_TRAVA) is None


def test_trava_e_liberada_mesmo_com_erro(redis_falso, monkeypatch):
    def quebra(*args, **kwargs):
        raise RuntimeError("falha de teste")

    monkeypatch.setattr(tarefas, "agendar_jobs", quebra)

    with pytest.raises(RuntimeError):
        ciclo_de_disparo()

    assert redis_falso.get(CHAVE_TRAVA) is None


def test_trava_expira_sozinha(redis_falso, criar_regra):
    """Se o worker morrer no meio, a trava some e o próximo ciclo roda."""
    redis_falso.set(CHAVE_TRAVA, "morto", ex=900)

    assert 0 < redis_falso.ttl(CHAVE_TRAVA) <= 900


def test_sem_redis_o_ciclo_roda_mesmo_assim(db, criar_regra, criar_devedor, monkeypatch):
    def sem_redis():
        raise redis.ConnectionError("fora do ar")

    monkeypatch.setattr(tarefas, "get_redis", sem_redis)
    criar_devedor("Ana", email="ana@exemplo.com")
    criar_regra()

    resultado = ciclo_de_disparo()

    assert resultado["enviados"] == 1


# --------------------------------------------------------------------------
# Execução manual
# --------------------------------------------------------------------------


def test_execucao_manual_cria_o_job_do_dia(db, criar_regra, criar_devedor):
    criar_devedor()
    regra = criar_regra()

    resultado = executar_regua_task(str(regra.id), SEGUNDA.isoformat())

    assert resultado["criado"] is True
    db.expire_all()
    assert db.scalars(select(Job)).one().dia_referencia == SEGUNDA


def test_execucao_manual_nao_duplica(db, criar_regra, criar_devedor):
    criar_devedor()
    regra = criar_regra()

    executar_regua_task(str(regra.id), SEGUNDA.isoformat())
    segunda_vez = executar_regua_task(str(regra.id), SEGUNDA.isoformat())

    assert segunda_vez["criado"] is False
    assert len(db.scalars(select(Job)).all()) == 1


def test_execucao_manual_de_regra_inativa_ou_inexistente(db, criar_regra):
    inativa = criar_regra(ativa=False)

    assert executar_regua_task(str(inativa.id), SEGUNDA.isoformat())["criado"] is False
    assert executar_regua_task(str(uuid.uuid4()), SEGUNDA.isoformat())["criado"] is False
    assert db.scalars(select(Job)).all() == []


# --------------------------------------------------------------------------
# Agendamento do Beat (RN05)
# --------------------------------------------------------------------------


def test_beat_agenda_o_ciclo_a_cada_5_minutos_em_dias_uteis_das_8_as_20():
    agenda = celery_app.conf.beat_schedule["ciclo-de-disparo"]
    horario: crontab = agenda["schedule"]

    assert agenda["task"] == "app.worker.disparo_tasks.ciclo_de_disparo"
    assert horario.minute == set(range(0, 60, 5))
    assert horario.hour == set(range(8, 20))
    assert horario.day_of_week == {1, 2, 3, 4, 5}


def test_tasks_estao_registradas_no_celery():
    assert "app.worker.disparo_tasks.ciclo_de_disparo" in celery_app.tasks
    assert "app.worker.disparo_tasks.executar_regua_task" in celery_app.tasks


def test_beat_roda_no_fuso_de_brasilia():
    assert celery_app.conf.timezone == "America/Sao_Paulo"
