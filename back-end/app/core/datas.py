"""Datas no fuso de Brasília (cálculo de atraso e, no M4, a janela da RN05)."""
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings


def agora() -> datetime:
    """Momento atual com fuso de Brasília."""
    return datetime.now(ZoneInfo(settings.fuso_horario))


def hoje() -> date:
    """Data de hoje em Brasília (e não a do servidor, que pode estar em UTC)."""
    return agora().date()


def inicio_do_dia_utc(dia: date) -> datetime:
    """00h00 de Brasília do dia informado, em UTC (como o banco grava)."""
    local = datetime.combine(dia, time.min, tzinfo=ZoneInfo(settings.fuso_horario))
    return local.astimezone(timezone.utc)
