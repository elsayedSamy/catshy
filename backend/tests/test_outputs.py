"""Tests for Phase 10 — Outputs, Webhooks, Export Jobs."""
import pytest
from app.models.outputs import WebhookOutput, ExportJob, SyslogOutput


def test_webhook_output_model():
    hook = WebhookOutput(
        workspace_id="ws-1",
        name="SIEM Forwarder",
        url="https://siem.example.com/webhook",
        auth_type="bearer",
        event_types=["new_intel", "new_alert"],
        enabled=True,
    )
    assert hook.name == "SIEM Forwarder"
    assert hook.auth_type == "bearer"
    assert "new_intel" in hook.event_types
    assert hook.consecutive_failures == 0


def test_export_job_model():
    job = ExportJob(
        workspace_id="ws-1",
        job_type="webhook",
        target="https://siem.example.com/webhook",
        event_type="new_intel",
        status="success",
        status_code=200,
    )
    assert job.job_type == "webhook"
    assert job.status == "success"


def test_syslog_output_model():
    s = SyslogOutput(
        workspace_id="ws-1",
        name="Corp Syslog",
        host="syslog.internal",
        port=514,
        protocol="udp",
        format="cef",
        event_types=["new_alert", "vuln_kev"],
    )
    assert s.host == "syslog.internal"
    assert s.format == "cef"
    assert s.port == 514


def test_webhook_workspace_scoping():
    h1 = WebhookOutput(workspace_id="ws-a", name="hook-a", url="https://a.com/hook")
    h2 = WebhookOutput(workspace_id="ws-b", name="hook-b", url="https://b.com/hook")
    assert h1.workspace_id != h2.workspace_id


def test_export_job_statuses():
    for status in ["pending", "success", "failed", "retrying"]:
        j = ExportJob(workspace_id="ws-1", job_type="pdf", status=status)
        assert j.status == status


def test_syslog_protocols():
    for proto in ["udp", "tcp", "tls"]:
        s = SyslogOutput(workspace_id="ws-1", name="test", host="h", protocol=proto)
        assert s.protocol == proto
