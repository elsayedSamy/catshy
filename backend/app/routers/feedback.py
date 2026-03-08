"""Feedback API — POST feedback on intel items for false-positive learning.
Workspace-scoped + auth required."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.intel import UserFeedback, IntelItem
from app.core.deps import get_current_user, get_workspace_id
from datetime import datetime, timezone
import uuid

router = APIRouter()


class FeedbackRequest(BaseModel):
    intel_item_id: str
    verdict: str  # true_positive, false_positive, needs_review
    reason: Optional[str] = ""


class FeedbackResponse(BaseModel):
    id: str
    intel_item_id: str
    verdict: str
    previous_score: float
    adjusted_score: float


VERDICT_ADJUSTMENTS = {
    "false_positive": -0.3,
    "true_positive": 0.1,
    "needs_review": 0.0,
}


@router.post("/", response_model=FeedbackResponse)
async def submit_feedback(req: FeedbackRequest, db: AsyncSession = Depends(get_db),
                          user=Depends(get_current_user), wid: str = Depends(get_workspace_id)):
    """Submit feedback on an intel item. Adjusts risk score and updates source reliability."""
    if req.verdict not in VERDICT_ADJUSTMENTS:
        raise HTTPException(400, f"Invalid verdict. Must be: {list(VERDICT_ADJUSTMENTS.keys())}")

    # Get intel item — must belong to same workspace
    result = await db.execute(
        select(IntelItem).where(IntelItem.id == req.intel_item_id, IntelItem.workspace_id == wid))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Intel item not found")

    previous_score = item.risk_score or 0.0
    adjustment = VERDICT_ADJUSTMENTS[req.verdict]
    adjusted_score = max(0.0, min(1.0, previous_score + adjustment))

    item.risk_score = adjusted_score
    item.feedback_adjustment = (item.feedback_adjustment or 0.0) + adjustment

    explain = item.score_explanation or {}
    history = explain.get("feedback_history", [])
    history.append({"verdict": req.verdict, "adjustment": adjustment,
                    "user_id": user.id, "ts": datetime.now(timezone.utc).isoformat()})
    explain["feedback_history"] = history[-10:]
    item.score_explanation = explain

    fb_id = str(uuid.uuid4())
    fb = UserFeedback(
        id=fb_id,
        workspace_id=wid,
        intel_item_id=req.intel_item_id,
        user_id=user.id,
        verdict=req.verdict,
        reason=req.reason or "",
        previous_score=previous_score,
        adjusted_score=adjusted_score,
    )
    db.add(fb)
    await db.commit()

    return FeedbackResponse(
        id=fb_id,
        intel_item_id=req.intel_item_id,
        verdict=req.verdict,
        previous_score=previous_score,
        adjusted_score=adjusted_score,
    )


@router.get("/stats")
async def feedback_stats(source_id: Optional[str] = None, db: AsyncSession = Depends(get_db),
                         user=Depends(get_current_user), wid: str = Depends(get_workspace_id)):
    """Get feedback statistics scoped to workspace."""
    q = (
        select(UserFeedback.verdict, func.count().label("count"))
        .where(UserFeedback.workspace_id == wid)
        .group_by(UserFeedback.verdict)
    )

    if source_id:
        q = q.join(IntelItem, UserFeedback.intel_item_id == IntelItem.id).where(IntelItem.source_id == source_id)

    result = await db.execute(q)
    rows = result.all()
    return {row[0]: row[1] for row in rows}
