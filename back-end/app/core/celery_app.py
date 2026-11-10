from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "cobranca_worker",
    broker=settings.rabbitmq_url,
    backend=settings.celery_result_backend,
    include=["app.worker.tasks", "app.worker.disparo_tasks"],  # módulos das tasks
)

celery_app.conf.update(
    # Serialização
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # Fuso: o Beat interpreta os horários do crontab neste fuso (RN05)
    timezone=settings.fuso_horario,
    enable_utc=True,
    # Confiabilidade: a mensagem só sai da fila depois da task terminar.
    # Exige tasks idempotentes (reprocessar não pode duplicar disparo).
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # tasks longas (lotes) não ficam "reservadas"
    task_track_started=True,
    # Limites: evitam task travada ocupando o worker para sempre
    task_soft_time_limit=900,
    task_time_limit=960,
    result_expires=86400,
    # Tenta reconectar ao RabbitMQ na subida do container
    broker_connection_retry_on_startup=True,
)

# Agendamento recorrente (Celery Beat). O horário é o de Brasília (timezone acima).
# Roda a cada 5 minutos, de segunda a sexta, das 08h às 19h55 (RN05): dentro do
# ciclo, cada regra dispara a partir do próprio horário_disparo e os reenvios
# vencidos são retomados.
celery_app.conf.beat_schedule = {
    "ciclo-de-disparo": {
        "task": "app.worker.disparo_tasks.ciclo_de_disparo",
        "schedule": crontab(minute="*/5", hour="8-19", day_of_week="1-5"),
    },
}
