from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.domain import Usuario

# Cria um cliente de teste que simula o navegador/Postman
client = TestClient(app)

def test_acesso_lotes_sem_autenticacao_deve_falhar():
    # Tenta acessar a rota GET /lotes/ sem enviar nenhum token ou cookie
    response = client.get("/lotes/")
    
    # Prova 1: O status code deve ser 401 (Não Autorizado)
    assert response.status_code == 401
    
    # Prova 2: A mensagem de erro deve ser a que configuramos no deps.py
    assert response.json() == {"detail": "Não autenticado"}

def test_acesso_erros_lote_sem_autenticacao_deve_falhar():
    response = client.get("/lotes/123/erros")
    assert response.status_code == 401

def test_acesso_lotes_com_usuario_logado():
    # 1. Geramos um token válido de teste
    token = create_access_token(data={"sub": "mariele@caj.com.br", "cargo": "administrador"})
    
    # 2. Injetamos o token no cookie do nosso cliente de testes
    client.cookies.set("access_token", f"Bearer {token}")
    
    # 3. Criamos um "Mock" (Dublê) do banco de dados
    mock_db = MagicMock()
    
    # 4. Ensinamos o Mock a responder as perguntas que o FastAPI fará:
    # A) Criamos o usuário base
    usuario_falso = Usuario(id="123e4567-e89b-12d3-a456-426614174000", email="mariele@caj.com.br")
    
    # B) Fabricamos um status falso que responde "ativo" quando acessam o .value
    status_falso = MagicMock()
    status_falso.value = "ativo"
    usuario_falso.status = status_falso
    
    # C) Ensinamos a query do banco a retornar esse usuário
    mock_db.query().filter().first.return_value = usuario_falso
    
    # D) Ensinamos a rota de listar_lotes a retornar uma lista vazia
    mock_db.query().order_by().offset().limit().all.return_value = []
    
    # 5. Substituímos o banco real pelo nosso banco Mockado!
    app.dependency_overrides[get_db] = lambda: mock_db
    
    # 6. Fazemos a requisição (agora com o cookie setado e o banco mockado)
    response = client.get("/lotes/")
    
    # 7. Limpamos a substituição para não afetar os próximos testes
    app.dependency_overrides.clear()
    
    # Prova 1: O status code deve ser 200 OK (Passou pelo bloqueio!)
    assert response.status_code == 200
    # Prova 2: O retorno deve ser uma lista (conforme nosso DTO LoteResponse prevê)
    assert isinstance(response.json(), list)