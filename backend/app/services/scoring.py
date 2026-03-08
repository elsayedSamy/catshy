"""Scoring service v2 — confidence and risk scoring with explainability.

CONFIDENCE SCORE (0–100):
  Deterministic weighted sum of five factors:
    source_reputation  × 25  — Source reliability (0-1 from SourceStats)
    corroboration      × 20  — Number of independent sources reporting same IOC (capped at 5)
    evidence_quality   × 20  — Has excerpt (0.5) + has URL (0.5)
    recency            × 15  — Decays linearly to 0 over 30 days
    enrichment_depth   × 20  — How many enrichment providers returned data (0-1)

RISK SCORE (0–100):
  Deterministic weighted sum of six factors:
    asset_relevance    × 25  — 1.0 if matched to org asset, else 0.0
    severity           × 20  — critical=1.0, high=0.8, medium=0.5, low=0.3, info=0.1
    asset_criticality  × 20  — Highest criticality of matched asset
    prevalence         × 10  — dedup_count / 10, capped at 1.0
    threat_actor_rep   × 15  — Known APT/threat actor reputation (0-1)
    ioc_freshness      × 10  — IOC age decay: fresh IOCs are riskier
"""
from datetime import datetime, timezone


# ── Threat Actor reputation database ──
THREAT_ACTOR_REPUTATION = {
    # Nation-state APTs (highest reputation = highest risk)
    "apt28": 1.0, "apt29": 1.0, "apt41": 1.0, "apt38": 1.0, "apt40": 1.0,
    "lazarus": 1.0, "fancy bear": 1.0, "cozy bear": 1.0, "turla": 0.95,
    "sandworm": 1.0, "kimsuky": 0.9, "mustang panda": 0.85, "winnti": 0.9,
    "hafnium": 0.95, "charming kitten": 0.85, "gamaredon": 0.8,
    # Ransomware groups
    "lockbit": 0.95, "conti": 0.9, "revil": 0.9, "blackcat": 0.9, "alphv": 0.9,
    "clop": 0.85, "hive": 0.8, "royal": 0.8, "play": 0.75, "akira": 0.75,
    "rhysida": 0.7, "bianlian": 0.7, "medusa": 0.7, "8base": 0.65,
    # Malware families
    "emotet": 0.85, "cobalt strike": 0.8, "qakbot": 0.75, "trickbot": 0.75,
    "agent tesla": 0.7, "agenttesla": 0.7, "raccoon stealer": 0.65,
    "redline": 0.7, "vidar": 0.65, "formbook": 0.65, "remcos": 0.6,
    "asyncrat": 0.6, "njrat": 0.55, "darkcomet": 0.5,
    # Generic threat types
    "botnet": 0.5, "ransomware": 0.7, "apt": 0.8, "zero-day": 0.9, "0-day": 0.9,
}


def _detect_threat_actor_reputation(title: str, description: str = "", tags: list = None) -> float:
    """Detect threat actor mentions and return highest reputation score."""
    text = f"{title} {description} {' '.join(tags or [])}".lower()
    max_rep = 0.0
    for actor, rep in THREAT_ACTOR_REPUTATION.items():
        if actor in text:
            max_rep = max(max_rep, rep)
    return max_rep


def _ioc_freshness_score(published_at, fetched_at=None) -> float:
    """Calculate IOC freshness: 1.0 for brand new, decays to 0 over 14 days."""
    ref_time = published_at or fetched_at
    if not ref_time:
        return 0.5

    if isinstance(ref_time, str):
        try:
            ref_time = datetime.fromisoformat(ref_time.replace("Z", "+00:00"))
        except Exception:
            return 0.5

    if ref_time.tzinfo is None:
        ref_time = ref_time.replace(tzinfo=timezone.utc)

    age_hours = (datetime.now(timezone.utc) - ref_time).total_seconds() / 3600
    if age_hours < 6:
        return 1.0
    elif age_hours < 24:
        return 0.9
    elif age_hours < 72:
        return 0.7
    elif age_hours < 168:  # 1 week
        return 0.4
    elif age_hours < 336:  # 2 weeks
        return 0.2
    return 0.05


def calculate_confidence_score(
    item: dict,
    source_reputation: float = 0.5,
    corroboration_count: int = 1,
    enrichment_results: dict = None,
) -> dict:
    """Calculate confidence score (0–100) with explainability breakdown."""
    factors = {}

    # Source reputation (0-1)
    factors["source_reputation"] = {
        "value": source_reputation, "weight": 0.25,
        "description": f"Source reputation: {source_reputation:.0%}",
    }

    # Corroboration
    corr_score = min(corroboration_count / 5.0, 1.0)
    factors["corroboration"] = {
        "value": corr_score, "weight": 0.20,
        "description": f"Corroborated by {corroboration_count} source(s)",
    }

    # Evidence quality
    has_excerpt = bool(item.get("excerpt"))
    has_url = bool(item.get("original_url"))
    evidence_score = (0.5 if has_excerpt else 0) + (0.5 if has_url else 0)
    factors["evidence_quality"] = {
        "value": evidence_score, "weight": 0.20,
        "description": f"Evidence: {'excerpt' if has_excerpt else 'no excerpt'}, {'URL' if has_url else 'no URL'}",
    }

    # Recency
    age_hours = 1
    if item.get("published_at"):
        try:
            pub = item["published_at"]
            if isinstance(pub, str):
                pub = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            if pub.tzinfo is None:
                pub = pub.replace(tzinfo=timezone.utc)
            age_hours = (datetime.now(timezone.utc) - pub).total_seconds() / 3600
        except Exception:
            pass
    age_score = max(0, 1 - (age_hours / 720))
    factors["recency"] = {
        "value": age_score, "weight": 0.15,
        "description": f"Age: {age_hours:.0f} hours",
    }

    # Enrichment depth (new in v2)
    enrichment_depth = 0.0
    if enrichment_results:
        found_count = sum(1 for v in enrichment_results.values() if isinstance(v, dict) and v.get("status") == "found")
        total = max(len(enrichment_results), 1)
        enrichment_depth = min(found_count / total, 1.0)
    factors["enrichment_depth"] = {
        "value": enrichment_depth, "weight": 0.20,
        "description": f"Enrichment: {int(enrichment_depth * 100)}% providers returned data",
    }

    # Weighted sum → scale to 0–100
    raw = sum(f["value"] * f["weight"] for f in factors.values())
    score = round(raw * 100)
    return {"score": score, "score_normalized": raw, "factors": factors}


def calculate_risk_score(
    item: dict,
    asset_relevance: float = 0.0,
    criticality: str = "medium",
    enrichment_results: dict = None,
) -> dict:
    """Calculate risk score (0–100) with explainability breakdown."""
    crit_map = {"critical": 1.0, "high": 0.8, "medium": 0.5, "low": 0.3, "info": 0.1}
    sev_map = {"critical": 1.0, "high": 0.8, "medium": 0.5, "low": 0.3, "info": 0.1}

    factors = {}

    # Asset relevance
    factors["asset_relevance"] = {
        "value": asset_relevance, "weight": 0.25,
        "description": f"Asset relevance: {asset_relevance:.0%}",
    }

    # Severity
    sev_score = sev_map.get(item.get("severity", "info"), 0.1)
    factors["severity"] = {
        "value": sev_score, "weight": 0.20,
        "description": f"Severity: {item.get('severity', 'info')}",
    }

    # Asset criticality
    crit_score = crit_map.get(criticality, 0.5)
    factors["asset_criticality"] = {
        "value": crit_score, "weight": 0.20,
        "description": f"Asset criticality: {criticality}",
    }

    # Prevalence
    prevalence = min(item.get("dedup_count", 1) / 10.0, 1.0)
    factors["prevalence"] = {
        "value": prevalence, "weight": 0.10,
        "description": f"Seen {item.get('dedup_count', 1)} time(s)",
    }

    # Threat Actor reputation (new in v2)
    title = item.get("title", "")
    description = item.get("description", "")
    tags = item.get("tags", [])
    actor_rep = _detect_threat_actor_reputation(title, description, tags)

    # Also check enrichment for malicious signals
    if enrichment_results and actor_rep < 0.5:
        vt = enrichment_results.get("virustotal", {})
        if isinstance(vt, dict) and vt.get("malicious", 0) > 5:
            actor_rep = max(actor_rep, 0.7)
        abuse = enrichment_results.get("abuseipdb", {})
        if isinstance(abuse, dict) and abuse.get("abuse_confidence", 0) > 80:
            actor_rep = max(actor_rep, 0.6)
        gn = enrichment_results.get("greynoise", {})
        if isinstance(gn, dict) and gn.get("classification") == "malicious":
            actor_rep = max(actor_rep, 0.5)

    factors["threat_actor_reputation"] = {
        "value": actor_rep, "weight": 0.15,
        "description": f"Threat actor reputation: {actor_rep:.0%}" + (
            " (known APT/malware)" if actor_rep >= 0.7 else ""
        ),
    }

    # IOC freshness (new in v2)
    freshness = _ioc_freshness_score(item.get("published_at"), item.get("fetched_at"))
    factors["ioc_freshness"] = {
        "value": freshness, "weight": 0.10,
        "description": f"IOC freshness: {freshness:.0%}",
    }

    raw = sum(f["value"] * f["weight"] for f in factors.values())
    score = round(raw * 100)
    return {"score": score, "score_normalized": raw, "factors": factors}
