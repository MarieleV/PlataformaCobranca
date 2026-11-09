import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.crypto import criptografar_decimal
from app.core.datas import hoje
from app.models.domain import (
    CanalEnum,
    CargoEnum,
    Comunicacao,
    Devedor,
    Job,
    Lote,
    LogAuditoria,
    RegraCobranca,
    StatusComunicacaoEnum,
    StatusDevedorEnum,
)

_contador = {"n": 0}


@pytest.fixture
def lote(db, criar_usuario):
    usuario = criar_usuario()
    lote = Lote(usuario_id=usuario.id, nome_arquivo="x.csv")
    db.add(lote)
    db.commit()
    db.refresh(lote)
    return lote


@pytest.fixture
def criar_devedor(db, lote):
    def _criar(
        nome="Maria Silva",
        cpf_cnpj=None,
        valor="1500.00",
        dias_atraso=10,
        status=StatusDevedorEnum.ativo,
    ) -> Devedor:
        _contador["n"] += 1
        devedor = Devedor(
            lote_id=lote.id,
            cpf_cnpj=cpf_cnpj or f"{_contador['n']:011d}",
            nome=nome,
            email="d@exemplo.com",
            valor_divida_enc=criptografar_decimal(Decimal(valor)),
            data_vencimento=hoje() - timedelta(days=dias_atraso),
            status=status,
        )
        db.add(devedor)
        db.commit()
        db.refresh(devedor)
        return devedor

    return _criar


@pytest.fixture
def criar_comunicacao(db):
    def _criar(devedor: Devedor, **campos) -> Comunicacao:
        regra = RegraCobranca(
            usuario_id=devedor.lote.usuario_id,
            nome="Regra",
            dias_atraso=5,
            canal=CanalEnum.email,
            template_mensagem="Olá",
        )
        db.add(regra)
        db.commit()
        job = Job(regra_id=regra.id)
        db.add(job)
        db.commit()
        comunicacao = Comunicacao(
            devedor_id=devedor.id,
            job_id=job.id,
            canal=campos.pop("canal", CanalEnum.email),
            **campos,
        )
        db.add(comunicacao)
        db.commit()
        db.refresh(comunicacao)
        return comunicacao

    return _criar


# --------------------------------------------------------------------------
# Autenticação
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "metodo, caminho",
    [
        ("get", "/devedores/"),
        ("get", f"/devedores/{uuid.uuid4()}"),
        ("get", f"/devedores/{uuid.uuid4()}/comunicacoes"),
        ("delete", f"/devedores/{uuid.uuid4()}"),
    ],
)
def test_rotas_de_devedores_exigem_login(client, metodo, caminho):
    """Antes da correção, a listagem estava aberta a qualquer pessoa."""
    assert getattr(client, metodo)(caminho).status_code == 401


# --------------------------------------------------------------------------
# Listagem (RF05)
# --------------------------------------------------------------------------


def test_listagem_devolve_pagina_com_total(logar, criar_devedor):
    criar_devedor(nome="A")
    criar_devedor(nome="B")

    corpo = logar().get("/devedores/").json()

    assert corpo["total"] == 2
    assert (corpo["skip"], corpo["limit"]) == (0, 50)
    assert len(corpo["itens"]) == 2


def test_valor_vem_descriptografado_e_com_dias_de_atraso(logar, criar_devedor):
    criar_devedor(valor="2500.50", dias_atraso=15)

    item = logar().get("/devedores/").json()["itens"][0]

    assert Decimal(item["valor_divida"]) == Decimal("2500.50")
    assert item["dias_atraso"] == 15
    assert "valor_divida_enc" not in item


def test_dias_de_atraso_nunca_e_negativo_para_vencimento_futuro(logar, criar_devedor):
    criar_devedor(dias_atraso=-30)  # vence daqui a 30 dias

    item = logar().get("/devedores/").json()["itens"][0]

    assert item["dias_atraso"] == 0


def test_mais_antigos_primeiro(logar, criar_devedor):
    criar_devedor(nome="Recente", dias_atraso=2)
    criar_devedor(nome="Antigo", dias_atraso=40)
    criar_devedor(nome="Medio", dias_atraso=15)

    nomes = [i["nome"] for i in logar().get("/devedores/").json()["itens"]]

    assert nomes == ["Antigo", "Medio", "Recente"]


def test_paginacao(logar, criar_devedor):
    for i in range(5):
        criar_devedor(nome=f"D{i}", dias_atraso=10 + i)
    client = logar()

    pagina = client.get("/devedores/?skip=2&limit=2").json()

    assert pagina["total"] == 5  # o total ignora a página
    assert len(pagina["itens"]) == 2


@pytest.mark.parametrize("query", ["limit=0", "limit=201", "skip=-1", "atraso_minimo=-1", "status=inexistente", "busca=a"])
def test_parametros_invalidos_retornam_422(logar, query):
    assert logar().get(f"/devedores/?{query}").status_code == 422


def test_filtro_por_status(logar, criar_devedor):
    criar_devedor(nome="Ativo", status=StatusDevedorEnum.ativo)
    criar_devedor(nome="Quitado", status=StatusDevedorEnum.quitado)

    itens = logar().get("/devedores/?status=quitado").json()["itens"]

    assert [i["nome"] for i in itens] == ["Quitado"]


def test_filtro_por_atraso_minimo(logar, criar_devedor):
    criar_devedor(nome="Cinco", dias_atraso=5)
    criar_devedor(nome="Quinze", dias_atraso=15)
    criar_devedor(nome="Trinta", dias_atraso=30)

    itens = logar().get("/devedores/?atraso_minimo=15").json()["itens"]

    assert sorted(i["nome"] for i in itens) == ["Quinze", "Trinta"]  # inclui o limite


def test_busca_por_nome_ignora_maiusculas(logar, criar_devedor):
    criar_devedor(nome="Maria Silva")
    criar_devedor(nome="Joao Souza")

    itens = logar().get("/devedores/?busca=MARIA").json()["itens"]

    assert [i["nome"] for i in itens] == ["Maria Silva"]


def test_busca_por_cpf_com_ou_sem_mascara(logar, criar_devedor):
    criar_devedor(nome="Maria", cpf_cnpj="52998224725")
    criar_devedor(nome="Joao", cpf_cnpj="11144477735")
    client = logar()

    com_mascara = client.get("/devedores/?busca=529.982").json()["itens"]
    sem_mascara = client.get("/devedores/?busca=52998224725").json()["itens"]

    assert [i["nome"] for i in com_mascara] == ["Maria"]
    assert [i["nome"] for i in sem_mascara] == ["Maria"]


def test_busca_trata_percentual_como_texto_literal(logar, criar_devedor):
    """O '%' não pode virar curinga do LIKE (autoescape)."""
    criar_devedor(nome="Maria Silva")

    assert logar().get("/devedores/?busca=%25%25").json()["total"] == 0


def test_filtros_combinados(logar, criar_devedor):
    criar_devedor(nome="Maria Antiga", dias_atraso=40, status=StatusDevedorEnum.ativo)
    criar_devedor(nome="Maria Recente", dias_atraso=3, status=StatusDevedorEnum.ativo)
    criar_devedor(nome="Maria Quitada", dias_atraso=40, status=StatusDevedorEnum.quitado)

    itens = logar().get("/devedores/?busca=maria&status=ativo&atraso_minimo=30").json()["itens"]

    assert [i["nome"] for i in itens] == ["Maria Antiga"]


@pytest.mark.parametrize("cargo", list(CargoEnum))
def test_todos_os_perfis_podem_consultar(logar, criar_devedor, cargo):
    criar_devedor()

    assert logar(cargo).get("/devedores/").status_code == 200


# --------------------------------------------------------------------------
# Detalhe e histórico (UC04 e UC06)
# --------------------------------------------------------------------------


def test_detalhe_do_devedor(logar, criar_devedor):
    devedor = criar_devedor(nome="Maria Silva", valor="890.00")

    resposta = logar().get(f"/devedores/{devedor.id}")

    assert resposta.status_code == 200
    assert resposta.json()["nome"] == "Maria Silva"
    assert Decimal(resposta.json()["valor_divida"]) == Decimal("890.00")


def test_devedor_inexistente_retorna_404(logar):
    assert logar().get(f"/devedores/{uuid.uuid4()}").status_code == 404


def test_historico_vazio(logar, criar_devedor):
    devedor = criar_devedor()

    resposta = logar().get(f"/devedores/{devedor.id}/comunicacoes")

    assert resposta.status_code == 200
    assert resposta.json() == []


def test_historico_de_comunicacoes(logar, criar_devedor, criar_comunicacao):
    devedor = criar_devedor()
    criar_comunicacao(
        devedor,
        canal=CanalEnum.sms,
        status=StatusComunicacaoEnum.entregue,
        tentativas=1,
    )
    criar_comunicacao(
        devedor,
        status=StatusComunicacaoEnum.falha,
        tentativas=4,
        codigo_erro="550",
        mensagem_erro="Caixa cheia",
    )

    historico = logar().get(f"/devedores/{devedor.id}/comunicacoes").json()

    assert len(historico) == 2
    por_status = {h["status"]: h for h in historico}
    assert por_status["entregue"]["canal"] == "sms"
    assert por_status["falha"]["tentativas"] == 4
    assert por_status["falha"]["codigo_erro"] == "550"


def test_historico_nao_mistura_devedores(logar, criar_devedor, criar_comunicacao):
    maria = criar_devedor(nome="Maria")
    joao = criar_devedor(nome="Joao")
    criar_comunicacao(maria)

    assert logar().get(f"/devedores/{joao.id}/comunicacoes").json() == []


def test_historico_de_devedor_inexistente_retorna_404(logar):
    assert logar().get(f"/devedores/{uuid.uuid4()}/comunicacoes").status_code == 404


# --------------------------------------------------------------------------
# Exclusão (LGPD, art. 18, RF12): só administrador
# --------------------------------------------------------------------------


def test_administrador_exclui_devedor_e_historico(logar, db, criar_devedor, criar_comunicacao):
    devedor = criar_devedor()
    devedor_id = devedor.id  # guarda antes: depois de apagado, o objeto não recarrega
    criar_comunicacao(devedor)
    client = logar(CargoEnum.administrador)

    resposta = client.delete(f"/devedores/{devedor_id}")

    assert resposta.status_code == 204
    assert resposta.content == b""
    db.expire_all()
    assert db.get(Devedor, devedor_id) is None
    assert db.scalars(select(Comunicacao)).all() == []
    assert client.get(f"/devedores/{devedor_id}").status_code == 404


@pytest.mark.parametrize("cargo", [CargoEnum.operador, CargoEnum.gestor])
def test_outros_perfis_nao_podem_excluir(logar, db, criar_devedor, cargo):
    devedor = criar_devedor()

    resposta = logar(cargo).delete(f"/devedores/{devedor.id}")

    assert resposta.status_code == 403
    db.expire_all()
    assert db.get(Devedor, devedor.id) is not None


def test_exclusao_fica_registrada_na_auditoria(logar, db, criar_devedor):
    devedor_id = criar_devedor().id
    client = logar(CargoEnum.administrador)
    client.delete(f"/devedores/{devedor_id}")

    db.expire_all()
    registro = db.scalars(select(LogAuditoria).where(LogAuditoria.acao == "excluir_devedor")).one()
    assert registro.usuario_id == client.usuario.id
    assert registro.entidade == "devedor"
    assert registro.entidade_id == devedor_id


def test_excluir_devedor_inexistente_retorna_404(logar):
    assert logar(CargoEnum.administrador).delete(f"/devedores/{uuid.uuid4()}").status_code == 404


def test_excluir_um_devedor_nao_apaga_os_outros(logar, db, criar_devedor):
    apagado = criar_devedor(nome="Apagado")
    mantido = criar_devedor(nome="Mantido")

    logar(CargoEnum.administrador).delete(f"/devedores/{apagado.id}")

    db.expire_all()
    assert db.get(Devedor, mantido.id) is not None