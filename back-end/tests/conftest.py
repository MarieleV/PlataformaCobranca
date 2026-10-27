# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    # Cria um cliente HTTP falso para testar as rotas sem precisar subir o servidor Uvicorn
    with TestClient(app) as c:
        yield c