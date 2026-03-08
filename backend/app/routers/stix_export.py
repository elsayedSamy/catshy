"""STIX 2.1 Export Router — workspace-scoped export of intel items as STIX bundles."""
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Body
from fastapi.responses import JSONResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.core.deps import get_current_user, get_workspace_id
from app.models.intel import IntelItem, Entity
from app.services.stix_export import build_stix_bundle

logger = logging.getLogger("catshy.stix")
router = APIRouter()


def _item_to_dict(item: IntelItem) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "severity": item.severity,
        "observable_type": item.observable_type,
        "observable_value": item.observable_value,
        "source_name": item.source_name,
        "published_at": item.published_at,
        "fetched_at": item.fetched_at,
        "created_at": item.created_at,
        "original_url": item.original_url,
        "excerpt": item.excerpt,
        "confidence_score": item.confidence_score or 0,
        "risk_score": item.risk_score or 0,
        "tags": item.tags or [],
        "mitre_technique_ids": item.mitre_technique_ids or [],
        "mitre_tactics": item.mitre_tactics or [],
        "mitre_mapping_confidence": item.mitre_mapping_confidence or 0,
        "mitre_mapping_source": item.mitre_mapping_source,
        "status": item.status,
    }


def _entity_to_dict(entity: Entity) -> dict:
    return {
        "id": entity.id,
        "type": entity.type,
        "name": entity.name,
        "description": entity.description,
        "confidence": entity.confidence or 0.5,
        "created_at": entity.created_at,
    }


@router.post("/export")
async def export_stix(
    item_ids: Optional[List[str]] = Body(None, embed=False),
    preset: Optional[str] = Query(None, description="Time preset: today, 7d, 30d"),
    severity: Optional[str] = Query(None),
    include_entities: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """Export intel items as a STIX 2.1 bundle JSON. Workspace-scoped."""
    filters = [IntelItem.workspace_id == workspace_id]

    if item_ids:
        filters.append(IntelItem.id.in_(item_ids))
    else:
        # Time-based filter
        now = datetime.now(timezone.utc)
        if preset == "7d":
            cutoff = now - timedelta(days=7)
        elif preset == "30d":
            cutoff = now - timedelta(days=30)
        else:  # default today
            cutoff = now - timedelta(hours=24)
        filters.append(IntelItem.fetched_at >= cutoff)

    if severity:
        filters.append(IntelItem.severity == severity)

    result = await db.execute(
        select(IntelItem).where(and_(*filters)).order_by(IntelItem.fetched_at.desc()).limit(1000)
    )
    items = result.scalars().all()
    item_dicts = [_item_to_dict(i) for i in items]

    entity_dicts = []
    if include_entities:
        ent_result = await db.execute(
            select(Entity).where(Entity.workspace_id == workspace_id).limit(500)
        )
        entity_dicts = [_entity_to_dict(e) for e in ent_result.scalars().all()]

    bundle = build_stix_bundle(item_dicts, entity_dicts)

    content = json.dumps(bundle, indent=2, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": "attachment; filename=catshy-stix-bundle.json",
            "X-STIX-Version": "2.1",
            "X-Item-Count": str(len(item_dicts)),
        },
    )


@router.get("/preview")
async def preview_stix(
    preset: str = Query("today"),
    severity: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """Preview STIX export metadata (counts) without generating full bundle."""
    filters = [IntelItem.workspace_id == workspace_id]
    now = datetime.now(timezone.utc)
    if preset == "7d":
        cutoff = now - timedelta(days=7)
    elif preset == "30d":
        cutoff = now - timedelta(days=30)
    else:
        cutoff = now - timedelta(hours=24)
    filters.append(IntelItem.fetched_at >= cutoff)
    if severity:
        filters.append(IntelItem.severity == severity)

    from sqlalchemy import func
    result = await db.execute(
        select(func.count()).select_from(IntelItem).where(and_(*filters))
    )
    count = result.scalar() or 0

    return {"item_count": count, "format": "stix-2.1", "preset": preset}
