"""Configuração global dos testes.

Os testes rodam offline: banco SQLite em arquivo temporário, Redis simulado
(fakeredis) e nenhuma chamada ao RabbitMQ. As variáveis de ambiente precisam
ser definidas ANTES de importar o app, porque `settings` e o `engine` são
criados no momento do import.
"""
import os
import tempfile
from pathlib import Path

_PASTA_TESTES = Path(tempfile.mkdtemp(prefix="cobranca_testes_"))

os.environ.update(
    {
        "ENVIRONMENT": "development",
        "DATABASE_URL": f"sqlite:///{_PASTA_TESTES / 'teste.db'}",
        "UPLOAD_DIR": str(_PASTA_TESTES / "uploads"),
        "RABBITMQ_URL": "memory://",
        "JWT_SECRET": "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres",
        "ENCRYPTION_KEY": "",  # em desenvolvimento deriva da JWT_SECRET
        "COOKIE_SECURE": "false",
        "COOKIE_SAMESITE": "lax",
        "REFRESH_COOKIE_PATH": "/auth",
        "AUTO_CREATE_TABLES": "false",
        "LOGIN_MAX_TENTATIVAS": "5",
    }
)

import fakeredis  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import app.core.redis_client as redis_client  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.main import app  # noqa: E402
from app.models import domain  # noqa: E402,F401
from app.models.domain import CargoEnum, Usuario  # noqa: E402

SENHA_PADRAO = "Senha@12345"


@pytest.fixture(autouse=True)
def banco_limpo():
    """Tabelas novas antes de cada teste e removidas depois."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def redis_falso(monkeypatch):
    """Redis em memória, novo a cada teste (sem falhas de login acumuladas)."""
    falso = fakeredis.FakeRedis(decode_responses=True)
    monkeypatch.setattr(redis_client, "_redis", falso)
    return falso


@pytest.fixture(autouse=True)
def pasta_uploads(tmp_path, monkeypatch) -> Path:
    """Pasta de uploads exclusiva de cada teste (sem arquivos de outros testes)."""
    pasta = tmp_path / "uploads"
    pasta.mkdir()
    monkeypatch.setattr(settings, "upload_dir", str(pasta))
    return pasta


@pytest.fixture(scope="session")
def hash_senha_padrao() -> str:
    # O bcrypt com custo 12 é lento de propósito: gera uma vez e reaproveita
    return get_password_hash(SENHA_PADRAO)


@pytest.fixture
def db():
    sessao = SessionLocal()
    try:
        yield sessao
    finally:
        sessao.close()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def criar_usuario(db, hash_senha_padrao):
    """Fábrica de usuários reais no banco (e não mocks)."""
    contador = {"n": 0}

    def _criar(
        cargo: CargoEnum | str = CargoEnum.operador,
        email: str | None = None,
        ativo: bool = True,
    ) -> Usuario:
        contador["n"] += 1
        usuario = Usuario(
            nome=f"Usuario {contador['n']}",
            email=email or f"usuario{contador['n']}@teste.com",
            senha_hash=hash_senha_padrao,
            cargo=CargoEnum(cargo),
            ativo=ativo,
        )
        db.add(usuario)
        db.commit()
        db.refresh(usuario)
        return usuario

    return _criar


@pytest.fixture
def logar(client, criar_usuario):
    """Cria um usuário do cargo pedido e devolve o client já autenticado."""

    def _logar(cargo: CargoEnum | str = CargoEnum.operador) -> TestClient:
        usuario = criar_usuario(cargo)
        resposta = client.post(
            "/auth/login", json={"email": usuario.email, "password": SENHA_PADRAO}
        )
        assert resposta.status_code == 200, resposta.text
        client.usuario = usuario  # facilita os testes que precisam do id
        return client

    return _logar


@pytest.fixture
def como(criar_usuario):
    """Client próprio (cookies próprios) logado no cargo pedido.

    Ao contrário do `logar`, permite ter vários usuários logados no mesmo teste.
    """

    def _como(cargo: CargoEnum | str = CargoEnum.operador, **campos) -> TestClient:
        usuario = criar_usuario(cargo, **campos)
        cliente = TestClient(app)
        resposta = cliente.post(
            "/auth/login", json={"email": usuario.email, "password": SENHA_PADRAO}
        )
        assert resposta.status_code == 200, resposta.text
        cliente.usuario = usuario
        return cliente

    return _como
