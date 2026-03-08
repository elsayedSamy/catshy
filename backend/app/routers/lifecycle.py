"""IOC Lifecycle + MITRE mapping router — triage, status updates, MITRE view/edit."""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, update
from pydantic import BaseModel
from typing import Optional, List

from app.database import get_db
from app.models import IntelItem, Observable, AuditLog
from app.core.deps import get_current_user, get_workspace_id, RequireRole
from app.services.mitre_mapper import get_tactics_for_techniques

logger = logging.getLogger("catshy.lifecycle")
router = APIRouter()

require_write = RequireRole("system_owner", "team_admin", "team_member")
require_admin = RequireRole("system_owner", "team_admin")


# ── Schemas ──

class TriageRequest(BaseModel):
    status: str  # active, resolved, expired, false_positive, investigating
    analyst_verdict: Optional[str] = None  # true_positive, false_positive, benign, suspicious
    verdict_reason: Optional[str] = None
    analyst_notes: Optional[str] = None


class BulkTriageRequest(BaseModel):
    item_ids: List[str]
    status: str
    analyst_verdict: Optional[str] = None
    verdict_reason: Optional[str] = None


class ObservableStatusRequest(BaseModel):
    status: str  # active, expired, false_positive, whitelisted


class MitreMappingRequest(BaseModel):
    technique_ids: List[str]
    tactics: Optional[List[str]] = None
    confidence: Optional[float] = None


# ── Intel Item Lifecycle ──

@router.get("/{item_id}")
async def get_intel_detail(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """Get full intel item detail including lifecycle and MITRE data."""
    result = await db.execute(
        select(IntelItem).where(IntelItem.id == item_id, IntelItem.workspace_id == wid)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Intel item not found")

    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "severity": item.severity,
        "observable_type": item.observable_type,
        "observable_value": item.observable_value,
        "source_name": item.source_name,
        "fetched_at": item.fetched_at.isoformat() if item.fetched_at else None,
        "published_at": item.published_at.isoformat() if item.published_at else None,
        "original_url": item.original_url,
        "excerpt": item.excerpt,
        "dedup_count": item.dedup_count,
        "asset_match": item.asset_match,
        "matched_assets": item.matched_asset_ids or [],
        "confidence_score": item.confidence_score,
        "risk_score": item.risk_score,
        "tags": item.tags or [],
        # Lifecycle
        "status": item.status or "active",
        "expires_at": item.expires_at.isoformat() if item.expires_at else None,
        "analyst_verdict": item.analyst_verdict,
        "verdict_reason": item.verdict_reason,
        "analyst_notes": item.analyst_notes,
        # MITRE
        "mitre_technique_ids": item.mitre_technique_ids or [],
        "mitre_tactics": item.mitre_tactics or [],
        "mitre_mapping_confidence": item.mitre_mapping_confidence or 0,
        "mitre_mapping_source": item.mitre_mapping_source,
        # Geo
        "geo_lat": item.geo_lat,
        "geo_lon": item.geo_lon,
        "geo_country": item.geo_country,
        "geo_country_name": item.geo_country_name,
        "campaign_name": item.campaign_name,
        "score_explanation": item.score_explanation,
    }


@router.patch("/{item_id}/triage")
async def triage_intel_item(
    item_id: str,
    req: TriageRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_write),
    wid: str = Depends(get_workspace_id),
):
    """Update lifecycle status of an intel item (triage action)."""
    valid_statuses = {"active", "resolved", "expired", "false_positive", "investigating"}
    if req.status not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Must be one of: {valid_statuses}")

    result = await db.execute(
        select(IntelItem).where(IntelItem.id == item_id, IntelItem.workspace_id == wid)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Intel item not found")

    old_status = item.status
    item.status = req.status
    if req.analyst_verdict:
        item.analyst_verdict = req.analyst_verdict
    if req.verdict_reason:
        item.verdict_reason = req.verdict_reason
    if req.analyst_notes is not None:
        item.analyst_notes = req.analyst_notes

    # Adjust scoring for false positives
    if req.status == "false_positive":
        item.risk_score = max(item.risk_score * 0.1, 0)
        item.feedback_adjustment = -0.9
    elif req.status == "resolved":
        item.risk_score = max(item.risk_score * 0.3, 0)
        item.feedback_adjustment = -0.5

    db.add(AuditLog(
        action="intel_triaged",
        entity_type="intel_item",
        entity_id=item_id,
        user_id=user.id,
        user_email=user.email,
        workspace_id=wid,
        details={
            "old_status": old_status,
            "new_status": req.status,
            "verdict": req.analyst_verdict,
            "reason": req.verdict_reason,
        },
    ))
    await db.commit()

    return {
        "id": item_id,
        "status": item.status,
        "analyst_verdict": item.analyst_verdict,
        "risk_score": item.risk_score,
        "message": f"Status updated: {old_status} → {req.status}",
    }


@router.post("/bulk-triage")
async def bulk_triage(
    req: BulkTriageRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_write),
    wid: str = Depends(get_workspace_id),
):
    """Bulk update lifecycle status for multiple intel items."""
    valid_statuses = {"active", "resolved", "expired", "false_positive", "investigating"}
    if req.status not in valid_statuses:
        raise HTTPException(400, f"Invalid status")
    if len(req.item_ids) > 200:
        raise HTTPException(400, "Max 200 items per bulk operation")

    update_vals = {"status": req.status}
    if req.analyst_verdict:
        update_vals["analyst_verdict"] = req.analyst_verdict
    if req.verdict_reason:
        update_vals["verdict_reason"] = req.verdict_reason

    # Scoring adjustments for bulk
    if req.status == "false_positive":
        update_vals["feedback_adjustment"] = -0.9
    elif req.status == "resolved":
        update_vals["feedback_adjustment"] = -0.5

    stmt = (
        update(IntelItem)
        .where(IntelItem.workspace_id == wid, IntelItem.id.in_(req.item_ids))
        .values(**update_vals)
    )
    result = await db.execute(stmt)
    affected = result.rowcount

    db.add(AuditLog(
        action="intel_bulk_triaged",
        entity_type="intel_item",
        user_id=user.id,
        user_email=user.email,
        workspace_id=wid,
        details={"status": req.status, "count": affected, "verdict": req.analyst_verdict},
    ))
    await db.commit()

    return {"message": f"{affected} items updated to '{req.status}'", "affected": affected}


# ── Observable Lifecycle ──

@router.patch("/observables/{observable_id}/status")
async def update_observable_status(
    observable_id: str,
    req: ObservableStatusRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_write),
    wid: str = Depends(get_workspace_id),
):
    """Update observable lifecycle status (whitelist, false_positive, etc.)."""
    valid = {"active", "expired", "false_positive", "whitelisted"}
    if req.status not in valid:
        raise HTTPException(400, f"Invalid status. Must be one of: {valid}")

    result = await db.execute(
        select(Observable).where(Observable.id == observable_id, Observable.workspace_id == wid)
    )
    obs = result.scalar_one_or_none()
    if not obs:
        raise HTTPException(404, "Observable not found")

    old_status = obs.status
    obs.status = req.status

    db.add(AuditLog(
        action="observable_status_changed",
        entity_type="observable",
        entity_id=observable_id,
        user_id=user.id,
        user_email=user.email,
        workspace_id=wid,
        details={"old_status": old_status, "new_status": req.status},
    ))
    await db.commit()

    return {"id": observable_id, "status": obs.status, "message": f"Status: {old_status} → {req.status}"}


# ── MITRE Mapping ──

@router.get("/{item_id}/mitre")
async def get_mitre_mapping(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """Get MITRE ATT&CK mapping for an intel item."""
    result = await db.execute(
        select(IntelItem).where(IntelItem.id == item_id, IntelItem.workspace_id == wid)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Intel item not found")

    return {
        "item_id": item.id,
        "technique_ids": item.mitre_technique_ids or [],
        "tactics": item.mitre_tactics or [],
        "mapping_confidence": item.mitre_mapping_confidence or 0,
        "mapping_source": item.mitre_mapping_source,
    }


@router.patch("/{item_id}/mitre")
async def update_mitre_mapping(
    item_id: str,
    req: MitreMappingRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_write),
    wid: str = Depends(get_workspace_id),
):
    """Manually update MITRE ATT&CK mapping for an intel item."""
    result = await db.execute(
        select(IntelItem).where(IntelItem.id == item_id, IntelItem.workspace_id == wid)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Intel item not found")

    item.mitre_technique_ids = req.technique_ids
    item.mitre_tactics = req.tactics or get_tactics_for_techniques(req.technique_ids)
    item.mitre_mapping_confidence = req.confidence or 1.0
    item.mitre_mapping_source = "manual"

    db.add(AuditLog(
        action="mitre_mapping_updated",
        entity_type="intel_item",
        entity_id=item_id,
        user_id=user.id,
        user_email=user.email,
        workspace_id=wid,
        details={"technique_ids": req.technique_ids, "source": "manual"},
    ))
    await db.commit()

    return {
        "item_id": item.id,
        "technique_ids": item.mitre_technique_ids,
        "tactics": item.mitre_tactics,
        "mapping_confidence": item.mitre_mapping_confidence,
        "mapping_source": "manual",
    }


# ── Lifecycle Stats (for dashboard) ──

@router.get("/stats/lifecycle")
async def lifecycle_stats(
    range: str = "24h",
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """Get lifecycle breakdown stats for the dashboard."""
    from app.routers.source_health import _parse_range
    cutoff = _parse_range(range)

    q = (
        select(IntelItem.status, func.count().label("cnt"))
        .where(and_(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff))
        .group_by(IntelItem.status)
    )
    rows = (await db.execute(q)).all()
    result = {"active": 0, "resolved": 0, "expired": 0, "false_positive": 0, "investigating": 0}
    for status, cnt in rows:
        if status in result:
            result[status] = cnt

    return result


# ── MITRE Stats (for dashboard heatmap — uses stored data) ──

@router.get("/stats/mitre")
async def mitre_stats(
    range: str = "24h",
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """Get MITRE tactic counts from stored mappings for the heatmap."""
    from app.routers.source_health import _parse_range
    cutoff = _parse_range(range)

    # Get all items with MITRE mappings in range
    q = (
        select(IntelItem.mitre_tactics, IntelItem.severity)
        .where(and_(
            IntelItem.workspace_id == wid,
            IntelItem.fetched_at >= cutoff,
            IntelItem.mitre_tactics != None,
            func.array_length(IntelItem.mitre_tactics, 1) > 0,
        ))
    )
    rows = (await db.execute(q)).all()

    # Count per tactic
    tactic_counts: dict[str, int] = {}
    tactic_max_sev: dict[str, str] = {}
    sev_order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}

    for tactics_arr, severity in rows:
        if not tactics_arr:
            continue
        for tactic in tactics_arr:
            tactic_counts[tactic] = tactic_counts.get(tactic, 0) + 1
            cur = tactic_max_sev.get(tactic, "none")
            if sev_order.get(severity, 0) > sev_order.get(cur, -1):
                tactic_max_sev[tactic] = severity

    from app.services.mitre_mapper import TACTIC_MAP
    results = []
    for tid, tname in TACTIC_MAP.items():
        cnt = tactic_counts.get(tid, 0)
        sev = tactic_max_sev.get(tid, "none")
        if cnt == 0:
            sev = "none"
        elif cnt > 20:
            sev = "critical"
        elif cnt > 10 and sev_order.get(sev, 0) < 4:
            sev = max(sev, "high", key=lambda s: sev_order.get(s, 0))
        results.append({"id": tid, "name": tname, "techniqueCount": cnt, "severity": sev})

    return results
