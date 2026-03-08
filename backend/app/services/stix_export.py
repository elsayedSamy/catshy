"""STIX 2.1 Bundle Export Service — converts CATSHY intel to valid STIX 2.1 JSON."""
import uuid
import re
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any


STIX_SPEC_VERSION = "2.1"
IDENTITY_CATSHY = {
    "type": "identity",
    "spec_version": STIX_SPEC_VERSION,
    "id": "identity--catshy-tip-00000000-0000-0000-0000-000000000001",
    "created": "2024-01-01T00:00:00.000Z",
    "modified": "2024-01-01T00:00:00.000Z",
    "name": "CATSHY Threat Intelligence Platform",
    "identity_class": "system",
}


def _stix_id(sdo_type: str) -> str:
    return f"{sdo_type}--{uuid.uuid4()}"


def _ts(dt: Optional[Any]) -> str:
    if dt is None:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    if isinstance(dt, str):
        return dt
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def _stix_confidence(score: float) -> int:
    """Map 0-100 score to STIX confidence (0-100 integer)."""
    return max(0, min(100, int(score)))


def _observable_to_pattern(obs_type: str, obs_value: str) -> Optional[str]:
    """Map CATSHY observable type+value to a STIX 2.1 indicator pattern."""
    t = (obs_type or "").lower()
    v = obs_value or ""
    if not v:
        return None
    if t == "ip" or t == "ipv4":
        return f"[ipv4-addr:value = '{v}']"
    if t == "ipv6":
        return f"[ipv6-addr:value = '{v}']"
    if t == "domain":
        return f"[domain-name:value = '{v}']"
    if t == "url":
        return f"[url:value = '{v}']"
    if t == "email":
        return f"[email-addr:value = '{v}']"
    if t in ("hash_md5", "md5"):
        return f"[file:hashes.'MD5' = '{v}']"
    if t in ("hash_sha1", "sha1"):
        return f"[file:hashes.'SHA-1' = '{v}']"
    if t in ("hash_sha256", "sha256", "hash"):
        return f"[file:hashes.'SHA-256' = '{v}']"
    # CVEs → not indicators per se but we still include as external_references
    return None


def _severity_to_labels(severity: str) -> List[str]:
    labels = []
    if severity:
        labels.append(f"severity:{severity}")
    return labels


def _mitre_external_refs(technique_ids: List[str], tactics: List[str]) -> List[Dict]:
    refs = []
    for tid in (technique_ids or []):
        refs.append({
            "source_name": "mitre-attack",
            "external_id": tid,
            "url": f"https://attack.mitre.org/techniques/{tid.replace('.', '/')}/",
        })
    return refs


def _mitre_kill_chain(tactics: List[str]) -> List[Dict]:
    phases = []
    for t in (tactics or []):
        phases.append({
            "kill_chain_name": "mitre-attack",
            "phase_name": t,
        })
    return phases


def intel_item_to_stix_objects(item: Dict[str, Any]) -> List[Dict]:
    """Convert a single IntelItem dict into a list of STIX 2.1 SDOs."""
    objects: List[Dict] = []
    now = _ts(None)
    created = _ts(item.get("created_at") or item.get("fetched_at"))
    modified = _ts(item.get("created_at") or item.get("fetched_at"))

    item_id = str(item.get("id", uuid.uuid4()))
    severity = item.get("severity", "info")
    confidence = _stix_confidence(item.get("confidence_score", 0))

    # External references
    ext_refs = []
    if item.get("original_url"):
        ext_refs.append({"source_name": item.get("source_name", "unknown"), "url": item["original_url"]})

    # MITRE refs
    mitre_refs = _mitre_external_refs(
        item.get("mitre_technique_ids", []),
        item.get("mitre_tactics", []),
    )
    ext_refs.extend(mitre_refs)

    # Kill chain phases
    kill_chain = _mitre_kill_chain(item.get("mitre_tactics", []))

    # 1) Report SDO — represents the IntelItem itself
    report_id = _stix_id("report")
    report_obj = {
        "type": "report",
        "spec_version": STIX_SPEC_VERSION,
        "id": report_id,
        "created": created,
        "modified": modified,
        "name": item.get("title", "Untitled Intel"),
        "description": item.get("description") or item.get("excerpt", ""),
        "published": _ts(item.get("published_at")),
        "report_types": ["threat-report"],
        "labels": _severity_to_labels(severity) + (item.get("tags") or []),
        "confidence": confidence,
        "created_by_ref": IDENTITY_CATSHY["id"],
        "object_refs": [],
    }
    if ext_refs:
        report_obj["external_references"] = ext_refs

    # 2) Indicator SDO — if observable is mappable to a STIX pattern
    obs_type = item.get("observable_type", "")
    obs_value = item.get("observable_value", "")
    pattern = _observable_to_pattern(obs_type, obs_value)

    if pattern:
        indicator_id = _stix_id("indicator")
        indicator_obj: Dict[str, Any] = {
            "type": "indicator",
            "spec_version": STIX_SPEC_VERSION,
            "id": indicator_id,
            "created": created,
            "modified": modified,
            "name": f"{obs_type.upper()}: {obs_value}",
            "description": f"Observable extracted from: {item.get('title', '')}",
            "pattern": pattern,
            "pattern_type": "stix",
            "valid_from": _ts(item.get("published_at") or item.get("fetched_at")),
            "labels": _severity_to_labels(severity),
            "confidence": confidence,
            "created_by_ref": IDENTITY_CATSHY["id"],
        }
        if ext_refs:
            indicator_obj["external_references"] = ext_refs
        if kill_chain:
            indicator_obj["kill_chain_phases"] = kill_chain
        objects.append(indicator_obj)
        report_obj["object_refs"].append(indicator_id)

        # 3) Relationship: indicator → report
        rel_id = _stix_id("relationship")
        objects.append({
            "type": "relationship",
            "spec_version": STIX_SPEC_VERSION,
            "id": rel_id,
            "created": created,
            "modified": modified,
            "relationship_type": "derived-from",
            "source_ref": indicator_id,
            "target_ref": report_id,
            "created_by_ref": IDENTITY_CATSHY["id"],
        })

    # CVE as vulnerability SDO
    if obs_type == "cve" and obs_value:
        vuln_id = _stix_id("vulnerability")
        vuln_obj = {
            "type": "vulnerability",
            "spec_version": STIX_SPEC_VERSION,
            "id": vuln_id,
            "created": created,
            "modified": modified,
            "name": obs_value,
            "description": item.get("description", ""),
            "external_references": [{
                "source_name": "cve",
                "external_id": obs_value,
                "url": f"https://nvd.nist.gov/vuln/detail/{obs_value}",
            }],
            "created_by_ref": IDENTITY_CATSHY["id"],
        }
        objects.append(vuln_obj)
        report_obj["object_refs"].append(vuln_id)

    objects.append(report_obj)
    return objects


def entity_to_stix_object(entity: Dict[str, Any]) -> Optional[Dict]:
    """Convert a CATSHY Entity to a STIX SDO (threat-actor, malware, tool)."""
    etype = (entity.get("type") or "").lower()
    created = _ts(entity.get("created_at"))

    if etype in ("threat_actor", "threat-actor", "actor", "apt"):
        return {
            "type": "threat-actor",
            "spec_version": STIX_SPEC_VERSION,
            "id": _stix_id("threat-actor"),
            "created": created,
            "modified": created,
            "name": entity.get("name", "Unknown"),
            "description": entity.get("description", ""),
            "threat_actor_types": ["unknown"],
            "confidence": _stix_confidence(entity.get("confidence", 50)),
            "created_by_ref": IDENTITY_CATSHY["id"],
        }
    elif etype in ("malware",):
        return {
            "type": "malware",
            "spec_version": STIX_SPEC_VERSION,
            "id": _stix_id("malware"),
            "created": created,
            "modified": created,
            "name": entity.get("name", "Unknown"),
            "description": entity.get("description", ""),
            "malware_types": ["unknown"],
            "is_family": True,
            "created_by_ref": IDENTITY_CATSHY["id"],
        }
    elif etype in ("tool",):
        return {
            "type": "tool",
            "spec_version": STIX_SPEC_VERSION,
            "id": _stix_id("tool"),
            "created": created,
            "modified": created,
            "name": entity.get("name", "Unknown"),
            "description": entity.get("description", ""),
            "tool_types": ["unknown"],
            "created_by_ref": IDENTITY_CATSHY["id"],
        }
    return None


def build_stix_bundle(
    intel_items: List[Dict],
    entities: Optional[List[Dict]] = None,
) -> Dict:
    """Build a complete STIX 2.1 bundle from intel items and optional entities."""
    objects: List[Dict] = [IDENTITY_CATSHY]

    for item in intel_items:
        objects.extend(intel_item_to_stix_objects(item))

    for entity in (entities or []):
        sdo = entity_to_stix_object(entity)
        if sdo:
            objects.append(sdo)

    bundle = {
        "type": "bundle",
        "id": _stix_id("bundle"),
        "objects": objects,
    }
    return bundle
