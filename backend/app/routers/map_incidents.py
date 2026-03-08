"""Map incidents endpoint — geo-filtered intel for threat map visualization.
Workspace-scoped + auth required."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app.models.intel import IntelItem
from app.core.deps import get_current_user, get_workspace_id

router = APIRouter()


@router.get("/incidents")
async def map_incidents(
    min_lat: Optional[float] = Query(None),
    max_lat: Optional[float] = Query(None),
    min_lon: Optional[float] = Query(None),
    max_lon: Optional[float] = Query(None),
    start: Optional[str] = Query(None),
    end: Optional[str] = Query(None),
    range: str = Query("24h"),
    threat_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    relevant_only: bool = Query(False),
    cluster: bool = Query(True),
    cluster_precision: int = Query(3, ge=1, le=6),
    limit: int = Query(500, le=2000),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    now = datetime.now(timezone.utc)
    if start and end:
        try:
            dt_start = datetime.fromisoformat(start.replace("Z", ""))
            dt_end = datetime.fromisoformat(end.replace("Z", ""))
        except ValueError:
            dt_start = now - timedelta(hours=24)
            dt_end = now
    else:
        mapping = {"1h": 1, "6h": 6, "24h": 24, "7d": 168, "30d": 720}
        hours = mapping.get(range, 24)
        dt_start = now - timedelta(hours=hours)
        dt_end = now

    q = select(IntelItem).where(
        and_(
            IntelItem.workspace_id == wid,
            IntelItem.geo_lat.isnot(None),
            IntelItem.geo_lon.isnot(None),
            func.coalesce(IntelItem.published_at, IntelItem.fetched_at) >= dt_start,
            func.coalesce(IntelItem.published_at, IntelItem.fetched_at) <= dt_end,
        )
    )

    if min_lat is not None and max_lat is not None:
        q = q.where(and_(IntelItem.geo_lat >= min_lat, IntelItem.geo_lat <= max_lat))
    if min_lon is not None and max_lon is not None:
        q = q.where(and_(IntelItem.geo_lon >= min_lon, IntelItem.geo_lon <= max_lon))
    if threat_type:
        q = q.where(IntelItem.severity == threat_type)
    if severity:
        q = q.where(IntelItem.severity == severity)
    if relevant_only:
        q = q.where(IntelItem.asset_match == True)

    q = q.order_by(func.coalesce(IntelItem.published_at, IntelItem.fetched_at).desc()).limit(limit)
    result = await db.execute(q)
    items = result.scalars().all()

    if cluster and items:
        return _cluster_incidents(items, cluster_precision)

    return {
        "type": "incidents",
        "count": len(items),
        "incidents": [_incident_to_dict(i) for i in items],
    }


def _incident_to_dict(item: IntelItem) -> dict:
    return {
        "id": str(item.id),
        "lat": item.geo_lat,
        "lon": item.geo_lon,
        "country": item.geo_country,
        "country_name": item.geo_country_name,
        "city": item.geo_city,
        "title": item.title,
        "severity": item.severity,
        "asset_match": item.asset_match or False,
        "confidence": item.confidence_score or 0,
        "risk": item.risk_score or 0,
        "source_name": item.source_name,
        "campaign": item.campaign_name,
        "timestamp": (item.published_at or item.fetched_at or datetime.now(timezone.utc)).isoformat() + "Z",
    }


def _cluster_incidents(items: list, precision: int) -> dict:
    clusters = {}
    factor = 10 ** precision

    for item in items:
        lat_key = round(item.geo_lat * factor) / factor
        lon_key = round(item.geo_lon * factor) / factor
        key = f"{lat_key},{lon_key}"

        if key not in clusters:
            clusters[key] = {
                "lat": lat_key, "lon": lon_key, "count": 0,
                "severity_max": "info", "has_asset_match": False,
                "countries": set(), "sample_titles": [],
            }

        c = clusters[key]
        c["count"] += 1
        if _sev_rank(item.severity) > _sev_rank(c["severity_max"]):
            c["severity_max"] = item.severity
        if item.asset_match:
            c["has_asset_match"] = True
        if item.geo_country:
            c["countries"].add(item.geo_country)
        if len(c["sample_titles"]) < 3:
            c["sample_titles"].append(item.title[:100])

    return {
        "type": "clusters",
        "count": sum(c["count"] for c in clusters.values()),
        "clusters": [
            {
                "lat": c["lat"], "lon": c["lon"], "count": c["count"],
                "severity_max": c["severity_max"], "has_asset_match": c["has_asset_match"],
                "countries": list(c["countries"]), "sample_titles": c["sample_titles"],
            }
            for c in clusters.values()
        ],
    }


def _sev_rank(s: str) -> int:
    return {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}.get(s, 0)
