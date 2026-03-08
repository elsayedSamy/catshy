"""Output connectors router — webhook CRUD, syslog CRUD, test fire, export job history."""
import logging
import uuid
import hashlib
import hmac
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel
from typing import Optional, List

from app.database import get_db
from app.core.deps import get_current_user, get_workspace_id, require_team_admin
from app.models.outputs import WebhookOutput, ExportJob, SyslogOutput
from app.services.encryption import encrypt_api_key, decrypt_api_key, mask_api_key

logger = logging.getLogger("catshy.outputs")
router = APIRouter()

EVENT_TYPES = [
    "new_intel", "new_alert", "new_leak", "vuln_kev",
    "report_generated", "source_failure",
]

# ── Schemas ──

class WebhookCreate(BaseModel):
    name: str
    url: str
    auth_type: str = "none"
    secret: Optional[str] = None
    custom_headers: dict = {}
    event_types: List[str] = []
    enabled: bool = True

class WebhookUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    auth_type: Optional[str] = None
    secret: Optional[str] = None
    custom_headers: Optional[dict] = None
    event_types: Optional[List[str]] = None
    enabled: Optional[bool] = None

class SyslogCreate(BaseModel):
    name: str
    host: str
    port: int = 514
    protocol: str = "udp"
    format: str = "cef"
    event_types: List[str] = []
    enabled: bool = True

class SyslogUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    protocol: Optional[str] = None
    format: Optional[str] = None
    event_types: Optional[List[str]] = None
    enabled: Optional[bool] = None


def _serialize_webhook(w: WebhookOutput) -> dict:
    masked = None
    if w.encrypted_secret:
        try:
            masked = mask_api_key(decrypt_api_key(w.encrypted_secret))
        except Exception:
            masked = "••••••"
    return {
        "id": w.id,
        "name": w.name,
        "url": w.url,
        "auth_type": w.auth_type,
        "masked_secret": masked,
        "custom_headers": w.custom_headers or {},
        "event_types": w.event_types or [],
        "enabled": w.enabled,
        "last_triggered_at": str(w.last_triggered_at) if w.last_triggered_at else None,
        "last_status_code": w.last_status_code,
        "last_error": w.last_error,
        "consecutive_failures": w.consecutive_failures,
        "created_at": str(w.created_at),
    }


def _serialize_syslog(s: SyslogOutput) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "host": s.host,
        "port": s.port,
        "protocol": s.protocol,
        "format": s.format,
        "event_types": s.event_types or [],
        "enabled": s.enabled,
        "last_sent_at": str(s.last_sent_at) if s.last_sent_at else None,
        "last_error": s.last_error,
        "created_at": str(s.created_at),
    }


# ── Webhook CRUD ──

@router.get("/webhooks")
async def list_webhooks(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    result = await db.execute(
        select(WebhookOutput).where(WebhookOutput.workspace_id == wid).order_by(WebhookOutput.created_at.desc())
    )
    return [_serialize_webhook(w) for w in result.scalars().all()]


@router.post("/webhooks")
async def create_webhook(
    req: WebhookCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    wid: str = Depends(get_workspace_id),
):
    invalid = [e for e in req.event_types if e not in EVENT_TYPES]
    if invalid:
        raise HTTPException(400, f"Invalid event types: {invalid}")

    encrypted = encrypt_api_key(req.secret) if req.secret else None
    hook = WebhookOutput(
        workspace_id=wid,
        name=req.name,
        url=req.url,
        auth_type=req.auth_type,
        encrypted_secret=encrypted,
        custom_headers=req.custom_headers,
        event_types=req.event_types,
        enabled=req.enabled,
        created_by=user.id,
    )
    db.add(hook)
    await db.commit()
    await db.refresh(hook)
    logger.info(f"Webhook '{req.name}' created for workspace {wid}")
    return _serialize_webhook(hook)


@router.put("/webhooks/{webhook_id}")
async def update_webhook(
    webhook_id: str,
    req: WebhookUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    wid: str = Depends(get_workspace_id),
):
    result = await db.execute(
        select(WebhookOutput).where(WebhookOutput.id == webhook_id, WebhookOutput.workspace_id == wid)
    )
    hook = result.scalar_one_or_none()
    if not hook:
        raise HTTPException(404, "Webhook not found")

    if req.name is not None: hook.name = req.name
    if req.url is not None: hook.url = req.url
    if req.auth_type is not None: hook.auth_type = req.auth_type
    if req.secret is not None: hook.encrypted_secret = encrypt_api_key(req.secret)
    if req.custom_headers is not None: hook.custom_headers = req.custom_headers
    if req.event_types is not None: hook.event_types = req.event_types
    if req.enabled is not None: hook.enabled = req.enabled
    hook.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(hook)
    return _serialize_webhook(hook)


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    wid: str = Depends(get_workspace_id),
):
    result = await db.execute(
        select(WebhookOutput).where(WebhookOutput.id == webhook_id, WebhookOutput.workspace_id == wid)
    )
    hook = result.scalar_one_or_none()
    if not hook:
        raise HTTPException(404, "Webhook not found")
    await db.delete(hook)
    await db.commit()
    return {"message": "Webhook deleted"}


@router.post("/webhooks/{webhook_id}/test")
async def test_webhook(
    webhook_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    wid: str = Depends(get_workspace_id),
):
    """Fire a test event to the webhook endpoint."""
    result = await db.execute(
        select(WebhookOutput).where(WebhookOutput.id == webhook_id, WebhookOutput.workspace_id == wid)
    )
    hook = result.scalar_one_or_none()
    if not hook:
        raise HTTPException(404, "Webhook not found")

    test_payload = {
        "event": "test",
        "source": "catshy",
        "workspace_id": wid,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": "This is a test event from CATSHY.",
    }

    import httpx
    headers = {"Content-Type": "application/json", "User-Agent": "CATSHY-Webhook/1.0"}
    headers.update(hook.custom_headers or {})

    # Auth
    secret = None
    if hook.encrypted_secret:
        try:
            secret = decrypt_api_key(hook.encrypted_secret)
        except Exception:
            pass

    if hook.auth_type == "bearer" and secret:
        headers["Authorization"] = f"Bearer {secret}"
    elif hook.auth_type == "hmac" and secret:
        body_bytes = json.dumps(test_payload).encode()
        sig = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
        headers["X-CATSHY-Signature"] = f"sha256={sig}"
    elif hook.auth_type == "basic" and secret:
        import base64
        headers["Authorization"] = f"Basic {base64.b64encode(secret.encode()).decode()}"

    now = datetime.now(timezone.utc)
    job = ExportJob(
        workspace_id=wid, job_type="webhook", target=hook.url,
        event_type="test", status="pending", created_by=user.id,
        payload_summary=f"Test fire to {hook.name}",
    )
    db.add(job)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(hook.url, json=test_payload, headers=headers)
        hook.last_triggered_at = now
        hook.last_status_code = resp.status_code
        if resp.is_success:
            hook.last_error = None
            hook.consecutive_failures = 0
            job.status = "success"
            job.status_code = resp.status_code
        else:
            hook.last_error = f"HTTP {resp.status_code}"
            hook.consecutive_failures += 1
            job.status = "failed"
            job.status_code = resp.status_code
            job.error_message = f"HTTP {resp.status_code}: {resp.text[:500]}"
    except Exception as e:
        hook.last_error = str(e)[:500]
        hook.consecutive_failures += 1
        job.status = "failed"
        job.error_message = str(e)[:500]

    job.completed_at = datetime.now(timezone.utc)
    await db.commit()

    return {
        "success": job.status == "success",
        "status_code": job.status_code,
        "error": job.error_message,
    }


# ── Syslog CRUD ──

@router.get("/syslog")
async def list_syslog(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    result = await db.execute(
        select(SyslogOutput).where(SyslogOutput.workspace_id == wid).order_by(SyslogOutput.created_at.desc())
    )
    return [_serialize_syslog(s) for s in result.scalars().all()]


@router.post("/syslog")
async def create_syslog(
    req: SyslogCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    wid: str = Depends(get_workspace_id),
):
    s = SyslogOutput(
        workspace_id=wid, name=req.name, host=req.host, port=req.port,
        protocol=req.protocol, format=req.format, event_types=req.event_types, enabled=req.enabled,
    )
    db.add(s)
    await db.commit()
    await db.refresh(s)
    return _serialize_syslog(s)


@router.put("/syslog/{syslog_id}")
async def update_syslog(
    syslog_id: str,
    req: SyslogUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    wid: str = Depends(get_workspace_id),
):
    result = await db.execute(
        select(SyslogOutput).where(SyslogOutput.id == syslog_id, SyslogOutput.workspace_id == wid)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Syslog output not found")
    if req.name is not None: s.name = req.name
    if req.host is not None: s.host = req.host
    if req.port is not None: s.port = req.port
    if req.protocol is not None: s.protocol = req.protocol
    if req.format is not None: s.format = req.format
    if req.event_types is not None: s.event_types = req.event_types
    if req.enabled is not None: s.enabled = req.enabled
    await db.commit()
    await db.refresh(s)
    return _serialize_syslog(s)


@router.delete("/syslog/{syslog_id}")
async def delete_syslog(
    syslog_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    wid: str = Depends(get_workspace_id),
):
    result = await db.execute(
        select(SyslogOutput).where(SyslogOutput.id == syslog_id, SyslogOutput.workspace_id == wid)
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Syslog output not found")
    await db.delete(s)
    await db.commit()
    return {"message": "Syslog output deleted"}


# ── Export Job History ──

@router.get("/jobs")
async def list_export_jobs(
    job_type: Optional[str] = None,
    status: Optional[str] = None,
    offset: int = 0,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    q = select(ExportJob).where(ExportJob.workspace_id == wid)
    if job_type:
        q = q.where(ExportJob.job_type == job_type)
    if status:
        q = q.where(ExportJob.status == status)
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    q = q.order_by(desc(ExportJob.created_at)).offset(offset).limit(limit)
    result = await db.execute(q)
    items = [{
        "id": j.id,
        "job_type": j.job_type,
        "target": j.target,
        "event_type": j.event_type,
        "status": j.status,
        "status_code": j.status_code,
        "error_message": j.error_message,
        "retry_count": j.retry_count,
        "payload_summary": j.payload_summary,
        "created_at": str(j.created_at),
        "completed_at": str(j.completed_at) if j.completed_at else None,
    } for j in result.scalars().all()]
    return {"items": items, "total": total, "offset": offset, "limit": limit}


# ── Event types reference ──

@router.get("/event-types")
async def get_event_types(user=Depends(get_current_user)):
    return EVENT_TYPES
