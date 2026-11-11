"""Disparo da régua: jobs, envio, reenvios (RN07), bounce (RN08), janela (RN05)."""
import itertools
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from app.clients import ResultadoEnvio
from app.core.config import settings
from app.core.crypto import criptografar_decimal
from app.models.domain import (
    CanalEnum,
    Comunicacao,
    Devedor,
    Job,
    Lote,
    RegraCobranca,
    StatusComunicacaoEnum,
    StatusDevedorEnum,
    StatusJobEnum,
)
from app.services.disparo import agendar_jobs, criar_job, processar_fila
from app.services.regua import consulta_elegiveis

BRT = ZoneInfo("America/Sao_Paulo")
SEGUNDA = date(2026, 11, 9)
_cpf = itertools.count(1000)


def brt(dia: int = 9, hora: int = 10, minuto: int = 0) -> datetime:
    """Novembro de 2026: 9 segunda, 13 sexta, 14 sábado."""
    return datetime(2026, 11, dia, hora, minuto, tzinfo=BRT)


def depois(minutos: int, base: datetime | None = None) -> datetime:
    return (base or brt()) + timedelta(minutes=minutos)


def utc(momento: datetime | None) -> datetime | None:
    if momento is None:
        return None
    return momento.replace(tzinfo=timezone.utc) if momento.tzinfo is None else momento.astimezone(timezone.utc)


class ClienteFalso:
    """Registra as chamadas e devolve o resultado definido por destino."""

    def __init__(self, por_destino: dict[str, ResultadoEnvio] | None = None, padrao: ResultadoEnvio | None = None):
        self.por_destino = por_destino or {}
        self.padrao = padrao or ResultadoEnvio.enviado("ext-1")
        self.chamadas: list[tuple[str, str, str | None]] = []

    def enviar(self, destino, mensagem, assunto=None):
        self.chamadas.append((destino, mensagem, assunto))
        resultado = self.por_destino.get(destino, self.padrao)
        if isinstance(resultado, Exception):
            raise resultado
        return resultado

    @property
    def destinos(self) -> list[str]:
        return [c[0] for c in self.chamadas]


def provedor(cliente: ClienteFalso):
    return lambda canal: cliente


TEMP = ResultadoEnvio.temporaria("500", "Erro do provedor")
BOUNCE = ResultadoEnvio.bounce("21211", "Número inválido")


@pytest.fixture
def lote(db, criar_usuario):
    lote = Lote(usuario_id=criar_usuario().id, nome_arquivo="x.csv")
    db.add(lote)
    db.commit()
    return lote


@pytest.fixture
def criar_devedor(db, lote):
    def _criar(nome="Ana Souza", dias_atraso=5, dia=SEGUNDA, email=None, telefone="47999991234", **campos) -> Devedor:
        devedor = Devedor(
            lote_id=lote.id,
            cpf_cnpj=f"{next(_cpf):011d}",
            nome=nome,
            email=email if email is not None else f"{nome.split()[0].lower()}@exemplo.com",
            telefone=telefone,
            whatsapp=telefone,
            valor_divida_enc=criptografar_decimal(Decimal("1500.00")),
            data_vencimento=dia - timedelta(days=dias_atraso),
            status=campos.pop("status", StatusDevedorEnum.ativo),
            **campos,
        )
        db.add(devedor)
        db.commit()
        db.refresh(devedor)
        return devedor

    return _criar


@pytest.fixture
def criar_regra(db, criar_usuario):
    def _criar(dias_atraso=5, canal=CanalEnum.email, ativa=True, horario=time(9, 0), template="Olá {primeiro_nome}") -> RegraCobranca:
        regra = RegraCobranca(
            usuario_id=criar_usuario().id,
            nome=f"Regra {canal.value} {dias_atraso}d",
            dias_atraso=dias_atraso,
            canal=canal,
            template_mensagem=template,
            horario_disparo=horario,
            ativa=ativa,
        )
        db.add(regra)
        db.commit()
        db.refresh(regra)
        return regra

    return _criar


def comunicacoes(db) -> list[Comunicacao]:
    db.expire_all()
    return list(db.scalars(select(Comunicacao).order_by(Comunicacao.criado_em, Comunicacao.id)))


def job_unico(db) -> Job:
    db.expire_all()
    return db.scalars(select(Job)).one()


# --------------------------------------------------------------------------
# Criação do job
# --------------------------------------------------------------------------


def test_criar_job_gera_uma_comunicacao_pendente_por_elegivel(db, criar_regra, criar_devedor):
    criar_devedor("Ana")
    criar_devedor("Bia")
    criar_devedor("Fora", dias_atraso=9)
    regra = criar_regra()

    job = criar_job(db, regra, SEGUNDA, brt())

    assert job.status == StatusJobEnum.executando
    assert (job.total_alvos, job.dia_referencia) == (2, SEGUNDA)
    assert utc(job.inicio_em) == utc(brt())
    pendentes = comunicacoes(db)
    assert len(pendentes) == 2
    assert {c.status for c in pendentes} == {StatusComunicacaoEnum.pendente}
    assert {c.tentativas for c in pendentes} == {0}
    assert {c.canal for c in pendentes} == {CanalEnum.email}


def test_criar_job_nao_inclui_quem_nao_e_elegivel(db, criar_regra, criar_devedor):
    criar_devedor("Negociando", status=StatusDevedorEnum.negociando)
    criar_devedor("Quitado", status=StatusDevedorEnum.quitado)
    criar_devedor("SemEmail", email="")
    regra = criar_regra()
    db.execute(Devedor.__table__.update().where(Devedor.nome == "SemEmail").values(email=None))
    db.commit()

    job = criar_job(db, regra, SEGUNDA, brt())

    assert job.total_alvos == 0


def test_job_sem_alvos_ja_nasce_concluido(db, criar_regra):
    job = criar_job(db, criar_regra(), SEGUNDA, brt())

    assert job.status == StatusJobEnum.concluido
    assert utc(job.fim_em) == utc(brt())


def test_criar_job_e_idempotente_no_dia(db, criar_regra, criar_devedor):
    criar_devedor()
    regra = criar_regra()

    primeiro = criar_job(db, regra, SEGUNDA, brt())
    segundo = criar_job(db, regra, SEGUNDA, brt(hora=11))

    assert primeiro is not None and segundo is None
    assert len(comunicacoes(db)) == 1
    assert len(db.scalars(select(Job)).all()) == 1


def test_mesma_regra_em_outro_dia_cria_novo_job(db, criar_regra, criar_devedor):
    criar_devedor("Segunda", dia=SEGUNDA)
    criar_devedor("Terca", dia=SEGUNDA + timedelta(days=1))
    regra = criar_regra()

    criar_job(db, regra, SEGUNDA, brt())
    terca = criar_job(db, regra, SEGUNDA + timedelta(days=1), brt(10))

    assert terca is not None and terca.total_alvos == 1


# --------------------------------------------------------------------------
# Agendamento (RN05 + horário da regra)
# --------------------------------------------------------------------------


def test_agendar_ignora_regra_inativa(db, criar_regra, criar_devedor):
    criar_devedor()
    criar_regra(ativa=False)

    assert agendar_jobs(db, brt()) == []


def test_agendar_so_depois_do_horario_da_regra(db, criar_regra, criar_devedor):
    criar_devedor()
    criar_regra(horario=time(14, 0))

    assert agendar_jobs(db, brt(hora=13, minuto=59)) == []
    assert len(agendar_jobs(db, brt(hora=14, minuto=0))) == 1


def test_agendar_retoma_no_mesmo_dia_se_o_sistema_acordou_tarde(db, criar_regra, criar_devedor):
    criar_devedor()
    criar_regra(horario=time(9, 0))

    assert len(agendar_jobs(db, brt(hora=15))) == 1  # o ciclo das 9h não rodou


@pytest.mark.parametrize("momento", [brt(9, 7, 59), brt(9, 20, 0), brt(9, 23), brt(14, 10), brt(15, 10)])
def test_agendar_nao_faz_nada_fora_da_janela(db, criar_regra, criar_devedor, momento):
    criar_devedor(dia=momento.date())
    criar_regra(horario=time(8, 0))

    assert agendar_jobs(db, momento) == []
    assert db.scalars(select(Job)).all() == []


def test_agendar_varias_regras_e_nao_repete_no_dia(db, criar_regra, criar_devedor):
    criar_devedor("A5", dias_atraso=5)
    criar_devedor("B15", dias_atraso=15)
    criar_regra(dias_atraso=5)
    criar_regra(dias_atraso=15)

    assert len(agendar_jobs(db, brt())) == 2
    assert agendar_jobs(db, brt(hora=11)) == []
    assert len(db.scalars(select(Job)).all()) == 2


def test_agendar_dia_seguinte_cria_novo_job(db, criar_regra, criar_devedor):
    criar_devedor("Hoje", dia=SEGUNDA)
    criar_devedor("Amanha", dia=SEGUNDA + timedelta(days=1))
    criar_regra()

    agendar_jobs(db, brt(9, 10))
    novos = agendar_jobs(db, brt(10, 10))

    assert len(novos) == 1 and novos[0].dia_referencia == SEGUNDA + timedelta(days=1)


def test_um_job_com_erro_nao_derruba_os_outros(db, criar_regra, criar_devedor, monkeypatch):
    criar_devedor("A5", dias_atraso=5)
    criar_devedor("B15", dias_atraso=15)
    criar_regra(dias_atraso=5)
    criar_regra(dias_atraso=15)
    original = criar_job

    def quebra_na_primeira(db_, regra, dia, agora):
        if regra.dias_atraso == 5:
            raise RuntimeError("falha de teste")
        return original(db_, regra, dia, agora)

    monkeypatch.setattr("app.services.disparo.criar_job", quebra_na_primeira)

    criados = agendar_jobs(db, brt())

    assert [j.regra.dias_atraso for j in criados] == [15]


# --------------------------------------------------------------------------
# Envio com sucesso
# --------------------------------------------------------------------------


def test_envio_com_sucesso_grava_o_resultado(db, criar_regra, criar_devedor):
    devedor = criar_devedor("Ana", email="ana@exemplo.com")
    criar_job(db, criar_regra(), SEGUNDA, brt())
    cliente = ClienteFalso()

    resumo = processar_fila(db, brt(), provedor(cliente))

    assert resumo.enviados == 1
    (comunicacao,) = comunicacoes(db)
    assert comunicacao.status == StatusComunicacaoEnum.enviado
    assert comunicacao.tentativas == 1
    assert comunicacao.id_externo == "ext-1"
    assert utc(comunicacao.enviado_em) == utc(brt())
    assert comunicacao.proxima_tentativa_em is None and comunicacao.codigo_erro is None
    db.refresh(devedor)
    assert devedor.status == StatusDevedorEnum.comunicado
    assert cliente.destinos == ["ana@exemplo.com"]


def test_mensagem_e_renderizada_com_os_dados_do_devedor(db, criar_regra, criar_devedor):
    criar_devedor("Ana Souza", dias_atraso=5)
    criar_job(
        db,
        criar_regra(template="Olá {primeiro_nome}, você deve {valor} há {dias_atraso} dias."),
        SEGUNDA,
        brt(),
    )
    cliente = ClienteFalso()

    processar_fila(db, brt(), provedor(cliente))

    assert cliente.chamadas[0][1] == "Olá Ana, você deve R$ 1.500,00 há 5 dias."


def test_assunto_so_existe_no_email(db, criar_regra, criar_devedor):
    criar_devedor()
    criar_job(db, criar_regra(canal=CanalEnum.email, dias_atraso=5), SEGUNDA, brt())
    criar_job(db, criar_regra(canal=CanalEnum.sms, dias_atraso=5), SEGUNDA, brt())
    cliente = ClienteFalso()

    processar_fila(db, brt(), provedor(cliente))

    assuntos = {destino: assunto for destino, _, assunto in cliente.chamadas}
    assert assuntos["ana@exemplo.com"] == settings.email_assunto
    assert assuntos["47999991234"] is None


@pytest.mark.parametrize(
    "canal, destino",
    [(CanalEnum.email, "ana@exemplo.com"), (CanalEnum.sms, "47999991234"), (CanalEnum.whatsapp, "47999991234")],
)
def test_cada_canal_usa_o_contato_certo(db, criar_regra, criar_devedor, canal, destino):
    criar_devedor("Ana", email="ana@exemplo.com", telefone="47999991234")
    criar_job(db, criar_regra(canal=canal), SEGUNDA, brt())
    cliente = ClienteFalso()

    processar_fila(db, brt(), provedor(cliente))

    assert cliente.destinos == [destino]


def test_o_cliente_certo_e_pedido_para_cada_canal(db, criar_regra, criar_devedor):
    criar_devedor()
    criar_job(db, criar_regra(canal=CanalEnum.sms), SEGUNDA, brt())
    pedidos = []

    def escolher(canal):
        pedidos.append(canal)
        return ClienteFalso()

    processar_fila(db, brt(), escolher)

    assert pedidos == [CanalEnum.sms]


def test_job_conclui_com_os_contadores(db, criar_regra, criar_devedor):
    criar_devedor("Ana")
    criar_devedor("Bia")
    criar_job(db, criar_regra(), SEGUNDA, brt())

    processar_fila(db, brt(), provedor(ClienteFalso()))

    job = job_unico(db)
    assert job.status == StatusJobEnum.concluido
    assert (job.total_alvos, job.total_sucesso, job.total_falhas) == (2, 2, 0)
    assert utc(job.fim_em) == utc(brt())


def test_nao_reenvia_o_que_ja_foi_enviado(db, criar_regra, criar_devedor):
    criar_devedor()
    criar_job(db, criar_regra(), SEGUNDA, brt())
    cliente = ClienteFalso()

    processar_fila(db, brt(), provedor(cliente))
    resumo = processar_fila(db, brt(hora=12), provedor(cliente))

    assert len(cliente.chamadas) == 1
    assert resumo.enviados == 0


def test_processa_em_varios_lotes(db, criar_regra, criar_devedor):
    for i in range(5):
        criar_devedor(f"Pessoa{i}")
    criar_job(db, criar_regra(), SEGUNDA, brt())
    cliente = ClienteFalso()

    resumo = processar_fila(db, brt(), provedor(cliente), tamanho_lote=2)

    assert resumo.enviados == 5 and len(cliente.chamadas) == 5


def test_sem_orcamento_de_tempo_nada_e_enviado(db, criar_regra, criar_devedor):
    criar_devedor()
    criar_job(db, criar_regra(), SEGUNDA, brt())
    cliente = ClienteFalso()

    processar_fila(db, brt(), provedor(cliente), orcamento_segundos=0)

    assert cliente.chamadas == []
    assert comunicacoes(db)[0].status == StatusComunicacaoEnum.pendente


# --------------------------------------------------------------------------
# Janela da RN05
# --------------------------------------------------------------------------


@pytest.mark.parametrize("momento", [brt(9, 7, 59), brt(9, 20, 0), brt(14, 10)])
def test_fora_da_janela_nada_e_enviado(db, criar_regra, criar_devedor, momento):
    criar_devedor()
    criar_job(db, criar_regra(), SEGUNDA, brt())
    cliente = ClienteFalso()

    resumo = processar_fila(db, momento, provedor(cliente))

    assert resumo.fora_da_janela is True
    assert cliente.chamadas == []
    assert comunicacoes(db)[0].status == StatusComunicacaoEnum.pendente


def test_comunicacao_pendente_sai_quando_a_janela_abre(db, criar_regra, criar_devedor):
    criar_devedor()
    criar_job(db, criar_regra(), SEGUNDA, brt())
    cliente = ClienteFalso()

    processar_fila(db, brt(9, 21), provedor(cliente))  # fechada
    processar_fila(db, brt(10, 8), provedor(cliente))  # abriu

    assert len(cliente.chamadas) == 1


# --------------------------------------------------------------------------
# Falha temporária e reenvios (RN07)
# --------------------------------------------------------------------------


def test_falha_temporaria_agenda_reenvio_em_30_minutos(db, criar_regra, criar_devedor):
    devedor = criar_devedor(email="ana@exemplo.com")
    criar_job(db, criar_regra(), SEGUNDA, brt())

    resumo = processar_fila(db, brt(), provedor(ClienteFalso(padrao=TEMP)))

    assert resumo.reenvios_agendados == 1
    (comunicacao,) = comunicacoes(db)
    assert comunicacao.status == StatusComunicacaoEnum.falha
    assert comunicacao.tentativas == 1
    assert (comunicacao.codigo_erro, comunicacao.mensagem_erro) == ("500", "Erro do provedor")
    assert utc(comunicacao.proxima_tentativa_em) == utc(brt(minuto=30))
    assert comunicacao.enviado_em is None
    db.refresh(devedor)
    assert devedor.status == StatusDevedorEnum.ativo  # falha não conta como comunicado


def test_reenvio_so_acontece_depois_do_intervalo(db, criar_regra, criar_devedor):
    criar_devedor()
    criar_job(db, criar_regra(), SEGUNDA, brt())
    cliente = ClienteFalso(padrao=TEMP)

    processar_fila(db, brt(), provedor(cliente))
    processar_fila(db, brt(minuto=29), provedor(cliente))
    assert len(cliente.chamadas) == 1

    processar_fila(db, brt(minuto=30), provedor(cliente))
    assert len(cliente.chamadas) == 2


def test_reenvio_com_sucesso_na_segunda_tentativa(db, criar_regra, criar_devedor):
    criar_devedor()
    criar_job(db, criar_regra(), SEGUNDA, brt())

    processar_fila(db, brt(), provedor(ClienteFalso(padrao=TEMP)))
    processar_fila(db, brt(minuto=30), provedor(ClienteFalso()))

    (comunicacao,) = comunicacoes(db)
    assert comunicacao.status == StatusComunicacaoEnum.enviado
    assert comunicacao.tentativas == 2
    assert comunicacao.proxima_tentativa_em is None and comunicacao.codigo_erro is None
    job = job_unico(db)
    assert (job.status, job.total_sucesso, job.total_falhas) == (StatusJobEnum.concluido, 1, 0)


def test_job_continua_em_andamento_enquanto_houver_reenvio_pendente(db, criar_regra, criar_devedor):
    criar_devedor("Ana", email="ana@exemplo.com")
    criar_devedor("Bia", email="bia@exemplo.com")
    criar_job(db, criar_regra(), SEGUNDA, brt())

    processar_fila(db, brt(), provedor(ClienteFalso({"bia@exemplo.com": TEMP})))

    job = job_unico(db)
    assert job.status == StatusJobEnum.executando
    assert (job.total_sucesso, job.total_falhas) == (1, 0)
    assert job.fim_em is None


def test_esgotadas_as_4_tentativas_a_falha_e_definitiva(db, criar_regra, criar_devedor):
    criar_devedor()
    criar_job(db, criar_regra(), SEGUNDA, brt())
    cliente = ClienteFalso(padrao=TEMP)

    resumos = [processar_fila(db, depois(30 * n), provedor(cliente)) for n in range(4)]

    assert [r.reenvios_agendados for r in resumos] == [1, 1, 1, 0]
    assert resumos[-1].falhas_definitivas == 1
    (comunicacao,) = comunicacoes(db)
    assert (comunicacao.status, comunicacao.tentativas) == (StatusComunicacaoEnum.falha, 4)
    assert comunicacao.proxima_tentativa_em is None
    job = job_unico(db)
    assert (job.status, job.total_falhas, job.total_sucesso) == (StatusJobEnum.falhou, 1, 0)

    processar_fila(db, brt(hora=15), provedor(cliente))  # não tenta uma 5ª vez
    assert len(cliente.chamadas) == 4


def test_limite_de_tentativas_e_configuravel(db, criar_regra, criar_devedor, monkeypatch):
    monkeypatch.setattr(settings, "max_tentativas_envio", 2)
    criar_devedor()
    criar_job(db, criar_regra(), SEGUNDA, brt())
    cliente = ClienteFalso(padrao=TEMP)

    for n in range(4):
        processar_fila(db, depois(30 * n), provedor(cliente))

    assert len(cliente.chamadas) == 2


def test_intervalo_do_reenvio_e_configuravel(db, criar_regra, criar_devedor, monkeypatch):
    monkeypatch.setattr(settings, "intervalo_reenvio_minutos", 45)
    criar_devedor()
    criar_job(db, criar_regra(), SEGUNDA, brt())

    processar_fila(db, brt(), provedor(ClienteFalso(padrao=TEMP)))

    assert utc(comunicacoes(db)[0].proxima_tentativa_em) == utc(brt(minuto=45))


def test_reenvio_que_cairia_depois_das_20h_vai_para_o_dia_seguinte(db, criar_regra, criar_devedor):
    criar_devedor()
    criar_job(db, criar_regra(), SEGUNDA, brt())

    processar_fila(db, brt(hora=19, minuto=45), provedor(ClienteFalso(padrao=TEMP)))

    assert utc(comunicacoes(db)[0].proxima_tentativa_em) == utc(brt(10, 8, 0))


def test_reenvio_de_sexta_a_noite_vai_para_a_segunda(db, criar_regra, criar_devedor):
    sexta = date(2026, 11, 13)
    criar_devedor(dia=sexta)
    criar_job(db, criar_regra(), sexta, brt(13))

    processar_fila(db, brt(13, 19, 45), provedor(ClienteFalso(padrao=TEMP)))

    assert utc(comunicacoes(db)[0].proxima_tentativa_em) == utc(datetime(2026, 11, 16, 8, 0, tzinfo=BRT))


# --------------------------------------------------------------------------
# Bounce (RN08)
# --------------------------------------------------------------------------


def test_bounce_e_definitivo_na_hora(db, criar_regra, criar_devedor):
    criar_devedor(email="invalido@exemplo.com")
    criar_job(db, criar_regra(), SEGUNDA, brt())
    cliente = ClienteFalso(padrao=BOUNCE)

    resumo = processar_fila(db, brt(), provedor(cliente))

    assert resumo.bounces == 1
    (comunicacao,) = comunicacoes(db)
    assert comunicacao.status == StatusComunicacaoEnum.bounce
    assert comunicacao.tentativas == 1
    assert (comunicacao.codigo_erro, comunicacao.mensagem_erro) == ("21211", "Número inválido")
    assert comunicacao.proxima_tentativa_em is None
    processar_fila(db, brt(hora=15), provedor(cliente))
    assert len(cliente.chamadas) == 1  # nunca é reenviado
    job = job_unico(db)
    assert (job.status, job.total_falhas) == (StatusJobEnum.falhou, 1)


def test_devedor_sem_contato_no_momento_do_envio_vira_bounce(db, criar_regra, criar_devedor):
    devedor = criar_devedor()
    criar_job(db, criar_regra(), SEGUNDA, brt())
    devedor.email = None  # alguém apagou o contato depois de o job nascer
    db.commit()
    cliente = ClienteFalso()

    processar_fila(db, brt(), provedor(cliente))

    (comunicacao,) = comunicacoes(db)
    assert comunicacao.status == StatusComunicacaoEnum.bounce
    assert comunicacao.codigo_erro == "SEM_CONTATO"
    assert cliente.chamadas == []


# --------------------------------------------------------------------------
# Robustez e contadores
# --------------------------------------------------------------------------


def test_excecao_no_cliente_vira_falha_temporaria_e_nao_derruba_o_lote(db, criar_regra, criar_devedor):
    criar_devedor("Ana", email="ana@exemplo.com")
    criar_devedor("Bia", email="bia@exemplo.com")
    criar_job(db, criar_regra(), SEGUNDA, brt())
    cliente = ClienteFalso({"ana@exemplo.com": RuntimeError("explodiu")})

    resumo = processar_fila(db, brt(), provedor(cliente))

    assert (resumo.enviados, resumo.reenvios_agendados) == (1, 1)
    por_status = {c.status: c for c in comunicacoes(db)}
    assert por_status[StatusComunicacaoEnum.falha].codigo_erro == "ERRO_INTERNO"
    assert por_status[StatusComunicacaoEnum.falha].mensagem_erro == "RuntimeError"


def test_contadores_do_job_com_resultados_misturados(db, criar_regra, criar_devedor):
    criar_devedor("Ana", email="ana@exemplo.com")
    criar_devedor("Bia", email="bia@exemplo.com")
    criar_devedor("Caio", email="caio@exemplo.com")
    criar_job(db, criar_regra(), SEGUNDA, brt())
    cliente = ClienteFalso({"bia@exemplo.com": BOUNCE, "caio@exemplo.com": TEMP})

    processar_fila(db, brt(), provedor(cliente))
    job = job_unico(db)
    assert job.status == StatusJobEnum.executando  # o Caio ainda tem reenvio
    assert (job.total_alvos, job.total_sucesso, job.total_falhas) == (3, 1, 1)

    for n in (1, 2, 3):
        processar_fila(db, depois(30 * n), provedor(cliente))
    job = job_unico(db)
    assert job.status == StatusJobEnum.concluido  # houve ao menos um sucesso
    assert (job.total_sucesso, job.total_falhas) == (1, 2)


def test_rn03_depois_do_envio_o_devedor_sai_dos_elegiveis_do_dia(db, criar_regra, criar_devedor):
    criar_devedor()
    regra = criar_regra()
    criar_job(db, regra, SEGUNDA, brt())

    processar_fila(db, brt(), provedor(ClienteFalso()))

    assert db.execute(consulta_elegiveis(regra, SEGUNDA)).scalars().all() == []
