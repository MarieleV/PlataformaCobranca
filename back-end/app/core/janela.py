"""Janela de disparo (RN05): dias úteis, das 08h00 às 20h00, horário de Brasília.

Só considera sábado e domingo como dias não úteis; feriados não entram (o
projeto não mantém calendário de feriados).
"""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.config import settings


def _fuso() -> ZoneInfo:
    return ZoneInfo(settings.fuso_horario)


def dia_util(dia: date) -> bool:
    return dia.weekday() < 5  # segunda a sexta


def dentro_da_janela(momento: datetime) -> bool:
    local = momento.astimezone(_fuso())
    return dia_util(local.date()) and settings.janela_inicio_hora <= local.hour < settings.janela_fim_hora


def proxima_janela_valida(momento: datetime) -> datetime:
    """O próprio momento, se já estiver na janela; senão, a próxima abertura (08h00)."""
    local = momento.astimezone(_fuso())
    if dentro_da_janela(local):
        return local

    abertura = time(settings.janela_inicio_hora)
    if dia_util(local.date()) and local.hour < settings.janela_inicio_hora:
        return datetime.combine(local.date(), abertura, tzinfo=_fuso())

    dia = local.date() + timedelta(days=1)
    while not dia_util(dia):
        dia += timedelta(days=1)
    return datetime.combine(dia, abertura, tzinfo=_fuso())
