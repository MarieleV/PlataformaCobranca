import jwt
from app.core.security import (
    get_password_hash, 
    verify_password, 
    create_access_token, 
    SECRET_KEY, 
    ALGORITHM
)

def test_criptografia_senha():
    senha_plana = "minhaSenhaSuperForte123"
    senha_hash = get_password_hash(senha_plana)
    
    # Prova 1: O hash deve ser diferente da senha original
    assert senha_plana != senha_hash
    
    # Prova 2: A função de verificação deve reconhecer a senha correta
    assert verify_password(senha_plana, senha_hash) is True
    
    # Prova 3: A função de verificação deve rejeitar uma senha incorreta
    assert verify_password("senhaErrada", senha_hash) is False

def test_criacao_e_validade_jwt():
    dados_usuario = {"sub": "mariele@caj.com.br", "cargo": "administrador"}
    
    # Gera o token
    token = create_access_token(data=dados_usuario)
    
    # Prova 1: O token foi gerado e é uma string
    assert isinstance(token, str)
    assert len(token) > 0
    
    # Prova 2: Conseguimos decodificar o token com a mesma chave secreta
    payload_decodificado = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    
    # Prova 3: Os dados embutidos (email e cargo) estão corretos e não foram alterados
    assert payload_decodificado["sub"] == "mariele@caj.com.br"
    assert payload_decodificado["cargo"] == "administrador"
    # Prova 4: O token contém a data de expiração (exp) injetada automaticamente
    assert "exp" in payload_decodificado