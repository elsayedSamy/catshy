"""Unified Ingestion Pipeline — fetch → normalize → dedup → enrich → correlate → score → explain → campaign → stats.

Supports both sync (Celery workers) and async (API) execution."""
import hashlib
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.intel import IntelItem, Observable, IntelObservable, IntelMatch, SourceStats
from app.models.operations import Asset, Source
from app.services.normalizer import extract_observables, canonicalize, compute_dedup_hash, classify_severity
from app.services.scoring import calculate_confidence_score, calculate_risk_score
from app.services.asset_matcher import AssetMatcher
from app.services.geoip import geoip_for_observable
from app.services.mitre_mapper import extract_mitre_from_text

logger = logging.getLogger("catshy.ingestion")


def gen_uuid():
    return str(uuid.uuid4())


def _utcnow():
    return datetime.now(timezone.utc)


class IngestionPipeline:
    """Async pipeline for processing raw intel entries from a single source fetch."""

    def __init__(self, db: AsyncSession, source: Source, workspace_id: Optional[str] = None):
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
        self._source_reliability: float = 0.5

    async def _load_source_reliability(self):
        """Get latest reliability score for this source."""
        result = await self.db.execute(
            select(SourceStats)
            .where(SourceStats.source_id == self.source.id)
            .order_by(SourceStats.date.desc())
            .limit(1)
        )
        stats = result.scalar_one_or_none()
        self._source_reliability = stats.reliability_score if stats else 0.5

    async def _load_assets(self):
        """Load workspace assets for correlation."""
        if self._assets is not None:
            return
        result = await self.db.execute(
            select(Asset).where(Asset.workspace_id == self.workspace_id)
        )
        assets = result.scalars().all()
        self._assets = [
            {"id": a.id, "type": a.type, "value": a.value, "criticality": a.criticality}
            for a in assets
        ]
        self._matcher = AssetMatcher(self._assets)

    async def process_entries(self, raw_entries: List[dict]) -> List[IntelItem]:
        """Process a batch of raw entries through the full pipeline."""
        await self._load_source_reliability()
        await self._load_assets()
        self.stats["items_fetched"] = len(raw_entries)
        created_items = []

        for entry in raw_entries:
            item = await self._process_single(entry)
            if item:
                created_items.append(item)

        # Update source stats
        await self._update_source_stats(created_items)

        return created_items

    async def _process_single(self, entry: dict) -> Optional[IntelItem]:
        """Process a single raw entry through all pipeline stages."""
        # 1. Normalize
        title = str(entry.get("title", "Untitled"))[:500]
        description = str(entry.get("description", ""))[:2000]
        link = entry.get("link", entry.get("url", ""))
        raw_text = f"{title} {description} {link}"

        # 2. Extract observables
        observables = extract_observables(raw_text)
        primary_obs = observables[0] if observables else {"type": "other", "value": link or title[:100], "canonical": link or title[:100]}

        # 3. Deduplicate
        dedup_hash = compute_dedup_hash(self.source.id, primary_obs["canonical"], title)
        existing = (await self.db.execute(
            select(IntelItem).where(
                IntelItem.dedup_hash == dedup_hash,
                IntelItem.workspace_id == self.workspace_id
            )
        )).scalar_one_or_none()

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
            observable_type=primary_obs["type"],
            observable_value=primary_obs["canonical"],
            source_id=self.source.id,
            source_name=self.source.name,
            original_url=link,
            excerpt=description[:500],
            dedup_hash=dedup_hash,
            published_at=entry.get("published_at") or _utcnow(),
            fetched_at=_utcnow(),
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

        # 6b. Auto-enrich with WHOIS/DNS/GreyNoise (free APIs, no keys needed)
        enrichment_results = {}
        try:
            from app.services.whois_dns import whois_enrichment, dns_enrichment, greynoise_enrichment
            import asyncio

            enrich_tasks = []
            if primary_obs["type"] == "ip":
                enrich_tasks = [
                    whois_enrichment.lookup("ip", primary_obs["canonical"]),
                    dns_enrichment.reverse_dns(primary_obs["canonical"]),
                    greynoise_enrichment.classify_ip(primary_obs["canonical"]),
                ]
            elif primary_obs["type"] == "domain":
                enrich_tasks = [
                    whois_enrichment.lookup("domain", primary_obs["canonical"]),
                    dns_enrichment.lookup_domain(primary_obs["canonical"], ["A", "MX", "NS"]),
                ]

            if enrich_tasks:
                results = await asyncio.gather(*enrich_tasks, return_exceptions=True)
                for r in results:
                    if isinstance(r, dict):
                        enrichment_results[r.get("provider", "unknown")] = r
        except Exception as e:
            logger.debug(f"Auto-enrichment skipped: {e}")

        # 7. Store observables and link M2M
        for obs in observables:
            obs_record = await self._upsert_observable(obs, best_geo if obs == observables[0] and best_geo else None)
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

        # 9. Risk scoring v2 with explainability + threat actor reputation + IOC freshness
        highest_crit = self._matcher.get_highest_criticality(
            [(m["asset_id"], m["asset_value"], m["criticality"]) for m in all_matches]
        ) if all_matches and self._matcher else "info"

        asset_relevance = 1.0 if all_matches else 0.0
        corroboration = (await self.db.execute(
            select(func.count()).select_from(IntelItem).where(
                IntelItem.dedup_hash == dedup_hash,
            )
        )).scalar() or 0

        conf_result = calculate_confidence_score(
            {"excerpt": item.excerpt, "original_url": item.original_url, "published_at": item.published_at},
            source_reputation=self._source_reliability,
            corroboration_count=corroboration + 1,
            enrichment_results=enrichment_results,
        )
        risk_result = calculate_risk_score(
            {"severity": severity, "dedup_count": item.dedup_count,
             "title": title, "description": description, "tags": entry.get("tags", []),
             "published_at": item.published_at, "fetched_at": item.fetched_at},
            asset_relevance=asset_relevance,
            criticality=highest_crit,
            enrichment_results=enrichment_results,
        )

        item.confidence_score = conf_result["score"]
        item.risk_score = risk_result["score"]
        item.score_explanation = {
            "confidence": conf_result,
            "risk": risk_result,
            "asset_matches": len(all_matches),
            "observables_extracted": len(observables),
            "geo_enriched": best_geo is not None,
            "enrichment": enrichment_results,
        }

        # 10. MITRE ATT&CK mapping
        mitre = extract_mitre_from_text(
            f"{title} {description}",
            tags=entry.get("tags", []),
        )
        if mitre["technique_ids"]:
            item.mitre_technique_ids = mitre["technique_ids"]
            item.mitre_tactics = mitre["tactics"]
            item.mitre_mapping_confidence = mitre["confidence"]
            item.mitre_mapping_source = mitre["source"]

        # 11. Campaign auto-grouping
        campaign = self._detect_campaign(title, observables)
        if campaign:
            item.campaign_id = campaign["id"]
            item.campaign_name = campaign["name"]

        self.db.add(item)
        self.stats["items_new"] += 1
        self.stats["confidence_sum"] += item.confidence_score
        self.stats["risk_sum"] += item.risk_score

        return item

    async def _upsert_observable(self, obs: dict, geo: Optional[dict] = None) -> Observable:
        """Create or update an observable record."""
        existing = (await self.db.execute(
            select(Observable).where(
                Observable.workspace_id == self.workspace_id,
                Observable.type == obs["type"],
                Observable.normalized_value == obs["canonical"],
            )
        )).scalar_one_or_none()

        if existing:
            existing.last_seen = _utcnow()
            existing.sighting_count = (existing.sighting_count or 1) + 1
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
            first_seen=_utcnow(),
            last_seen=_utcnow(),
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
        if obs["canonical"].lower() == asset_value.lower():
            return "exact"
        if obs["type"] == "domain" and obs["canonical"].endswith(f".{asset_value.lower()}"):
            return "subdomain"
        if obs["type"] == "ip" and "/" in asset_value:
            return "cidr"
        return "fuzzy"

    def _detect_campaign(self, title: str, observables: list) -> Optional[dict]:
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

    async def _update_source_stats(self, created_items: List[IntelItem]):
        now = _utcnow()
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

        self.source.last_fetch_at = now
        self.source.last_success_at = now
        self.source.item_count = (self.source.item_count or 0) + self.stats["items_new"]
        self.source.health = "healthy"
        self.source.consecutive_failures = 0
        self.source.backoff_seconds = 0
        self.source.last_error = None
        self.source.last_fetched_count = self.stats["items_fetched"]
        self.source.last_new_count = self.stats["items_new"]
        self.source.last_dedup_count = self.stats["items_deduplicated"]

        # Schedule next fetch
        interval = self.source.polling_interval_minutes or 60
        self.source.next_fetch_at = now + timedelta(minutes=interval)

    async def record_failure(self, error_type: str, error_message: str, raw_excerpt: str = None):
        """Record a fetch failure in the dead-letter table and update source health."""
        from app.models.operations import FailedIngestion
        now = _utcnow()

        self.source.consecutive_failures = (self.source.consecutive_failures or 0) + 1
        self.source.last_error = error_message[:1000]
        self.source.last_fetch_at = now

        # Exponential backoff: 60s, 120s, 240s, 480s... capped at 1h
        backoff = min(60 * (2 ** (self.source.consecutive_failures - 1)), 3600)
        self.source.backoff_seconds = backoff
        self.source.backoff_until = now + timedelta(seconds=backoff)
        self.source.next_fetch_at = now + timedelta(seconds=backoff)

        if self.source.consecutive_failures >= 5:
            self.source.health = "error"
        elif self.source.consecutive_failures >= 2:
            self.source.health = "degraded"

        failure = FailedIngestion(
            id=gen_uuid(),
            workspace_id=self.workspace_id,
            source_id=self.source.id,
            source_name=self.source.name,
            fetched_at=now,
            error_type=error_type,
            error_message=error_message[:2000],
            raw_response_excerpt=raw_excerpt[:1000] if raw_excerpt else None,
        )
        self.db.add(failure)
        return failure
