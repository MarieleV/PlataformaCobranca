from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.domain import Usuario

client = TestClient(app)

def test_acesso_lotes_sem_autenticacao_deve_falhar():
    response = client.get("/lotes/")
    assert response.status_code == 401
    assert response.json() == {"detail": "Não autenticado"}

def test_acesso_erros_lote_sem_autenticacao_deve_falhar():
    response = client.get("/lotes/123/erros")
    assert response.status_code == 401

def test_acesso_lotes_com_usuario_logado():
    token = create_access_token(data={"sub": "mariele@caj.com.br", "cargo": "administrador"})
    client.cookies.set("access_token", f"Bearer {token}")
    
    mock_db = MagicMock()
    
    # A) Criamos o usuário base
    usuario_falso = Usuario(id="123e4567-e89b-12d3-a456-426614174000", email="mariele@caj.com.br")
    
    # B) A MÁGICA ESTÁ AQUI: deps.py exige que is_active seja True!
    usuario_falso.is_active = True
    
    # Mantemos o status caso seja usado em alguma validação futura
    status_falso = MagicMock()
    status_falso.value = "ativo"
    usuario_falso.status = status_falso
    
    # C) Fabricamos o cargo
    cargo_falso = MagicMock()
    cargo_falso.value = "administrador"
    usuario_falso.cargo = cargo_falso
    
    # D) Ensinamos a query do banco a retornar esse usuário
    mock_db.query().filter().first.return_value = usuario_falso
    mock_db.query().order_by().offset().limit().all.return_value = []
    
    app.dependency_overrides[get_db] = lambda: mock_db
    
    response = client.get("/lotes/")
    app.dependency_overrides.clear()
    
    assert response.status_code == 200
    assert isinstance(response.json(), list)