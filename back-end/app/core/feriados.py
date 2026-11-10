"""Calendário de feriados (RN05): nesses dias não há disparo.

Calcula os feriados nacionais de qualquer ano, sem depender de biblioteca:

* fixos: 1/jan, 21/abr, 1/mai, 7/set, 12/out, 2/nov, 15/nov, 25/dez e 20/nov
  (Consciência Negra, nacional desde 2024);
* móvel: Sexta-feira Santa (2 dias antes da Páscoa);
* facultativos (FERIADOS_FACULTATIVOS=true, o padrão): Carnaval (segunda e terça)
  e Corpus Christi — não são feriados por lei federal, mas o comércio e os
  devedores costumam tratá-los como tal, então não se cobra neles;
* extras (FERIADOS_EXTRAS): datas estaduais ou municipais, em ISO separadas por
  vírgula (ex.: "2026-03-19,2026-08-15").
"""
from datetime import date, timedelta
from functools import lru_cache

from app.core.config import settings


def pascoa(ano: int) -> date:
    """Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano)."""
    a = ano % 19
    b, c = divmod(ano, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mes, dia = divmod(h + l - 7 * m + 114, 31)
    return date(ano, mes, dia + 1)


@lru_cache(maxsize=32)
def feriados_do_ano(ano: int, facultativos: bool = True) -> frozenset[date]:
    feriados = {
        date(ano, 1, 1),
        date(ano, 4, 21),
        date(ano, 5, 1),
        date(ano, 9, 7),
        date(ano, 10, 12),
        date(ano, 11, 2),
        date(ano, 11, 15),
        date(ano, 12, 25),
        pascoa(ano) - timedelta(days=2),  # Sexta-feira Santa
    }
    if ano >= 2024:
        feriados.add(date(ano, 11, 20))
    if facultativos:
        domingo = pascoa(ano)
        feriados |= {
            domingo - timedelta(days=48),  # segunda de Carnaval
            domingo - timedelta(days=47),  # terça de Carnaval
            domingo + timedelta(days=60),  # Corpus Christi
        }
    return frozenset(feriados)


def feriados_extras() -> frozenset[date]:
    return frozenset(
        date.fromisoformat(valor.strip())
        for valor in settings.feriados_extras.split(",")
        if valor.strip()
    )


def eh_feriado(dia: date) -> bool:
    return dia in feriados_do_ano(dia.year, settings.feriados_facultativos) or dia in feriados_extras()
