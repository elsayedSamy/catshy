"""Threat Feed & History endpoints — time-window based item retrieval + report generation"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import io, csv, json, uuid

from app.database import get_db
from app.models import IntelItem
from app.services.report_generator import generate_csv_report, generate_html_report, generate_json_report

threats_router = APIRouter()
reports_gen_router = APIRouter()

# ── Helpers ──

def _effective_date(item: IntelItem) -> datetime:
    """Return published_at if available, else fetched_at (UTC)."""
    return item.published_at or item.fetched_at or datetime.utcnow()


def _cutoff_from_range(range_str: str) -> datetime:
    """Convert range string to UTC cutoff datetime."""
    now = datetime.utcnow()
    mapping = {"24h": 24, "7d": 168, "30d": 720}
    hours = mapping.get(range_str, 24)
    return now - timedelta(hours=hours)


def _item_to_dict(i: IntelItem) -> dict:
    return {
        "id": str(i.id),
        "title": i.title,
        "description": i.description or "",
        "severity": i.severity,
        "observable_type": i.observable_type,
        "observable_value": i.observable_value,
        "source_id": i.source_id,
        "source_name": i.source_name,
        "fetched_at": i.fetched_at.isoformat() + "Z" if i.fetched_at else None,
        "published_at": i.published_at.isoformat() + "Z" if i.published_at else None,
        "original_url": i.original_url,
        "excerpt": i.excerpt,
        "dedup_count": i.dedup_count or 1,
        "asset_match": i.asset_match or False,
        "matched_assets": i.matched_asset_ids or [],
        "confidence_score": i.confidence_score or 0,
        "risk_score": i.risk_score or 0,
        "tags": i.tags or [],
    }


# ── Feed: fresh items < 24h ──

@threats_router.get("/feed")
async def threat_feed(
    severity: Optional[str] = None,
    source_id: Optional[str] = None,
    asset_match_only: bool = False,
    sort: str = "newest",
    offset: int = 0,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Return items younger than 24 hours (fresh feed)."""
    now = datetime.utcnow()
    cutoff_24h = now - timedelta(hours=24)
    max_age = now - timedelta(days=30)

    # Use COALESCE(published_at, fetched_at) for effective date
    effective = func.coalesce(IntelItem.published_at, IntelItem.fetched_at)
    q = select(IntelItem).where(
        and_(effective >= cutoff_24h, effective >= max_age)
    )
    if severity:
        q = q.where(IntelItem.severity == severity)
    if source_id:
        q = q.where(IntelItem.source_id == source_id)
    if asset_match_only:
        q = q.where(IntelItem.asset_match == True)

    # Count
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Sort
    order = effective.desc() if sort == "newest" else effective.asc()
    q = q.order_by(order).offset(offset).limit(limit)
    result = await db.execute(q)
    items = [_item_to_dict(i) for i in result.scalars().all()]

    return {"items": items, "total": total, "offset": offset, "limit": limit}


# ── History: items >= 24h and <= 30d ──

@threats_router.get("/history")
async def threat_history(
    range: Optional[str] = Query(None, regex="^(24h|7d|30d)$"),
    start: Optional[str] = None,
    end: Optional[str] = None,
    severity: Optional[str] = None,
    source_id: Optional[str] = None,
    search: Optional[str] = None,
    asset_match_only: bool = False,
    sort: str = "newest",
    offset: int = 0,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Return items older than 24h but within 30d retention window.
    Supports preset ranges (24h, 7d, 30d) or custom start/end ISO dates.
    """
    now = datetime.utcnow()
    max_age = now - timedelta(days=30)
    effective = func.coalesce(IntelItem.published_at, IntelItem.fetched_at)

    if start and end:
        # Custom range
        try:
            dt_start = datetime.fromisoformat(start.replace("Z", "+00:00").replace("+00:00", ""))
            dt_end = datetime.fromisoformat(end.replace("Z", "+00:00").replace("+00:00", ""))
        except ValueError:
            raise HTTPException(400, "Invalid ISO date format for start/end")
        if dt_end < dt_start:
            raise HTTPException(400, "end must be >= start")
        if (dt_end - dt_start).days > 30:
            raise HTTPException(400, "Custom range cannot exceed 30 days (retention policy)")
        # Clamp to retention window
        dt_start = max(dt_start, max_age)
        q = select(IntelItem).where(and_(effective >= dt_start, effective <= dt_end))
    elif range:
        cutoff = _cutoff_from_range(range)
        cutoff = max(cutoff, max_age)
        q = select(IntelItem).where(and_(effective >= cutoff, effective <= now))
    else:
        # Default: show history (>= 24h old, <= 30d)
        cutoff_24h = now - timedelta(hours=24)
        q = select(IntelItem).where(and_(effective >= max_age, effective < cutoff_24h))

    if severity:
        q = q.where(IntelItem.severity == severity)
    if source_id:
        q = q.where(IntelItem.source_id == source_id)
    if asset_match_only:
        q = q.where(IntelItem.asset_match == True)
    if search:
        pattern = f"%{search}%"
        q = q.where(or_(IntelItem.title.ilike(pattern), IntelItem.description.ilike(pattern)))

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    order = effective.desc() if sort == "newest" else effective.asc()
    q = q.order_by(order).offset(offset).limit(limit)
    result = await db.execute(q)
    items = [_item_to_dict(i) for i in result.scalars().all()]

    return {
        "items": items,
        "total": total,
        "offset": offset,
        "limit": limit,
        "queried_at": now.isoformat() + "Z",
    }


# ── Report Generation ──

class ReportRequest(BaseModel):
    scope: str = "feed"  # "feed" or "history"
    preset: Optional[str] = None  # "today", "7d", "30d"
    start: Optional[str] = None
    end: Optional[str] = None
    format: str = "csv"  # "csv", "html", "json"
    severity: Optional[str] = None


@reports_gen_router.post("/generate")
async def generate_threat_report(req: ReportRequest, db: AsyncSession = Depends(get_db)):
    """Generate a downloadable report from threat feed or history data."""
    now = datetime.utcnow()
    max_age = now - timedelta(days=30)
    effective = func.coalesce(IntelItem.published_at, IntelItem.fetched_at)

    # Determine time window
    if req.start and req.end:
        try:
            dt_start = datetime.fromisoformat(req.start.replace("Z", "").replace("+00:00", ""))
            dt_end = datetime.fromisoformat(req.end.replace("Z", "").replace("+00:00", ""))
        except ValueError:
            raise HTTPException(400, "Invalid date format")
        if dt_end < dt_start:
            raise HTTPException(400, "end must be >= start")
        if (dt_end - dt_start).days > 30:
            raise HTTPException(400, "Max range is 30 days")
        dt_start = max(dt_start, max_age)
    elif req.preset == "today":
        dt_start = now - timedelta(hours=24)
        dt_end = now
    elif req.preset == "7d":
        dt_start = now - timedelta(days=7)
        dt_end = now
    elif req.preset == "30d":
        dt_start = max_age
        dt_end = now
    else:
        # Default: last 24h
        dt_start = now - timedelta(hours=24)
        dt_end = now

    q = select(IntelItem).where(and_(effective >= dt_start, effective <= dt_end))
    if req.severity:
        q = q.where(IntelItem.severity == req.severity)
    q = q.order_by(effective.desc()).limit(5000)
    result = await db.execute(q)
    rows = result.scalars().all()
    items_dicts = [_item_to_dict(i) for i in rows]

    report_title = f"CATSHY Threat Intelligence Report — {req.preset or 'Custom Range'}"
    period_str = f"{dt_start.strftime('%Y-%m-%d %H:%M')} to {dt_end.strftime('%Y-%m-%d %H:%M')} UTC"
    metadata = {
        "company_name": "CATSHY",
        "report_id": str(uuid.uuid4())[:8],
        "generated_by": "System",
        "format": req.format.upper(),
        "classification": "TLP:AMBER",
    }

    if req.format == "csv":
        fields = ["id", "title", "severity", "observable_type", "observable_value",
                   "source_name", "published_at", "fetched_at", "original_url",
                   "asset_match", "confidence_score", "risk_score", "tags"]
        csv_content = generate_csv_report(items_dicts, fields)
        return StreamingResponse(
            io.BytesIO(csv_content.encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="catshy-report-{metadata["report_id"]}.csv"'},
        )
    elif req.format == "html":
        sections = [
            {"heading": "Report Period", "type": "narrative", "content": period_str},
            {"heading": "Summary", "type": "narrative",
             "content": f"Total items: {len(items_dicts)}. "
                        f"Critical: {sum(1 for i in items_dicts if i['severity']=='critical')}. "
                        f"High: {sum(1 for i in items_dicts if i['severity']=='high')}. "
                        f"Medium: {sum(1 for i in items_dicts if i['severity']=='medium')}."},
            {"heading": "Items", "type": "evidence",
             "content": "\n".join(f"[{i['severity'].upper()}] {i['title']} — {i['observable_value']} (via {i['source_name']})" for i in items_dicts[:100])},
        ]
        html = generate_html_report(report_title, sections, metadata)
        return StreamingResponse(
            io.BytesIO(html.encode("utf-8")),
            media_type="text/html",
            headers={"Content-Disposition": f'attachment; filename="catshy-report-{metadata["report_id"]}.html"'},
        )
    elif req.format == "json":
        json_str = generate_json_report(report_title, [], metadata, items_dicts)
        return StreamingResponse(
            io.BytesIO(json_str.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="catshy-report-{metadata["report_id"]}.json"'},
        )
    else:
        raise HTTPException(400, f"Unsupported format: {req.format}. Use csv, html, or json.")
