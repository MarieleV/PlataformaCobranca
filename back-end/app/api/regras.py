"""Régua de cobrança (UC03 / RF04 / RN02).

- Gestor e administrador criam, editam, ativam/desativam e excluem regras.
- Todos os perfis autenticados consultam, fazem o preview do template e veem
  os devedores elegíveis do dia.
"""
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, ip_cliente, role_required
from app.core.auditoria import registrar_auditoria
from app.core.crypto import descriptografar_decimal
from app.core.database import get_db
from app.core.templates import (
    LIMITE_POR_CANAL,
    VARIAVEIS,
    TemplateInvalido,
    contexto_de_exemplo,
    contexto_do_devedor,
    renderizar,
    validar_template,
    variaveis_usadas,
)
from app.models.domain import CanalEnum, CargoEnum, Devedor, Job, RegraCobranca, Usuario
from app.schemas.devedor import DevedorResponse, PaginaDevedores
from app.schemas.regra import (
    PreviewRequest,
    PreviewResponse,
    RegraCreate,
    RegraResponse,
    RegraUpdate,
    StatusReguaResponse,
    VariavelResponse,
)
from app.services.regua import consulta_elegiveis, contar_elegiveis, status_da_regua

router = APIRouter(prefix="/regras", tags=["Régua de cobrança"])

gestor_ou_admin = role_required([CargoEnum.gestor.value, CargoEnum.administrador.value])


def _buscar_regra(db: Session, regra_id: uuid.UUID) -> RegraCobranca:
    regra = db.get(RegraCobranca, regra_id)
    if regra is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Regra não encontrada")
    return regra


def _validar_template_ou_422(template: str, canal: CanalEnum) -> None:
    try:
        validar_template(template, canal)
    except TemplateInvalido as erro:
        raise HTTPException(422, detail=str(erro))


def _garantir_regra_ativa_unica(
    db: Session, canal: CanalEnum, dias_atraso: int, ignorar_id: uuid.UUID | None = None
) -> None:
    consulta = select(RegraCobranca).where(
        RegraCobranca.ativa.is_(True),
        RegraCobranca.canal == canal,
        RegraCobranca.dias_atraso == dias_atraso,
    )
    if ignorar_id:
        consulta = consulta.where(RegraCobranca.id != ignorar_id)
    existente = db.execute(consulta).scalars().first()
    if existente:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=(
                f"Já existe uma regra ativa para {canal.value} com {dias_atraso} dias "
                f"de atraso ('{existente.nome}'). Desative-a antes."
            ),
        )


def _conflito_na_gravacao() -> HTTPException:
    return HTTPException(
        status.HTTP_409_CONFLICT,
        detail="Já existe uma regra ativa para este canal e prazo de atraso",
    )


# --------------------------------------------------------------------------
# Consultas auxiliares (rotas fixas vêm antes de /{regra_id})
# --------------------------------------------------------------------------
@router.get("/status", response_model=StatusReguaResponse)
def status_da_regua_endpoint(
    db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
):
    """RN02: a régua só está ativa com ao menos uma regra válida ativada."""
    dados = status_da_regua(db)
    dados["mensagem"] = (
        "Régua ativa"
        if dados["regua_ativa"]
        else "Régua inativa: ative ao menos uma regra para iniciar os disparos"
    )
    return StatusReguaResponse(**dados)


@router.get("/variaveis", response_model=list[VariavelResponse])
def listar_variaveis(_: Usuario = Depends(get_current_user)):
    """Variáveis que podem ser usadas nos templates (para o editor do front)."""
    return [
        VariavelResponse(nome=nome, placeholder="{" + nome + "}", descricao=desc, exemplo=exemplo)
        for nome, (desc, exemplo) in VARIAVEIS.items()
    ]


@router.post("/preview", response_model=PreviewResponse)
def previa_do_template(
    dados: PreviewRequest,
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    """Mostra como a mensagem fica, com dados de exemplo ou de um devedor real."""
    _validar_template_ou_422(dados.template_mensagem, dados.canal)

    if dados.devedor_id:
        devedor = db.get(Devedor, dados.devedor_id)
        if devedor is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Devedor não encontrado")
        contexto = contexto_do_devedor(devedor, descriptografar_decimal(devedor.valor_divida_enc))
    else:
        contexto = contexto_de_exemplo()

    mensagem = renderizar(dados.template_mensagem, contexto)
    return PreviewResponse(
        mensagem=mensagem,
        tamanho=len(mensagem),
        limite=LIMITE_POR_CANAL[dados.canal],
        variaveis_usadas=variaveis_usadas(dados.template_mensagem),
    )


# --------------------------------------------------------------------------
# CRUD
# --------------------------------------------------------------------------
@router.get("/", response_model=list[RegraResponse])
def listar_regras(
    ativa: bool | None = Query(None),
    canal: CanalEnum | None = Query(None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    consulta = select(RegraCobranca).order_by(
        RegraCobranca.dias_atraso, RegraCobranca.canal, RegraCobranca.id
    )
    if ativa is not None:
        consulta = consulta.where(RegraCobranca.ativa == ativa)
    if canal:
        consulta = consulta.where(RegraCobranca.canal == canal)
    return [RegraResponse.de_modelo(r) for r in db.execute(consulta).scalars()]


@router.get("/{regra_id}", response_model=RegraResponse)
def detalhar_regra(
    regra_id: uuid.UUID, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)
):
    return RegraResponse.de_modelo(_buscar_regra(db, regra_id))


@router.post("/", response_model=RegraResponse, status_code=status.HTTP_201_CREATED)
def criar_regra(
    dados: RegraCreate,
    request: Request,
    db: Session = Depends(get_db),
    ator: Usuario = Depends(gestor_ou_admin),
):
    if dados.ativa:
        _garantir_regra_ativa_unica(db, dados.canal, dados.dias_atraso)

    regra = RegraCobranca(
        usuario_id=ator.id,
        nome=dados.nome,
        dias_atraso=dados.dias_atraso,
        canal=dados.canal,
        template_mensagem=dados.template_mensagem,
        horario_disparo=dados.horario_disparo,
        ativa=dados.ativa,
    )
    db.add(regra)
    try:
        db.flush()
        registrar_auditoria(db, ator.id, "criar_regra", "regra", regra.id, ip_cliente(request))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _conflito_na_gravacao()

    db.refresh(regra)
    return RegraResponse.de_modelo(regra)


@router.patch("/{regra_id}", response_model=RegraResponse)
def editar_regra(
    regra_id: uuid.UUID,
    dados: RegraUpdate,
    request: Request,
    db: Session = Depends(get_db),
    ator: Usuario = Depends(gestor_ou_admin),
):
    regra = _buscar_regra(db, regra_id)

    canal = dados.canal if dados.canal is not None else regra.canal
    template = dados.template_mensagem if dados.template_mensagem is not None else regra.template_mensagem
    dias = dados.dias_atraso if dados.dias_atraso is not None else regra.dias_atraso

    # O limite do template depende do canal: revalida o conjunto
    _validar_template_ou_422(template, canal)
    if regra.ativa and (canal != regra.canal or dias != regra.dias_atraso):
        _garantir_regra_ativa_unica(db, canal, dias, ignorar_id=regra.id)

    novos = {
        "nome": dados.nome,
        "dias_atraso": dados.dias_atraso,
        "canal": dados.canal,
        "template_mensagem": dados.template_mensagem,
        "horario_disparo": dados.horario_disparo,
    }
    alterou = False
    for campo, valor in novos.items():
        if valor is not None and valor != getattr(regra, campo):
            setattr(regra, campo, valor)
            alterou = True

    if alterou:
        registrar_auditoria(db, ator.id, "editar_regra", "regra", regra.id, ip_cliente(request))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _conflito_na_gravacao()

    db.refresh(regra)
    return RegraResponse.de_modelo(regra)


@router.post("/{regra_id}/ativar", response_model=RegraResponse)
def ativar_regra(
    regra_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    ator: Usuario = Depends(gestor_ou_admin),
):
    """RN02: só ativa regra válida (template, canal e horário conferidos de novo)."""
    regra = _buscar_regra(db, regra_id)
    if not regra.ativa:
        _validar_template_ou_422(regra.template_mensagem, regra.canal)
        _garantir_regra_ativa_unica(db, regra.canal, regra.dias_atraso, ignorar_id=regra.id)
        regra.ativa = True
        registrar_auditoria(db, ator.id, "ativar_regra", "regra", regra.id, ip_cliente(request))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise _conflito_na_gravacao()
        db.refresh(regra)
    return RegraResponse.de_modelo(regra)


@router.post("/{regra_id}/desativar", response_model=RegraResponse)
def desativar_regra(
    regra_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    ator: Usuario = Depends(gestor_ou_admin),
):
    regra = _buscar_regra(db, regra_id)
    if regra.ativa:
        regra.ativa = False
        registrar_auditoria(db, ator.id, "desativar_regra", "regra", regra.id, ip_cliente(request))
        db.commit()
        db.refresh(regra)
    return RegraResponse.de_modelo(regra)


@router.delete("/{regra_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_regra(
    regra_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    ator: Usuario = Depends(gestor_ou_admin),
):
    """Regras que já geraram disparos ficam no histórico: desative em vez de excluir."""
    regra = _buscar_regra(db, regra_id)
    if db.execute(select(Job.id).where(Job.regra_id == regra.id).limit(1)).first():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="A regra já executou disparos e faz parte do histórico. Desative-a em vez de excluir.",
        )
    regra_id_guardado = regra.id
    db.delete(regra)
    registrar_auditoria(db, ator.id, "excluir_regra", "regra", regra_id_guardado, ip_cliente(request))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------
# Devedores elegíveis (UC03: "lista de devedores elegíveis do dia")
# --------------------------------------------------------------------------
@router.get("/{regra_id}/elegiveis", response_model=PaginaDevedores)
def devedores_elegiveis(
    regra_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    dia: date | None = Query(None, description="Padrão: hoje (horário de Brasília)"),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    regra = _buscar_regra(db, regra_id)
    devedores = db.execute(consulta_elegiveis(regra, dia).offset(skip).limit(limit)).scalars().all()
    return PaginaDevedores(
        total=contar_elegiveis(db, regra, dia),
        skip=skip,
        limit=limit,
        itens=[DevedorResponse.de_modelo(d) for d in devedores],
    )
