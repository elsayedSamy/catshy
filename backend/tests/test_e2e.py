#!/usr/bin/env python3
"""CATSHY E2E Test Suite — Run locally on Kali after install"""
import requests
import json
import sys
import time

BASE_URL = "http://localhost/api"
ADMIN_EMAIL = "admin@catshy.local"
ADMIN_PASS = "AdminPass123!"
TOKEN = None

def log(step, msg, ok=True):
    status = "✅" if ok else "❌"
    print(f"  {status} [{step}] {msg}")
    if not ok:
        sys.exit(1)

def test_health():
    r = requests.get(f"{BASE_URL}/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    log("Health", f"API healthy: {data['service']} v{data['version']}")

def test_register_bootstrap():
    r = requests.post(f"{BASE_URL}/auth/register", json={
        "email": ADMIN_EMAIL, "name": "Admin", "password": ADMIN_PASS
    })
    if r.status_code == 409:
        log("Register", "Admin already exists (OK)")
    else:
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "admin"
        log("Register", f"Bootstrap admin created (role={data['role']})")

def test_login():
    global TOKEN
    r = requests.post(f"{BASE_URL}/auth/login", json={
        "email": ADMIN_EMAIL, "password": ADMIN_PASS
    })
    assert r.status_code == 200
    data = r.json()
    TOKEN = data["access_token"]
    assert data["user"]["role"] == "admin"
    log("Login", f"Authenticated as {data['user']['email']} (role={data['user']['role']})")

def headers():
    return {"Authorization": f"Bearer {TOKEN}"}

def test_add_assets():
    assets = [
        {"type": "domain", "value": "example.com", "label": "Primary Domain", "criticality": "critical"},
        {"type": "ip_range", "value": "192.168.1.0/24", "label": "Internal Range", "criticality": "high"},
        {"type": "brand", "value": "CATSHY", "label": "Brand Name", "criticality": "medium"},
    ]
    for asset in assets:
        r = requests.post(f"{BASE_URL}/assets/", json=asset, headers=headers())
        assert r.status_code == 200
        log("Assets", f"Created {asset['type']}: {asset['value']}")

    r = requests.get(f"{BASE_URL}/assets/", headers=headers())
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 3
    log("Assets", f"Listed {len(data)} assets")

def test_initialize_sources():
    r = requests.post(f"{BASE_URL}/sources/initialize", headers=headers())
    assert r.status_code == 200
    log("Sources", r.json()["message"])

def test_enable_source():
    r = requests.get(f"{BASE_URL}/sources/", headers=headers())
    assert r.status_code == 200
    sources = r.json()
    assert len(sources) >= 50
    log("Sources", f"Catalog has {len(sources)} templates")

    # Enable a free, public RSS source
    r = requests.post(f"{BASE_URL}/sources/cisa-kev/enable", headers=headers())
    assert r.status_code == 200
    log("Sources", "Enabled CISA KEV source")

def test_view_feed():
    # Wait a moment for polling to potentially trigger
    time.sleep(2)
    r = requests.get(f"{BASE_URL}/feed/", headers=headers())
    assert r.status_code == 200
    data = r.json()
    log("Feed", f"Feed has {len(data)} items (may be 0 if first fetch pending)")

def test_search():
    r = requests.get(f"{BASE_URL}/search/?q=CVE", headers=headers())
    assert r.status_code == 200
    data = r.json()
    log("Search", f"Search returned {data['total']} results")

def test_create_alert_rule():
    r = requests.post(f"{BASE_URL}/alerts/rules", headers=headers(), params={
        "name": "Critical CVE Alert",
        "description": "Alert on critical CVEs",
        "severity": "critical",
    }, json=[{"field": "severity", "operator": "equals", "value": "critical"}])
    assert r.status_code == 200
    log("Alerts", f"Created rule: {r.json()['id']}")

def test_list_alerts():
    r = requests.get(f"{BASE_URL}/alerts/", headers=headers())
    assert r.status_code == 200
    log("Alerts", f"{len(r.json())} alerts")

def test_create_investigation():
    # Investigation is frontend-managed (notebook), but verify cases work
    pass

def test_create_case():
    r = requests.post(f"{BASE_URL}/cases/", headers=headers(), params={
        "title": "Test Incident",
        "description": "E2E test case",
        "priority": "high",
    })
    assert r.status_code == 200
    case_id = r.json()["id"]
    log("Cases", f"Created case: {case_id}")
    return case_id

def test_generate_report(case_id):
    r = requests.post(f"{BASE_URL}/reports/generate", headers=headers(), params={
        "case_id": case_id,
        "format": "technical_pdf",
    })
    assert r.status_code == 200
    log("Reports", f"Report queued: {r.json()['id']}")

def test_list_leaks():
    r = requests.get(f"{BASE_URL}/leaks/", headers=headers())
    assert r.status_code == 200
    log("Leaks", f"{len(r.json())} leak items (expected 0 initially)")

def test_audit_logs():
    r = requests.get(f"{BASE_URL}/admin/audit-logs", headers=headers())
    assert r.status_code == 200
    logs = r.json()
    assert len(logs) > 0  # At least login event
    log("Audit", f"{len(logs)} audit entries")

def test_disable_source():
    r = requests.post(f"{BASE_URL}/sources/cisa-kev/disable", headers=headers())
    assert r.status_code == 200
    log("Sources", "Disabled CISA KEV source")

if __name__ == "__main__":
    print("\n═══════════════════════════════════════════")
    print("  CATSHY E2E Test Suite")
    print("═══════════════════════════════════════════\n")

    tests = [
        ("1. Health Check", test_health),
        ("2. Register Bootstrap Admin", test_register_bootstrap),
        ("3. Login", test_login),
        ("4. Add Assets", test_add_assets),
        ("5. Initialize Source Catalog", test_initialize_sources),
        ("6. Enable Source", test_enable_source),
        ("7. View Feed", test_view_feed),
        ("8. Search", test_search),
        ("9. Create Alert Rule", test_create_alert_rule),
        ("10. List Alerts", test_list_alerts),
    ]

    for name, func in tests:
        print(f"\n▶ {name}")
        try:
            func()
        except Exception as e:
            log(name, f"FAILED: {e}", ok=False)

    # Tests that depend on previous results
    print(f"\n▶ 11. Create Case")
    case_id = test_create_case()

    print(f"\n▶ 12. Generate Report")
    test_generate_report(case_id)

    print(f"\n▶ 13. List Leaks")
    test_list_leaks()

    print(f"\n▶ 14. Audit Logs")
    test_audit_logs()

    print(f"\n▶ 15. Disable Source")
    test_disable_source()

    print("\n═══════════════════════════════════════════")
    print("  ✅ All E2E tests passed!")
    print("═══════════════════════════════════════════\n")
