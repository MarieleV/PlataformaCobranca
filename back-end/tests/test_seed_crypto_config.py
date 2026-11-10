from decimal import Decimal

import pytest
from sqlalchemy import select

from app.core.config import Settings, settings
from app.core.crypto import (
    criptografar_decimal,
    criptografar_texto,
    descriptografar_decimal,
    descriptografar_texto,
)
from app.core.security import verify_password
from app.models.domain import CargoEnum, Usuario
from app.seed import criar_admin_inicial

# --------------------------------------------------------------------------
# Seed
# --------------------------------------------------------------------------


def test_seed_cria_o_administrador(db):
    criar_admin_inicial()

    admin = db.scalars(select(Usuario)).one()
    assert admin.email == settings.admin_email
    assert admin.cargo == CargoEnum.administrador
    assert admin.ativo is True
    assert admin.senha_hash != settings.admin_senha_inicial
    assert verify_password(settings.admin_senha_inicial, admin.senha_hash)


def test_seed_e_idempotente(db):
    criar_admin_inicial()
    criar_admin_inicial()

    assert len(db.scalars(select(Usuario)).all()) == 1


def test_seed_em_producao_recusa_a_senha_padrao(db, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "admin_senha_inicial", "admin123")

    with pytest.raises(SystemExit):
        criar_admin_inicial()

    assert db.scalars(select(Usuario)).all() == []


def test_seed_em_producao_aceita_senha_propria(db, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "admin_senha_inicial", "SenhaForteEUnica2026")

    criar_admin_inicial()

    assert len(db.scalars(select(Usuario)).all()) == 1


# --------------------------------------------------------------------------
# Criptografia (RNF05)
# --------------------------------------------------------------------------


def test_texto_criptografado_nao_e_legivel_e_volta_ao_original():
    cifrado = criptografar_texto("segredo 123")

    assert b"segredo" not in cifrado
    assert descriptografar_texto(cifrado) == "segredo 123"


def test_decimal_mantem_a_precisao():
    assert descriptografar_decimal(criptografar_decimal(Decimal("1234.56"))) == Decimal("1234.56")


def test_mesmo_valor_gera_cifras_diferentes():
    assert criptografar_decimal(Decimal("10")) != criptografar_decimal(Decimal("10"))


def test_dado_adulterado_e_rejeitado():
    with pytest.raises(ValueError):
        descriptografar_texto(b"isto-nao-e-um-token-fernet")


# --------------------------------------------------------------------------
# Configuração
# --------------------------------------------------------------------------


def _config(**campos) -> Settings:
    return Settings(_env_file=None, **campos)


def test_url_do_postgres_ganha_o_driver_psycopg2():
    """O SQLAlchemy 2.1 assumiria o psycopg 3, que o projeto não instala."""
    assert _config(database_url="postgresql://u:s@db:5432/x").database_url.startswith(
        "postgresql+psycopg2://"
    )


def test_url_com_driver_explicito_nao_e_alterada():
    url = "postgresql+psycopg2://u:s@db:5432/x"

    assert _config(database_url=url).database_url == url


def test_producao_exige_jwt_secret_longo():
    with pytest.raises(ValueError):
        _config(environment="production", jwt_secret="curto", encryption_key="x", cookie_secure=True)


def test_producao_exige_chave_de_criptografia():
    with pytest.raises(ValueError):
        _config(environment="production", jwt_secret="x" * 40, cookie_secure=True)


def test_producao_exige_cookie_seguro():
    with pytest.raises(ValueError):
        _config(environment="production", jwt_secret="x" * 40, encryption_key="k", cookie_secure=False)


def test_producao_com_tudo_configurado_sobe():
    config = _config(
        environment="production",
        jwt_secret="x" * 40,
        encryption_key="k",
        cookie_secure=True,
    )

    assert config.is_production is True


def test_desenvolvimento_sem_segredo_usa_valor_de_dev():
    assert _config(environment="development", jwt_secret="").jwt_secret != ""


def test_cors_origins_vira_lista_sem_espacos_nem_vazios():
    config = _config(cors_origins=" http://a.com , http://b.com ,, ")

    assert config.cors_origins_list == ["http://a.com", "http://b.com"]


# --------------------------------------------------------------------------
# Banco remoto (AWS RDS) exige TLS em produção
# --------------------------------------------------------------------------

_PRODUCAO = dict(
    environment="production", jwt_secret="x" * 40, encryption_key="k", cookie_secure=True
)


def test_producao_recusa_banco_remoto_sem_tls():
    with pytest.raises(ValueError, match="sslmode"):
        _config(database_url="postgresql://u:s@meu-banco.rds.amazonaws.com:5432/x", **_PRODUCAO)


def test_producao_recusa_sslmode_desativado():
    with pytest.raises(ValueError, match="sslmode"):
        _config(
            database_url="postgresql://u:s@meu-banco.rds.amazonaws.com:5432/x?sslmode=disable",
            **_PRODUCAO,
        )


def test_producao_aceita_banco_remoto_com_tls():
    config = _config(
        database_url="postgresql://u:s@meu-banco.rds.amazonaws.com:5432/x?sslmode=require",
        **_PRODUCAO,
    )

    assert config.database_url.endswith("?sslmode=require")


def test_banco_do_proprio_compose_nao_exige_tls():
    assert _config(database_url="postgresql://u:s@db:5432/x", **_PRODUCAO).is_production


def test_desenvolvimento_nao_exige_tls_no_banco_remoto():
    config = _config(database_url="postgresql://u:s@meu-banco.rds.amazonaws.com:5432/x")

    assert config.is_production is False


# --------------------------------------------------------------------------
# Disparo real exige as chaves dos provedores
# --------------------------------------------------------------------------


def test_envio_simulado_e_o_padrao():
    assert _config().envio_simulado is True


def test_producao_pode_ficar_em_modo_simulado_sem_chaves():
    assert _config(**_PRODUCAO).is_production


def test_producao_com_envio_real_exige_as_chaves():
    with pytest.raises(ValueError, match="ENVIO_SIMULADO"):
        _config(envio_simulado=False, **_PRODUCAO)


def test_producao_com_envio_real_e_chaves_completas_sobe():
    config = _config(
        envio_simulado=False,
        sendgrid_api_key="SG.x",
        email_remetente="cobranca@empresa.com",
        twilio_account_sid="ACx",
        twilio_auth_token="t",
        twilio_sms_from="+15550001111",
        twilio_whatsapp_from="+15550002222",
        **_PRODUCAO,
    )

    assert config.envio_simulado is False
