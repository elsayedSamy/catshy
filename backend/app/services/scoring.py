"""Scoring service — confidence and risk scoring with explainability"""

def calculate_confidence_score(item: dict, source_reputation: float = 0.5, corroboration_count: int = 1) -> dict:
    """Calculate confidence score with explainability breakdown"""
    factors = {}
    # Source reputation (0-1)
    factors["source_reputation"] = {"value": source_reputation, "weight": 0.3, "description": f"Source reputation: {source_reputation:.0%}"}
    # Corroboration
    corr_score = min(corroboration_count / 5.0, 1.0)
    factors["corroboration"] = {"value": corr_score, "weight": 0.25, "description": f"Corroborated by {corroboration_count} source(s)"}
    # Evidence quality
    has_excerpt = bool(item.get("excerpt"))
    has_url = bool(item.get("original_url"))
    evidence_score = (0.5 if has_excerpt else 0) + (0.5 if has_url else 0)
    factors["evidence_quality"] = {"value": evidence_score, "weight": 0.25, "description": f"Evidence: {'excerpt' if has_excerpt else 'no excerpt'}, {'URL' if has_url else 'no URL'}"}
    # Recency
    from datetime import datetime
    age_hours = 1  # default
    if item.get("published_at"):
        try:
            age_hours = (datetime.utcnow() - datetime.fromisoformat(str(item["published_at"]))).total_seconds() / 3600
        except: pass
    age_score = max(0, 1 - (age_hours / 720))  # Decays over 30 days
    factors["recency"] = {"value": age_score, "weight": 0.2, "description": f"Age: {age_hours:.0f} hours"}
    # Weighted sum
    total = sum(f["value"] * f["weight"] for f in factors.values())
    return {"score": round(total, 3), "factors": factors}

def calculate_risk_score(item: dict, asset_relevance: float = 0.0, criticality: str = "medium") -> dict:
    """Calculate risk score with explainability breakdown"""
    crit_map = {"critical": 1.0, "high": 0.8, "medium": 0.5, "low": 0.3, "info": 0.1}
    sev_map = {"critical": 1.0, "high": 0.8, "medium": 0.5, "low": 0.3, "info": 0.1}
    factors = {}
    factors["asset_relevance"] = {"value": asset_relevance, "weight": 0.35, "description": f"Asset relevance: {asset_relevance:.0%}"}
    sev_score = sev_map.get(item.get("severity", "info"), 0.1)
    factors["severity"] = {"value": sev_score, "weight": 0.25, "description": f"Severity: {item.get('severity', 'info')}"}
    crit_score = crit_map.get(criticality, 0.5)
    factors["asset_criticality"] = {"value": crit_score, "weight": 0.25, "description": f"Asset criticality: {criticality}"}
    factors["prevalence"] = {"value": min(item.get("dedup_count", 1) / 10.0, 1.0), "weight": 0.15,
                             "description": f"Seen {item.get('dedup_count', 1)} time(s)"}
    total = sum(f["value"] * f["weight"] for f in factors.values())
    return {"score": round(total, 3), "factors": factors}
