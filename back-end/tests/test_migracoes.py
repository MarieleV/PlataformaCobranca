"""Garante que as migrações do Alembic acompanham os models.

Rodam offline (geram o SQL sem conectar a um banco). A checagem completa
contra um PostgreSQL de verdade (upgrade, downgrade e `alembic check`) fica
para o CI, que sobe um serviço de Postgres.
"""
import io
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import Enum

from app.core.database import Base
from app.models import domain  # noqa: F401

RAIZ = Path(__file__).resolve().parent.parent


def _config(saida: io.StringIO | None = None) -> Config:
    config = Config(str(RAIZ / "alembic.ini"))
    config.set_main_option("script_location", str(RAIZ / "alembic"))
    if saida is not None:
        config.output_buffer = saida
    return config


def _sql_de_todas_as_migracoes() -> str:
    saida = io.StringIO()
    command.upgrade(_config(saida), "head", sql=True)
    return saida.getvalue()


def test_ha_uma_unica_cabeca_de_migracao():
    """Duas cabeças = duas branches mexendo no esquema sem se enxergarem."""
    assert len(ScriptDirectory.from_config(_config()).get_heads()) == 1


def test_migracoes_criam_todas_as_tabelas_dos_models():
    sql = _sql_de_todas_as_migracoes()

    for tabela in Base.metadata.tables:
        assert f"CREATE TABLE {tabela} " in sql, f"falta a tabela {tabela} na migração"


def test_migracoes_criam_todos_os_indices_dos_models():
    sql = _sql_de_todas_as_migracoes()

    nomes = {
        indice.name
        for tabela in Base.metadata.tables.values()
        for indice in tabela.indexes
    }
    for nome in nomes:
        assert nome in sql, f"falta o índice {nome} na migração"


def test_migracoes_criam_os_tipos_enumerados():
    """O SQL offline usa o dialeto do SQLite (sem tipos nomeados): confere no código."""
    codigo = "".join(
        arquivo.read_text(encoding="utf-8")
        for arquivo in (RAIZ / "alembic" / "versions").glob("*.py")
    )

    tipos = {
        coluna.type.name
        for tabela in Base.metadata.tables.values()
        for coluna in tabela.columns
        if isinstance(coluna.type, Enum)
    }
    assert len(tipos) == 6
    for tipo in tipos:
        assert f"name='{tipo}'" in codigo, f"falta o tipo {tipo} na migração"
