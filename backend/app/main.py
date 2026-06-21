from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

# Auth
from app.routers import auth

# Committee Routers
from app.routers.committee import (
    events,
    participants,
    dashboard,
    rules,
    teams,
    results,
    travel_logistics,
    communications,
    activity_logs,
    approvals,
    evaluators,
    scores,
)


# Portal Routers
# from app.routers.portal import participant as portal_participant
# from app.routers.portal import evaluator as portal_evaluator
from app.routers.portal import judge, judge_evaluations
from app.routers.committee import travel_logistics
from app.routers.portal import participant as portal_participant
from app.websocket_manager import manager


app = FastAPI(title="Event Orchestration API", version="1.0.0")
_allowed_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    settings.FRONTEND_URL,
]

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    #allow_origins=["http://localhost:5173"], # Your Vite frontend
    allow_origins=_allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---

# Auth
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])

# Committee API
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(events.router, prefix="/api/events", tags=["Events"])
app.include_router(participants.router, prefix="/api/events", tags=["Participants"])
app.include_router(teams.router, prefix="/api/events/{event_id}/teams", tags=["teams"])
app.include_router(approvals.router, prefix="/api/approvals", tags=["Approvals"])
app.include_router(evaluators.router, prefix="/api/events/{event_id}/evaluators",tags=["Evaluators"])
app.include_router(scores.router, prefix="/api/events/{event_id}/scores", tags=["scores"])
app.include_router(activity_logs.router, prefix="/api/activity-logs", tags=["Activity Logs"])
app.include_router(communications.router, prefix="/api/events/{event_id}/communications", tags=["communications"])
app.include_router(rules.router, prefix="/api/events", tags=["rules"])
app.include_router( results.router, prefix="/api/results", tags=["Results"])
app.include_router( travel_logistics.router, prefix="/api/travel-logistics", tags=["Travel Logistics"])

# Public/Portal API
from app.routers.portal import participant as portal_participant
from app.routers.portal import travel as portal_travel
from app.routers.portal import notifications as portal_notifications
app.include_router(portal_participant.router, prefix="/api/participant", tags=["Portal - Participant"])
app.include_router(portal_notifications.router, prefix="/api/participant/notifications", tags=["Portal - Participant Notifications"])
app.include_router(portal_travel.router, prefix="/api/participant/travel", tags=["Portal - Participant Travel"])
# app.include_router(portal_evaluator.router, prefix="/api/portal/evaluator", tags=["Portal - Evaluator"])

from app.routers.portal import chat as portal_chat
app.include_router(portal_chat.router, prefix="/api/participant/chat", tags=["Portal - Chat"])
#app.include_router(portal_evaluator.router, prefix="/api/portal/evaluator", tags=["Portal - Evaluator"])
# Fallback mounts without /api prefix (handles WS connections routed via Vercel edge)
app.include_router(portal_participant.router, prefix="/participant", tags=["Portal - Participant Alt"])
app.include_router(portal_chat.router, prefix="/participant/chat", tags=["Portal - Chat Alt"])

# Judge Portal Routers
from app.routers.portal import judge, judge_evaluations
from app.routers.portal import judge as portal_judge
app.include_router(portal_judge.router, prefix="/api/judge", tags=["Judge Portal"])
app.include_router(judge_evaluations.router, prefix="/api/judge/evaluations", tags=["Judge Portal"])


@app.websocket("/ws/events/{event_id}/scoring")
async def websocket_endpoint(websocket: WebSocket, event_id: str):
    await manager.connect(websocket, event_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, event_id)

@app.websocket("/events/{event_id}/scoring")
async def websocket_endpoint_alt(websocket: WebSocket, event_id: str):
    await manager.connect(websocket, event_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, event_id)
        manager.disconnect(websocket, event_id)