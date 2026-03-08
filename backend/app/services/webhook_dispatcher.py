"""Webhook dispatcher — fires events to all matching workspace webhooks."""
import hashlib
import hmac
import json
import logging
import base64
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.outputs import WebhookOutput, ExportJob
from app.services.encryption import decrypt_api_key

logger = logging.getLogger("catshy.webhook_dispatcher")


async def dispatch_event(
    db: AsyncSession,
    workspace_id: str,
    event_type: str,
    payload: dict,
    user_id: Optional[str] = None,
):
    """Send an event to all enabled webhooks in the workspace that subscribe to this event type."""
    result = await db.execute(
        select(WebhookOutput).where(
            WebhookOutput.workspace_id == workspace_id,
            WebhookOutput.enabled == True,
        )
    )
    hooks = result.scalars().all()

    for hook in hooks:
        if hook.event_types and event_type not in hook.event_types:
            continue

        envelope = {
            "event": event_type,
            "source": "catshy",
            "workspace_id": workspace_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data": payload,
        }

        headers = {"Content-Type": "application/json", "User-Agent": "CATSHY-Webhook/1.0"}
        headers.update(hook.custom_headers or {})

        secret = None
        if hook.encrypted_secret:
            try:
                secret = decrypt_api_key(hook.encrypted_secret)
            except Exception:
                pass

        if hook.auth_type == "bearer" and secret:
            headers["Authorization"] = f"Bearer {secret}"
        elif hook.auth_type == "hmac" and secret:
            body_bytes = json.dumps(envelope).encode()
            sig = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
            headers["X-CATSHY-Signature"] = f"sha256={sig}"
        elif hook.auth_type == "basic" and secret:
            headers["Authorization"] = f"Basic {base64.b64encode(secret.encode()).decode()}"

        job = ExportJob(
            workspace_id=workspace_id,
            job_type="webhook",
            target=hook.url,
            event_type=event_type,
            status="pending",
            created_by=user_id,
            payload_summary=f"{event_type}: {str(payload)[:200]}",
        )
        db.add(job)

        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(hook.url, json=envelope, headers=headers)

            now = datetime.now(timezone.utc)
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
                job.error_message = f"HTTP {resp.status_code}"
        except Exception as e:
            hook.last_error = str(e)[:500]
            hook.consecutive_failures += 1
            job.status = "failed"
            job.error_message = str(e)[:500]
            logger.warning(f"Webhook delivery failed for {hook.name}: {e}")

        job.completed_at = datetime.now(timezone.utc)

    await db.commit()
