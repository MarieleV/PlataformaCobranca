"""Devedores elegíveis do dia (UC03) e a RN03."""
import itertools
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.core.crypto import criptografar_decimal
from app.core.datas import hoje
from app.models.domain import (
    CanalEnum,
    CargoEnum,
    Comunicacao,
    Devedor,
    Job,
    Lote,
    RegraCobranca,
    StatusComunicacaoEnum,
    StatusDevedorEnum,
)
from app.services.regua import contar_elegiveis, consulta_elegiveis, status_da_regua

_cpf = itertools.count(1)


@pytest.fixture
def lote(db, criar_usuario):
    lote = Lote(usuario_id=criar_usuario().id, nome_arquivo="x.csv")
    db.add(lote)
    db.commit()
    return lote


@pytest.fixture
def criar_devedor(db, lote):
    def _criar(dias_atraso=5, status=StatusDevedorEnum.ativo, nome="Maria Silva", valor="100.00", **contatos) -> Devedor:
        contatos = {"email": "d@exemplo.com", "telefone": "47999990000", "whatsapp": "47999990000", **contatos}
        devedor = Devedor(
            lote_id=lote.id,
            cpf_cnpj=f"{next(_cpf):011d}",
            nome=nome,
            valor_divida_enc=criptografar_decimal(Decimal(valor)),
            data_vencimento=hoje() - timedelta(days=dias_atraso),
            status=status,
            **contatos,
        )
        db.add(devedor)
        db.commit()
        db.refresh(devedor)
        return devedor

    return _criar


@pytest.fixture
def regra(db, criar_usuario):
    def _criar(dias_atraso=5, canal=CanalEnum.email, ativa=True) -> RegraCobranca:
        regra = RegraCobranca(
            usuario_id=criar_usuario().id,
            nome="Regra",
            dias_atraso=dias_atraso,
            canal=canal,
            template_mensagem="Olá {nome}",
            ativa=ativa,
        )
        db.add(regra)
        db.commit()
        db.refresh(regra)
        return regra

    return _criar


@pytest.fixture
def registrar_envio(db, regra):
    """Grava uma comunicação do devedor (por uma regra qualquer)."""

    def _registrar(devedor, canal=CanalEnum.email, status=StatusComunicacaoEnum.entregue, quando=None):
        job = Job(regra_id=regra(dias_atraso=99, ativa=False).id)
        db.add(job)
        db.commit()
        db.add(
            Comunicacao(
                devedor_id=devedor.id,
                job_id=job.id,
                canal=canal,
                status=status,
                enviado_em=quando or datetime.now(timezone.utc),
            )
        )
        db.commit()

    return _registrar


def _nomes(db, regra_) -> list[str]:
    return [d.nome for d in db.execute(consulta_elegiveis(regra_)).scalars()]


# --------------------------------------------------------------------------
# Quem é elegível
# --------------------------------------------------------------------------


def test_so_quem_tem_exatamente_o_prazo_da_regra(db, regra, criar_devedor):
    criar_devedor(dias_atraso=4, nome="Quatro")
    criar_devedor(dias_atraso=5, nome="Cinco")
    criar_devedor(dias_atraso=6, nome="Seis")

    assert _nomes(db, regra(dias_atraso=5)) == ["Cinco"]


def test_vencimento_futuro_nao_e_elegivel(db, regra, criar_devedor):
    criar_devedor(dias_atraso=-5)

    assert _nomes(db, regra(dias_atraso=5)) == []


@pytest.mark.parametrize(
    "status, elegivel",
    [
        (StatusDevedorEnum.ativo, True),
        (StatusDevedorEnum.comunicado, True),
        (StatusDevedorEnum.negociando, False),
        (StatusDevedorEnum.quitado, False),
        (StatusDevedorEnum.inativo, False),
    ],
)
def test_status_do_devedor(db, regra, criar_devedor, status, elegivel):
    criar_devedor(status=status)

    assert (_nomes(db, regra()) != []) is elegivel


@pytest.mark.parametrize(
    "canal, campo",
    [(CanalEnum.email, "email"), (CanalEnum.sms, "telefone"), (CanalEnum.whatsapp, "whatsapp")],
)
@pytest.mark.parametrize("vazio", [None, ""])
def test_precisa_ter_o_contato_do_canal(db, regra, criar_devedor, canal, campo, vazio):
    criar_devedor(nome="Sem contato", **{campo: vazio})
    criar_devedor(nome="Com contato")

    assert _nomes(db, regra(canal=canal)) == ["Com contato"]


def test_contato_de_outro_canal_nao_basta(db, regra, criar_devedor):
    criar_devedor(email=None, telefone="47999990000", whatsapp=None)

    assert _nomes(db, regra(canal=CanalEnum.email)) == []
    assert _nomes(db, regra(canal=CanalEnum.sms)) == ["Maria Silva"]


def test_ordenados_por_nome(db, regra, criar_devedor):
    for nome in ("Carla", "Ana", "Bruno"):
        criar_devedor(nome=nome)

    assert _nomes(db, regra()) == ["Ana", "Bruno", "Carla"]


def test_dia_informado_muda_a_conta(db, regra, criar_devedor):
    criar_devedor(dias_atraso=5, nome="Hoje")
    amanha = hoje() + timedelta(days=1)

    nomes_amanha = [d.nome for d in db.execute(consulta_elegiveis(regra(dias_atraso=6), amanha)).scalars()]

    assert nomes_amanha == ["Hoje"]  # amanhã ele completa 6 dias


# --------------------------------------------------------------------------
# RN03: no máximo uma comunicação bem-sucedida por canal por dia
# --------------------------------------------------------------------------


@pytest.mark.parametrize("status", [StatusComunicacaoEnum.enviado, StatusComunicacaoEnum.entregue])
def test_quem_ja_recebeu_hoje_no_canal_sai_da_lista(db, regra, criar_devedor, registrar_envio, status):
    devedor = criar_devedor()
    registrar_envio(devedor, CanalEnum.email, status)

    assert _nomes(db, regra(canal=CanalEnum.email)) == []


@pytest.mark.parametrize("status", [StatusComunicacaoEnum.falha, StatusComunicacaoEnum.bounce, StatusComunicacaoEnum.pendente])
def test_tentativa_sem_sucesso_nao_conta_e_permite_reenvio(db, regra, criar_devedor, registrar_envio, status):
    devedor = criar_devedor()
    registrar_envio(devedor, CanalEnum.email, status)

    assert _nomes(db, regra(canal=CanalEnum.email)) == ["Maria Silva"]


def test_envio_em_outro_canal_nao_bloqueia(db, regra, criar_devedor, registrar_envio):
    devedor = criar_devedor()
    registrar_envio(devedor, CanalEnum.sms)

    assert _nomes(db, regra(canal=CanalEnum.email)) == ["Maria Silva"]


def test_envio_de_ontem_nao_bloqueia_hoje(db, regra, criar_devedor, registrar_envio):
    devedor = criar_devedor()
    registrar_envio(devedor, CanalEnum.email, quando=datetime.now(timezone.utc) - timedelta(days=1, hours=1))

    assert _nomes(db, regra(canal=CanalEnum.email)) == ["Maria Silva"]


def test_so_o_devedor_que_recebeu_sai(db, regra, criar_devedor, registrar_envio):
    recebeu = criar_devedor(nome="Recebeu")
    criar_devedor(nome="Nao recebeu")
    registrar_envio(recebeu)

    assert _nomes(db, regra()) == ["Nao recebeu"]


# --------------------------------------------------------------------------
# Contagem e status da régua (serviço)
# --------------------------------------------------------------------------


def test_contagem_ignora_paginacao(db, regra, criar_devedor):
    for i in range(3):
        criar_devedor(nome=f"D{i}")

    assert contar_elegiveis(db, regra()) == 3


def test_status_da_regua_conta_regras(db, regra):
    regra(dias_atraso=5, ativa=True)
    regra(dias_atraso=15, ativa=False)

    assert status_da_regua(db) == {"regua_ativa": True, "regras_ativas": 1, "total_regras": 2}


# --------------------------------------------------------------------------
# Endpoint
# --------------------------------------------------------------------------


def test_endpoint_lista_elegiveis_com_valor_descriptografado(como, regra, criar_devedor):
    criar_devedor(nome="Ana", valor="1500.00")
    criar_devedor(dias_atraso=9, nome="Fora")

    corpo = como().get(f"/regras/{regra().id}/elegiveis").json()

    assert corpo["total"] == 1
    assert corpo["itens"][0]["nome"] == "Ana"
    assert Decimal(corpo["itens"][0]["valor_divida"]) == Decimal("1500.00")
    assert corpo["itens"][0]["dias_atraso"] == 5


def test_endpoint_pagina_e_total_ignora_a_pagina(como, regra, criar_devedor):
    for i in range(5):
        criar_devedor(nome=f"D{i}")
    regra_id = regra().id

    corpo = como().get(f"/regras/{regra_id}/elegiveis?skip=1&limit=2").json()

    assert corpo["total"] == 5
    assert [d["nome"] for d in corpo["itens"]] == ["D1", "D2"]


def test_endpoint_aceita_outro_dia(como, regra, criar_devedor):
    criar_devedor(nome="Ana")
    regra_id = regra(dias_atraso=6).id
    amanha = hoje() + timedelta(days=1)

    assert como().get(f"/regras/{regra_id}/elegiveis?dia={amanha}").json()["total"] == 1
    assert como().get(f"/regras/{regra_id}/elegiveis").json()["total"] == 0


@pytest.mark.parametrize("cargo", list(CargoEnum))
def test_todos_os_perfis_veem_os_elegiveis(como, regra, cargo):
    assert como(cargo).get(f"/regras/{regra().id}/elegiveis").status_code == 200


@pytest.mark.parametrize("query", ["limit=0", "limit=201", "skip=-1", "dia=ontem"])
def test_parametros_invalidos(como, regra, query):
    assert como().get(f"/regras/{regra().id}/elegiveis?{query}").status_code == 422


def test_elegiveis_de_regra_inexistente(como):
    import uuid

    assert como().get(f"/regras/{uuid.uuid4()}/elegiveis").status_code == 404
