"""Dashboard & Map API endpoints — aggregation for the main dashboard.
All queries are scoped to the authenticated user's workspace_id."""
import builtins
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case, extract
from typing import Optional
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app.models import Alert, IntelItem, Asset, Entity
from app.models.operations import Source
from app.core.deps import get_current_user, get_workspace_id

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
                         user=Depends(get_current_user), wid: str = Depends(get_workspace_id)):
    cutoff = _parse_range(range)
    now = datetime.now(timezone.utc)
    prev_cutoff = cutoff - (now - cutoff)

    crit_q = select(func.count()).select_from(Alert).where(
        and_(Alert.workspace_id == wid, Alert.severity == "critical", Alert.triggered_at >= cutoff)
    )
    crit_count = (await db.execute(crit_q)).scalar() or 0

    prev_crit_q = select(func.count()).select_from(Alert).where(
        and_(Alert.workspace_id == wid, Alert.severity == "critical",
             Alert.triggered_at >= prev_cutoff, Alert.triggered_at < cutoff)
    )
    prev_crit = (await db.execute(prev_crit_q)).scalar() or 0
    crit_delta = round(((crit_count - prev_crit) / max(prev_crit, 1)) * 100)

    ioc_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.workspace_id == wid, IntelItem.confidence_score >= 0.7, IntelItem.fetched_at >= cutoff)
    )
    ioc_count = (await db.execute(ioc_q)).scalar() or 0

    prev_ioc_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.workspace_id == wid, IntelItem.confidence_score >= 0.7,
             IntelItem.fetched_at >= prev_cutoff, IntelItem.fetched_at < cutoff)
    )
    prev_ioc = (await db.execute(prev_ioc_q)).scalar() or 0
    ioc_delta = round(((ioc_count - prev_ioc) / max(prev_ioc, 1)) * 100)

    asset_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.workspace_id == wid, IntelItem.asset_match == True, IntelItem.fetched_at >= cutoff)
    )
    assets_affected = (await db.execute(asset_q)).scalar() or 0

    campaign_q = select(func.count()).select_from(Entity).where(
        and_(Entity.workspace_id == wid, Entity.type == "campaign")
    )
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
                              user=Depends(get_current_user), wid: str = Depends(get_workspace_id)):
    cutoff = _parse_range(range)
    q = select(IntelItem).where(and_(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff))
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


# ── Dashboard Widget Endpoints ──

@dashboard_router.get("/severity")
async def dashboard_severity(range: str = "24h", db: AsyncSession = Depends(get_db),
                             user=Depends(get_current_user), wid: str = Depends(get_workspace_id)):
    cutoff = _parse_range(range)
    q = (
        select(IntelItem.severity, func.count().label("cnt"))
        .where(and_(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff))
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
                             user=Depends(get_current_user), wid: str = Depends(get_workspace_id)):
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
            .where(and_(IntelItem.workspace_id == wid,
                        IntelItem.fetched_at >= b_start, IntelItem.fetched_at < b_end))
            .group_by(IntelItem.severity)
        )
        rows = (await db.execute(q)).all()
        point = {"time": b_start.strftime("%H:%M" if span.days < 2 else "%b %d"),
                 "critical": 0, "high": 0, "medium": 0, "low": 0}
        for sev, cnt in rows:
            if sev in point:
                point[sev] = cnt
        timeline.append(point)
    return timeline


@dashboard_router.get("/top-iocs")
async def dashboard_top_iocs(range: str = "24h", limit: int = 10, db: AsyncSession = Depends(get_db),
                             user=Depends(get_current_user), wid: str = Depends(get_workspace_id)):
    cutoff = _parse_range(range)
    q = (
        select(
            IntelItem.observable_value,
            IntelItem.observable_type,
            func.count().label("cnt"),
            func.max(IntelItem.severity).label("max_sev"),
        )
        .where(and_(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff,
                     IntelItem.observable_value.isnot(None), IntelItem.observable_value != ""))
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
                               user=Depends(get_current_user), wid: str = Depends(get_workspace_id)):
    cutoff = _parse_range(range)
    avg_q = select(func.avg(IntelItem.risk_score)).where(
        and_(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff))
    avg_risk = (await db.execute(avg_q)).scalar() or 0
    overall = round(float(avg_risk) * 100)

    crit_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.workspace_id == wid, IntelItem.severity == "critical", IntelItem.fetched_at >= cutoff))
    crit_count = (await db.execute(crit_q)).scalar() or 0

    match_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.workspace_id == wid, IntelItem.asset_match == True, IntelItem.fetched_at >= cutoff))
    match_count = (await db.execute(match_q)).scalar() or 0

    total_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff))
    total = (await db.execute(total_q)).scalar() or 1

    now = datetime.now(timezone.utc)
    mid = cutoff + (now - cutoff) / 2
    first_half = select(func.avg(IntelItem.risk_score)).where(
        and_(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff, IntelItem.fetched_at < mid))
    second_half = select(func.avg(IntelItem.risk_score)).where(
        and_(IntelItem.workspace_id == wid, IntelItem.fetched_at >= mid, IntelItem.fetched_at <= now))
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
                                  user=Depends(get_current_user), wid: str = Depends(get_workspace_id)):
    cutoff = _parse_range(range)
    q = (
        select(Alert)
        .where(and_(Alert.workspace_id == wid, Alert.triggered_at >= cutoff))
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
                                user=Depends(get_current_user), wid: str = Depends(get_workspace_id)):
    cutoff = _parse_range(range)
    q = select(Source).where(Source.workspace_id == wid)
    result = await db.execute(q)
    sources = result.scalars().all()

    items = []
    for s in sources:
        cnt_q = select(func.count()).select_from(IntelItem).where(
            and_(IntelItem.workspace_id == wid, IntelItem.source_id == s.id, IntelItem.fetched_at >= cutoff)
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
                          user=Depends(get_current_user), wid: str = Depends(get_workspace_id)):
    """MITRE heatmap — uses stored MITRE mappings from intel items."""
    cutoff = _parse_range(range)

    # Query items that have MITRE tactics stored
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

    tactic_counts: dict = {}
    tactic_max_sev: dict = {}
    sev_order = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}

    for tactics_arr, severity in rows:
        if not tactics_arr:
            continue
        for tactic in tactics_arr:
            tactic_counts[tactic] = tactic_counts.get(tactic, 0) + 1
            cur = tactic_max_sev.get(tactic, "none")
            if sev_order.get(severity, 0) > sev_order.get(cur, -1):
                tactic_max_sev[tactic] = severity

    # Fallback: also count from tags for items without stored MITRE
    tag_q = (
        select(IntelItem.tags)
        .where(and_(
            IntelItem.workspace_id == wid,
            IntelItem.fetched_at >= cutoff,
            (IntelItem.mitre_tactics == None) | (func.array_length(IntelItem.mitre_tactics, 1) == 0),
        ))
    )
    tag_rows = (await db.execute(tag_q)).all()
    MITRE_TACTICS = [
        ("TA0001", "Initial Access"), ("TA0002", "Execution"), ("TA0003", "Persistence"),
        ("TA0004", "Privilege Escalation"), ("TA0005", "Defense Evasion"), ("TA0006", "Credential Access"),
        ("TA0007", "Discovery"), ("TA0008", "Lateral Movement"), ("TA0009", "Collection"),
        ("TA0010", "Exfiltration"), ("TA0011", "Command and Control"), ("TA0040", "Impact"),
    ]
    for (tags,) in tag_rows:
        if not tags:
            continue
        for tid, _ in MITRE_TACTICS:
            if tid in tags:
                tactic_counts[tid] = tactic_counts.get(tid, 0) + 1

    results = []
    for tid, tname in MITRE_TACTICS:
        cnt = tactic_counts.get(tid, 0)
        sev = tactic_max_sev.get(tid, "none")
        if cnt == 0:
            sev = "none"
        elif cnt > 20:
            sev = "critical"
        elif cnt > 10:
            sev = "high" if sev_order.get(sev, 0) < 3 else sev
        results.append({"id": tid, "name": tname, "techniqueCount": cnt, "severity": sev})
    return results


@dashboard_router.get("/attacked-assets")
async def dashboard_attacked_assets(range: str = "24h", limit: int = 10, db: AsyncSession = Depends(get_db),
                                    user=Depends(get_current_user), wid: str = Depends(get_workspace_id)):
    cutoff = _parse_range(range)
    q = (
        select(
            IntelItem.observable_value,
            func.count().label("cnt"),
            func.max(IntelItem.severity).label("max_sev"),
        )
        .where(and_(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff,
                     IntelItem.asset_match == True, IntelItem.observable_value.isnot(None)))
        .group_by(IntelItem.observable_value)
        .order_by(func.count().desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    return [{"asset": r[0], "count": r[1], "severity": r[2] or "medium"} for r in rows]


# ── Map Endpoints ──

@map_router.get("/summary")
async def map_summary(range: str = "24h", db: AsyncSession = Depends(get_db),
                      user=Depends(get_current_user), wid: str = Depends(get_workspace_id)):
    return {"events": [], "hotlist": [], "topThreats": [], "topCountries": [], "topCves": []}


@map_router.get("/country/{code}")
async def map_country_detail(code: str, range: str = "24h", db: AsyncSession = Depends(get_db),
                             user=Depends(get_current_user), wid: str = Depends(get_workspace_id)):
    return {
        "code": code, "name": code,
        "threats": {"critical": 0, "high": 0, "medium": 0, "low": 0},
        "topIocs": [], "topEventTypes": [], "assetsAffected": 0,
    }


@map_router.get("/events")
async def map_events(range: str = "24h", country: Optional[str] = None,
                     severity: Optional[str] = None, limit: int = 100,
                     db: AsyncSession = Depends(get_db), user=Depends(get_current_user),
                     wid: str = Depends(get_workspace_id)):
    return []
