from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "cobranca_worker",
    broker=settings.rabbitmq_url,
    backend=settings.celery_result_backend,
    include=["app.worker.tasks"],  # módulo onde ficam as tasks
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

# Agendamento recorrente (Celery Beat). Será preenchido no M4, por exemplo:
# celery_app.conf.beat_schedule = {
#     "executar-regua": {
#         "task": "app.worker.tasks.executar_regua",
#         "schedule": crontab(minute="*/15", hour="8-19", day_of_week="1-5"),
#     },
# }