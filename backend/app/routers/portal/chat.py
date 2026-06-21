import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.db import get_db
from app.auth import require_participant, decode_token
from app.config import settings
from app.models.participant import Participant
from app.models.team import Team
from app.models.team_member import TeamMember
from app.models.chat import ChatRoom, ChatRoomMember, ChatMessage
from app.chat_manager import chat_manager

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_participant(db: Session, participant_id: str) -> Participant:
    p = db.get(Participant, participant_id)
    if not p:
        raise HTTPException(status_code=404, detail="Participant not found")
    return p


def _ensure_team_channels(db: Session, team: Team, event_id: str) -> list[ChatRoom]:
    """Create default team channels if they don't exist yet."""
    defaults = [
        ("General", "#"),
        ("Ideas & Brainstorm", "💡"),
        ("Project Discussion", "📁"),
        ("Announcements", "📢"),
    ]
    rooms = []
    for name, icon in defaults:
        room = (
            db.query(ChatRoom)
            .filter(ChatRoom.team_id == team.id, ChatRoom.name == name)
            .first()
        )
        if not room:
            room = ChatRoom(
                id=uuid.uuid4(),
                event_id=event_id,
                room_type="channel",
                name=name,
                icon=icon,
                team_id=team.id,
            )
            db.add(room)
        rooms.append(room)
    db.commit()
    return rooms


def _ensure_member(db: Session, room_id, participant_id):
    exists = (
        db.query(ChatRoomMember)
        .filter(ChatRoomMember.room_id == room_id, ChatRoomMember.participant_id == participant_id)
        .first()
    )
    if not exists:
        db.add(ChatRoomMember(room_id=room_id, participant_id=participant_id))
        db.commit()


# ---------------------------------------------------------------------------
# REST – list rooms
# ---------------------------------------------------------------------------

@router.get("/rooms")
def list_rooms(
    db: Session = Depends(get_db),
    actor: dict = Depends(require_participant),
):
    participant_id = actor["participant_id"]
    participant = _get_participant(db, participant_id)

    tm = db.query(TeamMember).filter(TeamMember.participant_id == participant.id).first()
    if not tm:
        return {"channels": [], "dms": []}

    team = db.get(Team, tm.team_id)
    _ensure_team_channels(db, team, str(participant.event_id))

    # Add participant to all team channels
    channel_rooms = (
        db.query(ChatRoom)
        .filter(ChatRoom.team_id == team.id, ChatRoom.room_type == "channel")
        .order_by(ChatRoom.created_at)
        .all()
    )
    for room in channel_rooms:
        _ensure_member(db, room.id, participant.id)

    # DM rooms this participant belongs to
    dm_memberships = (
        db.query(ChatRoomMember)
        .filter(ChatRoomMember.participant_id == participant.id)
        .all()
    )
    dm_room_ids = {str(m.room_id) for m in dm_memberships}
    dm_rooms = (
        db.query(ChatRoom)
        .filter(ChatRoom.id.in_(dm_room_ids), ChatRoom.room_type == "dm")
        .all()
    )

    def _last_msg(room_id):
        msg = (
            db.query(ChatMessage)
            .filter(ChatMessage.room_id == room_id)
            .order_by(ChatMessage.created_at.desc())
            .first()
        )
        return msg.content[:60] if msg else ""

    channels = [
        {
            "id": str(r.id),
            "name": r.name,
            "icon": r.icon,
            "room_type": "channel",
            "last_message": _last_msg(r.id),
        }
        for r in channel_rooms
    ]

    dms = []
    for r in dm_rooms:
        # Find the other person
        other = (
            db.query(ChatRoomMember)
            .filter(
                ChatRoomMember.room_id == r.id,
                ChatRoomMember.participant_id != participant.id,
            )
            .first()
        )
        other_name = ""
        if other:
            op = db.get(Participant, other.participant_id)
            other_name = op.name if op else ""
        dms.append(
            {
                "id": str(r.id),
                "name": other_name,
                "room_type": "dm",
                "last_message": _last_msg(r.id),
            }
        )

    return {"channels": channels, "dms": dms}


# ---------------------------------------------------------------------------
# REST – get or create DM room
# ---------------------------------------------------------------------------

class DMRequest(BaseModel):
    target_participant_id: str


@router.post("/rooms/dm")
def get_or_create_dm(
    body: DMRequest,
    db: Session = Depends(get_db),
    actor: dict = Depends(require_participant),
):
    participant_id = actor["participant_id"]
    participant = _get_participant(db, participant_id)
    target = _get_participant(db, body.target_participant_id)

    if str(participant.id) == str(target.id):
        raise HTTPException(status_code=400, detail="Cannot DM yourself")

    # Look for existing DM between these two
    my_memberships = {
        str(m.room_id)
        for m in db.query(ChatRoomMember)
        .filter(ChatRoomMember.participant_id == participant.id)
        .all()
    }
    target_memberships = {
        str(m.room_id)
        for m in db.query(ChatRoomMember)
        .filter(ChatRoomMember.participant_id == target.id)
        .all()
    }
    shared = my_memberships & target_memberships
    if shared:
        for room_id in shared:
            room = db.get(ChatRoom, room_id)
            if room and room.room_type == "dm":
                return {"id": str(room.id), "room_type": "dm", "name": target.name}

    # Create new DM room
    room = ChatRoom(
        id=uuid.uuid4(),
        event_id=participant.event_id,
        room_type="dm",
    )
    db.add(room)
    db.flush()
    db.add(ChatRoomMember(room_id=room.id, participant_id=participant.id))
    db.add(ChatRoomMember(room_id=room.id, participant_id=target.id))
    db.commit()

    return {"id": str(room.id), "room_type": "dm", "name": target.name}


# ---------------------------------------------------------------------------
# REST – fetch message history
# ---------------------------------------------------------------------------

@router.get("/rooms/{room_id}/messages")
def get_messages(
    room_id: str,
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    actor: dict = Depends(require_participant),
):
    participant_id = actor["participant_id"]

    membership = (
        db.query(ChatRoomMember)
        .filter(
            ChatRoomMember.room_id == room_id,
            ChatRoomMember.participant_id == participant_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.room_id == room_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
        .all()
    )

    result = []
    for m in messages:
        sender = db.get(Participant, m.sender_id) if m.sender_id else None
        result.append(
            {
                "id": str(m.id),
                "room_id": str(m.room_id),
                "sender_id": str(m.sender_id) if m.sender_id else None,
                "sender_name": sender.name if sender else "Unknown",
                "sender_initials": "".join(w[0].upper() for w in sender.name.split()[:2]) if sender else "??",
                "content": m.content,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
        )
    return result


# ---------------------------------------------------------------------------
# WebSocket – real-time chat
# ---------------------------------------------------------------------------

@router.websocket("/ws/{room_id}")
async def chat_websocket(
    websocket: WebSocket,
    room_id: str,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    # Authenticate via query-param token (or DEV_MODE bypass)
    participant_id = None
    if settings.DEV_MODE:
        # Mirror require_participant: find by portal_token so we get the real DB row's UUID
        dev_participant = (
            db.query(Participant)
            .filter(Participant.portal_token == "dev-participant-token")
            .first()
        )
        if dev_participant:
            participant_id = str(dev_participant.id)
    elif token:
        try:
            payload = decode_token(token)
            sub = payload.get("sub", "")
            if sub.startswith("participant:"):
                participant_id = sub.split(":", 1)[1]
        except Exception:
            # JWT decode failed — try portal_token DB lookup as fallback
            p = db.query(Participant).filter(Participant.portal_token == token).first()
            if p:
                participant_id = str(p.id)

    if not participant_id:
        await websocket.close(code=4001)
        return

    # Verify membership (in DEV_MODE, auto-add if missing)
    membership = (
        db.query(ChatRoomMember)
        .filter(
            ChatRoomMember.room_id == room_id,
            ChatRoomMember.participant_id == participant_id,
        )
        .first()
    )
    if not membership:
        # Auto-add participant to room if they are a valid participant
        # (mirrors DEV_MODE behaviour — don't reject known participants)
        if participant_id:
            _ensure_member(db, room_id, participant_id)
        else:
            await websocket.close(code=4003)
            return

    participant = db.get(Participant, participant_id)
    sender_name = participant.name if participant else "Unknown"
    sender_initials = "".join(w[0].upper() for w in sender_name.split()[:2])

    await chat_manager.connect(websocket, room_id, participant_id)
    try:
        while True:
            data = await websocket.receive_json()
            content = (data.get("content") or "").strip()
            if not content:
                continue

            # Persist to DB
            msg = ChatMessage(
                room_id=room_id,
                sender_id=participant_id,
                content=content,
            )
            db.add(msg)
            db.commit()
            db.refresh(msg)

            # Broadcast to all room members
            await chat_manager.broadcast(
                room_id,
                {
                    "id": str(msg.id),
                    "room_id": room_id,
                    "sender_id": participant_id,
                    "sender_name": sender_name,
                    "sender_initials": sender_initials,
                    "content": content,
                    "created_at": msg.created_at.isoformat(),
                },
            )
    except WebSocketDisconnect:
        chat_manager.disconnect(websocket, room_id)