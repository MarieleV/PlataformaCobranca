"""Endpoint /metrics para o Prometheus (RNF08)."""
import hmac

from fastapi import APIRouter, HTTPException, Request, Response, status
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.core.config import settings
from app.core.metricas import REGISTRO

router = APIRouter(tags=["Métricas"])


@router.get("/metrics", include_in_schema=False)
def metricas(request: Request) -> Response:
    """Formato de texto do Prometheus.

    Sem login (o Prometheus não usa o cookie JWT). Com METRICS_TOKEN definido,
    exige o token; em qualquer caso, não exponha a rota para a internet.
    """
    if settings.metrics_token:
        enviado = request.headers.get("Authorization", "")
        esperado = f"Bearer {settings.metrics_token}"
        if not hmac.compare_digest(enviado.encode(), esperado.encode()):
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                detail="Token de métricas inválido",
                headers={"WWW-Authenticate": "Bearer"},
            )
    return Response(generate_latest(REGISTRO), media_type=CONTENT_TYPE_LATEST)
