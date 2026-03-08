"""Executive Dashboard & Scheduled Reports API endpoints."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.database import get_db
from app.models import Alert, IntelItem, Asset, Entity
from app.models.operations import Source
from app.models.intel import SourceStats, UserFeedback, Observable
from app.core.deps import get_current_user, get_workspace_id

router = APIRouter()


def _parse_range(range_str: str) -> datetime:
    now = datetime.now(timezone.utc)
    mapping = {'1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720}
    return now - timedelta(hours=mapping.get(range_str, 24))


@router.get("/executive/summary")
async def executive_summary(
    range: str = Query("7d"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """Executive summary — high-level risk posture for management."""
    cutoff = _parse_range(range)
    now = datetime.now(timezone.utc)
    prev_cutoff = cutoff - (now - cutoff)

    # Total threats
    total = (await db.execute(
        select(func.count()).select_from(IntelItem).where(
            IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff)
    )).scalar() or 0

    prev_total = (await db.execute(
        select(func.count()).select_from(IntelItem).where(
            IntelItem.workspace_id == wid, IntelItem.fetched_at >= prev_cutoff, IntelItem.fetched_at < cutoff)
    )).scalar() or 0

    # Critical + High
    critical = (await db.execute(
        select(func.count()).select_from(IntelItem).where(
            IntelItem.workspace_id == wid, IntelItem.severity == "critical", IntelItem.fetched_at >= cutoff)
    )).scalar() or 0

    high = (await db.execute(
        select(func.count()).select_from(IntelItem).where(
            IntelItem.workspace_id == wid, IntelItem.severity == "high", IntelItem.fetched_at >= cutoff)
    )).scalar() or 0

    # Asset matches
    asset_hits = (await db.execute(
        select(func.count()).select_from(IntelItem).where(
            IntelItem.workspace_id == wid, IntelItem.asset_match == True, IntelItem.fetched_at >= cutoff)
    )).scalar() or 0

    # Average risk score
    avg_risk = (await db.execute(
        select(func.avg(IntelItem.risk_score)).where(
            IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff)
    )).scalar() or 0

    # Active sources
    active_sources = (await db.execute(
        select(func.count()).select_from(Source).where(
            Source.workspace_id == wid, Source.enabled == True)
    )).scalar() or 0

    # Unique IOC types
    ioc_types = (await db.execute(
        select(IntelItem.observable_type, func.count().label("cnt"))
        .where(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff,
               IntelItem.observable_type.isnot(None))
        .group_by(IntelItem.observable_type)
        .order_by(func.count().desc())
    )).all()

    # MITRE coverage
    mitre_count = (await db.execute(
        select(func.count()).select_from(IntelItem).where(
            IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff,
            func.array_length(IntelItem.mitre_technique_ids, 1) > 0)
    )).scalar() or 0

    # Severity distribution
    sev_rows = (await db.execute(
        select(IntelItem.severity, func.count().label("cnt"))
        .where(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff)
        .group_by(IntelItem.severity)
    )).all()
    severity_dist = {r[0]: r[1] for r in sev_rows}

    # Trend (daily counts for chart)
    days = max(1, int((now - cutoff).total_seconds() / 86400))
    daily_trend = []
    for d in range(min(days, 30)):
        day_start = cutoff + timedelta(days=d)
        day_end = day_start + timedelta(days=1)
        day_count = (await db.execute(
            select(func.count()).select_from(IntelItem).where(
                IntelItem.workspace_id == wid,
                IntelItem.fetched_at >= day_start, IntelItem.fetched_at < day_end)
        )).scalar() or 0
        daily_trend.append({
            "date": day_start.strftime("%b %d"),
            "count": day_count,
        })

    # Risk level
    risk_pct = round(float(avg_risk) * 100)
    risk_level = "critical" if risk_pct >= 75 else "high" if risk_pct >= 50 else "medium" if risk_pct >= 25 else "low"

    delta_pct = round(((total - prev_total) / max(prev_total, 1)) * 100)

    return {
        "risk_level": risk_level,
        "risk_score": risk_pct,
        "total_threats": total,
        "threats_delta_pct": delta_pct,
        "critical_count": critical,
        "high_count": high,
        "asset_matches": asset_hits,
        "active_sources": active_sources,
        "mitre_mapped": mitre_count,
        "severity_distribution": severity_dist,
        "ioc_type_breakdown": [{"type": r[0], "count": r[1]} for r in ioc_types],
        "daily_trend": daily_trend,
        "period": range,
    }


@router.get("/executive/top-risks")
async def executive_top_risks(
    range: str = Query("7d"),
    limit: int = Query(10),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """Top risk items for executive review — sorted by risk score."""
    cutoff = _parse_range(range)
    result = await db.execute(
        select(IntelItem)
        .where(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff)
        .order_by(IntelItem.risk_score.desc())
        .limit(limit)
    )
    items = result.scalars().all()
    return [
        {
            "id": i.id, "title": i.title, "severity": i.severity,
            "risk_score": round(float(i.risk_score or 0) * 100),
            "confidence_score": round(float(i.confidence_score or 0)),
            "observable_type": i.observable_type, "observable_value": i.observable_value,
            "asset_match": i.asset_match, "source_name": i.source_name,
            "campaign_name": i.campaign_name,
            "mitre_tactics": i.mitre_tactics or [],
            "published_at": str(i.published_at) if i.published_at else None,
        }
        for i in items
    ]


@router.get("/executive/source-performance")
async def executive_source_performance(
    range: str = Query("7d"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """Source performance metrics for executive view."""
    cutoff = _parse_range(range)
    sources = (await db.execute(
        select(Source).where(Source.workspace_id == wid)
    )).scalars().all()

    performance = []
    for s in sources:
        item_count = (await db.execute(
            select(func.count()).select_from(IntelItem).where(
                IntelItem.workspace_id == wid, IntelItem.source_id == s.id,
                IntelItem.fetched_at >= cutoff)
        )).scalar() or 0

        match_count = (await db.execute(
            select(func.count()).select_from(IntelItem).where(
                IntelItem.workspace_id == wid, IntelItem.source_id == s.id,
                IntelItem.asset_match == True, IntelItem.fetched_at >= cutoff)
        )).scalar() or 0

        performance.append({
            "id": s.id, "name": s.name, "health": s.health or "disabled",
            "items_collected": item_count, "asset_matches": match_count,
            "match_rate": round(match_count / max(item_count, 1) * 100, 1),
            "last_fetch": str(s.last_fetch_at) if s.last_fetch_at else None,
        })

    return sorted(performance, key=lambda x: x["items_collected"], reverse=True)


# ── Scheduled Reports ──

@router.post("/reports/generate")
async def generate_scheduled_report(
    report_type: str = Query("daily", description="daily, weekly, executive"),
    format: str = Query("json", description="json, html, csv"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """Generate a report on demand. Supports daily brief, weekly summary, and executive overview."""
    now = datetime.now(timezone.utc)

    if report_type == "daily":
        cutoff = now - timedelta(hours=24)
        title = f"Daily Threat Brief — {now.strftime('%Y-%m-%d')}"
    elif report_type == "weekly":
        cutoff = now - timedelta(days=7)
        title = f"Weekly Threat Summary — {now.strftime('%Y-%m-%d')}"
    else:
        cutoff = now - timedelta(days=30)
        title = f"Executive Overview — {now.strftime('%Y-%m-%d')}"

    # Gather data
    total = (await db.execute(
        select(func.count()).select_from(IntelItem).where(
            IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff)
    )).scalar() or 0

    sev_rows = (await db.execute(
        select(IntelItem.severity, func.count().label("cnt"))
        .where(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff)
        .group_by(IntelItem.severity)
    )).all()
    severity = {r[0]: r[1] for r in sev_rows}

    asset_hits = (await db.execute(
        select(func.count()).select_from(IntelItem).where(
            IntelItem.workspace_id == wid, IntelItem.asset_match == True, IntelItem.fetched_at >= cutoff)
    )).scalar() or 0

    top_items = (await db.execute(
        select(IntelItem)
        .where(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff)
        .order_by(IntelItem.risk_score.desc())
        .limit(10)
    )).scalars().all()

    top_sources = (await db.execute(
        select(IntelItem.source_name, func.count().label("cnt"))
        .where(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff)
        .group_by(IntelItem.source_name)
        .order_by(func.count().desc())
        .limit(5)
    )).all()

    avg_risk = (await db.execute(
        select(func.avg(IntelItem.risk_score)).where(
            IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff)
    )).scalar() or 0

    report_data = {
        "title": title,
        "type": report_type,
        "period": {"from": cutoff.isoformat(), "to": now.isoformat()},
        "summary": {
            "total_threats": total,
            "severity_breakdown": severity,
            "asset_matches": asset_hits,
            "avg_risk_score": round(float(avg_risk) * 100),
        },
        "top_threats": [
            {
                "title": i.title, "severity": i.severity,
                "risk_score": round(float(i.risk_score or 0) * 100),
                "observable": i.observable_value, "source": i.source_name,
            }
            for i in top_items
        ],
        "top_sources": [{"name": r[0], "count": r[1]} for r in top_sources],
        "generated_at": now.isoformat(),
        "generated_by": user.id if hasattr(user, 'id') else "system",
    }

    if format == "html":
        from app.services.report_generator import generate_html_report
        sections = [
            {"heading": "Summary", "type": "narrative",
             "content": f"Total threats: {total}. Critical: {severity.get('critical', 0)}. Asset matches: {asset_hits}."},
            {"heading": "Severity Breakdown", "type": "narrative",
             "content": ", ".join(f"{k}: {v}" for k, v in severity.items())},
        ]
        html = generate_html_report(title, sections, {"report_id": f"rpt-{now.strftime('%Y%m%d')}"})
        return {"format": "html", "content": html, "title": title}

    return report_data
