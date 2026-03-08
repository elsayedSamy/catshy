"""Tests for STIX 2.1 export service."""
import pytest
from app.services.stix_export import (
    build_stix_bundle, intel_item_to_stix_objects,
    _observable_to_pattern, entity_to_stix_object,
)


def _make_item(**overrides):
    base = {
        "id": "test-001",
        "title": "Test CVE Alert",
        "description": "A critical vulnerability.",
        "severity": "critical",
        "observable_type": "ip",
        "observable_value": "192.168.1.1",
        "source_name": "CISA KEV",
        "published_at": "2024-06-01T12:00:00Z",
        "fetched_at": "2024-06-01T12:05:00Z",
        "created_at": "2024-06-01T12:05:00Z",
        "original_url": "https://example.com/alert",
        "excerpt": "Test excerpt",
        "confidence_score": 90,
        "risk_score": 85,
        "tags": ["test", "critical"],
        "mitre_technique_ids": ["T1059", "T1566.001"],
        "mitre_tactics": ["execution", "initial-access"],
        "mitre_mapping_confidence": 0.8,
        "mitre_mapping_source": "auto",
        "status": "active",
    }
    base.update(overrides)
    return base


class TestPatternMapping:
    def test_ipv4(self):
        assert _observable_to_pattern("ip", "1.2.3.4") == "[ipv4-addr:value = '1.2.3.4']"

    def test_domain(self):
        assert _observable_to_pattern("domain", "evil.com") == "[domain-name:value = 'evil.com']"

    def test_url(self):
        assert _observable_to_pattern("url", "https://evil.com/p") == "[url:value = 'https://evil.com/p']"

    def test_sha256(self):
        h = "a" * 64
        assert _observable_to_pattern("hash_sha256", h) == f"[file:hashes.'SHA-256' = '{h}']"

    def test_md5(self):
        assert _observable_to_pattern("md5", "abc123") == "[file:hashes.'MD5' = 'abc123']"

    def test_email(self):
        assert _observable_to_pattern("email", "a@b.com") == "[email-addr:value = 'a@b.com']"

    def test_cve_returns_none(self):
        assert _observable_to_pattern("cve", "CVE-2024-1234") is None

    def test_unknown_returns_none(self):
        assert _observable_to_pattern("foobar", "val") is None


class TestIntelItemConversion:
    def test_ip_produces_indicator_and_report(self):
        objects = intel_item_to_stix_objects(_make_item())
        types = [o["type"] for o in objects]
        assert "indicator" in types
        assert "report" in types
        assert "relationship" in types

    def test_cve_produces_vulnerability(self):
        objects = intel_item_to_stix_objects(
            _make_item(observable_type="cve", observable_value="CVE-2024-3400")
        )
        types = [o["type"] for o in objects]
        assert "vulnerability" in types
        assert "report" in types
        # CVE should not produce an indicator (no pattern)
        assert "indicator" not in types

    def test_mitre_external_references(self):
        objects = intel_item_to_stix_objects(_make_item())
        indicator = next(o for o in objects if o["type"] == "indicator")
        mitre_refs = [r for r in indicator.get("external_references", []) if r.get("source_name") == "mitre-attack"]
        assert len(mitre_refs) == 2
        assert mitre_refs[0]["external_id"] == "T1059"

    def test_confidence_mapping(self):
        objects = intel_item_to_stix_objects(_make_item(confidence_score=75))
        report = next(o for o in objects if o["type"] == "report")
        assert report["confidence"] == 75

    def test_kill_chain_phases(self):
        objects = intel_item_to_stix_objects(_make_item())
        indicator = next(o for o in objects if o["type"] == "indicator")
        assert len(indicator.get("kill_chain_phases", [])) == 2


class TestEntityConversion:
    def test_threat_actor(self):
        sdo = entity_to_stix_object({"type": "threat_actor", "name": "APT28", "description": "Russian APT", "confidence": 0.9, "created_at": None})
        assert sdo["type"] == "threat-actor"
        assert sdo["name"] == "APT28"

    def test_malware(self):
        sdo = entity_to_stix_object({"type": "malware", "name": "Emotet", "description": "", "confidence": 0.8, "created_at": None})
        assert sdo["type"] == "malware"

    def test_tool(self):
        sdo = entity_to_stix_object({"type": "tool", "name": "Cobalt Strike", "description": "", "confidence": 0.7, "created_at": None})
        assert sdo["type"] == "tool"

    def test_unknown_returns_none(self):
        assert entity_to_stix_object({"type": "unknown", "name": "x"}) is None


class TestBundleStructure:
    def test_bundle_type_and_id(self):
        bundle = build_stix_bundle([_make_item()])
        assert bundle["type"] == "bundle"
        assert bundle["id"].startswith("bundle--")

    def test_identity_included(self):
        bundle = build_stix_bundle([_make_item()])
        types = [o["type"] for o in bundle["objects"]]
        assert "identity" in types

    def test_empty_items(self):
        bundle = build_stix_bundle([])
        assert bundle["type"] == "bundle"
        assert len(bundle["objects"]) == 1  # only identity

    def test_workspace_isolation_not_leaked(self):
        """Ensure no workspace_id appears in STIX output."""
        import json
        bundle = build_stix_bundle([_make_item()])
        raw = json.dumps(bundle)
        assert "workspace_id" not in raw

    def test_multiple_items(self):
        items = [_make_item(id=f"item-{i}") for i in range(5)]
        bundle = build_stix_bundle(items)
        reports = [o for o in bundle["objects"] if o["type"] == "report"]
        assert len(reports) == 5
