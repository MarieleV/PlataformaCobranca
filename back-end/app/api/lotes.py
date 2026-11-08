import csv
import io
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from kombu.exceptions import OperationalError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, role_required
from app.core.config import settings
from app.core.database import get_db
from app.models.domain import ErroLote, Lote, StatusLoteEnum, Usuario
from app.schemas.lote import ErroLoteResponse, LoteResponse, UploadLoteResponse
from app.worker.tasks import processar_lote_task

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lotes", tags=["Gestão de Lotes"])

EXTENSOES_PERMITIDAS = {".csv", ".xlsx", ".xls"}  # RF01


def _buscar_lote(db: Session, lote_id: uuid.UUID) -> Lote:
    lote = db.get(Lote, lote_id)
    if lote is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Lote não encontrado")
    return lote


@router.post("/upload", response_model=UploadLoteResponse)
def upload_lote(
    file: UploadFile = File(...),
    current_user: Usuario = Depends(role_required(["operador", "gestor", "administrador"])),
    db: Session = Depends(get_db),
):
    nome_original = file.filename or ""
    extensao = Path(nome_original).suffix.lower()
    if extensao not in EXTENSOES_PERMITIDAS:
        # RFC (fluxo alternativo): formato inválido retorna 422 sem enfileirar
        raise HTTPException(
            status_code=422,
            detail="Formato inválido. Envie arquivos .csv, .xlsx ou .xls",
        )

    limite = settings.max_upload_mb * 1024 * 1024
    conteudo = file.file.read(limite + 1)
    if len(conteudo) > limite:
        raise HTTPException(
            status_code=413,
            detail=f"Arquivo maior que o limite de {settings.max_upload_mb} MB",
        )
    if not conteudo:
        raise HTTPException(status_code=422, detail="O arquivo está vazio")

    # O nome gravado em disco é o id do lote: o nome enviado pelo usuário
    # nunca vira caminho (evita path traversal).
    lote_id = uuid.uuid4()
    pasta = Path(settings.upload_dir)
    pasta.mkdir(parents=True, exist_ok=True)
    caminho = pasta / f"{lote_id}{extensao}"
    caminho.write_bytes(conteudo)

    try:
        lote = Lote(
            id=lote_id,
            usuario_id=current_user.id,
            nome_arquivo=nome_original[:255],
            status=StatusLoteEnum.pendente,
        )
        db.add(lote)
        db.commit()
    except Exception:
        db.rollback()
        caminho.unlink(missing_ok=True)
        raise

    try:
        processar_lote_task.delay(str(lote_id), str(caminho))
    except OperationalError:
        # RFC (fluxo alternativo): broker fora do ar retorna 503
        logger.error("RabbitMQ indisponível ao enfileirar o lote %s", lote_id)
        lote.status = StatusLoteEnum.erro
        db.commit()
        caminho.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Fila de processamento indisponível. Tente novamente em instantes.",
        )

    return UploadLoteResponse(
        message="Arquivo recebido. Processamento iniciado em segundo plano.",
        lote_id=lote_id,
    )


@router.get("/", response_model=list[LoteResponse])
def listar_lotes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return (
        db.query(Lote).order_by(Lote.criado_em.desc()).offset(skip).limit(limit).all()
    )


@router.get("/{lote_id}", response_model=LoteResponse)
def detalhar_lote(
    lote_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Status e progresso do lote. O front consulta esta rota (polling) até concluir."""
    return _buscar_lote(db, lote_id)


@router.get("/{lote_id}/erros", response_model=list[ErroLoteResponse])
def listar_erros_lote(
    lote_id: uuid.UUID,
    campo: str | None = Query(None, max_length=100),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _buscar_lote(db, lote_id)
    consulta = db.query(ErroLote).filter(ErroLote.lote_id == lote_id)
    if campo:
        consulta = consulta.filter(ErroLote.campo == campo)
    return (
        consulta.order_by(ErroLote.numero_linha, ErroLote.campo)
        .offset(skip)
        .limit(limit)
        .all()
    )


def _celula_segura(valor) -> str:
    """Evita injeção de fórmula: o valor veio do arquivo do usuário e o CSV
    será aberto no Excel."""
    texto = "" if valor is None else str(valor)
    return "'" + texto if texto[:1] in ("=", "+", "-", "@") else texto


@router.get("/{lote_id}/erros/csv")
def baixar_erros_csv(
    lote_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Download do relatório de erros em CSV (RF03)."""
    lote = _buscar_lote(db, lote_id)
    erros = (
        db.query(ErroLote)
        .filter(ErroLote.lote_id == lote_id)
        .order_by(ErroLote.numero_linha, ErroLote.campo)
        .all()
    )

    saida = io.StringIO()
    escritor = csv.writer(saida, delimiter=";")  # ';' abre direto no Excel BR
    escritor.writerow(["linha", "campo", "regra_violada", "valor_informado"])
    for erro in erros:
        escritor.writerow([
            erro.numero_linha,
            _celula_segura(erro.campo),
            _celula_segura(erro.regra_violada),
            _celula_segura(erro.valor_informado),
        ])

    conteudo = "\ufeff" + saida.getvalue()  # BOM para o Excel reconhecer UTF-8
    return StreamingResponse(
        iter([conteudo]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="erros_lote_{lote.id}.csv"'},
    )