import os
import uuid
from datetime import datetime, timedelta, timezone
from app.celery_app import celery_app
from celery.exceptions import Retry
from sqlalchemy.orm import Session
from sqlalchemy import select

from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from python_http_client.exceptions import HTTPError

from app.db import SessionLocal
from app.models import (
    Communication, CommunicationLog, Participant,
    Evaluator, TeamMember, Team, Event
)
from app.services.token_service import create_access_token
from app.config import settings

def render_template(template: str, context: dict) -> str:
    """Replaces {placeholder} with context values."""
    rendered = template
    for key, value in context.items():
        rendered = rendered.replace(f"{{{key}}}", str(value))
    return rendered

# ==========================================
# RECIPIENT ROUTING STRATEGIES
# ==========================================

def get_participant_recipients(db: Session, event: Event) -> list:
    query = (
        select(Participant, Team.name.label("team_name"))
        .outerjoin(TeamMember, TeamMember.participant_id == Participant.id)
        .outerjoin(Team, Team.id == TeamMember.team_id)
        .where(Participant.event_id == event.id)
    )
    rows = db.execute(query).all()

    recipients = []
    for row in rows:
        p = row.Participant
        token = create_access_token(
            {"sub": f"participant:{p.id}", "event": str(event.id)},
            expires_delta=timedelta(days=30),
        )
        p.portal_token = token
        login_url = f"{settings.FRONTEND_URL}/login?participant_token={token}"
        recipients.append({
            "email": p.email,
            "name": p.name,
            "context": {
                "name": p.name,
                "event_name": event.name,
                "team_name": row.team_name or "Unassigned",
                "action_link": login_url,
            }
        })
    return recipients

def get_judge_recipients(db: Session, event: Event) -> list:
    evaluators = db.execute(select(Evaluator).where(Evaluator.event_id == event.id)).scalars().all()
    recipients = []
    for e in evaluators:
        token = create_access_token(
            {"sub": f"evaluator:{e.id}", "event": str(event.id)},
            expires_delta=timedelta(days=30),
        )
        e.access_token = token
        login_url = f"{settings.FRONTEND_URL}/login?token={token}"
        recipients.append({
            "email": e.email,
            "name": e.name,
            "context": {
                "name": e.name,
                "event_name": event.name,
                "action_link": login_url,
            }
        })
    return recipients

def get_mentor_recipients(db: Session, event: Event) -> list:
    # Placeholder: Your database currently doesn't have a mentors table!
    # return db.execute(select(Mentor)...)
    raise NotImplementedError("Mentor routing is not yet implemented in the database schema.")

# The Routing Dictionary (Strategy Pattern)
RECIPIENT_STRATEGIES = {
    "Participants": get_participant_recipients,
    "Participants (120)": get_participant_recipients, # Catching the frontend's static dropdown label
    "Judges": get_judge_recipients,
    "Mentors": get_mentor_recipients
}

# ==========================================
# MAIN CELERY TASK
# ==========================================

@celery_app.task(name="draft_and_send_emails_task", bind=True, max_retries=3)
def draft_and_send_emails_task(self, event_id_str: str, approval_id_str: str = None):
    db: Session = SessionLocal()
    
    try:
        # 1. Fetch the Communication Record
        if approval_id_str:
            comm = db.execute(
                select(Communication).where(Communication.approval_id == uuid.UUID(approval_id_str))
            ).scalars().first()
        else:
            comm = db.get(Communication, uuid.UUID(event_id_str))

        if not comm:
            return "Communication record not found."

        # 2. Check the Schedule
        now = datetime.now(timezone.utc)
        if comm.scheduled_for and comm.scheduled_for > now:
            comm.status = "scheduled"
            db.commit()
            raise self.retry(eta=comm.scheduled_for)

        comm.status = "sending"
        db.commit()
            
        event = db.get(Event, comm.event_id)
        
        # 3. Dynamic Recipient Routing
        fetch_strategy = RECIPIENT_STRATEGIES.get(comm.recipient_type)
        
        if not fetch_strategy:
            comm.status = "failed"
            db.commit()
            return f"Error: Unknown recipient type '{comm.recipient_type}'"
            
        recipients = fetch_strategy(db, event)

        # 4. Render Templates & Bulk Create Logs (N+1 INSERT Fix)
        # We use standard object creation and db.add_all(), which in SQLAlchemy 2.0
        # automatically utilizes optimized batched 'insertmanyvalues' under the hood.
        logs = []
        for r in recipients:
            logs.append(CommunicationLog(
                communication_id=comm.id,
                recipient_email=r["email"],
                recipient_name=r["name"],
                personalized_body=render_template(comm.body_template, r["context"]),
                status="queued"
            ))
            
        db.add_all(logs)
        db.flush() # Flushes batch to DB to generate UUIDs for logs, but keeps transaction open

        # 5. Dispatch to SendGrid
        sg = SendGridAPIClient(os.environ.get('SENDGRID_API_KEY', 'dummy_key'))
        from_email = os.environ.get('FROM_EMAIL', 'agrawaldiya80@gmail.com')
        api_key = os.environ.get('SENDGRID_API_KEY')
        safe_key = f"{api_key[:5]}...[length:{len(api_key)}]" if api_key else "None"
        print(f"\n--- DEBUG: Celery is using API Key: {safe_key} ---\n")
        print(f"--- DEBUG: Sending FROM: {from_email} ---\n")
        success_count = 0
        
        for log in logs:
            try:
                message = Mail(
                    from_email=from_email,
                    to_emails=log.recipient_email,
                    subject=comm.subject,
                    html_content=log.personalized_body
                )
                response = sg.send(message)
                log.sendgrid_message_id = response.headers.get('X-Message-Id')
                
                # Simulation for current dev environment:
                log.status = "sent" 
                log.sendgrid_message_id = f"sim_sg_{uuid.uuid4().hex[:8]}"
                success_count += 1
            
            except HTTPError as e:
                log.status = "failed"
                # This will extract the actual JSON error message from SendGrid
                error_details = e.body.decode('utf-8') if e.body else str(e)
                log.error = error_details
                
                print(f"\n--- SENDGRID REJECTED THE EMAIL ---")
                print(f"Recipient: {log.recipient_email}")
                print(f"Reason: {error_details}\n")
                
            except Exception as e:
                log.status = "failed"
                log.error = str(e)
                print(f"Failed to send email to {log.recipient_email}: {log.error}")
                
        # 6. Finalize
        #comm.status = "sent"
        #db.commit() # Commits the logs and the final comm.status in one go
        
        comm.status = "dispatched" # Changed from "sent"
        db.commit() 
        
        # WebSocket broadcast happens via the HTTP endpoint to avoid async/sync mismatch
        import requests
        try:
            requests.post(
                f"http://localhost:8000/api/events/{comm.event_id}/scores/broadcast-consolidation",
                timeout=2,
            )
        except Exception:
            pass  # Non-critical — scoring page will refresh on next poll
    
        
        return f"Dispatched {success_count}/{len(recipients)} emails successfully."
        
    except Retry:
        raise
    except NotImplementedError as nie:
        # Catch our specific strategy errors
        db.rollback()
        if 'comm' in locals():
            comm.status = "failed"
            db.commit()
        return str(nie)
    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()


# ==========================================
# JUDGE NOTIFICATION TASK
# ==========================================

def _send_judge_email(sg: SendGridAPIClient, from_email: str, evaluator: Evaluator, event: Event, login_url: str):
    """Send a single magic-link invitation email to an evaluator."""
    subject = f"You're invited to judge: {event.name}"
    html_body = f"""
    <p>Hi {evaluator.name},</p>
    <p>You have been invited to evaluate submissions for <strong>{event.name}</strong>.</p>
    <p>Click the button below to access your judge portal. This link is personal and unique to you.</p>
    <p style="margin: 24px 0;">
      <a href="{login_url}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Open Judge Portal
      </a>
    </p>
    <p style="color:#6b7280;font-size:0.875rem;">
      If the button doesn't work, copy and paste this link into your browser:<br/>
      <a href="{login_url}">{login_url}</a>
    </p>
    <p style="color:#6b7280;font-size:0.875rem;">This link is valid for 30 days.</p>
    """
    message = Mail(
        from_email=from_email,
        to_emails=evaluator.email,
        subject=subject,
        html_content=html_body,
    )
    return sg.send(message)


# ==========================================
# PARTICIPANT NOTIFICATION TASK
# ==========================================

def _send_participant_email(sg: SendGridAPIClient, from_email: str, participant: Participant, event: Event, login_url: str):
    """Send a magic-link invitation email to a participant whose team was approved."""
    subject = f"Your access link for {event.name}"
    html_body = f"""
    <p>Hi {participant.name},</p>
    <p>Great news — your team has been approved for <strong>{event.name}</strong>!</p>
    <p>Click the button below to access your participant portal. This link is personal and unique to you.</p>
    <p style="margin: 24px 0;">
      <a href="{login_url}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        Open Participant Portal
      </a>
    </p>
    <p style="color:#6b7280;font-size:0.875rem;">
      If the button doesn't work, copy and paste this link into your browser:<br/>
      <a href="{login_url}">{login_url}</a>
    </p>
    <p style="color:#6b7280;font-size:0.875rem;">This link is valid for 30 days.</p>
    """
    message = Mail(
        from_email=from_email,
        to_emails=participant.email,
        subject=subject,
        html_content=html_body,
    )
    return sg.send(message)


@celery_app.task(name="notify_participants_task", bind=True, max_retries=3)
def notify_participants_task(self, event_id_str: str):
    db: Session = SessionLocal()
    try:
        event = db.get(Event, uuid.UUID(event_id_str))
        if not event:
            return "Event not found."

        approved_teams = db.execute(
            select(Team).where(Team.event_id == event.id, Team.status == "approved")
        ).scalars().all()

        if not approved_teams:
            return "No approved teams to notify."

        approved_team_ids = [t.id for t in approved_teams]

        members = db.execute(
            select(TeamMember).where(TeamMember.team_id.in_(approved_team_ids))
        ).scalars().all()

        if not members:
            return "No participants in approved teams."

        frontend_base = settings.FRONTEND_URL
        sg = SendGridAPIClient(os.environ.get("SENDGRID_API_KEY", ""))
        from_email = os.environ.get("FROM_EMAIL", "agrawaldiya80@gmail.com")

        success_count = 0
        for member in members:
            participant = db.get(Participant, member.participant_id)
            if not participant:
                continue

            token = create_access_token(
                {"sub": f"participant:{participant.id}", "event": event_id_str},
                expires_delta=timedelta(days=30),
            )
            participant.portal_token = token
            login_url = f"{frontend_base}/login?participant_token={token}"

            try:
                _send_participant_email(sg, from_email, participant, event, login_url)
                success_count += 1
            except HTTPError as e:
                error_details = e.body.decode("utf-8") if e.body else str(e)
                print(f"SendGrid rejected email to {participant.email}: {error_details}")
            except Exception as e:
                print(f"Failed to send email to {participant.email}: {e}")

        db.commit()
        return f"Notified {success_count} participants in approved teams."

    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()


# ==========================================
# JUDGE NOTIFICATION TASK
# ==========================================

@celery_app.task(name="notify_evaluators_task", bind=True, max_retries=3)
def notify_evaluators_task(self, event_id_str: str):
    db: Session = SessionLocal()
    try:
        event = db.get(Event, uuid.UUID(event_id_str))
        if not event:
            return "Event not found."

        evaluators = db.execute(
            select(Evaluator).where(Evaluator.event_id == event.id)
        ).scalars().all()

        if not evaluators:
            return "No evaluators to notify."

        frontend_base = settings.FRONTEND_URL
        sg = SendGridAPIClient(os.environ.get("SENDGRID_API_KEY", ""))
        from_email = os.environ.get("FROM_EMAIL", "agrawaldiya80@gmail.com")

        success_count = 0
        for ev in evaluators:
            # Generate a fresh JWT and persist it — this rotates any old link.
            token = create_access_token(
                {"sub": f"evaluator:{ev.id}", "event": event_id_str},
                expires_delta=timedelta(days=30),
            )
            ev.access_token = token
            login_url = f"{frontend_base}/login?token={token}"

            try:
                _send_judge_email(sg, from_email, ev, event, login_url)
                success_count += 1
            except HTTPError as e:
                error_details = e.body.decode("utf-8") if e.body else str(e)
                print(f"SendGrid rejected email to {ev.email}: {error_details}")
            except Exception as e:
                print(f"Failed to send email to {ev.email}: {e}")

        db.commit()
        return f"Notified {success_count}/{len(evaluators)} evaluators."

    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()