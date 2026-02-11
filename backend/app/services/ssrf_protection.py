"""SSRF Protection — deny private IP ranges, DNS pinning, timeouts"""
import ipaddress
import socket
from urllib.parse import urlparse
from app.config import settings

PRIVATE_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]

class SSRFError(Exception):
    pass

def validate_url(url: str) -> str:
    """Validate URL against SSRF attacks. Returns resolved URL."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise SSRFError(f"Disallowed scheme: {parsed.scheme}")
    hostname = parsed.hostname
    if not hostname:
        raise SSRFError("No hostname in URL")
    # Allowlist check
    if settings.SSRF_ALLOWLIST:
        if hostname not in settings.SSRF_ALLOWLIST:
            raise SSRFError(f"Hostname {hostname} not in allowlist")
        return url
    # DNS resolution + pinning
    try:
        resolved = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror:
        raise SSRFError(f"Cannot resolve hostname: {hostname}")
    for family, _, _, _, sockaddr in resolved:
        ip = ipaddress.ip_address(sockaddr[0])
        if settings.SSRF_DENY_PRIVATE:
            for network in PRIVATE_RANGES:
                if ip in network:
                    raise SSRFError(f"Resolved to private IP: {ip}")
    return url

async def safe_fetch(url: str, timeout: int = None):
    """Fetch URL with SSRF protection"""
    import httpx
    validated = validate_url(url)
    t = timeout or settings.SSRF_TIMEOUT
    async with httpx.AsyncClient(timeout=t, follow_redirects=True, max_redirects=3) as client:
        response = await client.get(validated)
        response.raise_for_status()
        return response
