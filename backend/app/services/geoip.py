"""GeoIP enrichment service — uses ip-api.com (free, no key needed for <45 req/min)."""
import httpx
import ipaddress
import logging
import dns.resolver
from typing import Optional, Dict
from functools import lru_cache

logger = logging.getLogger("catshy.geoip")

# In-memory cache for GeoIP lookups (production would use Redis)
_geo_cache: Dict[str, Optional[dict]] = {}
_MAX_CACHE = 10000


def _is_private_ip(ip_str: str) -> bool:
    try:
        return ipaddress.ip_address(ip_str).is_private
    except ValueError:
        return False


def geoip_lookup(ip: str) -> Optional[dict]:
    """Lookup GeoIP data for an IP address. Returns dict with lat, lon, country, city, etc."""
    ip = ip.strip()
    if _is_private_ip(ip):
        return None

    if ip in _geo_cache:
        return _geo_cache[ip]

    try:
        resp = httpx.get(
            f"http://ip-api.com/json/{ip}",
            params={"fields": "status,country,countryCode,city,lat,lon,isp,org,as,query"},
            timeout=5,
        )
        data = resp.json()
        if data.get("status") == "success":
            result = {
                "lat": data["lat"],
                "lon": data["lon"],
                "country": data.get("countryCode", ""),
                "country_name": data.get("country", ""),
                "city": data.get("city", ""),
                "asn": data.get("as", ""),
                "org": data.get("org", "") or data.get("isp", ""),
            }
        else:
            result = None
    except Exception as e:
        logger.warning(f"GeoIP lookup failed for {ip}: {e}")
        result = None

    # Cache management
    if len(_geo_cache) >= _MAX_CACHE:
        # Evict oldest 20%
        keys = list(_geo_cache.keys())
        for k in keys[:_MAX_CACHE // 5]:
            _geo_cache.pop(k, None)
    _geo_cache[ip] = result
    return result


def resolve_domain_ip(domain: str) -> Optional[str]:
    """Resolve a domain to its first A record IP."""
    try:
        answers = dns.resolver.resolve(domain, 'A', lifetime=5)
        for rdata in answers:
            return str(rdata)
    except Exception:
        pass
    return None


def geoip_for_observable(obs_type: str, obs_value: str) -> Optional[dict]:
    """Get GeoIP data for any observable type. Resolves domains to IPs first."""
    if obs_type == "ip":
        return geoip_lookup(obs_value)
    elif obs_type == "domain":
        ip = resolve_domain_ip(obs_value)
        if ip:
            geo = geoip_lookup(ip)
            if geo:
                geo["resolved_ip"] = ip
            return geo
    elif obs_type == "url":
        from urllib.parse import urlparse
        parsed = urlparse(obs_value)
        if parsed.hostname:
            return geoip_for_observable("domain", parsed.hostname)
    return None
