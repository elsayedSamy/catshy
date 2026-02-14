"""Unified Ingestion Pipeline — fetch → normalize → dedup → enrich → correlate → score → explain → campaign → stats."""
import hashlib
import logging
import time
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.models.intel import IntelItem, Observable, IntelObservable, IntelMatch, SourceStats
from app.models.operations import Asset, Source
from app.services.normalizer import extract_observables, canonicalize, compute_dedup_hash, classify_severity
from app.services.scoring import calculate_confidence_score, calculate_risk_score
from app.services.asset_matcher import AssetMatcher
from app.services.geoip import geoip_for_observable

logger = logging.getLogger("catshy.ingestion")


def gen_uuid():
    return str(uuid.uuid4())


class IngestionPipeline:
    """Stateful pipeline for processing raw intel entries from a single source fetch."""

    def __init__(self, db: Session, source: Source, workspace_id: Optional[str] = None):
        self.db = db
        self.source = source
        self.workspace_id = workspace_id or source.workspace_id
        self.stats = {
            "items_fetched": 0,
            "items_new": 0,
            "items_deduplicated": 0,
            "items_matched_assets": 0,
            "confidence_sum": 0.0,
            "risk_sum": 0.0,
        }
        self._assets: Optional[List[dict]] = None
        self._matcher: Optional[AssetMatcher] = None
        # Load source reliability from latest stats
        self._source_reliability = self._get_source_reliability()

    def _get_source_reliability(self) -> float:
        """Get latest reliability score for this source."""
        result = self.db.execute(
            select(SourceStats)
            .where(SourceStats.source_id == self.source.id)
            .order_by(SourceStats.date.desc())
            .limit(1)
        )
        stats = result.scalar_one_or_none()
        return stats.reliability_score if stats else 0.5

    def _load_assets(self):
        """Load workspace assets for correlation."""
        if self._assets is not None:
            return
        result = self.db.execute(
            select(Asset).where(Asset.workspace_id == self.workspace_id)
        )
        assets = result.scalars().all()
        self._assets = [
            {"id": a.id, "type": a.type, "value": a.value, "criticality": a.criticality}
            for a in assets
        ]
        self._matcher = AssetMatcher(self._assets)

    def process_entries(self, raw_entries: List[dict]) -> List[IntelItem]:
        """Process a batch of raw entries through the full pipeline."""
        self._load_assets()
        self.stats["items_fetched"] = len(raw_entries)
        created_items = []

        for entry in raw_entries:
            item = self._process_single(entry)
            if item:
                created_items.append(item)

        # Update source stats
        self._update_source_stats(created_items)

        return created_items

    def _process_single(self, entry: dict) -> Optional[IntelItem]:
        """Process a single raw entry through all pipeline stages."""
        # 1. Normalize — extract title, description, observables
        title = str(entry.get("title", "Untitled"))[:500]
        description = str(entry.get("description", ""))[:2000]
        link = entry.get("link", entry.get("url", ""))
        raw_text = f"{title} {description} {link}"

        # 2. Extract observables
        observables = extract_observables(raw_text)

        # Pick primary observable (most specific)
        primary_obs = observables[0] if observables else {"type": "other", "value": link or title[:100], "canonical": link or title[:100]}

        # 3. Deduplicate
        dedup_hash = compute_dedup_hash(self.source.id, primary_obs["canonical"], title)
        existing = self.db.execute(
            select(IntelItem).where(
                IntelItem.dedup_hash == dedup_hash,
                IntelItem.workspace_id == self.workspace_id
            )
        ).scalar_one_or_none()

        if existing:
            existing.dedup_count = (existing.dedup_count or 1) + 1
            self.stats["items_deduplicated"] += 1
            return None

        # 4. Auto-classify severity
        severity = classify_severity({"type": primary_obs["type"], "value": primary_obs["value"], "title": title})

        # 5. Create intel item
        item = IntelItem(
            id=gen_uuid(),
            workspace_id=self.workspace_id,
            title=title,
            description=description[:1000],
            severity=severity,
            source_id=self.source.id,
            source_name=self.source.name,
            original_url=link,
            excerpt=description[:500],
            dedup_hash=dedup_hash,
            published_at=entry.get("published_at") or datetime.utcnow(),
            fetched_at=datetime.utcnow(),
            raw_data=entry if isinstance(entry, dict) else {},
            tags=entry.get("tags", []),
        )

        # 6. Enrich with GeoIP
        best_geo = None
        for obs in observables:
            if obs["type"] in ("ip", "domain", "url"):
                geo = geoip_for_observable(obs["type"], obs["canonical"])
                if geo:
                    best_geo = geo
                    break

        if best_geo:
            item.geo_lat = best_geo.get("lat")
            item.geo_lon = best_geo.get("lon")
            item.geo_country = best_geo.get("country")
            item.geo_country_name = best_geo.get("country_name")
            item.geo_city = best_geo.get("city")

        # 7. Store observables and link M2M
        obs_ids = []
        for obs in observables:
            obs_record = self._upsert_observable(obs, best_geo if obs == observables[0] and best_geo else None)
            obs_ids.append(obs_record.id)
            link_record = IntelObservable(
                id=gen_uuid(),
                intel_item_id=item.id,
                observable_id=obs_record.id,
            )
            self.db.add(link_record)

        # 8. Correlate to assets
        all_matches = []
        for obs in observables:
            if self._matcher:
                matches = self._matcher.match(obs["canonical"], obs["type"])
                for asset_id, asset_value, criticality in matches:
                    all_matches.append({
                        "asset_id": asset_id,
                        "asset_value": asset_value,
                        "criticality": criticality,
                        "observable_value": obs["canonical"],
                        "match_type": self._determine_match_type(obs, asset_value),
                    })

        if all_matches:
            item.asset_match = True
            item.matched_asset_ids = list(set(m["asset_id"] for m in all_matches))
            self.stats["items_matched_assets"] += 1

            # Store match records
            for m in all_matches:
                match_record = IntelMatch(
                    id=gen_uuid(),
                    workspace_id=self.workspace_id,
                    intel_item_id=item.id,
                    asset_id=m["asset_id"],
                    match_type=m["match_type"],
                    asset_value=m["asset_value"],
                    asset_criticality=m["criticality"],
                    matched_observable_value=m["observable_value"],
                    explain_json={
                        "reason": f"Observable {m['observable_value']} matched asset {m['asset_value']}",
                        "match_type": m["match_type"],
                        "asset_criticality": m["criticality"],
                        "observable_type": primary_obs["type"],
                    },
                )
                self.db.add(match_record)

        # 9. Risk scoring with explainability
        highest_crit = self._matcher.get_highest_criticality(
            [(m["asset_id"], m["asset_value"], m["criticality"]) for m in all_matches]
        ) if all_matches and self._matcher else "info"

        asset_relevance = 1.0 if all_matches else 0.0
        corroboration = self.db.execute(
            select(func.count()).select_from(IntelItem).where(
                IntelItem.dedup_hash == dedup_hash,
            )
        ).scalar() or 0

        conf_result = calculate_confidence_score(
            {"excerpt": item.excerpt, "original_url": item.original_url, "published_at": item.published_at},
            source_reputation=self._source_reliability,
            corroboration_count=corroboration + 1,
        )
        risk_result = calculate_risk_score(
            {"severity": severity, "dedup_count": item.dedup_count},
            asset_relevance=asset_relevance,
            criticality=highest_crit,
        )

        item.confidence_score = conf_result["score"]
        item.risk_score = risk_result["score"]
        item.score_explanation = {
            "confidence": conf_result,
            "risk": risk_result,
            "asset_matches": len(all_matches),
            "observables_extracted": len(observables),
            "geo_enriched": best_geo is not None,
        }

        # 10. Campaign auto-grouping
        campaign = self._detect_campaign(title, observables)
        if campaign:
            item.campaign_id = campaign["id"]
            item.campaign_name = campaign["name"]

        self.db.add(item)
        self.stats["items_new"] += 1
        self.stats["confidence_sum"] += item.confidence_score
        self.stats["risk_sum"] += item.risk_score

        return item

    def _upsert_observable(self, obs: dict, geo: Optional[dict] = None) -> Observable:
        """Create or update an observable record."""
        existing = self.db.execute(
            select(Observable).where(
                Observable.workspace_id == self.workspace_id,
                Observable.type == obs["type"],
                Observable.normalized_value == obs["canonical"],
            )
        ).scalar_one_or_none()

        if existing:
            existing.last_seen = datetime.utcnow()
            existing.sighting_count = (existing.sighting_count or 1) + 1
            # Update geo if we have new data and existing doesn't
            if geo and not existing.geo_lat:
                existing.geo_lat = geo.get("lat")
                existing.geo_lon = geo.get("lon")
                existing.geo_country = geo.get("country")
                existing.geo_country_name = geo.get("country_name")
                existing.geo_city = geo.get("city")
                existing.geo_asn = geo.get("asn")
                existing.geo_org = geo.get("org")
            return existing

        record = Observable(
            id=gen_uuid(),
            workspace_id=self.workspace_id,
            type=obs["type"],
            value=obs["value"],
            normalized_value=obs["canonical"],
            first_seen=datetime.utcnow(),
            last_seen=datetime.utcnow(),
        )
        if geo:
            record.geo_lat = geo.get("lat")
            record.geo_lon = geo.get("lon")
            record.geo_country = geo.get("country")
            record.geo_country_name = geo.get("country_name")
            record.geo_city = geo.get("city")
            record.geo_asn = geo.get("asn")
            record.geo_org = geo.get("org")

        self.db.add(record)
        return record

    def _determine_match_type(self, obs: dict, asset_value: str) -> str:
        """Determine match type: exact, subdomain, cidr, fuzzy."""
        if obs["canonical"].lower() == asset_value.lower():
            return "exact"
        if obs["type"] == "domain" and obs["canonical"].endswith(f".{asset_value.lower()}"):
            return "subdomain"
        if obs["type"] == "ip" and "/" in asset_value:
            return "cidr"
        return "fuzzy"

    def _detect_campaign(self, title: str, observables: list) -> Optional[dict]:
        """Simple campaign detection based on title keywords and observable clustering."""
        campaign_keywords = {
            "apt": "APT Campaign",
            "lazarus": "Lazarus Group",
            "cozy bear": "Cozy Bear",
            "fancy bear": "Fancy Bear",
            "emotet": "Emotet Campaign",
            "conti": "Conti Ransomware",
            "lockbit": "LockBit Ransomware",
            "revil": "REvil Ransomware",
            "cobalt strike": "Cobalt Strike Activity",
        }
        title_lower = title.lower()
        for keyword, campaign_name in campaign_keywords.items():
            if keyword in title_lower:
                return {
                    "id": hashlib.md5(keyword.encode()).hexdigest()[:16],
                    "name": campaign_name,
                }
        return None

    def _update_source_stats(self, created_items: List[IntelItem]):
        """Update source reliability stats after ingestion."""
        now = datetime.utcnow()
        n = self.stats["items_new"] or 1

        stats = SourceStats(
            id=gen_uuid(),
            source_id=self.source.id,
            workspace_id=self.workspace_id,
            date=now,
            items_fetched=self.stats["items_fetched"],
            items_new=self.stats["items_new"],
            items_deduplicated=self.stats["items_deduplicated"],
            items_matched_assets=self.stats["items_matched_assets"],
            avg_confidence=round(self.stats["confidence_sum"] / n, 3) if n else 0,
            avg_risk=round(self.stats["risk_sum"] / n, 3) if n else 0,
            reliability_score=self._source_reliability,
        )
        self.db.add(stats)

        # Update source counters
        self.source.last_fetch_at = now
        self.source.item_count = (self.source.item_count or 0) + self.stats["items_new"]
        self.source.health = "healthy"
        self.source.consecutive_failures = 0
        self.source.last_error = None
