"""Tests for Phase 6 — IOC lifecycle + MITRE ATT&CK mapping."""
import pytest
from app.services.mitre_mapper import extract_mitre_from_text, get_tactics_for_techniques


class TestMitreExtraction:
    """Test MITRE technique extraction from text and tags."""

    def test_extract_technique_from_text(self):
        result = extract_mitre_from_text("This attack uses T1059.001 for PowerShell execution")
        assert "T1059.001" in result["technique_ids"]
        assert result["confidence"] >= 0.9
        assert result["source"] == "tag"

    def test_extract_technique_from_tags(self):
        result = extract_mitre_from_text("Some generic text", tags=["T1566", "phishing"])
        assert "T1566" in result["technique_ids"]
        assert "TA0001" in result["tactics"]

    def test_extract_from_known_malware(self):
        result = extract_mitre_from_text("Emotet botnet C2 activity detected")
        assert len(result["technique_ids"]) > 0
        assert "T1566.001" in result["technique_ids"]
        assert result["confidence"] >= 0.7

    def test_extract_from_ransomware_keyword(self):
        result = extract_mitre_from_text("LockBit ransomware variant spreading")
        assert "T1486" in result["technique_ids"]
        assert "TA0040" in result["tactics"]

    def test_no_match_returns_empty(self):
        result = extract_mitre_from_text("The weather is nice today")
        assert result["technique_ids"] == []
        assert result["tactics"] == []
        assert result["confidence"] == 0.0
        assert result["source"] is None

    def test_apt_group_mapping(self):
        result = extract_mitre_from_text("APT28 spear-phishing campaign")
        assert len(result["technique_ids"]) > 0
        assert "TA0001" in result["tactics"]

    def test_multiple_techniques(self):
        result = extract_mitre_from_text("Attack uses T1059 and T1190 for initial access and execution")
        assert "T1059" in result["technique_ids"]
        assert "T1190" in result["technique_ids"]

    def test_tactic_from_tags(self):
        result = extract_mitre_from_text("Generic", tags=["TA0001", "TA0002"])
        assert "TA0001" in result["tactics"]
        assert "TA0002" in result["tactics"]

    def test_cobalt_strike_mapping(self):
        result = extract_mitre_from_text("Cobalt Strike beacon detected communicating with C2")
        assert "T1059.001" in result["technique_ids"]
        assert "T1071.001" in result["technique_ids"]


class TestTacticLookup:
    def test_known_technique(self):
        tactics = get_tactics_for_techniques(["T1566.001", "T1059"])
        assert "TA0001" in tactics
        assert "TA0002" in tactics

    def test_unknown_technique(self):
        tactics = get_tactics_for_techniques(["T9999"])
        assert tactics == []


class TestLifecycleModel:
    """Test that lifecycle fields are properly defined on models."""

    def test_intel_item_has_lifecycle_fields(self):
        from app.models.intel import IntelItem
        assert hasattr(IntelItem, 'status')
        assert hasattr(IntelItem, 'expires_at')
        assert hasattr(IntelItem, 'analyst_verdict')
        assert hasattr(IntelItem, 'verdict_reason')
        assert hasattr(IntelItem, 'analyst_notes')

    def test_intel_item_has_mitre_fields(self):
        from app.models.intel import IntelItem
        assert hasattr(IntelItem, 'mitre_technique_ids')
        assert hasattr(IntelItem, 'mitre_tactics')
        assert hasattr(IntelItem, 'mitre_mapping_confidence')
        assert hasattr(IntelItem, 'mitre_mapping_source')

    def test_observable_has_lifecycle_fields(self):
        from app.models.intel import Observable
        assert hasattr(Observable, 'status')
        assert hasattr(Observable, 'expires_at')

    def test_failed_ingestion_model(self):
        from app.models.operations import FailedIngestion
        assert hasattr(FailedIngestion, 'source_id')
        assert hasattr(FailedIngestion, 'error_type')
        assert hasattr(FailedIngestion, 'retry_count')
        assert hasattr(FailedIngestion, 'status')


class TestIngestionMitreIntegration:
    """Test that MITRE mapping is called during ingestion."""

    def test_mitre_mapping_in_pipeline_context(self):
        """Verify extract_mitre_from_text works with typical ingestion data."""
        title = "CVE-2024-3400 - PAN-OS Command Injection (RCE)"
        description = "Critical command injection vulnerability allows unauthenticated attacker to execute arbitrary OS commands"
        tags = ["rce", "firewall"]

        result = extract_mitre_from_text(f"{title} {description}", tags=tags)
        # "command injection" and "rce" should map
        assert len(result["technique_ids"]) > 0
        assert result["confidence"] > 0

    def test_phishing_mapping(self):
        result = extract_mitre_from_text(
            "New spear-phishing campaign targeting finance sector",
            tags=["phishing", "finance"]
        )
        assert "T1566" in result["technique_ids"] or "T1566.001" in result["technique_ids"]
        assert "TA0001" in result["tactics"]
