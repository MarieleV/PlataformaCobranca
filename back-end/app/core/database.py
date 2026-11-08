from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

# pool_pre_ping descarta conexões mortas (ex.: banco reiniciado) antes de usar.
# Pool pequeno: API + workers somam conexões e o Postgres limita o total (~100).
engine = create_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=1800,
)

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