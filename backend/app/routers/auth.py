from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
import os
import uuid
from datetime import timedelta

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

from app.db import get_db
from app.models.committee_user import CommitteeUser
from app.models.evaluator import Evaluator
from app.models.participant import Participant
from app.services.token_service import create_access_token, verify_token
from app.config import settings

from app.auth import require_committee
# Re-export under the legacy name so Stage 1 routers that still reference
# get_current_committee_user continue to work without modification.
get_current_committee_user = require_committee

router = APIRouter()

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
_bearer = HTTPBearer()


# ---------- Pydantic schemas ----------

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class JudgeLinkRequest(BaseModel):
    email: EmailStr
    event_id: str

class ParticipantLinkRequest(BaseModel):
    email: EmailStr
    event_id: str = ""



# ---------- Endpoints ----------

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    if len(body.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters",
        )
    if db.query(CommitteeUser).filter(CommitteeUser.email == body.email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = CommitteeUser(
        name=body.name,
        email=body.email,
        hashed_password=_pwd.hash(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": f"committee:{user.id}", "email": user.email})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(CommitteeUser).filter(CommitteeUser.email == body.email).first()

    print("EMAIL:", body.email)
    print("PASSWORD LENGTH:", len(body.password))

    if not user or not _pwd.verify(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    token = create_access_token({"sub": f"committee:{user.id}", "email": user.email})
    return TokenResponse(access_token=token)

@router.get("/verify-judge", response_model=TokenResponse)
def verify_judge(token: str, db: Session = Depends(get_db)):
    evaluator = db.query(Evaluator).filter(Evaluator.access_token == token).first()
    if not evaluator:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired invitation link",
        )
    # Return the raw token exactly as expected by the require_evaluator dependency
    return TokenResponse(access_token=token)


@router.post("/request-judge-link", status_code=status.HTTP_200_OK)
def request_judge_link(body: JudgeLinkRequest, db: Session = Depends(get_db)):
    """
    Allows a judge to request a new magic-link email when their original link
    has expired or been lost. Always returns the same generic message to avoid
    revealing whether an email is registered (anti-enumeration).
    """
    _GENERIC_RESPONSE = {"message": "If that email is registered as a judge, you'll receive a login link shortly."}

    evaluator = (
        db.query(Evaluator)
        .filter(Evaluator.email == body.email)
        .first()
    )
    if not evaluator:
        return _GENERIC_RESPONSE

    # Rotate the token
    token = create_access_token(
        {"sub": f"evaluator:{evaluator.id}", "event": body.event_id},
        expires_delta=timedelta(days=30),
    )
    evaluator.access_token = token
    db.commit()

    frontend_base = settings.FRONTEND_URL
    login_url = f"{frontend_base}/login?token={token}"

    if settings.DEV_MODE:
        print(f"\n{'='*60}")
        print(f"DEV MODE — judge login link for {evaluator.email}:")
        print(f"  {login_url}")
        print(f"{'='*60}\n")
        return _GENERIC_RESPONSE

    try:
        sg = SendGridAPIClient(os.environ.get("SENDGRID_API_KEY", ""))
        from_email = os.environ.get("FROM_EMAIL", "agrawaldiya80@gmail.com")
        if not from_email:
            raise ValueError("FROM_EMAIL env var is not set")
        message = Mail(
            from_email=from_email,
            to_emails=evaluator.email,
            subject="Your HackFlow Judge Portal Link",
            html_content=(
                f"<p>Hi {evaluator.name},</p>"
                f"<p>Here is your personal judge portal link:</p>"
                f"<p><a href='{login_url}'>{login_url}</a></p>"
                f"<p style='color:#6b7280;font-size:0.875rem;'>This link is valid for 30 days.</p>"
            ),
        )
        sg.send(message)
    except Exception as e:
        print(f"ERROR: Failed to send judge link email to {evaluator.email}: {e}")

    return _GENERIC_RESPONSE

@router.post("/participant-login", response_model=TokenResponse)
def participant_login(body: LoginRequest, db: Session = Depends(get_db)):

    print("EMAIL RECEIVED:", body.email)
    print("PASSWORD RECEIVED:", body.password)

    participant = db.query(Participant).filter(
        Participant.email == body.email
    ).first()

    print("PARTICIPANT FOUND:", participant)

    if participant:
        print("DB TOKEN:", participant.portal_token)

@router.post("/participant-login", response_model=TokenResponse)
def participant_login(body: LoginRequest, db: Session = Depends(get_db)):
    participant = db.query(Participant).filter(Participant.email == body.email).first()
    if not participant or participant.portal_token != body.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    token = create_access_token({
        "sub": f"participant:{participant.id}",
        "email": participant.email,
        "role": "participant"
    })
    return TokenResponse(access_token=token)


@router.get("/verify-participant", response_model=TokenResponse)
def verify_participant(token: str, db: Session = Depends(get_db)):
    participant = db.query(Participant).filter(Participant.portal_token == token).first()
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access link",
        )
    session_token = create_access_token({
        "sub": f"participant:{participant.id}",
        "email": participant.email,
        "role": "participant",
    })
    return TokenResponse(access_token=session_token)


@router.post("/request-participant-link", status_code=status.HTTP_200_OK)
def request_participant_link(body: ParticipantLinkRequest, db: Session = Depends(get_db)):
    _GENERIC = {"message": "If that email is registered as a participant, you'll receive a login link shortly."}

    participant = db.query(Participant).filter(Participant.email == body.email).first()
    if not participant:
        return _GENERIC

    token = create_access_token(
        {"sub": f"participant:{participant.id}", "event": body.event_id},
        expires_delta=timedelta(days=30),
    )
    participant.portal_token = token
    db.commit()

    frontend_base = settings.FRONTEND_URL
    login_url = f"{frontend_base}/login?participant_token={token}"

    try:
        sg = SendGridAPIClient(os.environ.get("SENDGRID_API_KEY", ""))
        from_email = os.environ.get("FROM_EMAIL", "agrawaldiya80@gmail.com")
        if not from_email:
            raise ValueError("FROM_EMAIL env var is not set")
        message = Mail(
            from_email=from_email,
            to_emails=participant.email,
            subject="Your HackFlow Participant Portal Link",
            html_content=(
                f"<p>Hi {participant.name},</p>"
                f"<p>Here is your personal participant portal link:</p>"
                f"<p><a href='{login_url}'>{login_url}</a></p>"
                f"<p style='color:#6b7280;font-size:0.875rem;'>This link is valid for 30 days.</p>"
            ),
        )
        sg.send(message)
    except Exception as e:
        print(f"ERROR: Failed to send participant link email to {participant.email}: {e}")

    return _GENERIC
