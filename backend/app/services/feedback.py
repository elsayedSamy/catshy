"""False positive feedback service — adjusts scoring weights based on user verdicts."""
import logging
import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.models.intel import IntelItem, UserFeedback, SourceStats

logger = logging.getLogger("catshy.feedback")


def gen_uuid():
    return str(uuid.uuid4())


# Scoring adjustment weights per verdict
VERDICT_ADJUSTMENTS = {
    "false_positive": -0.3,
    "true_positive": 0.1,
    "needs_review": 0.0,
}


def submit_feedback(
    db: Session,
    intel_item_id: str,
    user_id: str,
    verdict: str,
    reason: str = "",
    workspace_id: str = None,
) -> dict:
    """Submit user feedback on an intel item and adjust its score."""
    if verdict not in VERDICT_ADJUSTMENTS:
        raise ValueError(f"Invalid verdict: {verdict}. Must be one of: {list(VERDICT_ADJUSTMENTS.keys())}")

    # Get intel item
    item = db.execute(select(IntelItem).where(IntelItem.id == intel_item_id)).scalar_one_or_none()
    if not item:
        raise ValueError("Intel item not found")

    previous_score = item.risk_score or 0.0
    adjustment = VERDICT_ADJUSTMENTS[verdict]

    # Apply cumulative adjustment
    item.feedback_adjustment = (item.feedback_adjustment or 0.0) + adjustment
    adjusted_score = max(0.0, min(1.0, previous_score + adjustment))
    item.risk_score = adjusted_score

    # Update score explanation
    explain = item.score_explanation or {}
    feedbacks = explain.get("feedback_history", [])
    feedbacks.append({
        "verdict": verdict,
        "adjustment": adjustment,
        "user_id": user_id,
        "timestamp": datetime.utcnow().isoformat(),
    })
    explain["feedback_history"] = feedbacks[-10:]  # Keep last 10
    item.score_explanation = explain

    # Record feedback
    fb = UserFeedback(
        id=gen_uuid(),
        workspace_id=workspace_id or item.workspace_id,
        intel_item_id=intel_item_id,
        user_id=user_id,
        verdict=verdict,
        reason=reason,
        previous_score=previous_score,
        adjusted_score=adjusted_score,
    )
    db.add(fb)

    # Update source reliability based on accumulated feedback
    if item.source_id:
        _update_source_reliability(db, item.source_id, workspace_id or item.workspace_id)

    db.commit()

    return {
        "intel_item_id": intel_item_id,
        "verdict": verdict,
        "previous_score": previous_score,
        "adjusted_score": adjusted_score,
        "adjustment": adjustment,
    }


def _update_source_reliability(db: Session, source_id: str, workspace_id: str):
    """Recalculate source reliability from feedback verdicts."""
    tp_count = db.execute(
        select(func.count()).select_from(UserFeedback)
        .join(IntelItem, UserFeedback.intel_item_id == IntelItem.id)
        .where(IntelItem.source_id == source_id, UserFeedback.verdict == "true_positive")
    ).scalar() or 0

    fp_count = db.execute(
        select(func.count()).select_from(UserFeedback)
        .join(IntelItem, UserFeedback.intel_item_id == IntelItem.id)
        .where(IntelItem.source_id == source_id, UserFeedback.verdict == "false_positive")
    ).scalar() or 0

    total = tp_count + fp_count
    if total >= 5:  # Only adjust after enough samples
        reliability = tp_count / total
        # Update latest source stats
        latest = db.execute(
            select(SourceStats)
            .where(SourceStats.source_id == source_id)
            .order_by(SourceStats.date.desc())
            .limit(1)
        ).scalar_one_or_none()
        if latest:
            latest.reliability_score = round(reliability, 3)
            latest.true_positive_count = tp_count
            latest.false_positive_count = fp_count
