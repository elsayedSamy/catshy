"""Workspace Settings router — per-workspace configuration.

Endpoints:
  GET  /api/settings/workspace — get settings for current workspace
  PUT  /api/settings/workspace — update settings (admin only)
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional

from app.database import get_db
from app.core.deps import get_current_user, get_workspace_id, require_team_admin
from app.models.integrations import WorkspaceSettings

logger = logging.getLogger("catshy.settings")
router = APIRouter()


class WorkspaceSettingsResponse(BaseModel):
    retention_days: int = 30
    default_polling_interval_minutes: int = 5
    risk_weight_severity: float = 0.4
    risk_weight_asset_relevance: float = 0.3
    risk_weight_confidence: float = 0.2
    risk_weight_recency: float = 0.1
    notify_on_critical: bool = True
    notify_on_high: bool = True
    notify_on_medium: bool = False
    notify_on_low: bool = False
    notify_on_asset_match: bool = True
    timezone: str = "UTC"
    auto_enrich: bool = True


class UpdateWorkspaceSettingsRequest(BaseModel):
    retention_days: Optional[int] = Field(None, ge=1, le=365)
    default_polling_interval_minutes: Optional[int] = Field(None, ge=1, le=1440)
    risk_weight_severity: Optional[float] = Field(None, ge=0, le=1)
    risk_weight_asset_relevance: Optional[float] = Field(None, ge=0, le=1)
    risk_weight_confidence: Optional[float] = Field(None, ge=0, le=1)
    risk_weight_recency: Optional[float] = Field(None, ge=0, le=1)
    notify_on_critical: Optional[bool] = None
    notify_on_high: Optional[bool] = None
    notify_on_medium: Optional[bool] = None
    notify_on_low: Optional[bool] = None
    notify_on_asset_match: Optional[bool] = None
    timezone: Optional[str] = None
    auto_enrich: Optional[bool] = None


def _serialize(settings: WorkspaceSettings) -> dict:
    return {
        "retention_days": settings.retention_days,
        "default_polling_interval_minutes": settings.default_polling_interval_minutes,
        "risk_weight_severity": settings.risk_weight_severity,
        "risk_weight_asset_relevance": settings.risk_weight_asset_relevance,
        "risk_weight_confidence": settings.risk_weight_confidence,
        "risk_weight_recency": settings.risk_weight_recency,
        "notify_on_critical": settings.notify_on_critical,
        "notify_on_high": settings.notify_on_high,
        "notify_on_medium": settings.notify_on_medium,
        "notify_on_low": settings.notify_on_low,
        "notify_on_asset_match": settings.notify_on_asset_match,
        "timezone": settings.timezone,
        "auto_enrich": settings.auto_enrich,
    }


async def _get_or_create_settings(db: AsyncSession, workspace_id: str) -> WorkspaceSettings:
    result = await db.execute(
        select(WorkspaceSettings).where(WorkspaceSettings.workspace_id == workspace_id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        settings = WorkspaceSettings(workspace_id=workspace_id)
        db.add(settings)
        await db.flush()
    return settings


@router.get("/workspace")
async def get_workspace_settings(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """Get settings for the current workspace."""
    settings = await _get_or_create_settings(db, workspace_id)
    await db.commit()
    return _serialize(settings)


@router.put("/workspace")
async def update_workspace_settings(
    req: UpdateWorkspaceSettingsRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    workspace_id: str = Depends(get_workspace_id),
):
    """Update workspace settings. Requires team_admin or system_owner."""
    settings = await _get_or_create_settings(db, workspace_id)

    update_data = req.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(settings, field, value)

    settings.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(settings)

    logger.info(f"Workspace settings updated for {workspace_id}: {list(update_data.keys())}")
    return _serialize(settings)
