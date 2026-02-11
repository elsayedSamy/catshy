"""Feed URL auto-discovery — Enable-time Wizard backend"""
import httpx
import feedparser
from bs4 import BeautifulSoup
from typing import List, Optional, Tuple
from app.services.ssrf_protection import validate_url, SSRFError

async def discover_feeds(page_url: str) -> List[dict]:
    """Auto-discover RSS/Atom feed URLs from a webpage.
    Returns list of {url, title, feed_type} dicts.
    """
    validate_url(page_url)
    discovered = []

    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        response = await client.get(page_url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")

        # If the URL itself is a feed
        if any(t in content_type for t in ["xml", "rss", "atom", "json"]):
            feed = feedparser.parse(response.text)
            if feed.entries:
                return [{"url": page_url, "title": feed.feed.get("title", "Direct feed"), "feed_type": "rss_atom", "entries": len(feed.entries)}]

        # Parse HTML for feed links
        soup = BeautifulSoup(response.text, "lxml")

        # Look for <link> tags with feed types
        for link in soup.find_all("link", {"type": ["application/rss+xml", "application/atom+xml", "application/feed+json"]}):
            href = link.get("href", "")
            if href:
                if not href.startswith("http"):
                    from urllib.parse import urljoin
                    href = urljoin(page_url, href)
                discovered.append({
                    "url": href,
                    "title": link.get("title", "Discovered feed"),
                    "feed_type": "rss_atom",
                })

        # Look for common feed URL patterns
        for suffix in ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml", "/feeds/posts/default"]:
            from urllib.parse import urljoin
            candidate = urljoin(page_url, suffix)
            try:
                validate_url(candidate)
                resp = await client.head(candidate, follow_redirects=True)
                if resp.status_code == 200:
                    discovered.append({"url": candidate, "title": f"Auto-discovered ({suffix})", "feed_type": "rss_atom"})
            except:
                continue

    return discovered

async def validate_feed(feed_url: str) -> Tuple[bool, dict]:
    """Validate a feed URL by fetching and parsing it.
    Returns (is_valid, details_dict).
    """
    try:
        validate_url(feed_url)
    except SSRFError as e:
        return False, {"error": f"SSRF protection: {e}"}

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            response = await client.get(feed_url)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")

            # Try RSS/Atom parsing
            feed = feedparser.parse(response.text)
            if feed.entries:
                return True, {
                    "title": feed.feed.get("title", "Unknown"),
                    "entries": len(feed.entries),
                    "feed_type": "rss_atom",
                    "last_updated": feed.feed.get("updated", "Unknown"),
                    "content_type": content_type,
                }

            # Try JSON parsing
            if "json" in content_type:
                import json
                data = response.json()
                if isinstance(data, list):
                    return True, {"entries": len(data), "feed_type": "http_json", "content_type": content_type}
                if isinstance(data, dict):
                    # Look for common data keys
                    for key in ["data", "results", "items", "vulnerabilities", "entries"]:
                        if key in data and isinstance(data[key], list):
                            return True, {"entries": len(data[key]), "feed_type": "http_json", "data_key": key, "content_type": content_type}
                    return True, {"entries": 1, "feed_type": "http_json", "content_type": content_type}

            # Try CSV parsing
            lines = [l for l in response.text.strip().split("\n") if l and not l.startswith("#")]
            if len(lines) > 1:
                return True, {"entries": len(lines), "feed_type": "http_csv", "content_type": content_type}

            return False, {"error": "Could not parse feed content", "content_type": content_type}

    except httpx.HTTPStatusError as e:
        return False, {"error": f"HTTP {e.response.status_code}", "status_code": e.response.status_code}
    except Exception as e:
        return False, {"error": str(e)[:200]}
