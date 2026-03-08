"""WebSocket endpoint for real-time threat streaming (Issue #6)."""
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.models import IntelItem

logger = logging.getLogger("catshy.ws_threats")
router = APIRouter()

# Connected clients
_clients: set[WebSocket] = set()


async def _authenticate_ws(token: Optional[str]) -> Optional[dict]:
    """Validate JWT token from WebSocket query param."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None


@router.websocket("/stream")
async def threat_stream(websocket: WebSocket, token: Optional[str] = Query(None)):
    """WebSocket endpoint for real-time threat events.
    Connect: ws://host/api/threats/stream?token=<jwt>
    Sends new IntelItems as they arrive, polled every 5 seconds.
    """
    # Authenticate
    payload = await _authenticate_ws(token)
    if not payload:
        await websocket.close(code=4001, reason="Authentication required")
        return

    await websocket.accept()
    _clients.add(websocket)
    logger.info("WebSocket client connected (user=%s)", payload.get("sub"))

    last_check = datetime.now(timezone.utc)

    try:
        while True:
            # Poll for new items since last check
            try:
                async with async_session() as db:
                    result = await db.execute(
                        select(IntelItem)
                        .where(IntelItem.fetched_at >= last_check)
                        .order_by(IntelItem.fetched_at.desc())
                        .limit(50)
                    )
                    new_items = result.scalars().all()

                if new_items:
                    events = []
                    for item in new_items:
                        events.append({
                            "id": str(item.id),
                            "title": item.title,
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
                            "fetched_at": item.fetched_at.isoformat() if item.fetched_at else None,
                            "tags": item.tags or [],
                        })
                    await websocket.send_json({"type": "threat_batch", "events": events})
                    last_check = datetime.now(timezone.utc)

            except Exception as e:
                logger.error("Error polling for new threats: %s", e)

            # Check for client messages (pause/resume/filters)
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
                data = json.loads(msg)
                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif data.get("type") == "pause":
                    # Wait until resume
                    while True:
                        msg = await websocket.receive_text()
                        data = json.loads(msg)
                        if data.get("type") == "resume":
                            break
            except asyncio.TimeoutError:
                # Normal — no message from client, continue polling
                pass

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected (user=%s)", payload.get("sub"))
    except Exception as e:
        logger.error("WebSocket error: %s", e)
    finally:
        _clients.discard(websocket)


async def broadcast_threat_event(event: dict):
    """Broadcast a threat event to all connected WebSocket clients.
    Call this from the ingestion pipeline when new items are created."""
    dead = set()
    for ws in _clients:
        try:
            await ws.send_json({"type": "threat_event", "event": event})
        except Exception:
            dead.add(ws)
    _clients -= dead
