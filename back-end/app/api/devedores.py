# app/api/devedores.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.domain import Devedor

router = APIRouter(prefix="/devedores", tags=["Devedores Processados"])

@router.get("/")
def listar_devedores(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Devedor).offset(skip).limit(limit).all()