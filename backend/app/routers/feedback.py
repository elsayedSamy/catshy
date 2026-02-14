"""Feedback API — POST feedback on intel items for false-positive learning."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.intel import UserFeedback, IntelItem
from jose import jwt, JWTError
from app.config import settings
import uuid, hashlib
from datetime import datetime

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


def _get_user_id_from_request(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(auth.split(" ", 1)[1], settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload["sub"]
    except JWTError:
        raise HTTPException(401, "Invalid token")


@router.post("/", response_model=FeedbackResponse)
async def submit_feedback(req: FeedbackRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Submit feedback on an intel item. Adjusts risk score and updates source reliability."""
    if req.verdict not in VERDICT_ADJUSTMENTS:
        raise HTTPException(400, f"Invalid verdict. Must be: {list(VERDICT_ADJUSTMENTS.keys())}")

    user_id = _get_user_id_from_request(request)

    # Get intel item
    result = await db.execute(select(IntelItem).where(IntelItem.id == req.intel_item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Intel item not found")

    previous_score = item.risk_score or 0.0
    adjustment = VERDICT_ADJUSTMENTS[req.verdict]
    adjusted_score = max(0.0, min(1.0, previous_score + adjustment))

    # Update item
    item.risk_score = adjusted_score
    item.feedback_adjustment = (item.feedback_adjustment or 0.0) + adjustment

    # Update explanation
    explain = item.score_explanation or {}
    history = explain.get("feedback_history", [])
    history.append({"verdict": req.verdict, "adjustment": adjustment, "user_id": user_id, "ts": datetime.utcnow().isoformat()})
    explain["feedback_history"] = history[-10:]
    item.score_explanation = explain

    # Record feedback
    fb_id = str(uuid.uuid4())
    fb = UserFeedback(
        id=fb_id,
        workspace_id=item.workspace_id,
        intel_item_id=req.intel_item_id,
        user_id=user_id,
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
async def feedback_stats(source_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Get feedback statistics, optionally filtered by source."""
    from sqlalchemy import func

    q = select(
        UserFeedback.verdict,
        func.count().label("count"),
    ).group_by(UserFeedback.verdict)

    if source_id:
        q = q.join(IntelItem, UserFeedback.intel_item_id == IntelItem.id).where(IntelItem.source_id == source_id)

    result = await db.execute(q)
    rows = result.all()
    return {row[0]: row[1] for row in rows}
