from app.config import settings
from datetime import date, time
from pydantic import BaseModel
from app.models.support_request import SupportRequest
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth import require_participant
from app.models.participant import Participant
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.event import Event
from fastapi import WebSocket, WebSocketDisconnect
from app.websocket_manager import manager

router = APIRouter()

import asyncio

SUPPORT_WS_ROOM = "support"

@router.websocket("/ws/support")
async def support_websocket(websocket: WebSocket):
    await manager.connect(websocket, SUPPORT_WS_ROOM)
    try:
        while True:
            await asyncio.sleep(30)
    except Exception:
        pass
    finally:
        manager.disconnect(websocket, SUPPORT_WS_ROOM)


@router.get("/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    actor: dict = Depends(require_participant)
):
    participant_id = actor["participant_id"]
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
        
    event = db.query(Event).filter(Event.id == participant.event_id).first()
    
    # Get Team logic
    tm = db.query(TeamMember).filter(TeamMember.participant_id == participant.id).first()
    
    team_data = None
    members_data = []
    
    if tm:
        team = db.query(Team).filter(Team.id == tm.team_id).first()
        if team:
            team_data = {
                "id": str(team.id),
                "name": team.name,
                "registration_id": None,
                "is_qualified_round_3": True
            }
            
            # Fetch all members of this team
            team_members = db.query(TeamMember).filter(TeamMember.team_id == team.id).all()
            for member in team_members:
                p = db.query(Participant).filter(Participant.id == member.participant_id).first()
                if p:
                    members_data.append({
                        "id": str(p.id),
                        "name": p.name
                    })

    # Prepare event data safely checking config
    config = event.config or {} if event else {}
    schedule = config.get("schedule", {})
    
    return {
        "participant": {
            "id": str(participant.id),
            "name": participant.name,
            "email": participant.email
        },
        "team": team_data,
        "members": members_data,
        "event": {
            "name": event.name if event else "",
            "theme": config.get("theme", ""),
            "current_stage": event.current_stage if event else "",
            "start_date": schedule.get("start_date", ""),
            "end_date": schedule.get("end_date", ""),
            "submission_deadline": schedule.get("submission_deadline", ""),
            "evaluation_start": schedule.get("evaluation_start", "")
        }
    }

@router.get("/team")
def get_team_details(
    db: Session = Depends(get_db),
    actor: dict = Depends(require_participant)
):
    participant_id = actor["participant_id"]
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
        
    tm = db.query(TeamMember).filter(TeamMember.participant_id == participant.id).first()
    if not tm:
        return {"team": None, "track": None, "members": []}

    team = db.query(Team).filter(Team.id == tm.team_id).first()
    if not team:
        return {"team": None, "track": None, "members": []}

    members_data = []
    team_members = db.query(TeamMember).filter(TeamMember.team_id == team.id).all()
    for member in team_members:
        p = db.query(Participant).filter(Participant.id == member.participant_id).first()
        if p:
            members_data.append({
                "id": str(p.id),
                "name": p.name,
                "email": p.email,
                "institution": p.institution or "",
                "skills": p.skills or []
            })
            
    # Mock track/mentor since these relationships may not explicitly exist yet or are handled differently
    # The prompt says: "Only return fields that already exist in DB. If mentor/track are unavailable: return null."
    track_data = None
    if team.challenge:
        track_data = {
            "id": "challenge",
            "name": team.challenge
        }

    return {
        "team": {
            "id": str(team.id),
            "name": team.name,
            "registration_id": None
        },
        "track": track_data,
        "members": members_data
    }

from pydantic import BaseModel
from typing import Optional
from app.models.submission import Submission
from typing import Optional
from datetime import date

class SubmissionUpdate(BaseModel):
    github_link: Optional[str] = None
    project_description: Optional[str] = None
    presentation_url: Optional[str] = None
    demo_video_url: Optional[str] = None
    is_final_submitted: Optional[bool] = False
    participant_notes: Optional[str] = None

class SupportRequestCreate(BaseModel):
    issue_type: str
    priority: str
    conflict_date: Optional[date] = None
    duration: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    description: str
    notify_admin: bool = True

def calculate_submission_status(github_link, project_description, presentation_url, demo_video_url):
    progress = 0
    if github_link: progress += 25
    if project_description: progress += 25
    if presentation_url: progress += 25
    if demo_video_url: progress += 25
    
    if progress == 0:
        return "DRAFT"
    elif progress < 100:
        return "IN_PROGRESS"
    else:
        return "READY"

@router.get("/submission")
def get_submission(
    db: Session = Depends(get_db),
    actor: dict = Depends(require_participant)
):
    participant_id = actor["participant_id"]
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
        
    tm = db.query(TeamMember).filter(TeamMember.participant_id == participant.id).first()
    if not tm:
        return None

    submission = db.query(Submission).filter(Submission.team_id == tm.team_id).first()
    if not submission:
        return None
        
    return {
        "id": str(submission.id),
        "team_id": str(submission.team_id),
        "event_id": str(submission.event_id),
        "github_link": submission.github_link,
        "project_description": submission.project_description,
        "presentation_url": submission.presentation_url,
        "demo_video_url": submission.demo_video_url,
        "status": submission.status,
        "participant_notes": submission.participant_notes,
        "created_at": submission.created_at,
        "updated_at": submission.updated_at
    }

@router.post("/submission")
def save_submission(
    data: SubmissionUpdate,
    db: Session = Depends(get_db),
    actor: dict = Depends(require_participant)
):
    participant_id = actor["participant_id"]
    participant = db.query(Participant).filter(Participant.id == participant_id).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")
        
    tm = db.query(TeamMember).filter(TeamMember.participant_id == participant.id).first()
    if not tm:
        raise HTTPException(status_code=404, detail="Not assigned to a team")
        
    submission = db.query(Submission).filter(Submission.team_id == tm.team_id).first()
    
    if submission:
        if data.github_link is not None:
            submission.github_link = data.github_link
        if data.project_description is not None:
            submission.project_description = data.project_description
        if data.presentation_url is not None:
            submission.presentation_url = data.presentation_url
        if data.demo_video_url is not None:
            submission.demo_video_url = data.demo_video_url
        if data.participant_notes is not None:
            submission.participant_notes = data.participant_notes
        
        calculated_status = calculate_submission_status(
            submission.github_link,
            submission.project_description,
            submission.presentation_url,
            submission.demo_video_url
        )

        if data.is_final_submitted:
            if not (submission.github_link and submission.project_description and submission.presentation_url and submission.demo_video_url):
                raise HTTPException(
                    status_code=400,
                    detail="All deliverables must be completed before final submission"
                )
            submission.status = "SUBMITTED"
        elif submission.status != "SUBMITTED":
            submission.status = calculated_status
    else:
        calculated_status = calculate_submission_status(
            data.github_link,
            data.project_description,
            data.presentation_url,
            data.demo_video_url
        )
        if data.is_final_submitted:
            if not (data.github_link and data.project_description and data.presentation_url and data.demo_video_url):
                raise HTTPException(
                    status_code=400,
                    detail="All deliverables must be completed before final submission"
                )
            status_val = "SUBMITTED"
        else:
            status_val = calculated_status
            
        submission = Submission(
            team_id=tm.team_id,
            event_id=participant.event_id,
            github_link=data.github_link,
            project_description=data.project_description,
            presentation_url=data.presentation_url,
            demo_video_url=data.demo_video_url,
            participant_notes=data.participant_notes,
            status=status_val
        )
        db.add(submission)
        
    db.commit()
    db.refresh(submission)
    
    return {
        "id": str(submission.id),
        "team_id": str(submission.team_id),
        "event_id": str(submission.event_id),
        "github_link": submission.github_link,
        "project_description": submission.project_description,
        "presentation_url": submission.presentation_url,
        "demo_video_url": submission.demo_video_url,
        "status": submission.status,
        "participant_notes": submission.participant_notes,
        "created_at": submission.created_at,
        "updated_at": submission.updated_at
    }

@router.post("/support-requests")
async def create_support_request(
    
    data: SupportRequestCreate,
    db: Session = Depends(get_db)
):
    print("CREATE SUPPORT REQUEST HIT")
   # if not settings.DEV_MODE:
   #     raise HTTPException(
   #         status_code=403,
   #         detail="Auth required outside DEV_MODE"
   #     )

    support_request = SupportRequest(
        issue_type=data.issue_type,
        priority=data.priority,
        conflict_date=data.conflict_date,
        duration=data.duration,
        start_time=data.start_time,
        end_time=data.end_time,
        description=data.description,
        notify_admin=data.notify_admin,
        status="Under Review"
    )

    db.add(support_request)
    db.commit()
    db.refresh(support_request)

    await manager.broadcast_to_event(SUPPORT_WS_ROOM, {
        "type": "new_support_request",
        "id": support_request.id,
        "issue_type": support_request.issue_type,
        "priority": support_request.priority,
        "description": support_request.description,
    })

    return {
        "id": support_request.id,
        "status": support_request.status,
        "message": "Request submitted successfully"
    }


@router.get("/support-requests")
def get_support_requests(db: Session = Depends(get_db)):
    requests = (
        db.query(SupportRequest)
        .order_by(SupportRequest.created_at.desc())
        .all()
    )

    return [
        {
            "id": r.id,
            "issue_type": r.issue_type,
            "priority": r.priority,
            "description": r.description,
            "status": r.status,
            "created_at": r.created_at,
        }
        for r in requests
    ]

@router.delete("/support-requests/{request_id}")
def delete_support_request(
    request_id: int,
    db: Session = Depends(get_db)
):
    request = (
        db.query(SupportRequest)
        .filter(SupportRequest.id == request_id)
        .first()
    )

    if not request:
        raise HTTPException(
            status_code=404,
            detail="Support request not found"
        )

    db.delete(request)
    db.commit()

    return {"message": "Deleted successfully"}