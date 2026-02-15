"""Dashboard extended endpoints — pulse & changes for dashboard widgets."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from app.database import get_db
from app.models.intel import IntelItem

router = APIRouter()


def _parse_range(range_str: str) -> datetime:
    now = datetime.utcnow()
    mapping = {'1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720}
    hours = mapping.get(range_str, 24)
    return now - timedelta(hours=hours)


@router.get("/pulse")
async def dashboard_pulse(range: str = "24h", db: AsyncSession = Depends(get_db)):
    """Threat pulse — counts of new intel, critical CVEs, leaks, phishing & malware."""
    cutoff = _parse_range(range)

    # New intel
    new_q = select(func.count()).select_from(IntelItem).where(IntelItem.fetched_at >= cutoff)
    new_intel = (await db.execute(new_q)).scalar() or 0

    # Critical CVEs
    cve_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.observable_type == "cve", IntelItem.severity == "critical", IntelItem.fetched_at >= cutoff)
    )
    critical_cves = (await db.execute(cve_q)).scalar() or 0

    # Leak items (severity high+)
    leak_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.fetched_at >= cutoff, IntelItem.severity.in_(["critical", "high"]))
    )
    leak_items = (await db.execute(leak_q)).scalar() or 0

    # Phishing
    phish_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.fetched_at >= cutoff, IntelItem.title.ilike("%phish%"))
    )
    phishing = (await db.execute(phish_q)).scalar() or 0

    # Malware
    malware_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.fetched_at >= cutoff, IntelItem.title.ilike("%malware%"))
    )
    malware = (await db.execute(malware_q)).scalar() or 0

    return {
        "newIntel": new_intel,
        "criticalCves": critical_cves,
        "leakItems": leak_items,
        "phishingSpikes": phishing,
        "malwareSpikes": malware,
    }


@router.get("/changes")
async def dashboard_changes(range: str = "24h", db: AsyncSession = Depends(get_db)):
    """What changed since yesterday — source spikes, trending keywords, targeted assets."""
    cutoff = _parse_range(range)
    prev_cutoff = cutoff - (datetime.utcnow() - cutoff)

    # Source spikes: sources with most new items in range
    source_q = (
        select(IntelItem.source_name, func.count().label("cnt"))
        .where(IntelItem.fetched_at >= cutoff)
        .group_by(IntelItem.source_name)
        .order_by(func.count().desc())
        .limit(5)
    )
    source_rows = (await db.execute(source_q)).all()

    # Previous period counts for delta
    source_spikes = []
    for row in source_rows:
        prev_q = select(func.count()).select_from(IntelItem).where(
            and_(IntelItem.source_name == row[0], IntelItem.fetched_at >= prev_cutoff, IntelItem.fetched_at < cutoff)
        )
        prev_count = (await db.execute(prev_q)).scalar() or 0
        delta = row[1] - prev_count
        source_spikes.append({"name": row[0], "count": row[1], "delta": delta})

    # Most targeted assets (by asset_match items)
    asset_q = (
        select(IntelItem.observable_value, func.count().label("cnt"))
        .where(and_(IntelItem.asset_match == True, IntelItem.fetched_at >= cutoff))
        .group_by(IntelItem.observable_value)
        .order_by(func.count().desc())
        .limit(5)
    )
    asset_rows = (await db.execute(asset_q)).all()
    most_targeted = [{"value": r[0], "count": r[1]} for r in asset_rows]

    return {
        "sourceSpikes": source_spikes,
        "trendingKeywords": [],  # Requires NLP/keyword extraction — placeholder
        "mostTargetedAssets": most_targeted,
    }
