"""Métricas no formato Prometheus (RNF08), consumidas pelo Grafana.

Dois grupos, ambos no registro próprio `REGISTRO`:

* **HTTP** (contador e histograma): alimentados pelo middleware da API.
* **Negócio**: calculados no momento do scrape, direto do banco. Assim valem
  para qualquer processo (API e workers Celery são processos separados, e
  contadores em memória de um não enxergariam o outro) e sobrevivem a reinícios.
  São `gauge` porque o direito de exclusão (LGPD) pode reduzir os totais.
"""
from collections.abc import Iterable
from datetime import date, datetime, timezone

from prometheus_client import CollectorRegistry, Counter, Histogram
from prometheus_client.core import GaugeMetricFamily
from prometheus_client.registry import Collector
from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.core.datas import hoje
from app.models.domain import Job, Lote
from app.services import dashboard as servico

REGISTRO = CollectorRegistry()

HTTP_REQUISICOES = Counter(
    "cobranca_http_requests_total",
    "Requisições HTTP atendidas pela API.",
    ["metodo", "rota", "status"],
    registry=REGISTRO,
)
HTTP_DURACAO = Histogram(
    "cobranca_http_request_duration_seconds",
    "Duração das requisições HTTP da API.",
    ["metodo", "rota"],
    registry=REGISTRO,
)

DIAS_TAXAS = 7
_INICIO = datetime(2000, 1, 1, tzinfo=timezone.utc)
_FIM = datetime(2100, 1, 1, tzinfo=timezone.utc)


def registrar_requisicao(metodo: str, rota: str, status: int, duracao: float) -> None:
    HTTP_REQUISICOES.labels(metodo, rota, str(status)).inc()
    HTTP_DURACAO.labels(metodo, rota).observe(duracao)


def _resultados(c: servico.Contagem) -> dict[str, int]:
    return {"sucesso": c.sucesso, "falha": c.falhas, "aguardando": c.aguardando}


class ColetorNegocio(Collector):
    def collect(self) -> Iterable[GaugeMetricFamily]:
        ok = GaugeMetricFamily(
            "cobranca_coleta_ok", "1 se as métricas de negócio foram lidas do banco."
        )
        try:
            with SessionLocal() as db:
                familias = list(self._ler(db))
        except Exception:
            ok.add_metric([], 0)
            yield ok
            return
        ok.add_metric([], 1)
        yield ok
        yield from familias

    def _ler(self, db) -> Iterable[GaugeMetricFamily]:
        dia = hoje()

        devedores = GaugeMetricFamily(
            "cobranca_devedores", "Devedores na base, por status.", labels=["status"]
        )
        for status, total in servico.devedores_por_status(db).items():
            devedores.add_metric([status.value], total)
        yield devedores

        historico = GaugeMetricFamily(
            "cobranca_comunicacoes",
            "Comunicações por canal e resultado (sucesso, falha ou aguardando).",
            labels=["canal", "resultado"],
        )
        for canal, c in servico.contagem_por_canal(db, _INICIO, _FIM).items():
            for resultado, total in _resultados(c).items():
                historico.add_metric([canal.value, resultado], total)
        yield historico

        do_dia = GaugeMetricFamily(
            "cobranca_comunicacoes_hoje",
            "Comunicações criadas hoje (Brasília), por canal e resultado.",
            labels=["canal", "resultado"],
        )
        inicio_hoje, fim_hoje = servico.limites_do_periodo(dia, 1)
        for canal, c in servico.contagem_por_canal(db, inicio_hoje, fim_hoje).items():
            for resultado, total in _resultados(c).items():
                do_dia.add_metric([canal.value, resultado], total)
        yield do_dia

        inicio, fim = servico.limites_do_periodo(dia, DIAS_TAXAS)
        entrega = GaugeMetricFamily(
            "cobranca_taxa_entrega_percent",
            f"Taxa de entrega (%) por canal nos últimos {DIAS_TAXAS} dias.",
            labels=["canal"],
        )
        total = servico.Contagem()
        for canal, c in servico.contagem_por_canal(db, inicio, fim).items():
            total = total.somar(c)
            if c.taxa_entrega is not None:
                entrega.add_metric([canal.value], c.taxa_entrega)
        if total.taxa_entrega is not None:
            entrega.add_metric(["todos"], total.taxa_entrega)
        yield entrega

        alcancados, quitados = servico.conversao(db, inicio, fim)
        conversao = GaugeMetricFamily(
            "cobranca_taxa_conversao_percent",
            f"Devedores alcançados nos últimos {DIAS_TAXAS} dias que estão quitados (%).",
        )
        taxa = servico.percentual(quitados, alcancados)
        if taxa is not None:
            conversao.add_metric([], taxa)
        yield conversao

        jobs = GaugeMetricFamily(
            "cobranca_jobs", "Jobs de disparo por status.", labels=["status"]
        )
        for status, quantidade in db.execute(select(Job.status, func.count()).group_by(Job.status)):
            jobs.add_metric([status.value], quantidade)
        yield jobs

        lotes = GaugeMetricFamily(
            "cobranca_lotes", "Lotes de importação por status.", labels=["status"]
        )
        for status, quantidade in db.execute(select(Lote.status, func.count()).group_by(Lote.status)):
            lotes.add_metric([status.value], quantidade)
        yield lotes


REGISTRO.register(ColetorNegocio())
