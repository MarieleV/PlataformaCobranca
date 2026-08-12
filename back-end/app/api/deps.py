from fastapi import Depends, HTTPException, status, Request
import jwt
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.domain import Usuario
from app.core.security import SECRET_KEY, ALGORITHM

# Função para extrair o token do cookie (httpOnly) ou do Header Bearer
def get_token(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        # Fallback para o header de autorização padrão
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado")
    
    # Se o token do cookie vier com o prefixo "Bearer "
    if token.startswith("Bearer "):
        token = token.split(" ")[1]
        
    return token

def get_current_user(token: str = Depends(get_token), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = db.query(Usuario).filter(Usuario.email == email).first()
    if user is None:
        raise credentials_exception
        
    # Bloqueia usuários inativos
    if user.status.value == "inativo":
        raise HTTPException(status_code=403, detail="Usuário inativo")
        
    return user

# Controle de Acesso Baseado em Papel (RBAC)
def role_required(allowed_roles: list[str]):
    def role_checker(current_user: Usuario = Depends(get_current_user)):
        if current_user.cargo.value not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Acesso negado: Perfil de acesso insuficiente"
            )
        return current_user
    return role_checker