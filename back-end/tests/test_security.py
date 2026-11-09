from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.core.config import settings
from app.core.security import (
    ACCESS_TOKEN_TYPE,
    REFRESH_TOKEN_TYPE,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
    verify_password_dummy,
)

# --------------------------------------------------------------------------
# Senhas
# --------------------------------------------------------------------------


def test_criptografia_senha():
    senha_plana = "minhaSenhaSuperForte123"
    senha_hash = get_password_hash(senha_plana)

    assert senha_plana != senha_hash
    assert verify_password(senha_plana, senha_hash) is True
    assert verify_password("senhaErrada", senha_hash) is False


def test_hash_usa_custo_12_do_rfc():
    assert get_password_hash("qualquer").startswith("$2b$12$")


def test_hashes_da_mesma_senha_sao_diferentes_por_causa_do_salt():
    assert get_password_hash("mesma-senha") != get_password_hash("mesma-senha")


def test_senha_acima_de_72_bytes_nao_gera_erro():
    """O bcrypt 5 lança ValueError acima de 72 bytes: o login viraria erro 500."""
    senha_longa = "x" * 200
    senha_hash = get_password_hash(senha_longa)

    assert verify_password(senha_longa, senha_hash) is True
    assert verify_password("x" * 199, senha_hash) is False


def test_senhas_longas_diferentes_so_no_final_nao_sao_confundidas():
    base = "a" * 100
    senha_hash = get_password_hash(base + "1")

    assert verify_password(base + "2", senha_hash) is False


@pytest.mark.parametrize("hash_invalido", ["", "nao-e-um-hash", "$2b$12$curto"])
def test_hash_malformado_retorna_false_em_vez_de_quebrar(hash_invalido):
    assert verify_password("qualquer", hash_invalido) is False


def test_verificacao_dummy_nao_lanca_erro():
    assert verify_password_dummy("qualquer-senha") is None


# --------------------------------------------------------------------------
# Tokens JWT
# --------------------------------------------------------------------------


def test_criacao_e_validade_jwt():
    token = create_access_token({"sub": "id-do-usuario"})

    assert isinstance(token, str) and token
    payload = decode_token(token, ACCESS_TOKEN_TYPE)
    assert payload["sub"] == "id-do-usuario"
    assert payload["type"] == ACCESS_TOKEN_TYPE
    assert {"exp", "iat", "jti"} <= payload.keys()


def test_access_token_expira_em_15_minutos():
    payload = decode_token(create_access_token({"sub": "1"}), ACCESS_TOKEN_TYPE)

    duracao = payload["exp"] - payload["iat"]
    assert duracao == 15 * 60


def test_refresh_token_expira_em_7_dias():
    payload = decode_token(create_refresh_token({"sub": "1"}), REFRESH_TOKEN_TYPE)

    duracao = payload["exp"] - payload["iat"]
    assert duracao == 7 * 24 * 3600


def test_cada_token_tem_jti_unico():
    primeiro = decode_token(create_access_token({"sub": "1"}))
    segundo = decode_token(create_access_token({"sub": "1"}))

    assert primeiro["jti"] != segundo["jti"]


def test_refresh_token_nao_vale_como_access_token():
    refresh = create_refresh_token({"sub": "1"})

    with pytest.raises(jwt.InvalidTokenError):
        decode_token(refresh, ACCESS_TOKEN_TYPE)


def test_access_token_nao_vale_como_refresh_token():
    access = create_access_token({"sub": "1"})

    with pytest.raises(jwt.InvalidTokenError):
        decode_token(access, REFRESH_TOKEN_TYPE)


def _token_manual(**claims) -> str:
    agora = datetime.now(timezone.utc)
    payload = {
        "sub": "1",
        "type": ACCESS_TOKEN_TYPE,
        "iat": agora,
        "exp": agora + timedelta(minutes=5),
        "jti": "abc",
        **claims,
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def test_token_expirado_e_rejeitado():
    expirado = _token_manual(exp=datetime.now(timezone.utc) - timedelta(seconds=1))

    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(expirado)


def test_token_assinado_com_outra_chave_e_rejeitado():
    falso = jwt.encode(
        {
            "sub": "1",
            "type": ACCESS_TOKEN_TYPE,
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            "jti": "x",
        },
        "outra-chave-qualquer-com-tamanho-suficiente-123456",
        algorithm="HS256",
    )

    with pytest.raises(jwt.InvalidTokenError):
        decode_token(falso)


def test_token_adulterado_e_rejeitado():
    token = create_access_token({"sub": "1"})
    cabecalho, corpo, assinatura = token.split(".")
    adulterado = f"{cabecalho}.{corpo}.{assinatura[:-2]}xx"

    with pytest.raises(jwt.InvalidTokenError):
        decode_token(adulterado)


def test_token_sem_algoritmo_e_rejeitado():
    """Ataque clássico: token com alg=none, sem assinatura."""
    sem_assinatura = jwt.encode({"sub": "1"}, key=None, algorithm="none")

    with pytest.raises(jwt.InvalidTokenError):
        decode_token(sem_assinatura)


@pytest.mark.parametrize("claim_ausente", ["sub", "jti", "type", "exp", "iat"])
def test_token_sem_claim_obrigatoria_e_rejeitado(claim_ausente):
    agora = datetime.now(timezone.utc)
    claims = {
        "sub": "1",
        "type": ACCESS_TOKEN_TYPE,
        "iat": agora,
        "exp": agora + timedelta(minutes=5),
        "jti": "abc",
    }
    claims.pop(claim_ausente)
    token = jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    with pytest.raises(jwt.InvalidTokenError):
        decode_token(token)


def test_lixo_no_lugar_do_token_e_rejeitado():
    with pytest.raises(jwt.InvalidTokenError):
        decode_token("isto-nao-e-um-jwt")