import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from kombu import Connection
from sqlalchemy import text

from app.api import (
    auditoria,
    auth,
    dashboard,
    devedores,
    jobs,
    lotes,
    metricas,
    regras,
    usuarios,
)
from app.core.config import settings
from app.core.database import Base, engine
from app.core.metricas import registrar_requisicao
from app.core.redis_client import get_redis

# Importar os models é necessário para o SQLAlchemy registrar as tabelas.
from app.models import domain  # noqa: F401

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Roda na subida do servidor (e não no import), então importar `app.main`
    # nos testes não exige um banco acessível.
    # O esquema vem do Alembic; create_all só roda com AUTO_CREATE_TABLES=true.
    if settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)
    try:
        yield
    finally:
        engine.dispose()


app = FastAPI(
    title=settings.app_name,
    description="Backend para gestão e automação do ciclo de cobrança de inadimplentes.",
    version=settings.app_version,
    lifespan=lifespan,
)

# allow_credentials=True é obrigatório para trafegar os cookies httpOnly do JWT.
# Com credenciais, as origens precisam ser explícitas (nunca "*").
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def medir_requisicoes(request: Request, call_next):
    """Alimenta as métricas HTTP (RNF08). O rótulo é o modelo da rota
    (/devedores/{devedor_id}) e não a URL real, para não explodir a cardinalidade."""
    inicio = time.perf_counter()
    codigo = 500
    try:
        resposta = await call_next(request)
        codigo = resposta.status_code
        return resposta
    finally:
        rota = request.scope.get("route")
        modelo = getattr(rota, "path", None) or "nao_encontrada"
        if modelo != "/metrics":
            registrar_requisicao(
                request.method, modelo, codigo, time.perf_counter() - inicio
            )


app.include_router(auth.router)
app.include_router(lotes.router)
app.include_router(devedores.router)
app.include_router(usuarios.router)
app.include_router(auditoria.router)
app.include_router(regras.router)
app.include_router(jobs.router)
app.include_router(dashboard.router)
app.include_router(metricas.router)


@app.get("/", tags=["Health Check"])
def root():
    return {
        "status": "online",
        "message": "API Plataforma de Cobrança Automatizada operante.",
        "version": settings.app_version,
    }


def _banco_ok() -> bool:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        logger.warning("Health check: falha no PostgreSQL", exc_info=True)
        return False


def _redis_ok() -> bool:
    try:
        return bool(get_redis().ping())
    except Exception:
        logger.warning("Health check: falha no Redis", exc_info=True)
        return False


def _rabbitmq_ok() -> bool:
    try:
        with Connection(settings.rabbitmq_url, connect_timeout=2) as conn:
            conn.ensure_connection(max_retries=1)
        return True
    except Exception:
        logger.warning("Health check: falha no RabbitMQ", exc_info=True)
        return False


@app.get("/health", tags=["Health Check"])
def health():
    """Verifica as dependências. Usado pelo healthcheck do Docker e pelo monitoramento."""
    dependencias = {
        "postgres": _banco_ok(),
        "redis": _redis_ok(),
        "rabbitmq": _rabbitmq_ok(),
    }
    saudavel = all(dependencias.values())
    return JSONResponse(
        status_code=200 if saudavel else 503,
        content={
            "status": "ok" if saudavel else "degradado",
            "dependencias": dependencias,
        },
    )
