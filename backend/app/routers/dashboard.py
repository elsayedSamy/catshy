"""Dashboard & Map API endpoints — aggregation for the main dashboard"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import Optional
from datetime import datetime, timedelta
from app.database import get_db
from app.models import Alert, IntelItem, Asset, Entity

dashboard_router = APIRouter()
map_router = APIRouter()


def _parse_range(range_str: str) -> datetime:
    """Convert range string (1h, 6h, 24h, 7d, 30d) to a datetime cutoff."""
    now = datetime.utcnow()
    mapping = {'1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720}
    hours = mapping.get(range_str, 24)
    return now - timedelta(hours=hours)


@dashboard_router.get("/kpis")
async def dashboard_kpis(range: str = "24h", db: AsyncSession = Depends(get_db)):
    cutoff = _parse_range(range)
    prev_cutoff = cutoff - (datetime.utcnow() - cutoff)

    # Critical alerts in period
    crit_q = select(func.count()).select_from(Alert).where(
        and_(Alert.severity == "critical", Alert.triggered_at >= cutoff)
    )
    crit_count = (await db.execute(crit_q)).scalar() or 0

    prev_crit_q = select(func.count()).select_from(Alert).where(
        and_(Alert.severity == "critical", Alert.triggered_at >= prev_cutoff, Alert.triggered_at < cutoff)
    )
    prev_crit = (await db.execute(prev_crit_q)).scalar() or 0
    crit_delta = round(((crit_count - prev_crit) / max(prev_crit, 1)) * 100)

    # New high-confidence IOCs
    ioc_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.confidence_score >= 0.7, IntelItem.fetched_at >= cutoff)
    )
    ioc_count = (await db.execute(ioc_q)).scalar() or 0

    prev_ioc_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.confidence_score >= 0.7, IntelItem.fetched_at >= prev_cutoff, IntelItem.fetched_at < cutoff)
    )
    prev_ioc = (await db.execute(prev_ioc_q)).scalar() or 0
    ioc_delta = round(((ioc_count - prev_ioc) / max(prev_ioc, 1)) * 100)

    # Assets affected
    asset_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.asset_match == True, IntelItem.fetched_at >= cutoff)
    )
    assets_affected = (await db.execute(asset_q)).scalar() or 0

    # Active campaigns (entities of type 'campaign')
    campaign_q = select(func.count()).select_from(Entity).where(Entity.type == "campaign")
    campaigns = (await db.execute(campaign_q)).scalar() or 0

    return {
        "criticalAlerts": crit_count,
        "criticalAlertsDelta": crit_delta,
        "newIocs": ioc_count,
        "newIocsDelta": ioc_delta,
        "assetsAffected": assets_affected,
        "topAssetGroup": "domains",
        "activeCampaigns": campaigns,
    }


@dashboard_router.get("/live-feed")
async def dashboard_live_feed(range: str = "24h", severity: Optional[str] = None,
                              limit: int = 50, db: AsyncSession = Depends(get_db)):
    cutoff = _parse_range(range)
    q = select(IntelItem).where(IntelItem.fetched_at >= cutoff)
    if severity:
        q = q.where(IntelItem.severity == severity)
    q = q.order_by(IntelItem.fetched_at.desc()).limit(limit)
    result = await db.execute(q)
    items = [
        {"id": i.id, "title": i.title, "severity": i.severity, "observable_type": i.observable_type,
         "observable_value": i.observable_value, "source_name": i.source_name, "asset_match": i.asset_match,
         "confidence_score": i.confidence_score, "risk_score": i.risk_score,
         "published_at": str(i.published_at) if i.published_at else None,
         "original_url": i.original_url, "excerpt": i.excerpt, "source_id": i.source_id,
         "fetched_at": str(i.fetched_at), "description": "", "dedup_count": i.dedup_count,
         "matched_assets": [], "tags": []}
        for i in result.scalars().all()
    ]
    return {"items": items}


@map_router.get("/summary")
async def map_summary(range: str = "24h", db: AsyncSession = Depends(get_db)):
    """Aggregated map data: events, hotlist, top threats, countries, CVEs."""
    # In production, this would aggregate from geo-tagged intel data + redis cache.
    # Return empty structure when no data exists.
    return {
        "events": [],
        "hotlist": [],
        "topThreats": [],
        "topCountries": [],
        "topCves": [],
    }


@map_router.get("/country/{code}")
async def map_country_detail(code: str, range: str = "24h", db: AsyncSession = Depends(get_db)):
    """Country-specific threat detail."""
    return {
        "code": code,
        "name": code,
        "threats": {"critical": 0, "high": 0, "medium": 0, "low": 0},
        "topIocs": [],
        "topEventTypes": [],
        "assetsAffected": 0,
    }


@map_router.get("/events")
async def map_events(range: str = "24h", country: Optional[str] = None,
                     severity: Optional[str] = None, limit: int = 100,
                     db: AsyncSession = Depends(get_db)):
    """Filtered map events for drill-down."""
    return []
