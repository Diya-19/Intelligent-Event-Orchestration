import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

_redis_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "event_orchestrator",
    broker=_redis_url,
    backend=_redis_url,
    include=["app.tasks.communication_tasks", "app.tasks.consolidate_scores_task", "app.tasks.event_workflow_tasks"]
)

# Optional but recommended settings
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

celery_app.autodiscover_tasks(["app"])