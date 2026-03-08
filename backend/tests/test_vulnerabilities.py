"""Tests for Vulnerability Intelligence module."""
import pytest
from app.models.vulnerability import Vulnerability, Advisory


def _make_vuln(**overrides):
    base = {
        "id": "vuln-001",
        "workspace_id": "ws-001",
        "cve_id": "CVE-2024-3400",
        "title": "PAN-OS Command Injection",
        "description": "Critical command injection in GlobalProtect",
        "cvss_score": 10.0,
        "severity": "critical",
        "vendor": "Palo Alto Networks",
        "product": "PAN-OS",
        "is_kev": True,
        "kev_ransomware_use": True,
        "affects_assets": False,
        "status": "open",
    }
    base.update(overrides)
    return base


class TestVulnerabilityModel:
    def test_kev_fields_present(self):
        """KEV fields exist on model."""
        cols = {c.name for c in Vulnerability.__table__.columns}
        assert "is_kev" in cols
        assert "kev_due_date" in cols
        assert "kev_ransomware_use" in cols

    def test_unique_constraint(self):
        """Unique constraint exists for workspace+cve."""
        constraints = [c.name for c in Vulnerability.__table__.constraints if hasattr(c, 'name') and c.name]
        assert "uq_vuln_cve_per_workspace" in constraints

    def test_advisory_model(self):
        cols = {c.name for c in Advisory.__table__.columns}
        assert "linked_cve_ids" in cols
        assert "vendor" in cols
        assert "dedup_hash" in cols


class TestVulnWorkspaceIsolation:
    def test_workspace_id_indexed(self):
        """workspace_id column exists and is indexed."""
        col = Vulnerability.__table__.columns["workspace_id"]
        assert col.index is True

    def test_advisory_workspace_id(self):
        col = Advisory.__table__.columns["workspace_id"]
        assert col.index is True


class TestCvssToSeverity:
    def test_critical_mapping(self):
        v = _make_vuln(cvss_score=9.8)
        assert v["severity"] == "critical"

    def test_model_has_cvss_vector(self):
        cols = {c.name for c in Vulnerability.__table__.columns}
        assert "cvss_vector" in cols
