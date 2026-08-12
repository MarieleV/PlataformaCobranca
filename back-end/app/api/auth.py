from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.models.domain import Usuario
from app.core.security import verify_password, create_access_token
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticação"])

# Schema do Pydantic para validação da requisição
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

@router.post("/login")
def login(request: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.email == request.email).first()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="E-mail ou senha incorretos"
        )
    
    # Gera o JWT com tempo de vida de 15 minutos (conforme RFC)
    access_token = create_access_token(data={"sub": user.email, "cargo": user.cargo.value})
    
    # Armazena em um cookie httpOnly para evitar ataques XSS
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=15 * 60, # 15 minutos
        secure=True,     # Requer HTTPS (ideal para produção)
        samesite="lax"
    )
    
    return {
        "message": "Login realizado com sucesso", 
        "user": {"nome": user.nome, "email": user.email, "perfil": user.cargo.value}
    }

@router.delete("/logout")
def logout(response: Response, current_user: Usuario = Depends(get_current_user)):
    # Invalida o cookie
    response.delete_cookie(key="access_token")
    return {"message": "Logout realizado com sucesso"}