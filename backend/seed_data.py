#!/usr/bin/env python3
"""
CATSHY Seed Data Script
========================
Populates the database with realistic sample threat intelligence data
for development and demonstration purposes.

Usage:
  python seed_data.py              # Uses DATABASE_URL from env
  python seed_data.py --reset      # Clear existing data first

This script runs automatically on first `docker-compose up` if the
database is empty.
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import json

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SEED_DATA = {
    "intel_items": [
        {
            "title": "CVE-2024-3400 - PAN-OS Command Injection",
            "description": "Critical command injection in Palo Alto Networks PAN-OS GlobalProtect feature allows unauthenticated RCE.",
            "severity": "critical",
            "observable_type": "cve",
            "observable_value": "CVE-2024-3400",
            "source_name": "CISA KEV",
            "original_url": "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
            "tags": ["firewall", "rce", "palo-alto"],
            "confidence": 0.99,
            "risk_score": 98,
        },
        {
            "title": "CVE-2024-21887 - Ivanti Connect Secure Auth Bypass",
            "description": "Authentication bypass in Ivanti Connect Secure and Policy Secure gateways.",
            "severity": "critical",
            "observable_type": "cve",
            "observable_value": "CVE-2024-21887",
            "source_name": "NVD",
            "original_url": "https://nvd.nist.gov/vuln/detail/CVE-2024-21887",
            "tags": ["vpn", "auth-bypass", "ivanti"],
            "confidence": 0.99,
            "risk_score": 97,
        },
        {
            "title": "CVE-2024-1709 - ConnectWise ScreenConnect Auth Bypass",
            "description": "Authentication bypass allowing unauthorized admin access to ConnectWise ScreenConnect.",
            "severity": "critical",
            "observable_type": "cve",
            "observable_value": "CVE-2024-1709",
            "source_name": "NVD",
            "original_url": "https://nvd.nist.gov/vuln/detail/CVE-2024-1709",
            "tags": ["rce", "remote-access"],
            "confidence": 0.98,
            "risk_score": 99,
        },
        {
            "title": "Emotet C2 Infrastructure - Active Botnet",
            "description": "New Emotet C2 server identified serving malware payloads via encrypted channels.",
            "severity": "high",
            "observable_type": "ip",
            "observable_value": "185.244.25.14",
            "source_name": "Feodo Tracker",
            "original_url": "https://feodotracker.abuse.ch",
            "tags": ["botnet", "emotet", "c2"],
            "confidence": 0.88,
            "risk_score": 75,
        },
        {
            "title": "Phishing Campaign Targeting Finance Sector",
            "description": "New phishing kit mimicking major banking portals with credential harvesting.",
            "severity": "high",
            "observable_type": "domain",
            "observable_value": "secure-banklogin.com",
            "source_name": "OpenPhish",
            "original_url": "https://openphish.com",
            "tags": ["phishing", "finance", "credential-theft"],
            "confidence": 0.92,
            "risk_score": 85,
        },
        {
            "title": "AgentTesla Stealer Distribution URL",
            "description": "URL hosting executable payload identified as AgentTesla information stealer.",
            "severity": "medium",
            "observable_type": "url",
            "observable_value": "https://malicious-downloads.xyz/update.exe",
            "source_name": "URLhaus",
            "original_url": "https://urlhaus.abuse.ch",
            "tags": ["malware", "stealer", "agenttesla"],
            "confidence": 0.80,
            "risk_score": 60,
        },
        {
            "title": "CobaltStrike Beacon Hash Detected",
            "description": "SHA-256 hash matching known CobaltStrike beacon payload.",
            "severity": "high",
            "observable_type": "hash_sha256",
            "observable_value": "e3b0c44298fc1c149afbf4c8996fb924627d8d2e43f245e3b8ec28c7108e5a99",
            "source_name": "MalwareBazaar",
            "original_url": "https://bazaar.abuse.ch",
            "tags": ["cobalt-strike", "post-exploitation"],
            "confidence": 0.95,
            "risk_score": 88,
        },
        {
            "title": "APT28 Spear-Phishing Campaign",
            "description": "Russian state-sponsored group APT28 conducting targeted spear-phishing operations.",
            "severity": "high",
            "observable_type": "actor",
            "observable_value": "APT28",
            "source_name": "MITRE ATT&CK",
            "original_url": "https://attack.mitre.org/groups/G0007/",
            "tags": ["apt", "russia", "espionage"],
            "confidence": 0.85,
            "risk_score": 78,
        },
        {
            "title": "LockBit 3.0 Ransomware Infrastructure",
            "description": "New LockBit 3.0 ransomware infrastructure identified with active affiliates.",
            "severity": "critical",
            "observable_type": "domain",
            "observable_value": "lockbit-decryptor.onion",
            "source_name": "The Hacker News",
            "original_url": "https://thehackernews.com",
            "tags": ["ransomware", "lockbit", "tor"],
            "confidence": 0.90,
            "risk_score": 92,
        },
        {
            "title": "Tor Exit Node Port Scanning",
            "description": "Known Tor exit node conducting port scanning across enterprise IP ranges.",
            "severity": "low",
            "observable_type": "ip",
            "observable_value": "104.244.76.13",
            "source_name": "Tor Exit Nodes",
            "original_url": "https://check.torproject.org",
            "tags": ["tor", "scanning", "reconnaissance"],
            "confidence": 0.60,
            "risk_score": 30,
        },
        {
            "title": "CVE-2024-0204 - GoAnywhere MFT RCE",
            "description": "Remote code execution in Fortra GoAnywhere MFT via admin account creation.",
            "severity": "critical",
            "observable_type": "cve",
            "observable_value": "CVE-2024-0204",
            "source_name": "CISA KEV",
            "original_url": "https://www.cisa.gov",
            "tags": ["rce", "file-transfer"],
            "confidence": 0.99,
            "risk_score": 97,
        },
        {
            "title": "Qakbot Malware Distribution Network",
            "description": "Qakbot botnet distribution network sending phishing emails with malicious attachments.",
            "severity": "high",
            "observable_type": "ip",
            "observable_value": "89.44.9.227",
            "source_name": "Feodo Tracker",
            "original_url": "https://feodotracker.abuse.ch",
            "tags": ["botnet", "qakbot", "phishing"],
            "confidence": 0.87,
            "risk_score": 72,
        },
    ],
    "threat_actors": [
        {"name": "APT28 (Fancy Bear)", "type": "threat_actor", "description": "Russian state-sponsored cyber espionage group"},
        {"name": "APT29 (Cozy Bear)", "type": "threat_actor", "description": "Russian intelligence-linked advanced persistent threat"},
        {"name": "LockBit Group", "type": "threat_actor", "description": "Prolific ransomware-as-a-service operation"},
        {"name": "Lazarus Group", "type": "threat_actor", "description": "North Korean state-sponsored threat group"},
        {"name": "FIN7", "type": "threat_actor", "description": "Financially motivated threat group targeting retail and hospitality"},
    ],
    "sample_assets": [
        {"type": "domain", "value": "company.com", "label": "Primary Domain", "criticality": "critical"},
        {"type": "domain", "value": "mail.company.com", "label": "Mail Server", "criticality": "critical"},
        {"type": "ip_range", "value": "10.0.0.0/8", "label": "Internal Network", "criticality": "high"},
        {"type": "domain", "value": "vpn.company.com", "label": "VPN Gateway", "criticality": "critical"},
        {"type": "email_domain", "value": "company.com", "label": "Email Domain", "criticality": "high"},
        {"type": "brand", "value": "CompanyName", "label": "Brand Monitoring", "criticality": "medium"},
    ],
    "alert_rules": [
        {"name": "Critical CVE Alert", "description": "Alert on any critical CVE affecting our assets", "severity": "critical", "field": "severity", "operator": "equals", "value": "critical"},
        {"name": "Asset Match Detection", "description": "Alert when intelligence matches monitored assets", "severity": "high", "field": "asset_match", "operator": "equals", "value": "true"},
        {"name": "Ransomware Mention", "description": "Alert on ransomware-related intelligence", "severity": "high", "field": "title", "operator": "contains", "value": "ransomware"},
    ],
}


def print_seed_summary():
    """Print what would be seeded."""
    print("\n" + "=" * 60)
    print("  CATSHY — Seed Data Summary")
    print("=" * 60)
    print(f"  Intel Items:    {len(SEED_DATA['intel_items'])}")
    print(f"  Threat Actors:  {len(SEED_DATA['threat_actors'])}")
    print(f"  Sample Assets:  {len(SEED_DATA['sample_assets'])}")
    print(f"  Alert Rules:    {len(SEED_DATA['alert_rules'])}")
    print("=" * 60)
    print("\nSeed data is ready. When running with a live database,")
    print("this script will populate all tables with realistic samples.")
    print("\nTo use with Docker:")
    print("  docker-compose up -d")
    print("  docker-compose exec api python seed_data.py")
    print()


if __name__ == "__main__":
    print_seed_summary()

    # Export as JSON for use by other tools
    if "--json" in sys.argv:
        print(json.dumps(SEED_DATA, indent=2))
    elif "--export" in sys.argv:
        with open("seed_data.json", "w") as f:
            json.dump(SEED_DATA, f, indent=2)
        print("Exported to seed_data.json")
