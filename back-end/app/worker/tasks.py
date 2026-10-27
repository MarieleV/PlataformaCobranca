# app/worker/tasks.py
import pandas as pd
import io
import re
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.domain import Lote, Devedor, ErroLote, StatusLoteEnum

def validar_cpf_cnpj(documento: str) -> bool:
    if pd.isna(documento) or not documento:
        return False
        
    # Remove qualquer caractere que não seja número (pontos, traços, barras)
    doc_limpo = re.sub(r'[^0-9]', '', str(documento))
    
    if len(doc_limpo) == 11:
        # Rejeita CPFs com todos os números iguais (ex: 11111111111)
        if len(set(doc_limpo)) == 1:
            return False
        
        # Cálculo do 1º Dígito (Multiplica por pesos decrescentes de 10 a 2)
        soma = sum(int(doc_limpo[i]) * (10 - i) for i in range(9))
        d1 = 0 if soma % 11 < 2 else 11 - (soma % 11)
        
        # Cálculo do 2º Dígito (Multiplica por pesos decrescentes de 11 a 2)
        soma = sum(int(doc_limpo[i]) * (11 - i) for i in range(10))
        d2 = 0 if soma % 11 < 2 else 11 - (soma % 11)
        
        return doc_limpo[-2:] == f"{d1}{d2}"
        
    elif len(doc_limpo) == 14:
        # Rejeita CNPJs com todos os números iguais
        if len(set(doc_limpo)) == 1:
            return False
            
        # Cálculo do 1º Dígito
        pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        soma = sum(int(doc_limpo[i]) * pesos1[i] for i in range(12))
        d1 = 0 if soma % 11 < 2 else 11 - (soma % 11)
        
        # Cálculo do 2º Dígito
        pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        soma = sum(int(doc_limpo[i]) * pesos2[i] for i in range(13))
        d2 = 0 if soma % 11 < 2 else 11 - (soma % 11)
        
        return doc_limpo[-2:] == f"{d1}{d2}"
        
    return False

@celery_app.task
def processar_lote_task(lote_id: str, conteudo_csv: str):
    db = SessionLocal()
    try:
        # 1. Atualiza o status do lote para processando
        lote = db.query(Lote).filter(Lote.id == lote_id).first()
        if not lote:
            return f"Lote {lote_id} não encontrado."
            
        lote.status = StatusLoteEnum.processando
        db.commit()

        # 2. Lê o CSV em memória com Pandas
        df = pd.read_csv(io.StringIO(conteudo_csv))
        
        erros = []
        devedores_validos = []

        # 3. Itera sobre as linhas aplicando as regras
        for index, row in df.iterrows():
            linha_real = index + 2 # +2 considerando cabeçalho e índice 0
            
            cpf_cnpj = str(row.get('cpf_cnpj', ''))
            nome = str(row.get('nome', ''))
            
            if not validar_cpf_cnpj(cpf_cnpj):
                erros.append(ErroLote(
                    lote_id=lote_id,
                    numero_linha=linha_real,
                    campo="cpf_cnpj",
                    error_message=f"Documento inválido: {cpf_cnpj}"
                ))
                continue

            devedores_validos.append(Devedor(
                lote_id=lote_id,
                cpf_cnpj=''.join(filter(str.isdigit, cpf_cnpj)),
                nome=nome,
                email=row.get('email'),
                telefone=str(row.get('telefone', '')),
                valor_divida=row.get('valor_divida'),
                venc_orig_date=row.get('venc_orig_date')
            ))

        # 4. Persiste no PostgreSQL em lote (muito mais rápido)
        if devedores_validos:
            db.bulk_save_objects(devedores_validos)
        if erros:
            db.bulk_save_objects(erros)

        lote.status = StatusLoteEnum.concluido if not erros else StatusLoteEnum.erro
        db.commit()
        
        return f"Lote {lote_id} processado: {len(devedores_validos)} salvos, {len(erros)} erros."

    except Exception as e:
        db.rollback()
        if 'lote' in locals() and lote:
            lote.status = StatusLoteEnum.erro
            db.commit()
        raise e
    finally:
        db.close()