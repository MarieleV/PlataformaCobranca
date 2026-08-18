from datetime import datetime, timedelta
import jwt
import bcrypt
import os

# Configurações baseadas no RFC
SECRET_KEY = os.getenv("JWT_SECRET", "super-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15 # Conforme exigido no RFC
REFRESH_TOKEN_EXPIRE_DAYS = 7    # Conforme exigido no RFC

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # O bcrypt moderno exige que as strings sejam convertidas em bytes (encode)
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password: str) -> str:
    # Gera o salt com custo 12, conforme exigido no RFC
    salt = bcrypt.gensalt(rounds=12)
    # Gera o hash e transforma o resultado (bytes) de volta em string para salvar no banco
    hashed_bytes = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed_bytes.decode('utf-8')

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt