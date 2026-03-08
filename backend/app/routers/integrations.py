"""Workspace Integrations router — BYOK API key management per workspace.

Endpoints:
  GET    /api/integrations/           — list all providers for current workspace
  POST   /api/integrations/           — configure a provider (set API key)
  PUT    /api/integrations/{provider} — update provider config/key
  DELETE /api/integrations/{provider} — remove provider config
  POST   /api/integrations/{provider}/test — test connection
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.database import get_db
from app.core.deps import get_current_user, get_workspace_id, require_team_admin
from app.models.integrations import WorkspaceIntegration
from app.services.encryption import encrypt_api_key, decrypt_api_key, mask_api_key

logger = logging.getLogger("catshy.integrations")
router = APIRouter()

# Supported providers
SUPPORTED_PROVIDERS = {
    "virustotal": {"name": "VirusTotal", "description": "File/URL/IP reputation & analysis", "category": "Threat Intel"},
    "shodan": {"name": "Shodan", "description": "Internet-connected device search", "category": "Threat Intel"},
    "abuseipdb": {"name": "AbuseIPDB", "description": "IP address abuse reports", "category": "Threat Intel"},
    "otx": {"name": "OTX AlienVault", "description": "Open Threat Exchange", "category": "Threat Intel"},
    "greynoise": {"name": "GreyNoise", "description": "Internet scanner classification", "category": "Threat Intel"},
    "censys": {"name": "Censys", "description": "Internet asset discovery", "category": "Threat Intel"},
    "urlscan": {"name": "URLscan.io", "description": "URL scanning & analysis", "category": "Threat Intel"},
    "hibp": {"name": "Have I Been Pwned", "description": "Breach notification", "category": "Breach / Leak"},
}


class ConfigureProviderRequest(BaseModel):
    provider: str
    api_key: str
    enabled: bool = True
    config: dict = {}


class UpdateProviderRequest(BaseModel):
    api_key: Optional[str] = None
    enabled: Optional[bool] = None
    config: Optional[dict] = None


def _serialize_integration(integ: WorkspaceIntegration) -> dict:
    return {
        "id": integ.id,
        "provider": integ.provider,
        "enabled": integ.enabled,
        "status": integ.status,
        "masked_key": mask_api_key(decrypt_api_key(integ.encrypted_api_key)) if integ.encrypted_api_key else None,
        "last_success": str(integ.last_success) if integ.last_success else None,
        "last_error": integ.last_error,
        "last_checked": str(integ.last_checked) if integ.last_checked else None,
        "config": integ.config or {},
        "provider_info": SUPPORTED_PROVIDERS.get(integ.provider, {}),
    }


@router.get("/")
async def list_integrations(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """List all provider integrations for the current workspace."""
    result = await db.execute(
        select(WorkspaceIntegration).where(WorkspaceIntegration.workspace_id == workspace_id)
    )
    configured = {i.provider: i for i in result.scalars().all()}

    providers = []
    for provider_id, info in SUPPORTED_PROVIDERS.items():
        if provider_id in configured:
            providers.append(_serialize_integration(configured[provider_id]))
        else:
            providers.append({
                "id": None,
                "provider": provider_id,
                "enabled": False,
                "status": "not_configured",
                "masked_key": None,
                "last_success": None,
                "last_error": None,
                "last_checked": None,
                "config": {},
                "provider_info": info,
            })
    return providers


@router.post("/")
async def configure_provider(
    req: ConfigureProviderRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    workspace_id: str = Depends(get_workspace_id),
):
    """Configure a provider with an API key for this workspace."""
    if req.provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {req.provider}")

    # Check if already exists
    result = await db.execute(
        select(WorkspaceIntegration).where(
            WorkspaceIntegration.workspace_id == workspace_id,
            WorkspaceIntegration.provider == req.provider,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"{req.provider} already configured. Use PUT to update.")

    try:
        encrypted_key = encrypt_api_key(req.api_key)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    integ = WorkspaceIntegration(
        workspace_id=workspace_id,
        provider=req.provider,
        enabled=req.enabled,
        encrypted_api_key=encrypted_key,
        status="active",
        config=req.config,
    )
    db.add(integ)
    await db.commit()
    await db.refresh(integ)

    logger.info(f"Provider {req.provider} configured for workspace {workspace_id}")
    return _serialize_integration(integ)


@router.put("/{provider}")
async def update_provider(
    provider: str,
    req: UpdateProviderRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    workspace_id: str = Depends(get_workspace_id),
):
    """Update a provider's API key, enabled status, or config."""
    result = await db.execute(
        select(WorkspaceIntegration).where(
            WorkspaceIntegration.workspace_id == workspace_id,
            WorkspaceIntegration.provider == provider,
        )
    )
    integ = result.scalar_one_or_none()
    if not integ:
        raise HTTPException(status_code=404, detail=f"Provider {provider} not configured")

    if req.api_key is not None:
        integ.encrypted_api_key = encrypt_api_key(req.api_key)
        integ.status = "active"
    if req.enabled is not None:
        integ.enabled = req.enabled
    if req.config is not None:
        integ.config = req.config

    integ.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(integ)
    return _serialize_integration(integ)


@router.delete("/{provider}")
async def delete_provider(
    provider: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    workspace_id: str = Depends(get_workspace_id),
):
    """Remove a provider configuration (delete API key)."""
    result = await db.execute(
        select(WorkspaceIntegration).where(
            WorkspaceIntegration.workspace_id == workspace_id,
            WorkspaceIntegration.provider == provider,
        )
    )
    integ = result.scalar_one_or_none()
    if not integ:
        raise HTTPException(status_code=404, detail=f"Provider {provider} not configured")

    await db.delete(integ)
    await db.commit()
    return {"message": f"Provider {provider} removed"}


@router.post("/{provider}/test")
async def test_provider(
    provider: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """Test connection for a provider using the stored API key."""
    result = await db.execute(
        select(WorkspaceIntegration).where(
            WorkspaceIntegration.workspace_id == workspace_id,
            WorkspaceIntegration.provider == provider,
        )
    )
    integ = result.scalar_one_or_none()
    if not integ or not integ.encrypted_api_key:
        raise HTTPException(status_code=404, detail=f"Provider {provider} not configured")

    try:
        api_key = decrypt_api_key(integ.encrypted_api_key)
    except ValueError:
        integ.status = "error"
        integ.last_error = "Decryption failed — master key may have changed"
        integ.last_checked = datetime.now(timezone.utc)
        await db.commit()
        raise HTTPException(status_code=500, detail="Failed to decrypt API key")

    # Run a lightweight test call
    from app.services.enrichment import test_provider_connection
    success, message = await test_provider_connection(provider, api_key)

    now = datetime.now(timezone.utc)
    integ.last_checked = now
    if success:
        integ.status = "active"
        integ.last_success = now
        integ.last_error = None
    else:
        integ.status = "error"
        integ.last_error = message

    await db.commit()
    return {"provider": provider, "success": success, "message": message}
