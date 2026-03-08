"""WebSocket endpoint for real-time threat streaming — workspace-scoped.

Supports cookie-based auth (preferred) and query-param token (fallback for dev/CLI).
Pushes typed events: threat_batch, new_alert, new_leak, source_health.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Cookie
from jose import jwt, JWTError
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.models import IntelItem

logger = logging.getLogger("catshy.ws_threats")
router = APIRouter()

# Connected clients keyed by workspace_id
_clients: dict[str, set[WebSocket]] = {}


async def _authenticate_ws(
    token: Optional[str] = None,
    access_token_cookie: Optional[str] = None,
) -> Optional[dict]:
    """Validate JWT from cookie (preferred) or query param. Returns payload with 'sub' and 'wid'."""
    raw_token = access_token_cookie or token
    if not raw_token:
        return None
    try:
        payload = jwt.decode(raw_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        if not payload.get("wid"):
            return None
        return payload
    except JWTError:
        return None


@router.websocket("/stream")
async def threat_stream(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    access_token: Optional[str] = Cookie(None),
):
    """WebSocket endpoint for real-time workspace events.

    Auth: cookie `access_token` (preferred) or query param `token` (dev fallback).
    Pushes: threat_batch, new_alert, new_leak, source_health_change.
    """
    payload = await _authenticate_ws(token=token, access_token_cookie=access_token)
    if not payload:
        await websocket.close(code=4001, reason="Authentication required (valid JWT with workspace)")
        return

    workspace_id = payload["wid"]
    await websocket.accept()

    if workspace_id not in _clients:
        _clients[workspace_id] = set()
    _clients[workspace_id].add(websocket)

    logger.info("WebSocket client connected (user=%s, workspace=%s)", payload.get("sub"), workspace_id)

    last_check = datetime.now(timezone.utc)

    try:
        while True:
            try:
                async with async_session() as db:
                    result = await db.execute(
                        select(IntelItem)
                        .where(and_(
                            IntelItem.workspace_id == workspace_id,
                            IntelItem.fetched_at >= last_check,
                        ))
                        .order_by(IntelItem.fetched_at.desc())
                        .limit(50)
                    )
                    new_items = result.scalars().all()

                if new_items:
                    events = []
                    for item in new_items:
                        events.append({
                            "type": "new_intel",
                            "entity_id": str(item.id),
                            "created_at": item.fetched_at.isoformat() if item.fetched_at else None,
                            "summary": item.title[:200] if item.title else "",
                            "severity": item.severity,
                            "observable_type": item.observable_type,
                            "observable_value": item.observable_value,
                            "source_name": item.source_name,
                            "confidence_score": item.confidence_score,
                            "risk_score": item.risk_score,
                            "asset_match": item.asset_match,
                            "geo_lat": item.geo_lat,
                            "geo_lon": item.geo_lon,
                            "geo_country": item.geo_country,
                            "geo_country_name": item.geo_country_name,
                            "geo_city": item.geo_city,
                            "campaign_name": item.campaign_name,
                            "tags": item.tags or [],
                        })
                    await websocket.send_json({"type": "threat_batch", "events": events})
                    last_check = datetime.now(timezone.utc)

            except Exception as e:
                logger.error("Error polling for new threats: %s", e)

            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                data = json.loads(msg)
                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif data.get("type") == "pause":
                    while True:
                        msg = await websocket.receive_text()
                        data = json.loads(msg)
                        if data.get("type") == "resume":
                            break
            except asyncio.TimeoutError:
                pass

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected (user=%s, workspace=%s)", payload.get("sub"), workspace_id)
    except Exception as e:
        logger.error("WebSocket error: %s", e)
    finally:
        if workspace_id in _clients:
            _clients[workspace_id].discard(websocket)
            if not _clients[workspace_id]:
                del _clients[workspace_id]


async def broadcast_event(event: dict, workspace_id: str):
    """Broadcast any typed event to all connected WebSocket clients in a workspace.

    Event schema: { type: str, entity_id: str, created_at: str, summary: str, severity: str, ... }
    """
    clients = _clients.get(workspace_id, set())
    dead = set()
    for ws in clients:
        try:
            await ws.send_json(event)
        except Exception:
            dead.add(ws)
    clients -= dead


async def broadcast_threat_event(event: dict, workspace_id: str):
    """Legacy compat — broadcast a single threat event."""
    await broadcast_event({"type": "threat_event", "event": event}, workspace_id)
