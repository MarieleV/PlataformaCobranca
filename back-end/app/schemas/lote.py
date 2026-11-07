from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime
from uuid import UUID

# DTO para exibir as informações de Erros nos Lotes
class ErroLoteResponse(BaseModel):
    id: UUID
    linha_planilha: Optional[int]
    descricao_erro: str
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)

# DTO principal para exibir a listagem de Lotes
class LoteResponse(BaseModel):
    id: UUID
    nome_arquivo: str
    status: str
    usuario_id: UUID
    criado_em: datetime
    
    # Podemos incluir a lista de erros atrelada ao lote se necessário no futuro
    # erros: List[ErroLoteResponse] = []

    # Permite que o Pydantic leia diretamente dos objetos SQLAlchemy
    model_config = ConfigDict(from_attributes=True)
    
# DTO para a resposta do upload (que você já faz no formato dict no seu lote.py)
class UploadLoteResponse(BaseModel):
    message: str
    lote_id: UUID