import pytest
from unittest.mock import patch, MagicMock
from app.worker.tasks import processar_lote_task
from app.models.domain import StatusLoteEnum

@patch('app.worker.tasks.SessionLocal')
def test_processar_lote_com_linhas_validas_e_invalidas(mock_session_local):
    # Simula a sessão do banco de dados
    mock_db = MagicMock()
    mock_session_local.return_value = mock_db
    
    # Simula a busca do lote no banco
    mock_lote = MagicMock()
    mock_lote.id = "lote-123"
    mock_db.query().filter().first.return_value = mock_lote

    # Simula o conteúdo de um CSV lido pelo sistema (1 CPF válido e 1 inválido)
    csv_conteudo = (
        "nome,cpf_cnpj,email,telefone,valor_divida,venc_orig_date\n"
        "Cliente Certo,52998224725,certo@email.com,11999999999,100.00,2026-12-01\n"
        "Cliente Errado,11111111111,errado@email.com,11888888888,250.00,2026-12-05\n"
    )

    # Executa a função do worker
    resultado = processar_lote_task("lote-123", csv_conteudo)

    # Validações de regra de negócio
    # Como há 1 erro no CSV simulado, o status final do lote deve ser StatusLoteEnum.erro
    assert mock_lote.status == StatusLoteEnum.erro
    
    # A função deve ter chamado o bulk_save_objects duas vezes (uma para salvar o válido, outra para o erro)
    assert mock_db.bulk_save_objects.call_count == 2
    
    # A mensagem de retorno deve refletir exatamente 1 salvo e 1 erro
    assert "1 salvos, 1 erros" in resultado