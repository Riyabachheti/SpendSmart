from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "spendsmart",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks.receipt_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_publish_retry=True,
    task_publish_retry_policy={
        "max_retries": 3,
        "interval_start": 0,
        "interval_step": 0.5,
        "interval_max": 2,
    },
)
