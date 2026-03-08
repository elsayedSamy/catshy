"""Threat enrichment services — VirusTotal, Shodan, AbuseIPDB, AlienVault OTX.

All services are optional: if API key is not set, enrichment is skipped gracefully.
Configure via environment variables:
  VIRUSTOTAL_API_KEY, SHODAN_API_KEY, ABUSEIPDB_API_KEY, OTX_API_KEY
"""
import os
import logging
import asyncio
from typing import Optional
import httpx

logger = logging.getLogger("catshy.enrichment")

_TIMEOUT = httpx.Timeout(15.0, connect=10.0)


class VirusTotalEnrichment:
    """VirusTotal v3 API integration."""
    BASE = "https://www.virustotal.com/api/v3"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("VIRUSTOTAL_API_KEY", "")

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def lookup_ioc(self, ioc_type: str, value: str) -> dict:
        """Lookup an IOC (ip, domain, hash) on VirusTotal."""
        if not self.available:
            return {"provider": "virustotal", "status": "no_api_key"}

        type_map = {"ip": "ip_addresses", "domain": "domains", "hash": "files", "url": "urls"}
        vt_type = type_map.get(ioc_type)
        if not vt_type:
            return {"provider": "virustotal", "status": "unsupported_type", "type": ioc_type}

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(
                    f"{self.BASE}/{vt_type}/{value}",
                    headers={"x-apikey": self.api_key},
                )
                if resp.status_code == 200:
                    data = resp.json().get("data", {}).get("attributes", {})
                    stats = data.get("last_analysis_stats", {})
                    return {
                        "provider": "virustotal",
                        "status": "found",
                        "malicious": stats.get("malicious", 0),
                        "suspicious": stats.get("suspicious", 0),
                        "harmless": stats.get("harmless", 0),
                        "undetected": stats.get("undetected", 0),
                        "reputation": data.get("reputation"),
                        "tags": data.get("tags", []),
                    }
                elif resp.status_code == 404:
                    return {"provider": "virustotal", "status": "not_found"}
                else:
                    return {"provider": "virustotal", "status": "error", "code": resp.status_code}
        except Exception as e:
            logger.warning(f"VirusTotal lookup failed: {e}")
            return {"provider": "virustotal", "status": "error", "message": str(e)}


class ShodanEnrichment:
    """Shodan API integration for IP enrichment."""
    BASE = "https://api.shodan.io"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("SHODAN_API_KEY", "")

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def lookup_ip(self, ip: str) -> dict:
        if not self.available:
            return {"provider": "shodan", "status": "no_api_key"}
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(f"{self.BASE}/shodan/host/{ip}", params={"key": self.api_key})
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "provider": "shodan",
                        "status": "found",
                        "ports": data.get("ports", []),
                        "vulns": data.get("vulns", []),
                        "os": data.get("os"),
                        "isp": data.get("isp"),
                        "org": data.get("org"),
                        "country": data.get("country_code"),
                        "city": data.get("city"),
                        "hostnames": data.get("hostnames", []),
                    }
                elif resp.status_code == 404:
                    return {"provider": "shodan", "status": "not_found"}
                else:
                    return {"provider": "shodan", "status": "error", "code": resp.status_code}
        except Exception as e:
            logger.warning(f"Shodan lookup failed: {e}")
            return {"provider": "shodan", "status": "error", "message": str(e)}


class AbuseIPDBEnrichment:
    """AbuseIPDB v2 API integration."""
    BASE = "https://api.abuseipdb.com/api/v2"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("ABUSEIPDB_API_KEY", "")

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def check_ip(self, ip: str) -> dict:
        if not self.available:
            return {"provider": "abuseipdb", "status": "no_api_key"}
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(
                    f"{self.BASE}/check",
                    params={"ipAddress": ip, "maxAgeInDays": 90, "verbose": ""},
                    headers={"Key": self.api_key, "Accept": "application/json"},
                )
                if resp.status_code == 200:
                    data = resp.json().get("data", {})
                    return {
                        "provider": "abuseipdb",
                        "status": "found",
                        "abuse_confidence": data.get("abuseConfidenceScore", 0),
                        "total_reports": data.get("totalReports", 0),
                        "is_public": data.get("isPublic"),
                        "isp": data.get("isp"),
                        "domain": data.get("domain"),
                        "country": data.get("countryCode"),
                        "usage_type": data.get("usageType"),
                    }
                else:
                    return {"provider": "abuseipdb", "status": "error", "code": resp.status_code}
        except Exception as e:
            logger.warning(f"AbuseIPDB check failed: {e}")
            return {"provider": "abuseipdb", "status": "error", "message": str(e)}


class AlienVaultOTXEnrichment:
    """AlienVault OTX v2 API integration."""
    BASE = "https://otx.alienvault.com/api/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OTX_API_KEY", "")

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def lookup_indicator(self, ioc_type: str, value: str) -> dict:
        if not self.available:
            return {"provider": "otx", "status": "no_api_key"}

        type_map = {"ip": "IPv4", "domain": "domain", "hash": "file", "url": "url", "hostname": "hostname"}
        otx_type = type_map.get(ioc_type)
        if not otx_type:
            return {"provider": "otx", "status": "unsupported_type"}

        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(
                    f"{self.BASE}/indicators/{otx_type}/{value}/general",
                    headers={"X-OTX-API-KEY": self.api_key},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    pulses = data.get("pulse_info", {})
                    return {
                        "provider": "otx",
                        "status": "found",
                        "pulse_count": pulses.get("count", 0),
                        "pulse_names": [p.get("name") for p in pulses.get("pulses", [])[:5]],
                        "reputation": data.get("reputation"),
                        "country": data.get("country_code"),
                        "validation": data.get("validation", []),
                    }
                elif resp.status_code == 404:
                    return {"provider": "otx", "status": "not_found"}
                else:
                    return {"provider": "otx", "status": "error", "code": resp.status_code}
        except Exception as e:
            logger.warning(f"OTX lookup failed: {e}")
            return {"provider": "otx", "status": "error", "message": str(e)}


# ── Unified enrichment facade ──

class EnrichmentOrchestrator:
    """Runs all available enrichment providers in parallel."""

    def __init__(self):
        self.vt = VirusTotalEnrichment()
        self.shodan = ShodanEnrichment()
        self.abuseipdb = AbuseIPDBEnrichment()
        self.otx = AlienVaultOTXEnrichment()

    @property
    def available_providers(self) -> list[str]:
        providers = []
        if self.vt.available: providers.append("virustotal")
        if self.shodan.available: providers.append("shodan")
        if self.abuseipdb.available: providers.append("abuseipdb")
        if self.otx.available: providers.append("otx")
        return providers

    async def enrich(self, ioc_type: str, value: str) -> dict:
        """Enrich an IOC across all available providers in parallel."""
        tasks = []
        if ioc_type == "ip":
            tasks = [
                self.vt.lookup_ioc("ip", value),
                self.shodan.lookup_ip(value),
                self.abuseipdb.check_ip(value),
                self.otx.lookup_indicator("ip", value),
            ]
        elif ioc_type == "domain":
            tasks = [
                self.vt.lookup_ioc("domain", value),
                self.otx.lookup_indicator("domain", value),
            ]
        elif ioc_type in ("hash", "md5", "sha1", "sha256"):
            tasks = [
                self.vt.lookup_ioc("hash", value),
                self.otx.lookup_indicator("hash", value),
            ]
        elif ioc_type == "url":
            tasks = [
                self.vt.lookup_ioc("url", value),
                self.otx.lookup_indicator("url", value),
            ]
        else:
            tasks = [self.otx.lookup_indicator(ioc_type, value)]

        results = await asyncio.gather(*tasks, return_exceptions=True)
        enrichments = {}
        for r in results:
            if isinstance(r, dict):
                enrichments[r.get("provider", "unknown")] = r
            elif isinstance(r, Exception):
                logger.warning(f"Enrichment task failed: {r}")
        return enrichments


# Singleton
enrichment_orchestrator = EnrichmentOrchestrator()
