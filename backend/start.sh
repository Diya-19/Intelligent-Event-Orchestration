#!/bin/bash
# Start Celery worker in background, then start FastAPI
celery -A app.celery_app.celery_app worker --loglevel=info &
uvicorn app.main:app --host 0.0.0.0 --port $PORT