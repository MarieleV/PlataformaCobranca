"""Tasks do Celery.

Ingestão de lotes (M2): lê CSV/XLSX/XLS, valida linha a linha, grava devedores
válidos (valor da dívida criptografado) e registra os erros por linha.
"""
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from sqlalchemy import delete, insert, select

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.crypto import criptografar_decimal
from app.core.database import SessionLocal
from app.models.domain import Devedor, ErroLote, Lote, StatusDevedorEnum, StatusLoteEnum
from app.worker.validadores import (
    ALIASES_COLUNAS,
    COLUNAS_OBRIGATORIAS,
    ErroValidacao,
    normalizar_documento,
    validar_cpf_cnpj,  # noqa: F401  (reexportado para compatibilidade)
    validar_linha,
)

logger = logging.getLogger(__name__)

TAMANHO_BLOCO = 1000  # a cada bloco grava e atualiza o progresso (RF02)


def _agora() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------
# Leitura do arquivo
# --------------------------------------------------------------------------
def _ler_arquivo(caminho: str) -> pd.DataFrame:
    """Lê CSV, XLSX ou XLS tratando tudo como texto (a validação converte)."""
    extensao = Path(caminho).suffix.lower()
    opcoes = {"dtype": str, "na_filter": False}

    if extensao == ".csv":
        for codificacao in ("utf-8-sig", "latin-1"):  # CSVs do Excel BR costumam ser latin-1
            try:
                # sep=None detecta ',' ou ';' automaticamente
                return pd.read_csv(
                    caminho, sep=None, engine="python", encoding=codificacao, **opcoes
                )
            except UnicodeDecodeError:
                continue
        raise ValueError("Não foi possível identificar a codificação do CSV.")
    if extensao == ".xlsx":
        return pd.read_excel(caminho, engine="openpyxl", **opcoes)
    if extensao == ".xls":
        return pd.read_excel(caminho, engine="xlrd", **opcoes)
    raise ValueError(f"Extensão não suportada: {extensao}")


def _normalizar_colunas(df: pd.DataFrame) -> pd.DataFrame:
    nomes = [str(c).strip().lower().replace(" ", "_") for c in df.columns]
    df.columns = [ALIASES_COLUNAS.get(n, n) for n in nomes]
    return df


# --------------------------------------------------------------------------
# Gravação
# --------------------------------------------------------------------------
def _falhar_lote(db, lote: Lote, campo: str, mensagem: str) -> str:
    """Falha estrutural (arquivo ilegível, colunas ausentes...): lote vai para 'erro'."""
    db.add(ErroLote(lote_id=lote.id, numero_linha=1, campo=campo, regra_violada=mensagem))
    lote.status = StatusLoteEnum.erro
    lote.finalizado_em = _agora()
    db.commit()
    return f"Lote {lote.id} rejeitado: {mensagem}"


def _gravar_bloco(db, lote: Lote, devedores: list[dict], erros: list[dict],
                  importados: int, rejeitados: int) -> None:
    if devedores:
        db.execute(insert(Devedor), devedores)
    if erros:
        db.execute(insert(ErroLote), erros)
    lote.total_importados = importados
    lote.total_rejeitados = rejeitados
    db.commit()


def _documentos_existentes(db, documentos: set[str]) -> set[str]:
    existentes: set[str] = set()
    lista = list(documentos)
    for i in range(0, len(lista), 5000):
        bloco = lista[i : i + 5000]
        existentes.update(
            db.execute(select(Devedor.cpf_cnpj).where(Devedor.cpf_cnpj.in_(bloco))).scalars()
        )
    return existentes


def _erros_da_linha(resultado, existentes: set[str], vistos: dict[str, int]) -> list[ErroValidacao]:
    """Acrescenta as checagens que dependem de outras linhas e da base."""
    erros = list(resultado.erros)
    if resultado.dados is None:
        return erros
    documento = resultado.dados["cpf_cnpj"]
    if documento in existentes:
        erros.append(ErroValidacao("cpf_cnpj", "CPF/CNPJ já cadastrado na base", documento))
    elif documento in vistos:
        erros.append(ErroValidacao(
            "cpf_cnpj",
            f"CPF/CNPJ duplicado no arquivo (primeira ocorrência na linha {vistos[documento]})",
            documento,
        ))
    return erros


def _limpar_processamento_parcial(db, lote: Lote) -> None:
    """Se o worker caiu no meio e a mensagem foi reentregue, recomeça do zero."""
    db.execute(delete(ErroLote).where(ErroLote.lote_id == lote.id))
    db.execute(delete(Devedor).where(Devedor.lote_id == lote.id))
    lote.total_importados = 0
    lote.total_rejeitados = 0


# --------------------------------------------------------------------------
# Task
# --------------------------------------------------------------------------
def _processar(db, lote: Lote, caminho_arquivo: str) -> str:
    try:
        df = _normalizar_colunas(_ler_arquivo(caminho_arquivo))
    except Exception as exc:  # arquivo corrompido ou ilegível
        logger.warning("Falha ao ler o arquivo do lote %s: %s", lote.id, exc)
        return _falhar_lote(db, lote, "arquivo", "Não foi possível ler o arquivo enviado")

    ausentes = [c for c in COLUNAS_OBRIGATORIAS if c not in df.columns]
    if ausentes:
        return _falhar_lote(
            db, lote, "cabecalho", f"Colunas obrigatórias ausentes: {', '.join(ausentes)}"
        )
    if df.empty:
        return _falhar_lote(db, lote, "arquivo", "O arquivo não contém registros")
    if len(df) > settings.max_registros_lote:
        return _falhar_lote(
            db, lote, "arquivo", f"O arquivo excede o limite de {settings.max_registros_lote} registros"
        )

    lote.total_registros = len(df)
    db.commit()

    registros = df.to_dict(orient="records")
    existentes = _documentos_existentes(
        db, {d for d in (normalizar_documento(r["cpf_cnpj"]) for r in registros) if d}
    )

    vistos: dict[str, int] = {}
    devedores: list[dict] = []
    erros: list[dict] = []
    importados = rejeitados = 0

    for indice, registro in enumerate(registros):
        numero_linha = indice + 2  # +1 do cabeçalho, +1 porque a planilha começa na linha 1
        resultado = validar_linha(registro)
        erros_linha = _erros_da_linha(resultado, existentes, vistos)

        if erros_linha:
            rejeitados += 1
            erros.extend(
                {
                    "lote_id": lote.id,
                    "numero_linha": numero_linha,
                    "campo": e.campo,
                    "regra_violada": e.regra,
                    "valor_informado": e.valor or None,
                }
                for e in erros_linha
            )
        else:
            importados += 1
            dados = resultado.dados
            vistos[dados["cpf_cnpj"]] = numero_linha
            devedores.append({
                "lote_id": lote.id,
                "cpf_cnpj": dados["cpf_cnpj"],
                "nome": dados["nome"],
                "email": dados["email"],
                "telefone": dados["telefone"],
                "whatsapp": dados["whatsapp"],
                "valor_divida_enc": criptografar_decimal(dados["valor_divida"]),
                "data_vencimento": dados["data_vencimento"],
                "status": StatusDevedorEnum.ativo,
            })

        if (indice + 1) % TAMANHO_BLOCO == 0:
            _gravar_bloco(db, lote, devedores, erros, importados, rejeitados)
            devedores, erros = [], []

    _gravar_bloco(db, lote, devedores, erros, importados, rejeitados)

    # "concluido" mesmo com linhas rejeitadas: o relatório mostra os erros por linha
    lote.status = StatusLoteEnum.concluido
    lote.finalizado_em = _agora()
    db.commit()
    return f"Lote {lote.id} processado: {importados} importados, {rejeitados} rejeitados."


@celery_app.task(name="app.worker.tasks.processar_lote_task")
def processar_lote_task(lote_id: str, caminho_arquivo: str) -> str:
    """Processa um lote. Idempotente: pode ser reentregue sem duplicar dados."""
    db = SessionLocal()
    lote_uuid = uuid.UUID(lote_id)
    try:
        lote = db.get(Lote, lote_uuid)
        if lote is None:
            logger.warning("Lote %s não encontrado.", lote_id)
            return f"Lote {lote_id} não encontrado."
        if lote.status in (StatusLoteEnum.concluido, StatusLoteEnum.erro):
            return f"Lote {lote_id} já foi processado."

        _limpar_processamento_parcial(db, lote)
        lote.status = StatusLoteEnum.processando
        lote.iniciado_em = _agora()
        db.commit()

        return _processar(db, lote, caminho_arquivo)

    except Exception:
        db.rollback()
        logger.exception("Erro inesperado ao processar o lote %s", lote_id)
        lote = db.get(Lote, lote_uuid)
        if lote is not None:
            lote.status = StatusLoteEnum.erro
            lote.finalizado_em = _agora()
            db.commit()
        raise
    finally:
        db.close()
        # Dados pessoais: o arquivo não deve ficar no disco depois do processamento
        Path(caminho_arquivo).unlink(missing_ok=True)