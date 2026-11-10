import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, role_required
from app.core.auditoria import registrar_auditoria
from app.core.database import get_db
from app.core.datas import hoje
from app.models.domain import Comunicacao, Devedor, StatusDevedorEnum, Usuario
from app.schemas.devedor import (
    AlterarStatusRequest,
    ComunicacaoResponse,
    DevedorResponse,
    PaginaDevedores,
)
from app.worker.validadores import somente_digitos

router = APIRouter(prefix="/devedores", tags=["Devedores"])


def _buscar_devedor(db: Session, devedor_id: uuid.UUID) -> Devedor:
    devedor = db.get(Devedor, devedor_id)
    if devedor is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Devedor não encontrado")
    return devedor


@router.get("/", response_model=PaginaDevedores)
def listar_devedores(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_devedor: StatusDevedorEnum | None = Query(None, alias="status"),
    atraso_minimo: int | None = Query(None, ge=0, description="Dias mínimos de atraso"),
    busca: str | None = Query(None, min_length=2, max_length=100, description="Nome ou CPF/CNPJ"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Lista devedores com filtros por status, prazo de atraso e busca (RF05)."""
    filtros = []
    if status_devedor:
        filtros.append(Devedor.status == status_devedor)
    if atraso_minimo is not None:
        filtros.append(Devedor.data_vencimento <= hoje() - timedelta(days=atraso_minimo))
    if busca:
        digitos = somente_digitos(busca)
        criterio = Devedor.nome.icontains(busca, autoescape=True)
        if digitos:
            criterio = criterio | Devedor.cpf_cnpj.contains(digitos, autoescape=True)
        filtros.append(criterio)

    total = db.execute(select(func.count()).select_from(Devedor).where(*filtros)).scalar_one()
    devedores = (
        db.execute(
            select(Devedor)
            .where(*filtros)
            .order_by(Devedor.data_vencimento, Devedor.id)  # mais antigos primeiro
            .offset(skip)
            .limit(limit)
        )
        .scalars()
        .all()
    )
    return PaginaDevedores(
        total=total,
        skip=skip,
        limit=limit,
        itens=[DevedorResponse.de_modelo(d) for d in devedores],
    )


@router.get("/{devedor_id}", response_model=DevedorResponse)
def detalhar_devedor(
    devedor_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    return DevedorResponse.de_modelo(_buscar_devedor(db, devedor_id))


@router.patch("/{devedor_id}/status", response_model=DevedorResponse)
def alterar_status(
    devedor_id: uuid.UUID,
    dados: AlterarStatusRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Atualiza a situação da cobrança (ex.: `negociando`, `quitado`).

    `quitado` alimenta a taxa de conversão do dashboard; só `ativo` e
    `comunicado` continuam recebendo cobrança. A mudança fica no log de auditoria.
    """
    devedor = _buscar_devedor(db, devedor_id)
    if devedor.status != dados.status:
        devedor.status = dados.status
        registrar_auditoria(
            db,
            current_user.id,
            "alterar_status_devedor",
            "devedor",
            devedor.id,
            request.client.host if request.client else None,
        )
        db.commit()
        db.refresh(devedor)
    return DevedorResponse.de_modelo(devedor)


@router.get("/{devedor_id}/comunicacoes", response_model=list[ComunicacaoResponse])
def historico_comunicacoes(
    devedor_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Histórico de comunicações enviadas ao devedor (UC06)."""
    _buscar_devedor(db, devedor_id)
    return (
        db.query(Comunicacao)
        .filter(Comunicacao.devedor_id == devedor_id)
        .order_by(Comunicacao.criado_em.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.delete("/{devedor_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_devedor(
    devedor_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(role_required(["administrador"])),
):
    """Direito de exclusão do titular (LGPD, art. 18): apaga o devedor e o
    histórico de comunicações. A ação fica registrada no log de auditoria."""
    devedor = _buscar_devedor(db, devedor_id)
    db.execute(delete(Comunicacao).where(Comunicacao.devedor_id == devedor.id))
    db.delete(devedor)
    registrar_auditoria(
        db,
        current_user.id,
        "excluir_devedor",
        "devedor",
        devedor_id,
        request.client.host if request.client else None,
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
