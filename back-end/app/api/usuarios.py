"""Gestão de usuários (UC07 / RF10 / RN06).

- Administrador: acesso total (criar, editar, alterar perfil, ativar/desativar,
  redefinir senha e excluir qualquer usuário).
- Gestor: criar, editar, ativar/desativar e redefinir a senha APENAS de
  operadores; só enxerga operadores.
- Operador: sem acesso.
"""
import uuid

import redis
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import ip_cliente, role_required
from app.core.auditoria import registrar_auditoria
from app.core.database import get_db
from app.core.redis_client import invalidar_sessoes_do_usuario
from app.core.security import get_password_hash
from app.models.domain import CargoEnum, Lote, RegraCobranca, Usuario
from app.schemas.auth import MensagemResponse
from app.schemas.usuario import (
    PaginaUsuarios,
    RedefinirSenhaRequest,
    UsuarioCreate,
    UsuarioResponse,
    UsuarioUpdate,
)

router = APIRouter(prefix="/usuarios", tags=["Usuários"])

gestor_ou_admin = role_required([CargoEnum.gestor.value, CargoEnum.administrador.value])
somente_admin = role_required([CargoEnum.administrador.value])


def _e_admin(ator: Usuario) -> bool:
    return ator.cargo == CargoEnum.administrador


def _buscar_alvo(db: Session, ator: Usuario, usuario_id: uuid.UUID) -> Usuario:
    """Carrega o usuário-alvo respeitando o escopo do ator (RN06)."""
    alvo = db.get(Usuario, usuario_id)
    if alvo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado")
    if not _e_admin(ator) and alvo.cargo != CargoEnum.operador:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="O gestor só pode gerenciar usuários com perfil operador",
        )
    return alvo


def _nao_em_si_mesmo(ator: Usuario, alvo: Usuario, mensagem: str) -> None:
    if ator.id == alvo.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=mensagem)


def _email_em_uso(db: Session, email: str, ignorar_id: uuid.UUID | None = None) -> bool:
    consulta = select(Usuario.id).where(Usuario.email == email)
    if ignorar_id:
        consulta = consulta.where(Usuario.id != ignorar_id)
    return db.execute(consulta).first() is not None


def _email_duplicado() -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, detail="E-mail já cadastrado")


def _encerrar_sessoes(usuario_id: uuid.UUID) -> None:
    try:
        invalidar_sessoes_do_usuario(usuario_id)
    except redis.RedisError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, detail="Serviço de sessão indisponível"
        )


# --------------------------------------------------------------------------
# Consulta
# --------------------------------------------------------------------------
@router.get("/", response_model=PaginaUsuarios)
def listar_usuarios(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    perfil: CargoEnum | None = Query(None),
    ativo: bool | None = Query(None),
    busca: str | None = Query(None, min_length=2, max_length=100, description="Nome ou e-mail"),
    db: Session = Depends(get_db),
    ator: Usuario = Depends(gestor_ou_admin),
):
    filtros = []
    if not _e_admin(ator):
        filtros.append(Usuario.cargo == CargoEnum.operador)  # escopo do gestor
    if perfil:
        filtros.append(Usuario.cargo == perfil)
    if ativo is not None:
        filtros.append(Usuario.ativo == ativo)
    if busca:
        filtros.append(
            Usuario.nome.icontains(busca, autoescape=True)
            | Usuario.email.icontains(busca, autoescape=True)
        )

    total = db.execute(select(func.count()).select_from(Usuario).where(*filtros)).scalar_one()
    usuarios = (
        db.execute(
            select(Usuario).where(*filtros).order_by(Usuario.nome, Usuario.id).offset(skip).limit(limit)
        )
        .scalars()
        .all()
    )
    return PaginaUsuarios(
        total=total,
        skip=skip,
        limit=limit,
        itens=[UsuarioResponse.de_modelo(u) for u in usuarios],
    )


@router.get("/{usuario_id}", response_model=UsuarioResponse)
def detalhar_usuario(
    usuario_id: uuid.UUID,
    db: Session = Depends(get_db),
    ator: Usuario = Depends(gestor_ou_admin),
):
    return UsuarioResponse.de_modelo(_buscar_alvo(db, ator, usuario_id))


# --------------------------------------------------------------------------
# Criação e edição
# --------------------------------------------------------------------------
@router.post("/", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
def criar_usuario(
    dados: UsuarioCreate,
    request: Request,
    db: Session = Depends(get_db),
    ator: Usuario = Depends(gestor_ou_admin),
):
    if not _e_admin(ator) and dados.perfil != CargoEnum.operador:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="O gestor só pode criar usuários com perfil operador",
        )

    email = dados.email.lower()
    if _email_em_uso(db, email):
        raise _email_duplicado()

    usuario = Usuario(
        nome=dados.nome,
        email=email,
        senha_hash=get_password_hash(dados.senha),
        cargo=dados.perfil,
        ativo=True,
        criado_por=ator.id,
    )
    db.add(usuario)
    try:
        db.flush()  # gera o id e acusa e-mail duplicado em corrida
        registrar_auditoria(db, ator.id, "criar_usuario", "usuario", usuario.id, ip_cliente(request))
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _email_duplicado()

    db.refresh(usuario)
    return UsuarioResponse.de_modelo(usuario)


@router.patch("/{usuario_id}", response_model=UsuarioResponse)
def editar_usuario(
    usuario_id: uuid.UUID,
    dados: UsuarioUpdate,
    request: Request,
    db: Session = Depends(get_db),
    ator: Usuario = Depends(gestor_ou_admin),
):
    alvo = _buscar_alvo(db, ator, usuario_id)
    ip = ip_cliente(request)
    alterou_dados = False

    if dados.perfil is not None and dados.perfil != alvo.cargo:
        if not _e_admin(ator):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, detail="Somente o administrador altera o perfil"
            )
        _nao_em_si_mesmo(ator, alvo, "Você não pode alterar o seu próprio perfil")
        alvo.cargo = dados.perfil
        registrar_auditoria(db, ator.id, "alterar_perfil_usuario", "usuario", alvo.id, ip)

    if dados.nome is not None and dados.nome != alvo.nome:
        alvo.nome = dados.nome
        alterou_dados = True

    if dados.email is not None:
        email = dados.email.lower()
        if email != alvo.email:
            if _email_em_uso(db, email, ignorar_id=alvo.id):
                raise _email_duplicado()
            alvo.email = email
            alterou_dados = True

    if alterou_dados:
        registrar_auditoria(db, ator.id, "editar_usuario", "usuario", alvo.id, ip)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise _email_duplicado()

    db.refresh(alvo)
    return UsuarioResponse.de_modelo(alvo)


# --------------------------------------------------------------------------
# Ativação, senha e exclusão
# --------------------------------------------------------------------------
@router.post("/{usuario_id}/ativar", response_model=UsuarioResponse)
def ativar_usuario(
    usuario_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    ator: Usuario = Depends(gestor_ou_admin),
):
    alvo = _buscar_alvo(db, ator, usuario_id)
    if not alvo.ativo:
        alvo.ativo = True
        registrar_auditoria(db, ator.id, "ativar_usuario", "usuario", alvo.id, ip_cliente(request))
        db.commit()
        db.refresh(alvo)
    return UsuarioResponse.de_modelo(alvo)


@router.post("/{usuario_id}/desativar", response_model=UsuarioResponse)
def desativar_usuario(
    usuario_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    ator: Usuario = Depends(gestor_ou_admin),
):
    alvo = _buscar_alvo(db, ator, usuario_id)
    _nao_em_si_mesmo(ator, alvo, "Você não pode desativar a sua própria conta")
    if alvo.ativo:
        # Encerra as sessões: ao reativar, tokens antigos não voltam a valer
        _encerrar_sessoes(alvo.id)
        alvo.ativo = False
        registrar_auditoria(db, ator.id, "desativar_usuario", "usuario", alvo.id, ip_cliente(request))
        db.commit()
        db.refresh(alvo)
    return UsuarioResponse.de_modelo(alvo)


@router.post("/{usuario_id}/redefinir-senha", response_model=MensagemResponse)
def redefinir_senha(
    usuario_id: uuid.UUID,
    dados: RedefinirSenhaRequest,
    request: Request,
    db: Session = Depends(get_db),
    ator: Usuario = Depends(gestor_ou_admin),
):
    """Define uma nova senha para o usuário e encerra as sessões dele (A3/G2)."""
    alvo = _buscar_alvo(db, ator, usuario_id)
    _nao_em_si_mesmo(ator, alvo, "Para trocar a sua própria senha, use PUT /auth/senha")

    _encerrar_sessoes(alvo.id)
    alvo.senha_hash = get_password_hash(dados.nova_senha)
    registrar_auditoria(db, ator.id, "redefinir_senha", "usuario", alvo.id, ip_cliente(request))
    db.commit()
    return MensagemResponse(message="Senha redefinida com sucesso")


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_usuario(
    usuario_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    ator: Usuario = Depends(somente_admin),
):
    """Exclui o usuário (A4). Quem já importou lotes ou criou regras deve ser
    desativado: apagá-lo deixaria esses registros sem autor."""
    alvo = _buscar_alvo(db, ator, usuario_id)
    _nao_em_si_mesmo(ator, alvo, "Você não pode excluir a sua própria conta")

    tem_vinculos = (
        db.execute(select(Lote.id).where(Lote.usuario_id == alvo.id).limit(1)).first()
        or db.execute(select(RegraCobranca.id).where(RegraCobranca.usuario_id == alvo.id).limit(1)).first()
    )
    if tem_vinculos:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="O usuário possui lotes ou regras vinculados. Desative-o em vez de excluir.",
        )

    _encerrar_sessoes(alvo.id)
    alvo_id = alvo.id
    db.delete(alvo)
    registrar_auditoria(db, ator.id, "excluir_usuario", "usuario", alvo_id, ip_cliente(request))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
