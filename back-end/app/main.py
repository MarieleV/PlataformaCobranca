from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.api import auth
# É necessário importar o módulo domain para que o SQLAlchemy "enxergue" os modelos e crie as tabelas
from app.models import domain

# Cria as tabelas no banco de dados na inicialização
# Nota: Em um ambiente de produção maduro, o ideal é usar o Alembic para migrações
Base.metadata.create_all(bind=engine)

# Inicialização da aplicação FastAPI com metadados do projeto
app = FastAPI(
    title="API Plataforma de Cobrança Automatizada",
    description="Backend para gestão e automação do ciclo de cobrança de inadimplentes.",
    version="1.0.0",
)

# Configuração de CORS (Cross-Origin Resource Sharing)
# Extremamente importante para que o React (Vite) consiga consumir esta API
app.add_middleware(
    CORSMiddleware,
    # Adicione aqui os domínios do seu frontend (ex: http://localhost:8443 que vi no seu vite.config.ts)
    allow_origins=["http://localhost:8443", "http://localhost:5173", "http://127.0.0.1:8443"], 
    allow_credentials=True, # Obrigatório como True para permitir o tráfego dos Cookies httpOnly do JWT
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro dos Routers (Controllers) na aplicação principal
app.include_router(auth.router)

# Rota básica de Health Check para monitoramento e validação de uptime
@app.get("/", tags=["Health Check"])
def root():
    return {
        "status": "online",
        "message": "API Plataforma de Cobrança Automatizada operante.",
        "version": "1.0.0"
    }