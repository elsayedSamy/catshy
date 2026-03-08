"""Vulnerability Intelligence Router — CVE/KEV management, advisories, dashboard widgets."""
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_

from app.database import get_db
from app.core.deps import get_current_user, get_workspace_id
from app.models.vulnerability import Vulnerability, Advisory
from app.models.operations import Asset

logger = logging.getLogger("catshy.vulns")
router = APIRouter()


def _vuln_to_dict(v: Vulnerability) -> dict:
    return {
        "id": v.id, "cve_id": v.cve_id, "title": v.title, "description": v.description,
        "cvss_score": v.cvss_score, "cvss_vector": v.cvss_vector, "severity": v.severity,
        "cwe_ids": v.cwe_ids or [], "references": v.references or [],
        "vendor": v.vendor, "product": v.product, "cpe_uris": v.cpe_uris or [],
        "published_at": v.published_at, "updated_at": v.updated_at,
        "is_kev": v.is_kev, "kev_date_added": v.kev_date_added,
        "kev_due_date": v.kev_due_date, "kev_ransomware_use": v.kev_ransomware_use,
        "kev_required_action": v.kev_required_action,
        "affects_assets": v.affects_assets, "matched_asset_ids": v.matched_asset_ids or [],
        "status": v.status, "patch_available": v.patch_available,
        "analyst_notes": v.analyst_notes, "tags": v.tags or [],
        "source_name": v.source_name, "created_at": v.created_at,
    }


@router.get("/")
async def list_vulnerabilities(
    severity: Optional[str] = Query(None),
    is_kev: Optional[bool] = Query(None),
    affects_assets: Optional[bool] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    filters = [Vulnerability.workspace_id == workspace_id]
    if severity:
        filters.append(Vulnerability.severity == severity)
    if is_kev is not None:
        filters.append(Vulnerability.is_kev == is_kev)
    if affects_assets is not None:
        filters.append(Vulnerability.affects_assets == affects_assets)
    if status:
        filters.append(Vulnerability.status == status)
    if search:
        filters.append(or_(
            Vulnerability.cve_id.ilike(f"%{search}%"),
            Vulnerability.title.ilike(f"%{search}%"),
            Vulnerability.vendor.ilike(f"%{search}%"),
        ))

    total_q = await db.execute(select(func.count()).select_from(Vulnerability).where(and_(*filters)))
    total = total_q.scalar() or 0

    result = await db.execute(
        select(Vulnerability).where(and_(*filters))
        .order_by(Vulnerability.cvss_score.desc().nullslast(), Vulnerability.published_at.desc())
        .offset(offset).limit(limit)
    )
    items = [_vuln_to_dict(v) for v in result.scalars().all()]
    return {"items": items, "total": total, "offset": offset, "limit": limit}


@router.get("/kpis")
async def vuln_kpis(
    range: str = Query("7d"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    now = datetime.now(timezone.utc)
    days = {"24h": 1, "7d": 7, "30d": 30}.get(range, 7)
    cutoff = now - timedelta(days=days)
    base = [Vulnerability.workspace_id == workspace_id]

    new_q = await db.execute(select(func.count()).select_from(Vulnerability).where(
        and_(*base, Vulnerability.created_at >= cutoff)))
    kev_q = await db.execute(select(func.count()).select_from(Vulnerability).where(
        and_(*base, Vulnerability.is_kev == True, Vulnerability.created_at >= cutoff)))
    affected_q = await db.execute(select(func.count()).select_from(Vulnerability).where(
        and_(*base, Vulnerability.affects_assets == True)))
    critical_q = await db.execute(select(func.count()).select_from(Vulnerability).where(
        and_(*base, Vulnerability.severity == "critical")))

    return {
        "new_cves": new_q.scalar() or 0,
        "kev_count": kev_q.scalar() or 0,
        "affecting_assets": affected_q.scalar() or 0,
        "critical_total": critical_q.scalar() or 0,
        "range": range,
    }


@router.get("/{vuln_id}")
async def get_vulnerability(
    vuln_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    result = await db.execute(select(Vulnerability).where(
        Vulnerability.id == vuln_id, Vulnerability.workspace_id == workspace_id))
    vuln = result.scalar_one_or_none()
    if not vuln:
        from fastapi import HTTPException
        raise HTTPException(404, "Vulnerability not found")
    return _vuln_to_dict(vuln)


@router.patch("/{vuln_id}/triage")
async def triage_vulnerability(
    vuln_id: str,
    status: str = Body(..., embed=True),
    analyst_notes: Optional[str] = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    result = await db.execute(select(Vulnerability).where(
        Vulnerability.id == vuln_id, Vulnerability.workspace_id == workspace_id))
    vuln = result.scalar_one_or_none()
    if not vuln:
        from fastapi import HTTPException
        raise HTTPException(404, "Vulnerability not found")
    vuln.status = status
    if analyst_notes is not None:
        vuln.analyst_notes = analyst_notes
    await db.commit()
    return {"ok": True, "status": status}


@router.post("/correlate")
async def correlate_assets(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """Run asset correlation for all open vulns in workspace."""
    assets_q = await db.execute(select(Asset).where(Asset.workspace_id == workspace_id))
    assets = assets_q.scalars().all()
    asset_keywords = []
    for a in assets:
        asset_keywords.append({"id": a.id, "value": a.value.lower(), "tags": [t.lower() for t in (a.tags or [])]})

    vulns_q = await db.execute(select(Vulnerability).where(
        Vulnerability.workspace_id == workspace_id, Vulnerability.status == "open"))
    vulns = vulns_q.scalars().all()

    matched = 0
    for v in vulns:
        vendor_lower = (v.vendor or "").lower()
        product_lower = (v.product or "").lower()
        title_lower = (v.title or "").lower()
        match_ids = []
        for a in asset_keywords:
            if vendor_lower and (vendor_lower in a["value"] or any(vendor_lower in t for t in a["tags"])):
                match_ids.append(a["id"])
            elif product_lower and (product_lower in a["value"] or any(product_lower in t for t in a["tags"])):
                match_ids.append(a["id"])
            elif a["value"] in title_lower:
                match_ids.append(a["id"])
        v.matched_asset_ids = list(set(match_ids))
        v.affects_assets = len(match_ids) > 0
        if match_ids:
            matched += 1

    await db.commit()
    return {"correlated": matched, "total_vulns": len(vulns)}


# Advisories
@router.get("/advisories/list")
async def list_advisories(
    vendor: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    filters = [Advisory.workspace_id == workspace_id]
    if vendor:
        filters.append(Advisory.vendor.ilike(f"%{vendor}%"))
    total_q = await db.execute(select(func.count()).select_from(Advisory).where(and_(*filters)))
    result = await db.execute(
        select(Advisory).where(and_(*filters)).order_by(Advisory.published_at.desc()).offset(offset).limit(limit))
    items = [{
        "id": a.id, "title": a.title, "description": a.description,
        "vendor": a.vendor, "source_name": a.source_name, "source_url": a.source_url,
        "advisory_id": a.advisory_id, "severity": a.severity,
        "linked_cve_ids": a.linked_cve_ids or [], "published_at": a.published_at,
    } for a in result.scalars().all()]
    return {"items": items, "total": total_q.scalar() or 0, "offset": offset, "limit": limit}
