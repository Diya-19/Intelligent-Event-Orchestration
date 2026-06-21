import os
import ssl
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

_redis_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")

_is_tls = _redis_url.startswith("rediss://")
_ssl_opts = {"ssl_cert_reqs": ssl.CERT_NONE} if _is_tls else None

celery_app = Celery(
    "event_orchestrator",
    broker=_redis_url,
    backend=_redis_url,
    include=["app.tasks.communication_tasks", "app.tasks.consolidate_scores_task", "app.tasks.event_workflow_tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    broker_use_ssl=_ssl_opts,
    redis_backend_use_ssl=_ssl_opts,
)

celery_app.autodiscover_tasks(["app"])