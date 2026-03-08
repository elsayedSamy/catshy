"""Dashboard & Map API endpoints — aggregation for the main dashboard"""
import builtins
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case, extract
from typing import Optional
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app.models import Alert, IntelItem, Asset, Entity
from app.models.operations import Source
from app.core.deps import get_current_user

dashboard_router = APIRouter()
map_router = APIRouter()


def _parse_range(range_str: str) -> datetime:
    """Convert range string (1h, 6h, 24h, 7d, 30d) to a datetime cutoff."""
    now = datetime.now(timezone.utc)
    mapping = {'1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720}
    hours = mapping.get(range_str, 24)
    return now - timedelta(hours=hours)


def _bucket_count(range_str: str) -> int:
    return {'1h': 12, '6h': 12, '24h': 24, '7d': 14, '30d': 30}.get(range_str, 24)


@dashboard_router.get("/kpis")
async def dashboard_kpis(range: str = "24h", db: AsyncSession = Depends(get_db),
                         user=Depends(get_current_user)):
    cutoff = _parse_range(range)
    now = datetime.now(timezone.utc)
    prev_cutoff = cutoff - (now - cutoff)

    crit_q = select(func.count()).select_from(Alert).where(
        and_(Alert.severity == "critical", Alert.triggered_at >= cutoff)
    )
    crit_count = (await db.execute(crit_q)).scalar() or 0

    prev_crit_q = select(func.count()).select_from(Alert).where(
        and_(Alert.severity == "critical", Alert.triggered_at >= prev_cutoff, Alert.triggered_at < cutoff)
    )
    prev_crit = (await db.execute(prev_crit_q)).scalar() or 0
    crit_delta = round(((crit_count - prev_crit) / max(prev_crit, 1)) * 100)

    ioc_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.confidence_score >= 0.7, IntelItem.fetched_at >= cutoff)
    )
    ioc_count = (await db.execute(ioc_q)).scalar() or 0

    prev_ioc_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.confidence_score >= 0.7, IntelItem.fetched_at >= prev_cutoff, IntelItem.fetched_at < cutoff)
    )
    prev_ioc = (await db.execute(prev_ioc_q)).scalar() or 0
    ioc_delta = round(((ioc_count - prev_ioc) / max(prev_ioc, 1)) * 100)

    asset_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.asset_match == True, IntelItem.fetched_at >= cutoff)
    )
    assets_affected = (await db.execute(asset_q)).scalar() or 0

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
                              limit: int = 50, db: AsyncSession = Depends(get_db),
                              user=Depends(get_current_user)):
    cutoff = _parse_range(range)
    q = select(IntelItem).where(IntelItem.fetched_at >= cutoff)
    if severity:
        q = q.where(IntelItem.severity == severity)
    q = q.order_by(IntelItem.fetched_at.desc()).limit(limit)
    result = await db.execute(q)
    items = [
        {"id": i.id, "title": i.title, "severity": i.severity,
         "observable_type": i.observable_type or "other",
         "observable_value": i.observable_value or "",
         "source_name": i.source_name, "asset_match": i.asset_match,
         "confidence_score": i.confidence_score, "risk_score": i.risk_score,
         "published_at": str(i.published_at) if i.published_at else None,
         "original_url": i.original_url, "excerpt": i.excerpt, "source_id": i.source_id,
         "fetched_at": str(i.fetched_at), "description": i.description or "",
         "dedup_count": i.dedup_count or 1,
         "matched_assets": i.matched_asset_ids or [], "tags": i.tags or []}
        for i in result.scalars().all()
    ]
    return {"items": items}


# ── NEW: 8 Dashboard Widget Endpoints ──

@dashboard_router.get("/severity")
async def dashboard_severity(range: str = "24h", db: AsyncSession = Depends(get_db),
                             user=Depends(get_current_user)):
    """Severity distribution counts for the pie chart."""
    cutoff = _parse_range(range)
    q = (
        select(IntelItem.severity, func.count().label("cnt"))
        .where(IntelItem.fetched_at >= cutoff)
        .group_by(IntelItem.severity)
    )
    rows = (await db.execute(q)).all()
    result = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
    for sev, cnt in rows:
        if sev in result:
            result[sev] = cnt
    return result


@dashboard_router.get("/timeline")
async def dashboard_timeline(range: str = "24h", db: AsyncSession = Depends(get_db),
                             user=Depends(get_current_user)):
    """Threat timeline: time-bucketed severity counts for line chart."""
    cutoff = _parse_range(range)
    now = datetime.now(timezone.utc)
    span = now - cutoff
    buckets = _bucket_count(range)
    bucket_size = span / buckets

    timeline = []
    for i in builtins.range(buckets):
        b_start = cutoff + bucket_size * i
        b_end = b_start + bucket_size
        q = (
            select(IntelItem.severity, func.count().label("cnt"))
            .where(and_(IntelItem.fetched_at >= b_start, IntelItem.fetched_at < b_end))
            .group_by(IntelItem.severity)
        )
        rows = (await db.execute(q)).all()
        point = {"time": b_start.strftime("%H:%M" if span.days < 2 else "%b %d"), "critical": 0, "high": 0, "medium": 0, "low": 0}
        for sev, cnt in rows:
            if sev in point:
                point[sev] = cnt
        timeline.append(point)
    return timeline


def range_iter(n):
    return __builtins__["range"](n) if isinstance(__builtins__, dict) else builtins_range(n)

import builtins
range_iter = builtins.range


@dashboard_router.get("/top-iocs")
async def dashboard_top_iocs(range: str = "24h", limit: int = 10, db: AsyncSession = Depends(get_db),
                             user=Depends(get_current_user)):
    """Top IOCs by frequency."""
    cutoff = _parse_range(range)
    q = (
        select(
            IntelItem.observable_value,
            IntelItem.observable_type,
            func.count().label("cnt"),
            func.max(IntelItem.severity).label("max_sev"),
        )
        .where(and_(IntelItem.fetched_at >= cutoff, IntelItem.observable_value.isnot(None), IntelItem.observable_value != ""))
        .group_by(IntelItem.observable_value, IntelItem.observable_type)
        .order_by(func.count().desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    return [
        {"value": r[0], "type": r[1] or "other", "hitCount": r[2], "severity": r[3] or "medium"}
        for r in rows
    ]


@dashboard_router.get("/risk-score")
async def dashboard_risk_score(range: str = "24h", db: AsyncSession = Depends(get_db),
                               user=Depends(get_current_user)):
    """Overall risk score with contributing factors."""
    cutoff = _parse_range(range)
    # Average risk score
    avg_q = select(func.avg(IntelItem.risk_score)).where(IntelItem.fetched_at >= cutoff)
    avg_risk = (await db.execute(avg_q)).scalar() or 0
    overall = round(float(avg_risk) * 100)

    # Factor breakdown
    crit_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.severity == "critical", IntelItem.fetched_at >= cutoff))
    crit_count = (await db.execute(crit_q)).scalar() or 0

    match_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.asset_match == True, IntelItem.fetched_at >= cutoff))
    match_count = (await db.execute(match_q)).scalar() or 0

    total_q = select(func.count()).select_from(IntelItem).where(IntelItem.fetched_at >= cutoff)
    total = (await db.execute(total_q)).scalar() or 1

    # Determine trend
    now = datetime.now(timezone.utc)
    mid = cutoff + (now - cutoff) / 2
    first_half = select(func.avg(IntelItem.risk_score)).where(and_(IntelItem.fetched_at >= cutoff, IntelItem.fetched_at < mid))
    second_half = select(func.avg(IntelItem.risk_score)).where(and_(IntelItem.fetched_at >= mid, IntelItem.fetched_at <= now))
    fh = (await db.execute(first_half)).scalar() or 0
    sh = (await db.execute(second_half)).scalar() or 0
    trend = "up" if sh > fh * 1.05 else ("down" if sh < fh * 0.95 else "stable")

    return {
        "overallScore": min(overall, 100),
        "trend": trend,
        "factors": [
            {"label": "Critical Threats", "score": min(crit_count * 10, 100)},
            {"label": "Asset Exposure", "score": min(round(match_count / max(total, 1) * 100), 100)},
            {"label": "Threat Volume", "score": min(round(total / 10), 100)},
            {"label": "Avg Confidence", "score": overall},
        ],
    }


@dashboard_router.get("/recent-alerts")
async def dashboard_recent_alerts(range: str = "24h", limit: int = 20, db: AsyncSession = Depends(get_db),
                                  user=Depends(get_current_user)):
    """Recent alerts for the sidebar widget."""
    cutoff = _parse_range(range)
    q = (
        select(Alert)
        .where(Alert.triggered_at >= cutoff)
        .order_by(Alert.triggered_at.desc())
        .limit(limit)
    )
    result = await db.execute(q)
    return [
        {
            "id": a.id, "title": f"Alert — {a.severity.upper()}", "severity": a.severity,
            "triggered_at": str(a.triggered_at), "status": a.status,
        }
        for a in result.scalars().all()
    ]


@dashboard_router.get("/feed-status")
async def dashboard_feed_status(range: str = "24h", db: AsyncSession = Depends(get_db),
                                user=Depends(get_current_user)):
    """Status of all configured feeds/sources."""
    cutoff = _parse_range(range)
    q = select(Source)
    result = await db.execute(q)
    sources = result.scalars().all()

    items = []
    for s in sources:
        # Count items fetched today for this source
        cnt_q = select(func.count()).select_from(IntelItem).where(
            and_(IntelItem.source_id == s.id, IntelItem.fetched_at >= cutoff)
        )
        cnt = (await db.execute(cnt_q)).scalar() or 0
        items.append({
            "id": s.id, "name": s.name, "health": s.health or "disabled",
            "lastFetch": str(s.last_fetch_at) if s.last_fetch_at else None,
            "itemsToday": cnt,
        })
    return items


@dashboard_router.get("/mitre")
async def dashboard_mitre(range: str = "24h", db: AsyncSession = Depends(get_db),
                          user=Depends(get_current_user)):
    """MITRE ATT&CK tactic heatmap from tags."""
    cutoff = _parse_range(range)
    # Extract MITRE tactics from intel item tags
    MITRE_TACTICS = [
        ("TA0001", "Initial Access"), ("TA0002", "Execution"), ("TA0003", "Persistence"),
        ("TA0004", "Privilege Escalation"), ("TA0005", "Defense Evasion"), ("TA0006", "Credential Access"),
        ("TA0007", "Discovery"), ("TA0008", "Lateral Movement"), ("TA0009", "Collection"),
        ("TA0010", "Exfiltration"), ("TA0011", "Command and Control"), ("TA0040", "Impact"),
    ]

    results = []
    for tid, tname in MITRE_TACTICS:
        # Count items with this tactic tag
        q = select(func.count()).select_from(IntelItem).where(
            and_(IntelItem.fetched_at >= cutoff, IntelItem.tags.any(tid))
        )
        cnt = (await db.execute(q)).scalar() or 0
        sev = "critical" if cnt > 20 else "high" if cnt > 10 else "medium" if cnt > 5 else "low" if cnt > 0 else "none"
        results.append({"id": tid, "name": tname, "techniqueCount": cnt, "severity": sev})
    return results


@dashboard_router.get("/attacked-assets")
async def dashboard_attacked_assets(range: str = "24h", limit: int = 10, db: AsyncSession = Depends(get_db),
                                    user=Depends(get_current_user)):
    """Top attacked assets bar chart."""
    cutoff = _parse_range(range)
    q = (
        select(
            IntelItem.observable_value,
            func.count().label("cnt"),
            func.max(IntelItem.severity).label("max_sev"),
        )
        .where(and_(IntelItem.fetched_at >= cutoff, IntelItem.asset_match == True,
                     IntelItem.observable_value.isnot(None)))
        .group_by(IntelItem.observable_value)
        .order_by(func.count().desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    return [{"asset": r[0], "count": r[1], "severity": r[2] or "medium"} for r in rows]


# ── Map Endpoints ──

@map_router.get("/summary")
async def map_summary(range: str = "24h", db: AsyncSession = Depends(get_db),
                      user=Depends(get_current_user)):
    return {"events": [], "hotlist": [], "topThreats": [], "topCountries": [], "topCves": []}


@map_router.get("/country/{code}")
async def map_country_detail(code: str, range: str = "24h", db: AsyncSession = Depends(get_db),
                             user=Depends(get_current_user)):
    return {
        "code": code, "name": code,
        "threats": {"critical": 0, "high": 0, "medium": 0, "low": 0},
        "topIocs": [], "topEventTypes": [], "assetsAffected": 0,
    }


@map_router.get("/events")
async def map_events(range: str = "24h", country: Optional[str] = None,
                     severity: Optional[str] = None, limit: int = 100,
                     db: AsyncSession = Depends(get_db), user=Depends(get_current_user)):
    return []
