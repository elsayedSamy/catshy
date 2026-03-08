"""Noise Reduction API — evaluate, suppress, and manage noisy intel items."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import Optional

from app.database import get_db
from app.core.deps import get_current_user, get_workspace_id
from app.models.intel import IntelItem
from app.services.noise_reducer import NoiseReducer, get_noise_stats, DEFAULT_NOISE_THRESHOLD

router = APIRouter()


@router.post("/run")
async def run_noise_reduction(
    threshold: int = Query(DEFAULT_NOISE_THRESHOLD, ge=1, le=100, description="Noise score threshold for suppression"),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """Run noise reduction on recent active items."""
    reducer = NoiseReducer(db, workspace_id)
    stats = await reducer.run_batch(threshold=threshold)
    return stats


@router.get("/stats")
async def noise_stats(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """Get noise reduction statistics."""
    return await get_noise_stats(db, workspace_id)


@router.post("/evaluate/{item_id}")
async def evaluate_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """Evaluate noise score for a single item without suppressing."""
    result = await db.execute(
        select(IntelItem).where(IntelItem.id == item_id, IntelItem.workspace_id == workspace_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item not found")

    reducer = NoiseReducer(db, workspace_id)
    evaluation = await reducer.evaluate_item(item)
    return {"item_id": item_id, "title": item.title, **evaluation}


@router.post("/restore/{item_id}")
async def restore_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """Restore a suppressed item back to active status."""
    result = await db.execute(
        select(IntelItem).where(
            IntelItem.id == item_id,
            IntelItem.workspace_id == workspace_id,
            IntelItem.status == "suppressed",
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Suppressed item not found")

    item.status = "active"
    await db.commit()
    return {"message": "Item restored", "item_id": item_id}


@router.get("/suppressed")
async def list_suppressed(
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """List suppressed items."""
    result = await db.execute(
        select(IntelItem)
        .where(IntelItem.workspace_id == workspace_id, IntelItem.status == "suppressed")
        .order_by(IntelItem.fetched_at.desc())
        .offset(offset)
        .limit(limit)
    )
    items = result.scalars().all()
    return [
        {
            "id": i.id,
            "title": i.title,
            "severity": i.severity,
            "source_name": i.source_name,
            "observable_type": i.observable_type,
            "observable_value": i.observable_value,
            "noise_score": (i.score_explanation or {}).get("noise_analysis", {}).get("noise_score"),
            "top_signal": (i.score_explanation or {}).get("noise_analysis", {}).get("signals", {}),
            "fetched_at": str(i.fetched_at) if i.fetched_at else None,
        }
        for i in items
    ]
