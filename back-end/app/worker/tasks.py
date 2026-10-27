# app/worker/tasks.py
import pandas as pd
import io
from app.core.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.domain import Lote, Devedor, ErroLote, StatusLoteEnum

def validar_cpf_cnpj(documento: str) -> bool:
    # Validação provisória por tamanho. 
    if pd.isna(documento) or not documento:
        return False
    doc_limpo = ''.join(filter(str.isdigit, str(documento)))
    return len(doc_limpo) in (11, 14)

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