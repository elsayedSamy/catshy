"""Asset matcher — match intel items against organization assets"""
import re
import ipaddress
from typing import List, Tuple

class AssetMatcher:
    """Matches observable values against configured assets using regex, CIDR, and exact match."""

    def __init__(self, assets: list):
        self.domain_assets = []
        self.ip_range_assets = []
        self.brand_assets = []
        self.email_assets = []
        self.exact_assets = set()

        for asset in assets:
            t = asset.get("type", "")
            v = asset.get("value", "")
            aid = asset.get("id", "")
            crit = asset.get("criticality", "medium")

            if t == "domain":
                # Match domain and all subdomains
                pattern = re.compile(r'(^|\.){}'.format(re.escape(v)), re.IGNORECASE)
                self.domain_assets.append((aid, v, pattern, crit))
            elif t == "ip_range":
                try:
                    network = ipaddress.ip_network(v, strict=False)
                    self.ip_range_assets.append((aid, v, network, crit))
                except ValueError:
                    pass
            elif t in ("brand", "subsidiary", "app"):
                pattern = re.compile(re.escape(v), re.IGNORECASE)
                self.brand_assets.append((aid, v, pattern, crit))
            elif t == "email_domain":
                pattern = re.compile(r'@{}'.format(re.escape(v)), re.IGNORECASE)
                self.email_assets.append((aid, v, pattern, crit))
            elif t == "asn":
                self.exact_assets.add((aid, v.upper(), crit))

    def match(self, observable_value: str, observable_type: str = "") -> List[Tuple[str, str, str]]:
        """Returns list of (asset_id, asset_value, criticality) tuples for matches."""
        matches = []
        val = observable_value.strip()

        # Domain matching
        if observable_type in ("domain", "url", ""):
            for aid, av, pattern, crit in self.domain_assets:
                if pattern.search(val):
                    matches.append((aid, av, crit))

        # IP matching
        if observable_type in ("ip", ""):
            try:
                ip = ipaddress.ip_address(val.split("/")[0])
                for aid, av, network, crit in self.ip_range_assets:
                    if ip in network:
                        matches.append((aid, av, crit))
            except ValueError:
                pass

        # Brand/keyword matching
        for aid, av, pattern, crit in self.brand_assets:
            if pattern.search(val):
                matches.append((aid, av, crit))

        # Email domain matching
        if observable_type in ("email", ""):
            for aid, av, pattern, crit in self.email_assets:
                if pattern.search(val):
                    matches.append((aid, av, crit))

        return matches

    def get_highest_criticality(self, matches: List[Tuple[str, str, str]]) -> str:
        crit_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        if not matches:
            return "info"
        return min(matches, key=lambda m: crit_order.get(m[2], 5))[2]
