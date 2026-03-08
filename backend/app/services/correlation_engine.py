"""Auto-Correlation Engine — finds and groups related threats by shared indicators.

Strategy:
1. Shared IOC Correlation: Items sharing the same IP, domain, hash, or CVE
2. Temporal Proximity: Items from different sources appearing within a short window
3. Campaign Grouping: Items already tagged with the same campaign_id

The engine runs incrementally — it processes new items since last run and either
adds them to existing clusters or creates new ones.
"""
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, update
from app.models.intel import IntelItem
from app.models.correlation import CorrelationCluster, CorrelationLink

logger = logging.getLogger("catshy.correlation")

# Minimum items to form a cluster
MIN_CLUSTER_SIZE = 2
# Time window for temporal proximity (hours)
TEMPORAL_WINDOW_HOURS = 6
# IOC types that trigger correlation
CORRELATED_TYPES = {"ip", "domain", "url", "hash_sha256", "hash_md5", "hash_sha1", "cve"}

SEVERITY_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}


def _cluster_severity(items: List[dict]) -> str:
    """Determine cluster severity from its member items."""
    max_rank = max((SEVERITY_RANK.get(i.get("severity", "info"), 0) for i in items), default=0)
    for sev, rank in SEVERITY_RANK.items():
        if rank == max_rank:
            return sev
    return "medium"


def _cluster_confidence(link_count: int, source_count: int, item_count: int) -> float:
    """Calculate cluster confidence based on corroboration."""
    # More independent sources = higher confidence
    source_factor = min(source_count / 3.0, 1.0)  # Caps at 3 sources
    # More links = stronger correlation
    link_factor = min(link_count / 5.0, 1.0)
    # Base confidence
    return round(0.4 * source_factor + 0.4 * link_factor + 0.2 * min(item_count / 5.0, 1.0), 2)


async def run_correlation(db: AsyncSession, workspace_id: str, lookback_hours: int = 48) -> Dict:
    """Run the correlation engine for a workspace.

    Returns summary dict with counts of new/updated clusters.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=lookback_hours)

    # 1. Fetch recent items with observable values
    q = select(IntelItem).where(
        and_(
            IntelItem.workspace_id == workspace_id,
            IntelItem.created_at >= cutoff,
            IntelItem.observable_type.in_(list(CORRELATED_TYPES)),
            IntelItem.observable_value.isnot(None),
            IntelItem.observable_value != "",
        )
    ).order_by(IntelItem.created_at.desc())

    result = await db.execute(q)
    items = result.scalars().all()

    if len(items) < MIN_CLUSTER_SIZE:
        return {"new_clusters": 0, "updated_clusters": 0, "total_items_processed": len(items)}

    # 2. Group by shared observable value
    value_groups: Dict[str, List[IntelItem]] = defaultdict(list)
    for item in items:
        key = f"{item.observable_type}::{item.observable_value.lower().strip()}"
        value_groups[key].append(item)

    # 3. Also group by campaign_id
    campaign_groups: Dict[str, List[IntelItem]] = defaultdict(list)
    for item in items:
        if item.campaign_id:
            campaign_groups[item.campaign_id].append(item)

    new_clusters = 0
    updated_clusters = 0

    # 4. Process shared-IOC groups
    for key, group_items in value_groups.items():
        if len(group_items) < MIN_CLUSTER_SIZE:
            continue

        obs_type, obs_value = key.split("::", 1)
        item_ids = [str(i.id) for i in group_items]
        sources = set(i.source_name for i in group_items if i.source_name)

        # Check if cluster already exists for this pivot
        existing_q = select(CorrelationCluster).where(
            and_(
                CorrelationCluster.workspace_id == workspace_id,
                CorrelationCluster.status == "active",
                CorrelationCluster.pivot_indicators.contains([{"type": obs_type, "value": obs_value}]),
            )
        )
        existing_result = await db.execute(existing_q)
        existing_cluster = existing_result.scalar_one_or_none()

        if existing_cluster:
            # Add new items to existing cluster
            added = await _add_items_to_cluster(db, existing_cluster, group_items, f"shared_{obs_type}", obs_value)
            if added > 0:
                existing_cluster.item_count = existing_cluster.item_count + added
                existing_cluster.last_seen = now
                existing_cluster.severity = _cluster_severity(
                    [{"severity": i.severity} for i in group_items]
                )
                existing_cluster.updated_at = now
                updated_clusters += 1
        else:
            # Create new cluster
            cluster_name = f"Shared {obs_type.upper()}: {obs_value}"
            if obs_type == "cve":
                cluster_name = f"CVE Campaign: {obs_value}"
            elif obs_type in ("hash_sha256", "hash_md5", "hash_sha1"):
                cluster_name = f"Malware IOC: {obs_value[:16]}..."

            cluster = CorrelationCluster(
                workspace_id=workspace_id,
                name=cluster_name,
                description=f"Auto-correlated: {len(group_items)} items share {obs_type} indicator '{obs_value}' across {len(sources)} source(s).",
                cluster_type="shared_ioc",
                severity=_cluster_severity([{"severity": i.severity} for i in group_items]),
                confidence=_cluster_confidence(len(group_items), len(sources), len(group_items)),
                pivot_indicators=[{"type": obs_type, "value": obs_value}],
                item_count=len(group_items),
                first_seen=min((i.created_at for i in group_items), default=now),
                last_seen=max((i.created_at for i in group_items), default=now),
                tags=[f"auto-correlated", obs_type],
            )
            db.add(cluster)
            await db.flush()  # Get cluster ID

            for item in group_items:
                link = CorrelationLink(
                    cluster_id=cluster.id,
                    intel_item_id=str(item.id),
                    link_reason=f"shared_{obs_type}",
                    shared_value=obs_value,
                    confidence=1.0,
                )
                db.add(link)

            new_clusters += 1

    # 5. Process campaign groups
    for campaign_id, group_items in campaign_groups.items():
        if len(group_items) < MIN_CLUSTER_SIZE:
            continue

        campaign_name = group_items[0].campaign_name or campaign_id
        sources = set(i.source_name for i in group_items if i.source_name)

        existing_q = select(CorrelationCluster).where(
            and_(
                CorrelationCluster.workspace_id == workspace_id,
                CorrelationCluster.status == "active",
                CorrelationCluster.cluster_type == "campaign",
                CorrelationCluster.name.ilike(f"%{campaign_name}%"),
            )
        )
        existing_result = await db.execute(existing_q)
        existing_cluster = existing_result.scalar_one_or_none()

        if not existing_cluster:
            cluster = CorrelationCluster(
                workspace_id=workspace_id,
                name=f"Campaign: {campaign_name}",
                description=f"Auto-grouped: {len(group_items)} items linked to campaign '{campaign_name}'.",
                cluster_type="campaign",
                severity=_cluster_severity([{"severity": i.severity} for i in group_items]),
                confidence=_cluster_confidence(len(group_items), len(sources), len(group_items)),
                pivot_indicators=[{"type": "campaign", "value": campaign_id}],
                item_count=len(group_items),
                first_seen=min((i.created_at for i in group_items), default=now),
                last_seen=max((i.created_at for i in group_items), default=now),
                tags=["auto-correlated", "campaign"],
            )
            db.add(cluster)
            await db.flush()

            for item in group_items:
                link = CorrelationLink(
                    cluster_id=cluster.id,
                    intel_item_id=str(item.id),
                    link_reason="campaign_membership",
                    shared_value=campaign_id,
                    confidence=1.0,
                )
                db.add(link)

            new_clusters += 1

    await db.commit()

    return {
        "new_clusters": new_clusters,
        "updated_clusters": updated_clusters,
        "total_items_processed": len(items),
        "value_groups_found": sum(1 for v in value_groups.values() if len(v) >= MIN_CLUSTER_SIZE),
        "campaign_groups_found": sum(1 for v in campaign_groups.values() if len(v) >= MIN_CLUSTER_SIZE),
    }


async def _add_items_to_cluster(
    db: AsyncSession,
    cluster: CorrelationCluster,
    items: List[IntelItem],
    reason: str,
    shared_value: str,
) -> int:
    """Add items to an existing cluster, skipping duplicates. Returns count added."""
    existing_q = select(CorrelationLink.intel_item_id).where(
        CorrelationLink.cluster_id == cluster.id
    )
    result = await db.execute(existing_q)
    existing_ids = {row[0] for row in result.all()}

    added = 0
    for item in items:
        if str(item.id) not in existing_ids:
            db.add(CorrelationLink(
                cluster_id=cluster.id,
                intel_item_id=str(item.id),
                link_reason=reason,
                shared_value=shared_value,
                confidence=1.0,
            ))
            added += 1
    return added


async def get_item_correlations(db: AsyncSession, workspace_id: str, intel_item_id: str) -> List[dict]:
    """Get all clusters that contain a specific intel item."""
    q = (
        select(CorrelationCluster, CorrelationLink)
        .join(CorrelationLink, CorrelationLink.cluster_id == CorrelationCluster.id)
        .where(
            and_(
                CorrelationCluster.workspace_id == workspace_id,
                CorrelationLink.intel_item_id == intel_item_id,
            )
        )
    )
    result = await db.execute(q)
    return [
        {
            "cluster_id": str(cluster.id),
            "cluster_name": cluster.name,
            "cluster_type": cluster.cluster_type,
            "severity": cluster.severity,
            "confidence": cluster.confidence,
            "item_count": cluster.item_count,
            "link_reason": link.link_reason,
            "shared_value": link.shared_value,
        }
        for cluster, link in result.all()
    ]
