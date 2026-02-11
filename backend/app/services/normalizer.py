"""Intel normalizer — extract and canonicalize observables from raw data"""
import re
import hashlib
from typing import List, Dict, Optional
from urllib.parse import urlparse

# Observable extraction patterns
PATTERNS = {
    "ip": re.compile(r'\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b'),
    "domain": re.compile(r'\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b'),
    "url": re.compile(r'https?://[^\s<>"{}|\\^`\[\]]+'),
    "email": re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
    "hash_md5": re.compile(r'\b[a-fA-F0-9]{32}\b'),
    "hash_sha1": re.compile(r'\b[a-fA-F0-9]{40}\b'),
    "hash_sha256": re.compile(r'\b[a-fA-F0-9]{64}\b'),
    "cve": re.compile(r'\bCVE-\d{4}-\d{4,}\b', re.IGNORECASE),
}

# Exclude common false positives for domains
DOMAIN_EXCLUDE = {"example.com", "localhost", "schema.org", "w3.org", "xmlns.com"}

def extract_observables(text: str) -> List[Dict[str, str]]:
    """Extract all observables from text, prioritizing longer/more specific matches."""
    observables = []
    seen = set()

    # Extract in order of specificity
    for obs_type in ["cve", "hash_sha256", "hash_sha1", "hash_md5", "url", "email", "ip", "domain"]:
        for match in PATTERNS[obs_type].finditer(text):
            value = match.group().strip().rstrip(".,;:)")
            canonical = canonicalize(value, obs_type)
            if canonical not in seen and canonical not in DOMAIN_EXCLUDE:
                seen.add(canonical)
                observables.append({"type": obs_type, "value": value, "canonical": canonical})

    return observables

def canonicalize(value: str, obs_type: str) -> str:
    """Canonicalize observable values for deduplication."""
    if obs_type == "ip":
        return value.strip()
    elif obs_type == "domain":
        return value.lower().strip().rstrip(".")
    elif obs_type == "url":
        parsed = urlparse(value)
        return f"{parsed.scheme}://{parsed.netloc.lower()}{parsed.path}".rstrip("/")
    elif obs_type == "email":
        return value.lower().strip()
    elif obs_type.startswith("hash_"):
        return value.lower().strip()
    elif obs_type == "cve":
        return value.upper().strip()
    return value.strip()

def compute_dedup_hash(source_id: str, canonical_value: str, title: str = "") -> str:
    """Generate deduplication hash for an intel item."""
    key = f"{source_id}:{canonical_value}:{title[:100]}"
    return hashlib.sha256(key.encode()).hexdigest()

def classify_severity(item: dict) -> str:
    """Auto-classify severity based on observable type and context."""
    obs_type = item.get("type", "")
    value = item.get("value", "").lower()
    title = item.get("title", "").lower()

    # CVEs with known critical keywords
    if obs_type == "cve":
        if any(k in title for k in ["critical", "rce", "remote code execution", "0-day", "zero-day"]):
            return "critical"
        if any(k in title for k in ["high", "privilege escalation", "authentication bypass"]):
            return "high"
        return "medium"

    # Known malware/threat indicators
    if any(k in title for k in ["ransomware", "apt", "zero-day", "critical vulnerability"]):
        return "critical"
    if any(k in title for k in ["malware", "botnet", "c2", "command and control", "exploit"]):
        return "high"
    if any(k in title for k in ["phishing", "credential", "brute force", "scan"]):
        return "medium"

    return "info"
