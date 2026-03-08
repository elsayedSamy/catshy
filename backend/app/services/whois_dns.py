"""WHOIS & DNS History enrichment — passive lookups for domains and IPs.

Uses free public APIs:
  - RDAP (IANA) for WHOIS data
  - DNS over HTTPS (Google/Cloudflare) for DNS records
  - SecurityTrails-style passive DNS via OTX (reuses existing key)
"""
import logging
import asyncio
from typing import Optional
from datetime import datetime, timezone
import httpx

logger = logging.getLogger("catshy.whois_dns")

_TIMEOUT = httpx.Timeout(12.0, connect=8.0)


class WHOISEnrichment:
    """RDAP-based WHOIS lookup (no API key required)."""

    RDAP_BOOTSTRAP_IP = "https://rdap.org/ip/{value}"
    RDAP_BOOTSTRAP_DOMAIN = "https://rdap.org/domain/{value}"

    async def lookup(self, ioc_type: str, value: str) -> dict:
        if ioc_type not in ("ip", "domain"):
            return {"provider": "whois", "status": "unsupported_type"}
        try:
            url = self.RDAP_BOOTSTRAP_IP.format(value=value) if ioc_type == "ip" else self.RDAP_BOOTSTRAP_DOMAIN.format(value=value)
            async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
                resp = await client.get(url, headers={"Accept": "application/rdap+json"})
                if resp.status_code == 200:
                    data = resp.json()
                    return self._parse_rdap(data, ioc_type)
                elif resp.status_code == 404:
                    return {"provider": "whois", "status": "not_found"}
                return {"provider": "whois", "status": "error", "code": resp.status_code}
        except Exception as e:
            logger.warning(f"WHOIS lookup failed for {value}: {e}")
            return {"provider": "whois", "status": "error", "message": str(e)}

    def _parse_rdap(self, data: dict, ioc_type: str) -> dict:
        result = {"provider": "whois", "status": "found"}

        # Extract registration info
        events = {e.get("eventAction"): e.get("eventDate") for e in data.get("events", [])}
        result["registered"] = events.get("registration")
        result["last_changed"] = events.get("last changed") or events.get("lastChanged")
        result["expiration"] = events.get("expiration")

        # Extract entities (registrar, registrant)
        for entity in data.get("entities", []):
            roles = entity.get("roles", [])
            handle = entity.get("handle", "")
            vcard = entity.get("vcardArray", [None, []])
            name = ""
            if len(vcard) > 1:
                for field in vcard[1]:
                    if field[0] == "fn":
                        name = field[3] if len(field) > 3 else ""
            if "registrar" in roles:
                result["registrar"] = name or handle
            if "registrant" in roles:
                result["registrant"] = name or handle

        # Network info for IPs
        if ioc_type == "ip":
            result["name"] = data.get("name")
            result["cidr"] = None
            cidrs = data.get("cidr0_cidrs", [])
            if cidrs:
                c = cidrs[0]
                result["cidr"] = f"{c.get('v4prefix', c.get('v6prefix', ''))}/{c.get('length', '')}"
            result["country"] = data.get("country")

        # Domain-specific
        if ioc_type == "domain":
            result["handle"] = data.get("handle")
            nameservers = [ns.get("ldhName") for ns in data.get("nameservers", [])]
            result["nameservers"] = nameservers[:6]
            statuses = data.get("status", [])
            result["status_flags"] = statuses[:10]

        return result


class DNSEnrichment:
    """DNS record lookup using Google DNS-over-HTTPS (no API key required)."""

    DOH_URL = "https://dns.google/resolve"
    RECORD_TYPES = {"A": 1, "AAAA": 28, "MX": 15, "NS": 2, "TXT": 16, "CNAME": 5, "SOA": 6}

    async def lookup_domain(self, domain: str, record_types: list = None) -> dict:
        if not record_types:
            record_types = ["A", "AAAA", "MX", "NS", "TXT"]
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                tasks = []
                for rtype in record_types:
                    tasks.append(self._query_type(client, domain, rtype))
                results = await asyncio.gather(*tasks, return_exceptions=True)

            records = {}
            for rtype, result in zip(record_types, results):
                if isinstance(result, list):
                    records[rtype] = result
                elif isinstance(result, Exception):
                    records[rtype] = []

            return {
                "provider": "dns",
                "status": "found" if any(records.values()) else "no_records",
                "domain": domain,
                "records": records,
                "queried_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            logger.warning(f"DNS lookup failed for {domain}: {e}")
            return {"provider": "dns", "status": "error", "message": str(e)}

    async def _query_type(self, client: httpx.AsyncClient, domain: str, rtype: str) -> list:
        resp = await client.get(self.DOH_URL, params={"name": domain, "type": rtype})
        if resp.status_code == 200:
            data = resp.json()
            answers = data.get("Answer", [])
            return [{"data": a.get("data", ""), "ttl": a.get("TTL")} for a in answers]
        return []

    async def reverse_dns(self, ip: str) -> dict:
        """Reverse DNS lookup for an IP address."""
        try:
            # Convert IP to PTR format
            parts = ip.split(".")
            if len(parts) == 4:
                ptr_name = f"{'.'.join(reversed(parts))}.in-addr.arpa"
            else:
                return {"provider": "dns_reverse", "status": "unsupported", "message": "IPv6 not yet supported"}

            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(self.DOH_URL, params={"name": ptr_name, "type": "PTR"})
                if resp.status_code == 200:
                    data = resp.json()
                    answers = data.get("Answer", [])
                    hostnames = [a.get("data", "").rstrip(".") for a in answers]
                    return {
                        "provider": "dns_reverse",
                        "status": "found" if hostnames else "no_ptr",
                        "ip": ip,
                        "hostnames": hostnames,
                    }
            return {"provider": "dns_reverse", "status": "error"}
        except Exception as e:
            logger.warning(f"Reverse DNS failed for {ip}: {e}")
            return {"provider": "dns_reverse", "status": "error", "message": str(e)}


class GreyNoiseEnrichment:
    """GreyNoise Community API — classify IPs as benign/malicious scanners (free, no key required for community)."""

    COMMUNITY_URL = "https://api.greynoise.io/v3/community/{ip}"

    def __init__(self, api_key: str = ""):
        self.api_key = api_key

    @property
    def available(self) -> bool:
        return True  # Community API works without key

    async def classify_ip(self, ip: str) -> dict:
        try:
            headers = {"Accept": "application/json"}
            if self.api_key:
                headers["key"] = self.api_key
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(self.COMMUNITY_URL.format(ip=ip), headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "provider": "greynoise",
                        "status": "found",
                        "classification": data.get("classification", "unknown"),  # benign, malicious, unknown
                        "noise": data.get("noise", False),
                        "riot": data.get("riot", False),  # Rule It Out — known benign services
                        "name": data.get("name", ""),
                        "link": data.get("link", ""),
                        "message": data.get("message", ""),
                    }
                elif resp.status_code == 404:
                    return {"provider": "greynoise", "status": "not_found", "classification": "unknown"}
                return {"provider": "greynoise", "status": "error", "code": resp.status_code}
        except Exception as e:
            logger.warning(f"GreyNoise lookup failed for {ip}: {e}")
            return {"provider": "greynoise", "status": "error", "message": str(e)}


# Singleton instances
whois_enrichment = WHOISEnrichment()
dns_enrichment = DNSEnrichment()
greynoise_enrichment = GreyNoiseEnrichment()
