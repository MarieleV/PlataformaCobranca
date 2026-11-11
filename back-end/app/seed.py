import sys

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.domain import CargoEnum, Usuario

SENHA_PADRAO_DEV = "admin123"


def criar_admin_inicial() -> None:
    # Em produção, nunca criar o admin com a senha padrão de desenvolvimento
    if settings.is_production and settings.admin_senha_inicial == SENHA_PADRAO_DEV:
        print("ERRO: defina ADMIN_SENHA_INICIAL no .env antes de rodar o seed em produção.")
        sys.exit(1)

    db = SessionLocal()
    try:
        email = settings.admin_email.lower()
        if db.query(Usuario).filter(Usuario.email == email).first():
            print("O usuário Administrador já existe no banco de dados!")
            return

        db.add(
            Usuario(
                nome=settings.admin_nome,
                email=email,
                senha_hash=get_password_hash(settings.admin_senha_inicial),
                cargo=CargoEnum.administrador,
                ativo=True,
            )
        )
        db.commit()

        print("Administrador criado com sucesso!")
        print(f"E-mail: {email}")
        if settings.admin_senha_inicial == SENHA_PADRAO_DEV:
            print(f"Senha: {SENHA_PADRAO_DEV} (padrão de desenvolvimento, troque depois)")
        else:
            print("Senha: a definida em ADMIN_SENHA_INICIAL")

    except Exception as e:
        print(f"Erro ao criar administrador: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("Iniciando a carga de dados (Seed)...")
    criar_admin_inicial()