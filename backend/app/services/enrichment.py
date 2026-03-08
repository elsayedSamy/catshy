"""Threat enrichment services — VirusTotal, Shodan, AbuseIPDB, AlienVault OTX.

Supports per-workspace BYOK keys via WorkspaceIntegration model.
Falls back to ENV vars if no workspace key configured.
"""
import logging
import asyncio
from typing import Optional, Tuple
import httpx

logger = logging.getLogger("catshy.enrichment")

_TIMEOUT = httpx.Timeout(15.0, connect=10.0)


class VirusTotalEnrichment:
    BASE = "https://www.virustotal.com/api/v3"

    def __init__(self, api_key: str = ""):
        self.api_key = api_key

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def lookup_ioc(self, ioc_type: str, value: str) -> dict:
        if not self.available:
            return {"provider": "virustotal", "status": "not_configured"}
        type_map = {"ip": "ip_addresses", "domain": "domains", "hash": "files", "url": "urls"}
        vt_type = type_map.get(ioc_type)
        if not vt_type:
            return {"provider": "virustotal", "status": "unsupported_type", "type": ioc_type}
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(f"{self.BASE}/{vt_type}/{value}", headers={"x-apikey": self.api_key})
                if resp.status_code == 200:
                    data = resp.json().get("data", {}).get("attributes", {})
                    stats = data.get("last_analysis_stats", {})
                    return {
                        "provider": "virustotal", "status": "found",
                        "malicious": stats.get("malicious", 0), "suspicious": stats.get("suspicious", 0),
                        "harmless": stats.get("harmless", 0), "undetected": stats.get("undetected", 0),
                        "reputation": data.get("reputation"), "tags": data.get("tags", []),
                    }
                elif resp.status_code == 404:
                    return {"provider": "virustotal", "status": "not_found"}
                else:
                    return {"provider": "virustotal", "status": "error", "code": resp.status_code}
        except Exception as e:
            logger.warning(f"VirusTotal lookup failed: {e}")
            return {"provider": "virustotal", "status": "error", "message": str(e)}


class ShodanEnrichment:
    BASE = "https://api.shodan.io"

    def __init__(self, api_key: str = ""):
        self.api_key = api_key

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def lookup_ip(self, ip: str) -> dict:
        if not self.available:
            return {"provider": "shodan", "status": "not_configured"}
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(f"{self.BASE}/shodan/host/{ip}", params={"key": self.api_key})
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "provider": "shodan", "status": "found",
                        "ports": data.get("ports", []), "vulns": data.get("vulns", []),
                        "os": data.get("os"), "isp": data.get("isp"), "org": data.get("org"),
                        "country": data.get("country_code"), "city": data.get("city"),
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
    BASE = "https://api.abuseipdb.com/api/v2"

    def __init__(self, api_key: str = ""):
        self.api_key = api_key

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def check_ip(self, ip: str) -> dict:
        if not self.available:
            return {"provider": "abuseipdb", "status": "not_configured"}
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
                        "provider": "abuseipdb", "status": "found",
                        "abuse_confidence": data.get("abuseConfidenceScore", 0),
                        "total_reports": data.get("totalReports", 0),
                        "is_public": data.get("isPublic"), "isp": data.get("isp"),
                        "domain": data.get("domain"), "country": data.get("countryCode"),
                        "usage_type": data.get("usageType"),
                    }
                else:
                    return {"provider": "abuseipdb", "status": "error", "code": resp.status_code}
        except Exception as e:
            logger.warning(f"AbuseIPDB check failed: {e}")
            return {"provider": "abuseipdb", "status": "error", "message": str(e)}


class AlienVaultOTXEnrichment:
    BASE = "https://otx.alienvault.com/api/v1"

    def __init__(self, api_key: str = ""):
        self.api_key = api_key

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def lookup_indicator(self, ioc_type: str, value: str) -> dict:
        if not self.available:
            return {"provider": "otx", "status": "not_configured"}
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
                        "provider": "otx", "status": "found",
                        "pulse_count": pulses.get("count", 0),
                        "pulse_names": [p.get("name") for p in pulses.get("pulses", [])[:5]],
                        "reputation": data.get("reputation"), "country": data.get("country_code"),
                        "validation": data.get("validation", []),
                    }
                elif resp.status_code == 404:
                    return {"provider": "otx", "status": "not_found"}
                else:
                    return {"provider": "otx", "status": "error", "code": resp.status_code}
        except Exception as e:
            logger.warning(f"OTX lookup failed: {e}")
            return {"provider": "otx", "status": "error", "message": str(e)}


# ── Provider test functions ──

async def test_provider_connection(provider: str, api_key: str) -> Tuple[bool, str]:
    """Test that an API key works for a given provider. Returns (success, message)."""
    try:
        if provider == "virustotal":
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get("https://www.virustotal.com/api/v3/ip_addresses/8.8.8.8", headers={"x-apikey": api_key})
                if resp.status_code == 200:
                    return True, "VirusTotal API key valid"
                elif resp.status_code == 403:
                    return False, "Invalid API key"
                return False, f"Unexpected status: {resp.status_code}"

        elif provider == "shodan":
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get("https://api.shodan.io/api-info", params={"key": api_key})
                if resp.status_code == 200:
                    return True, "Shodan API key valid"
                return False, f"Status: {resp.status_code}"

        elif provider == "abuseipdb":
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(
                    "https://api.abuseipdb.com/api/v2/check",
                    params={"ipAddress": "8.8.8.8", "maxAgeInDays": 1},
                    headers={"Key": api_key, "Accept": "application/json"},
                )
                if resp.status_code == 200:
                    return True, "AbuseIPDB API key valid"
                return False, f"Status: {resp.status_code}"

        elif provider == "otx":
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(
                    "https://otx.alienvault.com/api/v1/user/me",
                    headers={"X-OTX-API-KEY": api_key},
                )
                if resp.status_code == 200:
                    return True, "OTX API key valid"
                return False, f"Status: {resp.status_code}"

        else:
            return False, f"No test available for provider: {provider}"

    except Exception as e:
        return False, f"Connection failed: {str(e)}"


# ── Workspace-aware orchestrator ──

class EnrichmentOrchestrator:
    """Runs all available enrichment providers in parallel.
    Accepts per-workspace keys dict: {"virustotal": "key", "shodan": "key", ...}
    """

    def __init__(self, keys: Optional[dict] = None):
        keys = keys or {}
        self.vt = VirusTotalEnrichment(keys.get("virustotal", ""))
        self.shodan = ShodanEnrichment(keys.get("shodan", ""))
        self.abuseipdb = AbuseIPDBEnrichment(keys.get("abuseipdb", ""))
        self.otx = AlienVaultOTXEnrichment(keys.get("otx", ""))

    @property
    def available_providers(self) -> list[str]:
        providers = []
        if self.vt.available: providers.append("virustotal")
        if self.shodan.available: providers.append("shodan")
        if self.abuseipdb.available: providers.append("abuseipdb")
        if self.otx.available: providers.append("otx")
        return providers

    async def enrich(self, ioc_type: str, value: str) -> dict:
        tasks = []
        if ioc_type == "ip":
            tasks = [self.vt.lookup_ioc("ip", value), self.shodan.lookup_ip(value),
                     self.abuseipdb.check_ip(value), self.otx.lookup_indicator("ip", value)]
        elif ioc_type == "domain":
            tasks = [self.vt.lookup_ioc("domain", value), self.otx.lookup_indicator("domain", value)]
        elif ioc_type in ("hash", "md5", "sha1", "sha256"):
            tasks = [self.vt.lookup_ioc("hash", value), self.otx.lookup_indicator("hash", value)]
        elif ioc_type == "url":
            tasks = [self.vt.lookup_ioc("url", value), self.otx.lookup_indicator("url", value)]
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


async def get_workspace_enrichment_keys(db, workspace_id: str) -> dict:
    """Load decrypted API keys for all enabled integrations in a workspace."""
    from sqlalchemy import select
    from app.models.integrations import WorkspaceIntegration
    from app.services.encryption import decrypt_api_key

    result = await db.execute(
        select(WorkspaceIntegration).where(
            WorkspaceIntegration.workspace_id == workspace_id,
            WorkspaceIntegration.enabled == True,
        )
    )
    keys = {}
    for integ in result.scalars().all():
        if integ.encrypted_api_key:
            try:
                keys[integ.provider] = decrypt_api_key(integ.encrypted_api_key)
            except Exception:
                logger.warning(f"Failed to decrypt key for {integ.provider} in workspace {workspace_id}")
    return keys
