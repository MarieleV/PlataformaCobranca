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
    Devedor,
    Job,
    Lote,
    LogAuditoria,
    RegraCobranca,
)

TEMPLATE = "Olá, {primeiro_nome}! Sua dívida de {valor} está em aberto."


def _corpo(**campos) -> dict:
    base = {
        "nome": "Lembrete 5 dias",
        "dias_atraso": 5,
        "canal": "email",
        "template_mensagem": TEMPLATE,
    }
    return {**base, **campos}


def _acoes(db) -> list[str]:
    db.expire_all()
    return sorted(a.acao for a in db.scalars(select(LogAuditoria)))


@pytest.fixture
def criar_regra(db, criar_usuario):
    def _criar(ativa=False, dias_atraso=5, canal=CanalEnum.email, **campos) -> RegraCobranca:
        regra = RegraCobranca(
            usuario_id=criar_usuario().id,
            nome=campos.pop("nome", "Regra"),
            dias_atraso=dias_atraso,
            canal=canal,
            template_mensagem=campos.pop("template_mensagem", TEMPLATE),
            ativa=ativa,
            **campos,
        )
        db.add(regra)
        db.commit()
        db.refresh(regra)
        return regra

    return _criar


# --------------------------------------------------------------------------
# Acesso
# --------------------------------------------------------------------------

_ID = uuid.uuid4()
_ESCRITA = [
    ("post", "/regras/", _corpo()),
    ("patch", f"/regras/{_ID}", {"nome": "Novo nome"}),
    ("post", f"/regras/{_ID}/ativar", None),
    ("post", f"/regras/{_ID}/desativar", None),
    ("delete", f"/regras/{_ID}", None),
]
_LEITURA = [
    ("get", "/regras/", None),
    ("get", "/regras/status", None),
    ("get", "/regras/variaveis", None),
    ("post", "/regras/preview", {"template_mensagem": "Oi"}),
    ("get", f"/regras/{_ID}", None),
    ("get", f"/regras/{_ID}/elegiveis", None),
]


def _chamar(cliente, metodo, caminho, corpo):
    return getattr(cliente, metodo)(caminho, **({"json": corpo} if corpo else {}))


@pytest.mark.parametrize("metodo, caminho, corpo", _ESCRITA + _LEITURA)
def test_todas_as_rotas_exigem_login(client, metodo, caminho, corpo):
    assert _chamar(client, metodo, caminho, corpo).status_code == 401


@pytest.mark.parametrize("metodo, caminho, corpo", _ESCRITA)
def test_operador_nao_altera_a_regua(como, metodo, caminho, corpo):
    assert _chamar(como(CargoEnum.operador), metodo, caminho, corpo).status_code == 403


@pytest.mark.parametrize("metodo, caminho, corpo", _LEITURA[:4])
def test_operador_consulta_a_regua(como, metodo, caminho, corpo):
    assert _chamar(como(CargoEnum.operador), metodo, caminho, corpo).status_code == 200


# --------------------------------------------------------------------------
# Criação
# --------------------------------------------------------------------------


@pytest.mark.parametrize("cargo", [CargoEnum.gestor, CargoEnum.administrador])
def test_gestor_e_admin_criam_regra(como, cargo, db):
    ator = como(cargo)

    resposta = ator.post("/regras/", json=_corpo())

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["ativa"] is False  # nasce desativada
    assert corpo["horario_disparo"] == "09:00:00"  # padrão do RFC
    assert corpo["usuario_id"] == str(ator.usuario.id)
    assert "criar_regra" in _acoes(db)


def test_criar_ja_ativa(como):
    assert como(CargoEnum.gestor).post("/regras/", json=_corpo(ativa=True)).json()["ativa"] is True


def test_horario_personalizado(como):
    resposta = como(CargoEnum.gestor).post("/regras/", json=_corpo(horario_disparo="14:30"))

    assert resposta.json()["horario_disparo"] == "14:30:00"


@pytest.mark.parametrize("horario", ["08:00", "12:00", "19:59"])
def test_horarios_dentro_da_janela(como, horario):
    assert como(CargoEnum.gestor).post("/regras/", json=_corpo(horario_disparo=horario)).status_code == 201


@pytest.mark.parametrize("horario", ["00:00", "07:59", "20:00", "23:30"])
def test_horarios_fora_da_janela_da_rn05(como, horario):
    resposta = como(CargoEnum.gestor).post("/regras/", json=_corpo(horario_disparo=horario))

    assert resposta.status_code == 422
    assert "08:00" in resposta.text and "20:00" in resposta.text


@pytest.mark.parametrize(
    "campos",
    [
        {"dias_atraso": 0},
        {"dias_atraso": -3},
        {"dias_atraso": 366},
        {"canal": "pombo"},
        {"nome": "a"},
        {"nome": "   "},
        {"template_mensagem": ""},
        {"template_mensagem": "Oi {cpf}"},
        {"template_mensagem": "Oi {nome"},
        {"template_mensagem": "a" * 481, "canal": "sms"},
        {"horario_disparo": "nao-e-hora"},
    ],
)
def test_dados_invalidos_na_criacao(como, campos):
    assert como(CargoEnum.gestor).post("/regras/", json=_corpo(**campos)).status_code == 422


def test_mesmo_prazo_em_canais_diferentes_pode_ficar_ativo(como):
    gestor = como(CargoEnum.gestor)

    gestor.post("/regras/", json=_corpo(ativa=True, canal="email"))
    resposta = gestor.post("/regras/", json=_corpo(ativa=True, canal="sms"))

    assert resposta.status_code == 201


def test_duas_regras_ativas_no_mesmo_canal_e_prazo_dao_409(como):
    gestor = como(CargoEnum.gestor)
    gestor.post("/regras/", json=_corpo(nome="Primeira", ativa=True))

    resposta = gestor.post("/regras/", json=_corpo(nome="Segunda", ativa=True))

    assert resposta.status_code == 409
    assert "Primeira" in resposta.json()["detail"]


def test_regras_inativas_repetidas_sao_permitidas(como):
    gestor = como(CargoEnum.gestor)

    assert gestor.post("/regras/", json=_corpo()).status_code == 201
    assert gestor.post("/regras/", json=_corpo()).status_code == 201


# --------------------------------------------------------------------------
# Listagem e detalhe
# --------------------------------------------------------------------------


def test_lista_ordenada_por_prazo(como, criar_regra):
    criar_regra(dias_atraso=30, nome="Trinta")
    criar_regra(dias_atraso=5, nome="Cinco")
    criar_regra(dias_atraso=15, nome="Quinze")

    nomes = [r["nome"] for r in como().get("/regras/").json()]

    assert nomes == ["Cinco", "Quinze", "Trinta"]


def test_filtros_da_listagem(como, criar_regra):
    criar_regra(ativa=True, canal=CanalEnum.sms, nome="SMS ativa")
    criar_regra(ativa=False, canal=CanalEnum.email, nome="Email inativa")
    cliente = como()

    assert [r["nome"] for r in cliente.get("/regras/?ativa=true").json()] == ["SMS ativa"]
    assert [r["nome"] for r in cliente.get("/regras/?canal=email").json()] == ["Email inativa"]
    assert cliente.get("/regras/?canal=whatsapp").json() == []


def test_detalhe_e_404(como, criar_regra):
    regra = criar_regra(nome="Minha regra")
    cliente = como()

    assert cliente.get(f"/regras/{regra.id}").json()["nome"] == "Minha regra"
    assert cliente.get(f"/regras/{uuid.uuid4()}").status_code == 404


# --------------------------------------------------------------------------
# Edição
# --------------------------------------------------------------------------


def test_editar_campos(como, criar_regra, db):
    regra = criar_regra()

    resposta = como(CargoEnum.gestor).patch(
        f"/regras/{regra.id}",
        json={"nome": "  Outro nome ", "dias_atraso": 10, "template_mensagem": "Olá {nome}", "horario_disparo": "10:15"},
    )

    corpo = resposta.json()
    assert resposta.status_code == 200
    assert (corpo["nome"], corpo["dias_atraso"], corpo["template_mensagem"]) == ("Outro nome", 10, "Olá {nome}")
    assert corpo["horario_disparo"] == "10:15:00"
    assert "editar_regra" in _acoes(db)


def test_editar_sem_mudar_nada_nao_gera_auditoria(como, criar_regra, db):
    regra = criar_regra(nome="Igual")

    como(CargoEnum.gestor).patch(f"/regras/{regra.id}", json={"nome": "Igual"})

    assert "editar_regra" not in _acoes(db)


def test_editar_sem_campos_retorna_422(como, criar_regra):
    assert como(CargoEnum.gestor).patch(f"/regras/{criar_regra().id}", json={}).status_code == 422


def test_trocar_para_sms_revalida_o_tamanho_do_template(como, criar_regra):
    regra = criar_regra(template_mensagem="a" * 600)  # cabe no e-mail, não no SMS

    resposta = como(CargoEnum.gestor).patch(f"/regras/{regra.id}", json={"canal": "sms"})

    assert resposta.status_code == 422
    assert "480" in resposta.json()["detail"]


def test_editar_template_com_variavel_invalida(como, criar_regra):
    resposta = como(CargoEnum.gestor).patch(
        f"/regras/{criar_regra().id}", json={"template_mensagem": "Oi {cpf_cnpj}"}
    )

    assert resposta.status_code == 422


def test_editar_horario_fora_da_janela(como, criar_regra):
    assert como(CargoEnum.gestor).patch(f"/regras/{criar_regra().id}", json={"horario_disparo": "22:00"}).status_code == 422


def test_editar_regra_ativa_para_um_par_ja_ocupado_da_409(como, criar_regra):
    criar_regra(ativa=True, dias_atraso=5)
    outra = criar_regra(ativa=True, dias_atraso=15)

    resposta = como(CargoEnum.gestor).patch(f"/regras/{outra.id}", json={"dias_atraso": 5})

    assert resposta.status_code == 409


def test_editar_regra_inativa_para_par_ocupado_e_permitido(como, criar_regra):
    criar_regra(ativa=True, dias_atraso=5)
    inativa = criar_regra(ativa=False, dias_atraso=15)

    assert como(CargoEnum.gestor).patch(f"/regras/{inativa.id}", json={"dias_atraso": 5}).status_code == 200


def test_editar_regra_inexistente(como):
    assert como(CargoEnum.gestor).patch(f"/regras/{uuid.uuid4()}", json={"nome": "Xx"}).status_code == 404


# --------------------------------------------------------------------------
# Ativar / desativar (RN02)
# --------------------------------------------------------------------------


def test_ativar_e_desativar(como, criar_regra, db):
    regra = criar_regra()
    gestor = como(CargoEnum.gestor)

    assert gestor.post(f"/regras/{regra.id}/ativar").json()["ativa"] is True
    assert gestor.post(f"/regras/{regra.id}/desativar").json()["ativa"] is False
    assert _acoes(db) == ["ativar_regra", "desativar_regra", "login"]


def test_ativar_e_desativar_sao_idempotentes(como, criar_regra, db):
    regra = criar_regra(ativa=True)
    gestor = como(CargoEnum.gestor)

    gestor.post(f"/regras/{regra.id}/ativar")  # já ativa

    assert "ativar_regra" not in _acoes(db)


def test_ativar_com_par_ocupado_da_409(como, criar_regra):
    criar_regra(ativa=True, dias_atraso=5)
    outra = criar_regra(ativa=False, dias_atraso=5)

    assert como(CargoEnum.gestor).post(f"/regras/{outra.id}/ativar").status_code == 409


def test_nao_ativa_regra_com_template_invalido(como, criar_regra):
    """Regra gravada com template inválido (ex.: variável removida depois) não ativa."""
    regra = criar_regra(template_mensagem="Olá {variavel_que_nao_existe}")

    resposta = como(CargoEnum.gestor).post(f"/regras/{regra.id}/ativar")

    assert resposta.status_code == 422
    assert "variavel_que_nao_existe" in resposta.json()["detail"]


def test_ativar_regra_inexistente(como):
    assert como(CargoEnum.gestor).post(f"/regras/{uuid.uuid4()}/ativar").status_code == 404


def test_status_da_regua_sem_regras(como):
    corpo = como().get("/regras/status").json()

    assert corpo["regua_ativa"] is False
    assert (corpo["regras_ativas"], corpo["total_regras"]) == (0, 0)
    assert "ative ao menos uma regra" in corpo["mensagem"]


def test_regua_continua_inativa_com_regras_so_desativadas(como, criar_regra):
    criar_regra(ativa=False)

    corpo = como().get("/regras/status").json()

    assert corpo["regua_ativa"] is False
    assert corpo["total_regras"] == 1


def test_regua_ativa_com_uma_regra_ativa(como, criar_regra):
    criar_regra(ativa=True, dias_atraso=5)
    criar_regra(ativa=False, dias_atraso=15)

    corpo = como().get("/regras/status").json()

    assert corpo["regua_ativa"] is True
    assert (corpo["regras_ativas"], corpo["total_regras"]) == (1, 2)


def test_regua_volta_a_ficar_inativa_ao_desativar_a_ultima(como, criar_regra):
    regra = criar_regra(ativa=True)
    gestor = como(CargoEnum.gestor)

    gestor.post(f"/regras/{regra.id}/desativar")

    assert gestor.get("/regras/status").json()["regua_ativa"] is False


# --------------------------------------------------------------------------
# Exclusão
# --------------------------------------------------------------------------


def test_excluir_regra(como, criar_regra, db):
    regra = criar_regra()
    regra_id = regra.id

    resposta = como(CargoEnum.gestor).delete(f"/regras/{regra_id}")

    assert resposta.status_code == 204
    db.expire_all()
    assert db.get(RegraCobranca, regra_id) is None
    registro = db.scalars(select(LogAuditoria).where(LogAuditoria.acao == "excluir_regra")).one()
    assert registro.entidade_id == regra_id


def test_regra_com_disparos_nao_e_excluida(como, criar_regra, db):
    regra = criar_regra()
    db.add(Job(regra_id=regra.id))
    db.commit()

    resposta = como(CargoEnum.administrador).delete(f"/regras/{regra.id}")

    assert resposta.status_code == 409
    assert "Desative" in resposta.json()["detail"]


def test_excluir_regra_inexistente(como):
    assert como(CargoEnum.gestor).delete(f"/regras/{uuid.uuid4()}").status_code == 404


# --------------------------------------------------------------------------
# Variáveis e preview
# --------------------------------------------------------------------------


def test_lista_de_variaveis_para_o_editor(como):
    variaveis = como().get("/regras/variaveis").json()

    nomes = {v["nome"] for v in variaveis}
    assert nomes == {"nome", "primeiro_nome", "valor", "data_vencimento", "dias_atraso"}
    assert all(v["placeholder"] == "{" + v["nome"] + "}" and v["exemplo"] for v in variaveis)


def test_preview_com_dados_de_exemplo(como):
    corpo = como().post("/regras/preview", json={"template_mensagem": TEMPLATE, "canal": "sms"}).json()

    assert corpo["mensagem"] == "Olá, Maria! Sua dívida de R$ 1.234,56 está em aberto."
    assert corpo["tamanho"] == len(corpo["mensagem"])
    assert corpo["limite"] == 480
    assert corpo["variaveis_usadas"] == ["primeiro_nome", "valor"]


def test_preview_com_devedor_real(como, db, criar_usuario):
    lote = Lote(usuario_id=criar_usuario().id, nome_arquivo="x.csv")
    db.add(lote)
    db.commit()
    devedor = Devedor(
        lote_id=lote.id,
        cpf_cnpj="52998224725",
        nome="Joana Pereira",
        valor_divida_enc=criptografar_decimal(Decimal("890.5")),
        data_vencimento=hoje() - timedelta(days=7),
    )
    db.add(devedor)
    db.commit()

    corpo = como().post(
        "/regras/preview",
        json={"template_mensagem": "{primeiro_nome}: {valor}, {dias_atraso} dias", "devedor_id": str(devedor.id)},
    ).json()

    assert corpo["mensagem"] == "Joana: R$ 890,50, 7 dias"


def test_preview_de_devedor_inexistente(como):
    resposta = como().post("/regras/preview", json={"template_mensagem": "Oi", "devedor_id": str(uuid.uuid4())})

    assert resposta.status_code == 404


@pytest.mark.parametrize("template", ["Oi {cpf}", "Oi {nome", ""])
def test_preview_de_template_invalido(como, template):
    assert como().post("/regras/preview", json={"template_mensagem": template}).status_code == 422
