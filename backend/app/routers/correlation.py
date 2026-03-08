"""Correlation API — list clusters, run engine, view cluster details."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

from app.database import get_db
from app.models.correlation import CorrelationCluster, CorrelationLink
from app.models.intel import IntelItem
from app.core.deps import get_current_user, get_workspace_id, RequireRole
from app.services.correlation_engine import run_correlation, get_item_correlations

router = APIRouter()
require_write = RequireRole("system_owner", "team_admin", "team_member")


@router.get("/clusters")
async def list_clusters(
    cluster_type: Optional[str] = None,
    severity: Optional[str] = None,
    status: str = "active",
    sort: str = "newest",
    offset: int = 0,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """List correlation clusters."""
    q = select(CorrelationCluster).where(
        and_(CorrelationCluster.workspace_id == wid, CorrelationCluster.status == status)
    )
    if cluster_type:
        q = q.where(CorrelationCluster.cluster_type == cluster_type)
    if severity:
        q = q.where(CorrelationCluster.severity == severity)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    order = CorrelationCluster.last_seen.desc() if sort == "newest" else CorrelationCluster.confidence.desc()
    q = q.order_by(order).offset(offset).limit(limit)
    result = await db.execute(q)

    items = []
    for c in result.scalars().all():
        items.append({
            "id": str(c.id),
            "name": c.name,
            "description": c.description,
            "cluster_type": c.cluster_type,
            "severity": c.severity,
            "confidence": c.confidence,
            "status": c.status,
            "tags": c.tags or [],
            "pivot_indicators": c.pivot_indicators or [],
            "item_count": c.item_count,
            "first_seen": c.first_seen.isoformat() + "Z" if c.first_seen else None,
            "last_seen": c.last_seen.isoformat() + "Z" if c.last_seen else None,
            "created_at": c.created_at.isoformat() + "Z" if c.created_at else None,
        })

    return {"items": items, "total": total, "offset": offset, "limit": limit}


@router.get("/clusters/{cluster_id}")
async def get_cluster_detail(
    cluster_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """Get cluster detail with all linked intel items."""
    result = await db.execute(
        select(CorrelationCluster).where(
            and_(CorrelationCluster.id == cluster_id, CorrelationCluster.workspace_id == wid)
        )
    )
    cluster = result.scalar_one_or_none()
    if not cluster:
        raise HTTPException(404, "Cluster not found")

    # Get linked items
    links_q = (
        select(CorrelationLink, IntelItem)
        .join(IntelItem, IntelItem.id == CorrelationLink.intel_item_id)
        .where(CorrelationLink.cluster_id == cluster_id)
        .order_by(IntelItem.created_at.desc())
    )
    links_result = await db.execute(links_q)

    linked_items = []
    for link, item in links_result.all():
        linked_items.append({
            "link_id": str(link.id),
            "link_reason": link.link_reason,
            "shared_value": link.shared_value,
            "link_confidence": link.confidence,
            "item": {
                "id": str(item.id),
                "title": item.title,
                "severity": item.severity,
                "observable_type": item.observable_type,
                "observable_value": item.observable_value,
                "source_name": item.source_name,
                "risk_score": item.risk_score,
                "confidence_score": item.confidence_score,
                "asset_match": item.asset_match,
                "published_at": item.published_at.isoformat() + "Z" if item.published_at else None,
                "status": item.status,
            },
        })

    return {
        "id": str(cluster.id),
        "name": cluster.name,
        "description": cluster.description,
        "cluster_type": cluster.cluster_type,
        "severity": cluster.severity,
        "confidence": cluster.confidence,
        "status": cluster.status,
        "tags": cluster.tags or [],
        "pivot_indicators": cluster.pivot_indicators or [],
        "summary": cluster.summary,
        "item_count": cluster.item_count,
        "first_seen": cluster.first_seen.isoformat() + "Z" if cluster.first_seen else None,
        "last_seen": cluster.last_seen.isoformat() + "Z" if cluster.last_seen else None,
        "linked_items": linked_items,
    }


@router.post("/run")
async def trigger_correlation(
    lookback_hours: int = Query(48, ge=1, le=720),
    db: AsyncSession = Depends(get_db),
    user=Depends(require_write),
    wid: str = Depends(get_workspace_id),
):
    """Manually trigger the correlation engine."""
    result = await run_correlation(db, wid, lookback_hours)
    return {"message": "Correlation engine completed", **result}


class ClusterStatusUpdate(BaseModel):
    status: str  # active, merged, resolved, false_positive


@router.patch("/clusters/{cluster_id}/status")
async def update_cluster_status(
    cluster_id: str,
    req: ClusterStatusUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_write),
    wid: str = Depends(get_workspace_id),
):
    """Update cluster status."""
    result = await db.execute(
        select(CorrelationCluster).where(
            and_(CorrelationCluster.id == cluster_id, CorrelationCluster.workspace_id == wid)
        )
    )
    cluster = result.scalar_one_or_none()
    if not cluster:
        raise HTTPException(404, "Cluster not found")

    valid = {"active", "merged", "resolved", "false_positive"}
    if req.status not in valid:
        raise HTTPException(400, f"Invalid status. Must be one of: {valid}")

    cluster.status = req.status
    cluster.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": f"Cluster status updated to {req.status}"}


@router.get("/items/{intel_item_id}")
async def get_item_clusters(
    intel_item_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """Get all correlation clusters containing a specific intel item."""
    clusters = await get_item_correlations(db, wid, intel_item_id)
    return {"clusters": clusters}


@router.get("/stats")
async def correlation_stats(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """Get correlation statistics."""
    active_q = select(func.count()).where(
        and_(CorrelationCluster.workspace_id == wid, CorrelationCluster.status == "active")
    )
    total_active = (await db.execute(active_q)).scalar() or 0

    # By type
    type_q = select(
        CorrelationCluster.cluster_type,
        func.count().label("count"),
    ).where(
        and_(CorrelationCluster.workspace_id == wid, CorrelationCluster.status == "active")
    ).group_by(CorrelationCluster.cluster_type)
    type_result = await db.execute(type_q)
    by_type = {row.cluster_type: row.count for row in type_result.all()}

    # By severity
    sev_q = select(
        CorrelationCluster.severity,
        func.count().label("count"),
    ).where(
        and_(CorrelationCluster.workspace_id == wid, CorrelationCluster.status == "active")
    ).group_by(CorrelationCluster.severity)
    sev_result = await db.execute(sev_q)
    by_severity = {row.severity: row.count for row in sev_result.all()}

    # Total linked items
    linked_q = select(func.count(CorrelationLink.id)).join(
        CorrelationCluster, CorrelationCluster.id == CorrelationLink.cluster_id
    ).where(
        and_(CorrelationCluster.workspace_id == wid, CorrelationCluster.status == "active")
    )
    total_linked = (await db.execute(linked_q)).scalar() or 0

    return {
        "total_active_clusters": total_active,
        "total_linked_items": total_linked,
        "by_type": by_type,
        "by_severity": by_severity,
    }
