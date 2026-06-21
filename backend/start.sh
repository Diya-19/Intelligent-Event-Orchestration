#!/bin/bash
# Run Celery with solo pool (no forking) to minimize memory on free tier
celery -A app.celery_app.celery_app worker --loglevel=warning --pool=solo --concurrency=1 &
uvicorn app.main:app --host 0.0.0.0 --port $PORT