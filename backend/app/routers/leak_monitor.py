"""Leak Monitoring Router — triage, correlation, dashboard widgets, case creation."""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query, Body, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_

from app.database import get_db
from app.core.deps import get_current_user, get_workspace_id
from app.models.operations import LeakItem, Case

logger = logging.getLogger("catshy.leaks")
router = APIRouter()


def _leak_to_dict(l: LeakItem) -> dict:
    return {
        "id": l.id, "type": l.type, "title": l.title, "description": l.description,
        "severity": l.severity, "source_name": l.source_name, "source_url": l.source_url,
        "discovered_at": l.discovered_at, "matched_asset_ids": l.matched_asset_ids or [],
        "evidence_excerpt": l.evidence_excerpt, "provenance": l.provenance,
        "is_tor_source": l.is_tor_source,
        "status": getattr(l, "status", "new"),
        "analyst_notes": getattr(l, "analyst_notes", None),
        "linked_case_id": getattr(l, "linked_case_id", None),
        "attribution_notes": getattr(l, "attribution_notes", None),
        "created_at": getattr(l, "created_at", l.discovered_at),
    }


@router.get("/")
async def list_leaks(
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    filters = [LeakItem.workspace_id == workspace_id]
    if type:
        filters.append(LeakItem.type == type)
    if status:
        filters.append(LeakItem.status == status)
    if search:
        filters.append(or_(
            LeakItem.title.ilike(f"%{search}%"),
            LeakItem.description.ilike(f"%{search}%"),
        ))

    total_q = await db.execute(select(func.count()).select_from(LeakItem).where(and_(*filters)))
    total = total_q.scalar() or 0
    result = await db.execute(
        select(LeakItem).where(and_(*filters))
        .order_by(LeakItem.discovered_at.desc()).offset(offset).limit(limit)
    )
    items = [_leak_to_dict(l) for l in result.scalars().all()]
    return {"items": items, "total": total, "offset": offset, "limit": limit}


@router.get("/kpis")
async def leak_kpis(
    range: str = Query("7d"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    now = datetime.now(timezone.utc)
    days = {"24h": 1, "7d": 7, "30d": 30}.get(range, 7)
    cutoff = now - timedelta(days=days)
    base = [LeakItem.workspace_id == workspace_id]

    new_q = await db.execute(select(func.count()).select_from(LeakItem).where(
        and_(*base, LeakItem.discovered_at >= cutoff)))
    assets_q = await db.execute(select(func.count()).select_from(LeakItem).where(
        and_(*base, LeakItem.matched_asset_ids != None, func.array_length(LeakItem.matched_asset_ids, 1) > 0)))
    cred_q = await db.execute(select(func.count()).select_from(LeakItem).where(
        and_(*base, LeakItem.type == "credential", LeakItem.discovered_at >= cutoff)))

    return {
        "new_leaks": new_q.scalar() or 0,
        "affecting_assets": assets_q.scalar() or 0,
        "credential_leaks": cred_q.scalar() or 0,
        "range": range,
    }


@router.patch("/{leak_id}/triage")
async def triage_leak(
    leak_id: str,
    status: str = Body(..., embed=True),
    analyst_notes: Optional[str] = Body(None, embed=True),
    attribution_notes: Optional[str] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    result = await db.execute(select(LeakItem).where(
        LeakItem.id == leak_id, LeakItem.workspace_id == workspace_id))
    leak = result.scalar_one_or_none()
    if not leak:
        raise HTTPException(404, "Leak item not found")
    leak.status = status
    if analyst_notes is not None:
        leak.analyst_notes = analyst_notes
    if attribution_notes is not None:
        leak.attribution_notes = attribution_notes
    await db.commit()
    return {"ok": True, "status": status}


@router.post("/{leak_id}/create-case")
async def create_case_from_leak(
    leak_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    result = await db.execute(select(LeakItem).where(
        LeakItem.id == leak_id, LeakItem.workspace_id == workspace_id))
    leak = result.scalar_one_or_none()
    if not leak:
        raise HTTPException(404, "Leak item not found")

    from app.models.operations import Case
    import uuid
    case = Case(
        id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        title=f"Leak Investigation: {leak.title[:200]}",
        description=f"Auto-created from leak item {leak.id}.\n\nType: {leak.type}\nSource: {leak.source_name}\n\n{leak.description or ''}",
        status="open",
        priority="high" if leak.severity in ("critical", "high") else "medium",
        created_by=user.id,
    )
    db.add(case)
    leak.linked_case_id = case.id
    leak.status = "investigating"
    await db.commit()
    return {"ok": True, "case_id": case.id, "case_title": case.title}
