"""Configuração central da aplicação.

Toda variável de ambiente é lida aqui, em um único lugar. O restante do código
importa `settings` em vez de chamar `os.getenv` espalhado pelos módulos.
"""
import base64
import hashlib

from pydantic import field_validator, model_validator
from sqlalchemy.engine import make_url
from pydantic_settings import BaseSettings, SettingsConfigDict

# Usado apenas em desenvolvimento/testes quando JWT_SECRET não é informado.
_JWT_SECRET_DEV = "dev-only-secret-nao-use-em-producao-0123456789"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Aplicação ---
    app_name: str = "API Plataforma de Cobrança Automatizada"
    app_version: str = "1.1.0"
    environment: str = "development"  # development | production
    # O esquema do banco é gerenciado pelo Alembic (alembic upgrade head).
    # Só ligue em protótipos descartáveis: create_all não acompanha mudanças.
    auto_create_tables: bool = False

    # --- Infraestrutura ---
    database_url: str = "postgresql://postgres:password123@db:5432/cobranca_db"
    # Pool de conexões por processo. No RDS db.t3.micro/t4g.micro o limite é de
    # ~110 conexões: API + workers (cada processo tem o seu pool) precisam caber.
    db_pool_size: int = 5
    db_max_overflow: int = 5
    redis_url: str = "redis://redis:6379/0"  # sessões / revogação de tokens
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq:5672//"
    celery_result_backend: str = "redis://redis:6379/1"  # DB separado do cache

    # --- Segurança ---
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    encryption_key: str = ""  # chave Fernet (dados sensíveis em repouso)

    # --- Cookies e CORS ---
    cors_origins: str = (
        "http://localhost:8443,http://localhost:5173,http://127.0.0.1:8443"
    )
    cookie_secure: bool = False  # true em produção (HTTPS)
    cookie_samesite: str = "lax"  # lax | strict | none
    refresh_cookie_path: str = "/"  # restrinja à rota de refresh, ex.: /auth

    # --- Upload e ingestão de lotes (RF01 e RNF03) ---
    # Diretório compartilhado entre a API e o worker (volume do Docker)
    upload_dir: str = "/code/uploads"
    max_upload_mb: int = 20
    max_registros_lote: int = 50000

    # --- Proteção do login (força bruta) ---
    login_max_tentativas: int = 5
    login_janela_segundos: int = 900  # 15 minutos

    # --- Administrador inicial (seed) ---
    admin_nome: str = "Administrador"
    admin_email: str = "admin@consulth.com.br"
    admin_senha_inicial: str = "admin123"  # troque em qualquer ambiente real

    # --- Régua de cobrança (RN05 e RN07) ---
    max_tentativas_envio: int = 4  # 1 envio inicial + 3 reenvios
    intervalo_reenvio_minutos: int = 30
    janela_inicio_hora: int = 8
    janela_fim_hora: int = 20
    fuso_horario: str = "America/Sao_Paulo"

    # --- Dashboard e métricas (RF08 e RNF08) ---
    meta_taxa_entrega: float = 95.0  # % de sucesso no e-mail (RFC: meta > 95%)
    # Se definido, o /metrics exige "Authorization: Bearer <token>" (o Prometheus
    # envia isso na configuração `authorization`). Vazio = aberto: nesse caso
    # bloqueie a rota no Nginx para a internet.
    metrics_token: str = ""

    # --- Provedores de disparo ---
    # Modo simulado: não chama SendGrid/Twilio, só finge o envio. É o padrão para
    # nunca mandar cobrança de verdade por engano. Em produção, ENVIO_SIMULADO=false.
    envio_simulado: bool = True
    email_assunto: str = "Comunicado de cobrança"
    sendgrid_api_key: str = ""
    email_remetente: str = ""
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_sms_from: str = ""
    twilio_whatsapp_from: str = ""

    @field_validator("database_url")
    @classmethod
    def _usar_driver_psycopg2(cls, valor: str) -> str:
        # O SQLAlchemy 2.1 assume o psycopg 3 em "postgresql://", mas o projeto
        # instala o psycopg2 (requirements.txt). Fixar o driver evita o erro.
        if valor.startswith("postgresql://"):
            return valor.replace("postgresql://", "postgresql+psycopg2://", 1)
        return valor

    @property
    def database_exige_ssl(self) -> bool:
        """Banco remoto (ex.: RDS) precisa de TLS; o do próprio compose não."""
        url = make_url(self.database_url)
        if not url.drivername.startswith("postgresql"):
            return False
        return url.host not in (None, "db", "localhost", "127.0.0.1")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def fernet_key(self) -> bytes:
        """Chave Fernet. Em dev sem ENCRYPTION_KEY, deriva da JWT_SECRET."""
        if self.encryption_key:
            return self.encryption_key.encode()
        digest = hashlib.sha256(self.jwt_secret.encode()).digest()
        return base64.urlsafe_b64encode(digest)

    @model_validator(mode="after")
    def _validar_segredos(self) -> "Settings":
        if self.is_production:
            if len(self.jwt_secret) < 32:
                raise ValueError("JWT_SECRET precisa ter 32+ caracteres em produção.")
            if not self.encryption_key:
                raise ValueError("ENCRYPTION_KEY é obrigatória em produção.")
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE deve ser true em produção.")
            if not self.envio_simulado and not (
                self.sendgrid_api_key
                and self.email_remetente
                and self.twilio_account_sid
                and self.twilio_auth_token
                and self.twilio_sms_from
                and self.twilio_whatsapp_from
            ):
                raise ValueError(
                    "ENVIO_SIMULADO=false exige SENDGRID_API_KEY, EMAIL_REMETENTE, "
                    "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM e TWILIO_WHATSAPP_FROM."
                )
            if self.database_exige_ssl and make_url(self.database_url).query.get(
                "sslmode"
            ) not in ("require", "verify-ca", "verify-full"):
                raise ValueError(
                    "DATABASE_URL remoto exige TLS em produção: "
                    "acrescente ?sslmode=require (dados pessoais, LGPD)."
                )
        elif not self.jwt_secret:
            self.jwt_secret = _JWT_SECRET_DEV
        return self


settings = Settings()
