import os
from celery import Celery

# Puxa as URLs de conexão do ambiente (configuradas no docker-compose)
RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://guest:guest@rabbitmq:5672//")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Cria a instância do Celery
celery_app = Celery(
    "cobranca_worker",
    broker=RABBITMQ_URL,
    backend=REDIS_URL,
    include=['app.worker.tasks'] # Aponta onde nossas funções de trabalho pesado ficarão
)

# Configurações de otimização e serialização
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='America/Sao_Paulo',
    enable_utc=True,
)