"""Enrichment API endpoints — VirusTotal, Shodan, AbuseIPDB, AlienVault OTX."""
from fastapi import APIRouter, Depends, Query, HTTPException
from app.core.deps import get_current_user
from app.services.enrichment import enrichment_orchestrator

router = APIRouter()


@router.get("/providers")
async def list_providers(user=Depends(get_current_user)):
    """List available enrichment providers (those with API keys configured)."""
    return {
        "providers": enrichment_orchestrator.available_providers,
        "total": len(enrichment_orchestrator.available_providers),
    }


@router.get("/lookup")
async def enrich_ioc(
    type: str = Query(..., description="IOC type: ip, domain, hash, url"),
    value: str = Query(..., description="IOC value to look up"),
    user=Depends(get_current_user),
):
    """Enrich an IOC across all available threat intelligence providers."""
    if not value.strip():
        raise HTTPException(status_code=400, detail="Value is required")
    if type not in ("ip", "domain", "hash", "md5", "sha1", "sha256", "url", "hostname"):
        raise HTTPException(status_code=400, detail=f"Unsupported IOC type: {type}")

    results = await enrichment_orchestrator.enrich(type, value.strip())
    return {
        "ioc_type": type,
        "ioc_value": value.strip(),
        "enrichments": results,
        "providers_queried": len(results),
    }
