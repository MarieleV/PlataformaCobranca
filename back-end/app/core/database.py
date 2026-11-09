from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

# pool_pre_ping descarta conexões mortas (ex.: banco reiniciado) antes de usar.
# Pool pequeno: API + workers somam conexões e o Postgres limita o total
# (~110 num RDS db.t3.micro). Ajuste com DB_POOL_SIZE / DB_MAX_OVERFLOW.
_opcoes_engine: dict = {"echo": False, "pool_pre_ping": True}
if not settings.database_url.startswith("sqlite"):
    # Parâmetros de pool só valem para o Postgres. O SQLite dos testes usa
    # outro tipo de pool e rejeitaria "max_overflow".
    _opcoes_engine.update(
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        pool_recycle=1800,
    )
else:
    # Permite que o TestClient (outra thread) use a mesma conexão do SQLite.
    _opcoes_engine["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.database_url, **_opcoes_engine)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base dos models. Compatível com models escritos no estilo Column(...)."""


def get_db():
    """Dependência do FastAPI: uma sessão por requisição."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
