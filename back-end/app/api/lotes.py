# app/api/lotes.py
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.domain import Lote, Usuario, StatusLoteEnum, ErroLote
from app.api.deps import role_required, get_current_user
from app.schemas.lote import LoteResponse, ErroLoteResponse, UploadLoteResponse

router = APIRouter(prefix="/lotes", tags=["Gestão de Lotes"])

@router.post("/upload", response_model=UploadLoteResponse)
async def upload_lote(
    current_user: Usuario = Depends(role_required(["operador", "gestor", "administrador"])),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Formato inválido. Envie apenas arquivos .csv"
        )

    novo_lote = Lote(
        usuario_id=current_user.id,
        nome_arquivo=file.filename,
        status=StatusLoteEnum.pendente
    )
    db.add(novo_lote)
    db.commit()
    db.refresh(novo_lote)

    conteudo_bytes = await file.read()
    conteudo_str = conteudo_bytes.decode('utf-8')

    # Despacha para o Celery
    from app.worker.tasks import processar_lote_task
    processar_lote_task.delay(str(novo_lote.id), conteudo_str)

    return {
        "message": "Arquivo recebido. Processamento iniciado em segundo plano.",
        "lote_id": novo_lote.id
    }

# ADICIONADO: response_model para saída segura e current_user para bloqueio
@router.get("/", response_model=List[LoteResponse])
def listar_lotes(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    return db.query(Lote).order_by(Lote.id.desc()).offset(skip).limit(limit).all()

# ADICIONADO: response_model para saída segura e current_user para bloqueio
@router.get("/{lote_id}/erros", response_model=List[ErroLoteResponse])
def listar_erros_lote(
    lote_id: str, 
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    return db.query(ErroLote).filter(ErroLote.lote_id == lote_id).offset(skip).limit(limit).all()