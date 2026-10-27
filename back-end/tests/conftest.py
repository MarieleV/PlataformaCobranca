import os
# Força o ambiente de testes a usar SQLite em memória antes de importar o app
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine

@pytest.fixture(scope="function", autouse=True)
def setup_database():
    # Cria as tabelas no SQLite em memória antes de cada teste
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c