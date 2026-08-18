from app.core.database import SessionLocal
from app.models.domain import Usuario, CargoEnum
from app.core.security import get_password_hash

def criar_admin_inicial():
    # Abre a sessão com o banco de dados
    db = SessionLocal()
    
    try:
        # Verifica se o admin já existe para não duplicar
        admin_existente = db.query(Usuario).filter(Usuario.email == "admin@consulth.com.br").first()
        
        if admin_existente:
            print("O usuário Administrador já existe no banco de dados!")
            return

        # Cria o novo usuário
        novo_admin = Usuario(
            email="admin@consulth.com.br",
            password_hash=get_password_hash("admin123"), # Senha criptografada com bcrypt
            cargo=CargoEnum.administrador # Perfil com permissão total
        )
        
        # Salva no banco
        db.add(novo_admin)
        db.commit()
        
        print("Administrador criado com sucesso!")
        print("E-mail: admin@consulth.com.br")
        print("Senha: admin123")
        
    except Exception as e:
        print(f"Erro ao criar administrador: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Iniciando a carga de dados (Seed)...")
    criar_admin_inicial()