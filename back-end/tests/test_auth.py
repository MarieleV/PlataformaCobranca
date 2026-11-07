from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.domain import Usuario
from app.core.security import get_password_hash

client = TestClient(app)

# --- FUNÇÃO AUXILIAR PARA CRIAR O MOCK DO USUÁRIO ---
def criar_mock_usuario(status_usuario="ativo"):
    # 1. Criamos o usuário apenas com os campos básicos permitidos
    usuario_falso = Usuario(
        nome="Mariele",
        email="mariele@caj.com.br"
    )
    
    # 2. Injetamos o password_hash por fora do construtor para evitar o TypeError
    usuario_falso.password_hash = get_password_hash("senha_correta_123")
    
    # Simula o Enum de cargo
    cargo_mock = MagicMock()
    cargo_mock.value = "administrador"
    usuario_falso.cargo = cargo_mock
    
    # Simula o Enum de status
    status_mock = MagicMock()
    status_mock.value = status_usuario
    usuario_falso.status = status_mock
    
    return usuario_falso

# --- TESTES ---

def test_login_sucesso_deve_retornar_cookie():
    mock_db = MagicMock()
    mock_db.query().filter().first.return_value = criar_mock_usuario("ativo")
    app.dependency_overrides[get_db] = lambda: mock_db

    # Fazemos o POST com a senha que geramos o hash
    response = client.post("/auth/login", json={
        "email": "mariele@caj.com.br", 
        "password": "senha_correta_123"
    })
    app.dependency_overrides.clear()

    # Provas de sucesso
    assert response.status_code == 200
    assert response.json()["message"] == "Login realizado com sucesso"
    assert "access_token" in response.cookies # Prova que o HttpOnly Cookie foi setado!

def test_login_senha_incorreta_deve_falhar():
    mock_db = MagicMock()
    mock_db.query().filter().first.return_value = criar_mock_usuario("ativo")
    app.dependency_overrides[get_db] = lambda: mock_db

    # Fazemos o POST com uma senha errada
    response = client.post("/auth/login", json={
        "email": "mariele@caj.com.br", 
        "password": "senha_errada_456"
    })
    app.dependency_overrides.clear()

    # Provas de falha de segurança
    assert response.status_code == 401
    assert response.json()["detail"] == "E-mail ou senha incorretos"

def test_login_usuario_inativo_deve_ser_bloqueado():
    mock_db = MagicMock()
    # Criamos o mock do usuário com status inativo
    mock_db.query().filter().first.return_value = criar_mock_usuario("inativo")
    app.dependency_overrides[get_db] = lambda: mock_db

    response = client.post("/auth/login", json={
        "email": "mariele@caj.com.br", 
        "password": "senha_correta_123"
    })
    app.dependency_overrides.clear()

    # Provas de bloqueio
    assert response.status_code == 403
    assert response.json()["detail"] == "Usuário inativo. O acesso foi revogado."

def test_logout_deve_limpar_cookie():
    # Para o logout, precisamos apenas mockar o current_user (fingir que já estamos logados)
    app.dependency_overrides[get_current_user] = lambda: MagicMock()
    
    response = client.delete("/auth/logout")
    app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["message"] == "Logout realizado com sucesso"