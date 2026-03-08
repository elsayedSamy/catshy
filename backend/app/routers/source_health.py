"""Source Health & Failed Ingestions router — streaming observability for the dashboard."""
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.database import get_db
from app.models.operations import Source, FailedIngestion
from app.models.intel import IntelItem
from app.core.deps import get_current_user, get_workspace_id, require_team_admin

logger = logging.getLogger("catshy.source_health")
router = APIRouter()


def _parse_range(range_str: str) -> datetime:
    now = datetime.now(timezone.utc)
    mapping = {"1h": 1, "6h": 6, "24h": 24, "7d": 168, "30d": 720}
    hours = mapping.get(range_str, 24)
    return now - timedelta(hours=hours)


@router.get("/health")
async def source_health_list(
    range: str = "24h",
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """Full source health table for the dashboard."""
    cutoff = _parse_range(range)
    result = await db.execute(select(Source).where(Source.workspace_id == wid))
    sources = result.scalars().all()

    items = []
    for s in sources:
        # Count items ingested in range
        cnt_q = select(func.count()).select_from(IntelItem).where(
            and_(IntelItem.workspace_id == wid, IntelItem.source_id == s.id, IntelItem.fetched_at >= cutoff)
        )
        ingested = (await db.execute(cnt_q)).scalar() or 0

        # Count failures in range
        fail_q = select(func.count()).select_from(FailedIngestion).where(
            and_(FailedIngestion.workspace_id == wid, FailedIngestion.source_id == s.id,
                 FailedIngestion.created_at >= cutoff)
        )
        failures = (await db.execute(fail_q)).scalar() or 0

        items.append({
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "connector_type": s.connector_type,
            "enabled": s.enabled,
            "health": s.health,
            "last_fetch_at": s.last_fetch_at.isoformat() if s.last_fetch_at else None,
            "last_success_at": s.last_success_at.isoformat() if s.last_success_at else None,
            "next_fetch_at": s.next_fetch_at.isoformat() if s.next_fetch_at else None,
            "consecutive_failures": s.consecutive_failures or 0,
            "backoff_seconds": s.backoff_seconds or 0,
            "last_error": s.last_error,
            "last_fetched_count": s.last_fetched_count or 0,
            "last_new_count": s.last_new_count or 0,
            "last_dedup_count": s.last_dedup_count or 0,
            "total_items": s.item_count or 0,
            "ingested_in_range": ingested,
            "failures_in_range": failures,
            "polling_interval_minutes": s.polling_interval_minutes,
        })

    return {"items": items, "total": len(items)}


@router.get("/ingestion-rate")
async def ingestion_rate(
    range: str = "24h",
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """Ingestion rate metrics — items/hour bucketed over time range."""
    cutoff = _parse_range(range)
    now = datetime.now(timezone.utc)
    span = now - cutoff

    # Determine bucket size
    if span <= timedelta(hours=6):
        bucket_minutes = 10
    elif span <= timedelta(hours=24):
        bucket_minutes = 60
    else:
        bucket_minutes = 360  # 6h buckets

    bucket_size = timedelta(minutes=bucket_minutes)
    buckets = int(span / bucket_size)

    timeline = []
    for i in range(buckets):
        b_start = cutoff + bucket_size * i
        b_end = b_start + bucket_size

        total_q = select(func.count()).select_from(IntelItem).where(
            and_(IntelItem.workspace_id == wid,
                 IntelItem.fetched_at >= b_start, IntelItem.fetched_at < b_end)
        )
        total = (await db.execute(total_q)).scalar() or 0

        fail_q = select(func.count()).select_from(FailedIngestion).where(
            and_(FailedIngestion.workspace_id == wid,
                 FailedIngestion.created_at >= b_start, FailedIngestion.created_at < b_end)
        )
        fails = (await db.execute(fail_q)).scalar() or 0

        label = b_start.strftime("%H:%M" if span.days < 2 else "%b %d %H:%M")
        timeline.append({"time": label, "ingested": total, "failed": fails})

    # Totals
    total_ingested_q = select(func.count()).select_from(IntelItem).where(
        and_(IntelItem.workspace_id == wid, IntelItem.fetched_at >= cutoff))
    total_ingested = (await db.execute(total_ingested_q)).scalar() or 0

    total_failed_q = select(func.count()).select_from(FailedIngestion).where(
        and_(FailedIngestion.workspace_id == wid, FailedIngestion.created_at >= cutoff))
    total_failed = (await db.execute(total_failed_q)).scalar() or 0

    hours = max(span.total_seconds() / 3600, 1)
    return {
        "timeline": timeline,
        "total_ingested": total_ingested,
        "total_failed": total_failed,
        "rate_per_hour": round(total_ingested / hours, 1),
    }


# ── Failed Ingestions (Dead Letter) ──

@router.get("/failures")
async def list_failures(
    status: str = Query("failed", regex="^(failed|retrying|resolved|abandoned|all)$"),
    source_id: str = None,
    offset: int = 0,
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    wid: str = Depends(get_workspace_id),
):
    """List failed ingestions (dead-letter queue)."""
    q = select(FailedIngestion).where(FailedIngestion.workspace_id == wid)
    if status != "all":
        q = q.where(FailedIngestion.status == status)
    if source_id:
        q = q.where(FailedIngestion.source_id == source_id)

    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    result = await db.execute(q.order_by(FailedIngestion.created_at.desc()).offset(offset).limit(limit))
    items = [
        {
            "id": f.id,
            "source_id": f.source_id,
            "source_name": f.source_name,
            "fetched_at": f.fetched_at.isoformat() if f.fetched_at else None,
            "error_type": f.error_type,
            "error_message": f.error_message,
            "retry_count": f.retry_count,
            "max_retries": f.max_retries,
            "status": f.status,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        }
        for f in result.scalars().all()
    ]
    return {"items": items, "total": total}


@router.post("/failures/{failure_id}/retry")
async def retry_failure(
    failure_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    wid: str = Depends(get_workspace_id),
):
    """Mark a failed ingestion for retry."""
    result = await db.execute(
        select(FailedIngestion).where(
            FailedIngestion.id == failure_id, FailedIngestion.workspace_id == wid
        )
    )
    failure = result.scalar_one_or_none()
    if not failure:
        raise HTTPException(404, "Failure record not found")
    if failure.status == "resolved":
        raise HTTPException(400, "Already resolved")
    if failure.retry_count >= failure.max_retries:
        failure.status = "abandoned"
        await db.commit()
        raise HTTPException(400, "Max retries exceeded — marked as abandoned")

    failure.status = "retrying"
    failure.retry_count = (failure.retry_count or 0) + 1
    await db.commit()
    return {"message": "Marked for retry", "retry_count": failure.retry_count}


@router.post("/failures/{failure_id}/resolve")
async def resolve_failure(
    failure_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    wid: str = Depends(get_workspace_id),
):
    """Manually resolve a failed ingestion."""
    result = await db.execute(
        select(FailedIngestion).where(
            FailedIngestion.id == failure_id, FailedIngestion.workspace_id == wid
        )
    )
    failure = result.scalar_one_or_none()
    if not failure:
        raise HTTPException(404, "Failure record not found")

    failure.status = "resolved"
    failure.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Marked as resolved"}


@router.post("/{source_id}/disable")
async def disable_failing_source(
    source_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    wid: str = Depends(get_workspace_id),
):
    """Disable a source from the health view."""
    result = await db.execute(
        select(Source).where(Source.id == source_id, Source.workspace_id == wid)
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(404, "Source not found")
    source.enabled = False
    source.health = "disabled"
    await db.commit()
    return {"message": f"Source {source.name} disabled"}
