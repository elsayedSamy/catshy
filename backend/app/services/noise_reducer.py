"""Smart Noise Reduction engine — reduces alert fatigue via multi-signal scoring.

Signals used to calculate a "noise score" (0-100, higher = noisier):
  1. Source false-positive rate       — sources with high FP rates are noisier
  2. IOC age & staleness              — very old IOCs without recent sightings = noise
  3. Duplicate/near-duplicate density  — many similar alerts in short time = noise
  4. GreyNoise benign classification   — known scanners/CDNs are noise
  5. Low severity + no asset match     — info-level items without org relevance
  6. Feedback learning                 — patterns from past false_positive verdicts

Items with noise_score >= threshold are auto-suppressed (status='suppressed').
"""
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Tuple
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intel import IntelItem, UserFeedback, SourceStats, Observable

logger = logging.getLogger("catshy.noise_reducer")

# Default suppression threshold (0-100)
DEFAULT_NOISE_THRESHOLD = 70

# Weights for noise score components
NOISE_WEIGHTS = {
    "source_fp_rate": 0.20,
    "staleness": 0.15,
    "duplicate_density": 0.15,
    "benign_classification": 0.20,
    "low_relevance": 0.15,
    "feedback_pattern": 0.15,
}


class NoiseReducer:
    """Evaluate and suppress noisy intel items."""

    def __init__(self, db: AsyncSession, workspace_id: str):
        self.db = db
        self.workspace_id = workspace_id
        self._source_fp_cache: Dict[str, float] = {}
        self._fp_patterns: Optional[Dict] = None

    async def evaluate_item(self, item: IntelItem) -> dict:
        """Calculate noise score for a single item. Returns score breakdown."""
        signals = {}

        # Signal 1: Source false-positive rate
        signals["source_fp_rate"] = await self._source_fp_rate(item.source_id)

        # Signal 2: Staleness
        signals["staleness"] = self._staleness_score(item)

        # Signal 3: Duplicate density (many similar items recently)
        signals["duplicate_density"] = await self._duplicate_density(item)

        # Signal 4: Benign classification (from enrichment data)
        signals["benign_classification"] = self._benign_signal(item)

        # Signal 5: Low relevance (no asset match + low severity)
        signals["low_relevance"] = self._low_relevance_score(item)

        # Signal 6: Feedback pattern matching
        signals["feedback_pattern"] = await self._feedback_pattern_score(item)

        # Weighted sum → 0-100
        noise_score = round(sum(signals[k] * NOISE_WEIGHTS[k] for k in NOISE_WEIGHTS) * 100)
        noise_score = max(0, min(100, noise_score))

        return {
            "noise_score": noise_score,
            "signals": signals,
            "suppressed": noise_score >= DEFAULT_NOISE_THRESHOLD,
            "threshold": DEFAULT_NOISE_THRESHOLD,
        }

    async def run_batch(self, items: List[IntelItem] = None, threshold: int = None) -> dict:
        """Evaluate and suppress noisy items in batch. Returns stats."""
        threshold = threshold or DEFAULT_NOISE_THRESHOLD

        if items is None:
            # Get active items from last 24h
            cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
            result = await self.db.execute(
                select(IntelItem).where(
                    IntelItem.workspace_id == self.workspace_id,
                    IntelItem.status == "active",
                    IntelItem.fetched_at >= cutoff,
                )
            )
            items = list(result.scalars().all())

        stats = {"total": len(items), "suppressed": 0, "kept": 0, "scores": []}

        for item in items:
            evaluation = await self.evaluate_item(item)
            stats["scores"].append({
                "item_id": item.id,
                "title": item.title[:80],
                "noise_score": evaluation["noise_score"],
                "suppressed": evaluation["noise_score"] >= threshold,
                "top_signal": max(evaluation["signals"], key=evaluation["signals"].get),
            })

            if evaluation["noise_score"] >= threshold:
                item.status = "suppressed"
                # Store noise analysis in score_explanation
                explain = item.score_explanation or {}
                explain["noise_analysis"] = evaluation
                item.score_explanation = explain
                stats["suppressed"] += 1
            else:
                stats["kept"] += 1

        await self.db.commit()

        logger.info(
            f"Noise reduction: {stats['suppressed']}/{stats['total']} items suppressed "
            f"(threshold={threshold}) in workspace {self.workspace_id}"
        )
        return stats

    # ── Signal calculators ──

    async def _source_fp_rate(self, source_id: Optional[str]) -> float:
        """0-1: proportion of false positives from this source."""
        if not source_id:
            return 0.3  # Unknown source = moderate noise signal

        if source_id in self._source_fp_cache:
            return self._source_fp_cache[source_id]

        result = await self.db.execute(
            select(SourceStats)
            .where(SourceStats.source_id == source_id)
            .order_by(SourceStats.date.desc())
            .limit(1)
        )
        stats = result.scalar_one_or_none()
        if stats and stats.true_positive_count and (stats.true_positive_count + stats.false_positive_count) >= 5:
            total = stats.true_positive_count + stats.false_positive_count
            fp_rate = stats.false_positive_count / total
        else:
            fp_rate = 0.0  # Not enough data

        self._source_fp_cache[source_id] = fp_rate
        return fp_rate

    def _staleness_score(self, item: IntelItem) -> float:
        """0-1: how stale the intel is. Very old = higher noise."""
        if not item.published_at:
            return 0.3
        age_hours = (datetime.now(timezone.utc) - item.published_at).total_seconds() / 3600
        if age_hours < 24:
            return 0.0
        elif age_hours < 72:
            return 0.2
        elif age_hours < 168:  # 1 week
            return 0.4
        elif age_hours < 720:  # 30 days
            return 0.6
        else:
            return 0.9

    async def _duplicate_density(self, item: IntelItem) -> float:
        """0-1: how many similar items appeared in the last 6 hours."""
        if not item.observable_value:
            return 0.0

        cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
        count = (await self.db.execute(
            select(func.count()).select_from(IntelItem).where(
                IntelItem.workspace_id == self.workspace_id,
                IntelItem.observable_value == item.observable_value,
                IntelItem.fetched_at >= cutoff,
                IntelItem.id != item.id,
            )
        )).scalar() or 0

        if count == 0:
            return 0.0
        elif count <= 2:
            return 0.2
        elif count <= 5:
            return 0.5
        elif count <= 10:
            return 0.7
        return 1.0

    def _benign_signal(self, item: IntelItem) -> float:
        """0-1: whether enrichment data suggests the IOC is benign."""
        explain = item.score_explanation or {}
        enrichment = explain.get("enrichment", {})

        # Check GreyNoise RIOT (known benign)
        gn = enrichment.get("greynoise", {})
        if gn.get("riot"):
            return 1.0
        if gn.get("classification") == "benign":
            return 0.8

        # Check AbuseIPDB low score
        abuse = enrichment.get("abuseipdb", {})
        if abuse.get("status") == "found" and abuse.get("abuse_confidence", 100) < 10:
            return 0.6

        # Check VirusTotal clean
        vt = enrichment.get("virustotal", {})
        if vt.get("status") == "found" and vt.get("malicious", 1) == 0 and vt.get("suspicious", 1) == 0:
            return 0.5

        return 0.0

    def _low_relevance_score(self, item: IntelItem) -> float:
        """0-1: low severity + no asset match = noise."""
        severity_noise = {"info": 0.9, "low": 0.6, "medium": 0.2, "high": 0.0, "critical": 0.0}
        sev = severity_noise.get(item.severity or "info", 0.5)

        if item.asset_match:
            return 0.0  # Always relevant if matched to asset

        return sev

    async def _feedback_pattern_score(self, item: IntelItem) -> float:
        """0-1: does this item match patterns previously marked as false positive?"""
        if self._fp_patterns is None:
            await self._load_fp_patterns()

        # Check if same source+severity combo has high FP history
        key = f"{item.source_id}:{item.severity}"
        if key in self._fp_patterns:
            return self._fp_patterns[key]

        # Check if same observable type from same source has FP history
        obs_key = f"{item.source_id}:{item.observable_type}"
        if obs_key in self._fp_patterns:
            return self._fp_patterns[obs_key] * 0.7

        return 0.0

    async def _load_fp_patterns(self):
        """Learn FP patterns from historical feedback."""
        self._fp_patterns = {}

        # Get all false_positive feedbacks for this workspace
        result = await self.db.execute(
            select(
                IntelItem.source_id,
                IntelItem.severity,
                IntelItem.observable_type,
                UserFeedback.verdict,
                func.count().label("cnt"),
            )
            .join(UserFeedback, UserFeedback.intel_item_id == IntelItem.id)
            .where(
                IntelItem.workspace_id == self.workspace_id,
                UserFeedback.verdict.in_(["false_positive", "true_positive"]),
            )
            .group_by(IntelItem.source_id, IntelItem.severity, IntelItem.observable_type, UserFeedback.verdict)
        )
        rows = result.all()

        # Build source+severity FP rates
        counts: Dict[str, Dict[str, int]] = {}
        for source_id, severity, obs_type, verdict, cnt in rows:
            for key in [f"{source_id}:{severity}", f"{source_id}:{obs_type}"]:
                if key not in counts:
                    counts[key] = {"fp": 0, "tp": 0}
                if verdict == "false_positive":
                    counts[key]["fp"] += cnt
                else:
                    counts[key]["tp"] += cnt

        for key, c in counts.items():
            total = c["fp"] + c["tp"]
            if total >= 3:  # Minimum sample
                self._fp_patterns[key] = c["fp"] / total


async def get_noise_stats(db: AsyncSession, workspace_id: str) -> dict:
    """Get noise reduction statistics for a workspace."""
    # Count suppressed items
    suppressed = (await db.execute(
        select(func.count()).select_from(IntelItem).where(
            IntelItem.workspace_id == workspace_id,
            IntelItem.status == "suppressed",
        )
    )).scalar() or 0

    active = (await db.execute(
        select(func.count()).select_from(IntelItem).where(
            IntelItem.workspace_id == workspace_id,
            IntelItem.status == "active",
        )
    )).scalar() or 0

    # Top noise sources
    result = await db.execute(
        select(
            IntelItem.source_name,
            func.count().label("cnt"),
        )
        .where(
            IntelItem.workspace_id == workspace_id,
            IntelItem.status == "suppressed",
        )
        .group_by(IntelItem.source_name)
        .order_by(func.count().desc())
        .limit(5)
    )
    top_noise_sources = [{"source": row[0], "count": row[1]} for row in result.all()]

    return {
        "active_items": active,
        "suppressed_items": suppressed,
        "noise_ratio": round(suppressed / max(active + suppressed, 1) * 100, 1),
        "top_noise_sources": top_noise_sources,
    }
