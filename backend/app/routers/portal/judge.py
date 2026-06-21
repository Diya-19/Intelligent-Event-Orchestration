from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import require_evaluator
from app.models.evaluator import Evaluator
from app.services import judge_service

router = APIRouter()

@router.get("/profile")
def get_judge_profile(
    evaluator: dict = Depends(require_evaluator),
    db: Session = Depends(get_db)
):
    ev = db.get(Evaluator, evaluator["evaluator_id"])
    if not ev:
        return {}
    return {
        "name": ev.name,
        "email": ev.email,
        "organization": ev.organization or "",
        "expertise": ev.expertise or "",
    }

@router.get("/dashboard")
def get_judge_dashboard(
    evaluator: dict = Depends(require_evaluator),
    db: Session = Depends(get_db)
):
    """
    Returns the dashboard statistics for the currently authenticated judge.
    """
    return judge_service.get_dashboard_stats(db, evaluator)