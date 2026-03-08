"""MITRE ATT&CK mapping service — technique extraction + known tool/malware mapping.

Used during ingestion to auto-map techniques from tags, titles, and known tool names.
"""
import re
import logging
from typing import List, Tuple, Optional

logger = logging.getLogger("catshy.mitre")

# Regex to find technique IDs like T1059, T1059.001
TECHNIQUE_PATTERN = re.compile(r'\bT\d{4}(?:\.\d{3})?\b')

# Tactic ID → Name mapping
TACTIC_MAP = {
    "TA0001": "Initial Access",
    "TA0002": "Execution",
    "TA0003": "Persistence",
    "TA0004": "Privilege Escalation",
    "TA0005": "Defense Evasion",
    "TA0006": "Credential Access",
    "TA0007": "Discovery",
    "TA0008": "Lateral Movement",
    "TA0009": "Collection",
    "TA0010": "Exfiltration",
    "TA0011": "Command and Control",
    "TA0040": "Impact",
}

# Known tool/malware → technique mapping (comprehensive)
TOOL_TECHNIQUE_MAP = {
    # Malware families
    "emotet": (["T1566.001", "T1059.005", "T1547.001", "T1055.001"], ["TA0001", "TA0002", "TA0003", "TA0005"]),
    "cobalt strike": (["T1059.001", "T1071.001", "T1055", "T1105", "T1027"], ["TA0002", "TA0011", "TA0005"]),
    "lockbit": (["T1486", "T1490", "T1027", "T1562.001", "T1083"], ["TA0040", "TA0005", "TA0007"]),
    "conti": (["T1486", "T1021.002", "T1059.001", "T1570"], ["TA0040", "TA0008", "TA0002"]),
    "revil": (["T1486", "T1490", "T1082", "T1560"], ["TA0040", "TA0007", "TA0009"]),
    "qakbot": (["T1566.001", "T1059.005", "T1055", "T1571"], ["TA0001", "TA0002", "TA0005", "TA0011"]),
    "trickbot": (["T1566.001", "T1059.001", "T1055", "T1087"], ["TA0001", "TA0002", "TA0005", "TA0007"]),
    "agenttesla": (["T1566.001", "T1056.001", "T1005", "T1041"], ["TA0001", "TA0009", "TA0010"]),
    "agent tesla": (["T1566.001", "T1056.001", "T1005", "T1041"], ["TA0001", "TA0009", "TA0010"]),
    "mimikatz": (["T1003.001", "T1550.002", "T1003.006"], ["TA0006", "TA0008"]),
    "metasploit": (["T1059", "T1203", "T1055", "T1105"], ["TA0002", "TA0001", "TA0005"]),
    "blackcat": (["T1486", "T1490", "T1027", "T1562"], ["TA0040", "TA0005"]),
    "alphv": (["T1486", "T1490", "T1027", "T1562"], ["TA0040", "TA0005"]),
    "raccoon stealer": (["T1555", "T1539", "T1005"], ["TA0006", "TA0009"]),
    "redline": (["T1555", "T1539", "T1005", "T1041"], ["TA0006", "TA0009", "TA0010"]),
    "vidar": (["T1555", "T1005", "T1041"], ["TA0006", "TA0009", "TA0010"]),
    "formbook": (["T1566.001", "T1056.001", "T1005"], ["TA0001", "TA0009"]),
    "remcos": (["T1566.001", "T1059", "T1056.001", "T1113"], ["TA0001", "TA0002", "TA0009"]),
    "asyncrat": (["T1059", "T1056.001", "T1113", "T1041"], ["TA0002", "TA0009", "TA0010"]),
    "sliver": (["T1059", "T1071.001", "T1055", "T1105"], ["TA0002", "TA0011", "TA0005"]),
    "brute ratel": (["T1059.001", "T1071", "T1055", "T1027"], ["TA0002", "TA0011", "TA0005"]),
    "havoc": (["T1059", "T1071.001", "T1055"], ["TA0002", "TA0011", "TA0005"]),
    # Attack types
    "phishing": (["T1566"], ["TA0001"]),
    "spear-phishing": (["T1566.001"], ["TA0001"]),
    "spearphishing": (["T1566.001"], ["TA0001"]),
    "credential stuffing": (["T1110.004"], ["TA0006"]),
    "brute force": (["T1110"], ["TA0006"]),
    "ransomware": (["T1486", "T1490"], ["TA0040"]),
    "data exfiltration": (["T1041", "T1048"], ["TA0010"]),
    "command injection": (["T1059"], ["TA0002"]),
    "sql injection": (["T1190"], ["TA0001"]),
    "auth bypass": (["T1556"], ["TA0006"]),
    "rce": (["T1203"], ["TA0001"]),
    "remote code execution": (["T1203"], ["TA0001"]),
    "ddos": (["T1498", "T1499"], ["TA0040"]),
    "botnet": (["T1583.005", "T1071"], ["TA0001", "TA0011"]),
    "supply chain": (["T1195"], ["TA0001"]),
    "watering hole": (["T1189"], ["TA0001"]),
    "drive-by": (["T1189"], ["TA0001"]),
    "exploit kit": (["T1189", "T1203"], ["TA0001"]),
    "zero-day": (["T1190", "T1203"], ["TA0001"]),
    "0-day": (["T1190", "T1203"], ["TA0001"]),
    "buffer overflow": (["T1203"], ["TA0001"]),
    "privilege escalation": (["T1068"], ["TA0004"]),
    "lateral movement": (["T1021", "T1570"], ["TA0008"]),
    "pass the hash": (["T1550.002"], ["TA0008"]),
    "kerberoasting": (["T1558.003"], ["TA0006"]),
    "dns tunneling": (["T1071.004"], ["TA0011"]),
    "data destruction": (["T1485"], ["TA0040"]),
    "defacement": (["T1491"], ["TA0040"]),
    "cryptominer": (["T1496"], ["TA0040"]),
    "cryptojacking": (["T1496"], ["TA0040"]),
    "keylogger": (["T1056.001"], ["TA0009"]),
    "rootkit": (["T1014"], ["TA0005"]),
    "webshell": (["T1505.003"], ["TA0003"]),
    "web shell": (["T1505.003"], ["TA0003"]),
    "living off the land": (["T1218", "T1059.001"], ["TA0005", "TA0002"]),
    "lolbin": (["T1218"], ["TA0005"]),
    # APT groups
    "apt28": (["T1566.001", "T1059.001", "T1071.001", "T1027"], ["TA0001", "TA0002", "TA0011", "TA0005"]),
    "apt29": (["T1566.002", "T1059.001", "T1071.001", "T1195"], ["TA0001", "TA0002", "TA0011"]),
    "apt41": (["T1190", "T1059", "T1505.003"], ["TA0001", "TA0002", "TA0003"]),
    "apt38": (["T1566.001", "T1059", "T1486"], ["TA0001", "TA0002", "TA0040"]),
    "lazarus": (["T1566.001", "T1059", "T1486", "T1195"], ["TA0001", "TA0002", "TA0040"]),
    "fancy bear": (["T1566.001", "T1059.001", "T1071.001"], ["TA0001", "TA0002", "TA0011"]),
    "cozy bear": (["T1566.002", "T1059.001", "T1071.001"], ["TA0001", "TA0002", "TA0011"]),
    "turla": (["T1071.001", "T1059.001", "T1027", "T1055"], ["TA0011", "TA0002", "TA0005"]),
    "sandworm": (["T1059", "T1485", "T1486", "T1562"], ["TA0002", "TA0040", "TA0005"]),
    "kimsuky": (["T1566.001", "T1059", "T1056.001"], ["TA0001", "TA0002", "TA0009"]),
    "mustang panda": (["T1566.001", "T1059", "T1071.001"], ["TA0001", "TA0002", "TA0011"]),
    "hafnium": (["T1190", "T1505.003", "T1003"], ["TA0001", "TA0003", "TA0006"]),
    "charming kitten": (["T1566.001", "T1059", "T1071"], ["TA0001", "TA0002", "TA0011"]),
    "gamaredon": (["T1566.001", "T1059.005", "T1071"], ["TA0001", "TA0002", "TA0011"]),
    "volt typhoon": (["T1190", "T1218", "T1059.001"], ["TA0001", "TA0005", "TA0002"]),
    "scattered spider": (["T1566", "T1621", "T1078"], ["TA0001", "TA0006"]),
}

# Technique → Tactic fallback (for techniques found via regex without tactic context)
TECHNIQUE_TO_TACTIC = {
    "T1566": "TA0001", "T1566.001": "TA0001", "T1566.002": "TA0001",
    "T1190": "TA0001", "T1195": "TA0001", "T1203": "TA0001",
    "T1059": "TA0002", "T1059.001": "TA0002", "T1059.003": "TA0002", "T1059.005": "TA0002",
    "T1547": "TA0003", "T1547.001": "TA0003",
    "T1055": "TA0005", "T1027": "TA0005", "T1556": "TA0005",
    "T1003": "TA0006", "T1003.001": "TA0006", "T1110": "TA0006", "T1110.004": "TA0006",
    "T1082": "TA0007",
    "T1021": "TA0008", "T1021.002": "TA0008", "T1550.002": "TA0008",
    "T1005": "TA0009", "T1056.001": "TA0009",
    "T1041": "TA0010", "T1048": "TA0010",
    "T1071": "TA0011", "T1071.001": "TA0011", "T1583.005": "TA0011",
    "T1486": "TA0040", "T1490": "TA0040", "T1498": "TA0040", "T1499": "TA0040",
}


def extract_mitre_from_text(text: str, tags: List[str] = None) -> dict:
    """Extract MITRE ATT&CK mappings from text content and tags.

    Returns:
        {
            "technique_ids": ["T1059", ...],
            "tactics": ["TA0002", ...],
            "confidence": 0.0-1.0,
            "source": "auto" | "tag",
        }
    """
    technique_ids: set = set()
    tactics: set = set()
    confidence = 0.0
    source = "auto"

    combined = (text or "").lower()
    if tags:
        combined += " " + " ".join(tags).lower()

    # 1. Direct technique ID extraction from text/tags
    found_techniques = TECHNIQUE_PATTERN.findall(combined.upper() if combined else "")
    # Re-search on original case
    found_techniques = TECHNIQUE_PATTERN.findall(text or "")
    if tags:
        for tag in tags:
            found_techniques.extend(TECHNIQUE_PATTERN.findall(tag))

    if found_techniques:
        technique_ids.update(found_techniques)
        source = "tag"
        confidence = max(confidence, 0.9)
        # Map to tactics
        for t in found_techniques:
            tactic = TECHNIQUE_TO_TACTIC.get(t)
            if tactic:
                tactics.add(tactic)

    # 2. Known tool/malware/attack pattern matching
    text_lower = combined
    for keyword, (techs, tacs) in TOOL_TECHNIQUE_MAP.items():
        if keyword in text_lower:
            technique_ids.update(techs)
            tactics.update(tacs)
            confidence = max(confidence, 0.7)

    # 3. Check tags for tactic IDs directly
    if tags:
        for tag in tags:
            tag_upper = tag.upper().strip()
            if tag_upper in TACTIC_MAP:
                tactics.add(tag_upper)
                confidence = max(confidence, 0.8)

    if not technique_ids and not tactics:
        return {"technique_ids": [], "tactics": [], "confidence": 0.0, "source": None}

    return {
        "technique_ids": sorted(technique_ids),
        "tactics": sorted(tactics),
        "confidence": round(confidence, 2),
        "source": source,
    }


def get_tactics_for_techniques(technique_ids: List[str]) -> List[str]:
    """Given technique IDs, return associated tactic IDs."""
    tactics = set()
    for t in technique_ids:
        tactic = TECHNIQUE_TO_TACTIC.get(t)
        if tactic:
            tactics.add(tactic)
    return sorted(tactics)
