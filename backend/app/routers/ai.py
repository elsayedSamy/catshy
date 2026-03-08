"""AI Router — threat summarization, correlation, and chat assistant.

Endpoints:
  GET   /api/ai/config        — get AI provider config (masked key)
  PUT   /api/ai/config        — update AI provider config (admin only)
  POST  /api/ai/test          — test AI connection
  POST  /api/ai/summarize     — summarize threat items
  POST  /api/ai/correlate     — find IOC correlations
  POST  /api/ai/chat          — chat with AI assistant
  POST  /api/ai/chat/stream   — streaming chat
"""
import logging
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

from app.database import get_db
from app.core.deps import get_current_user, get_workspace_id, require_team_admin
from app.models.integrations import WorkspaceIntegration
from app.services.encryption import encrypt_api_key, decrypt_api_key, mask_api_key
from app.services.ai_service import AIService, AIConfig, AIProvider, get_ai_service

logger = logging.getLogger("catshy.ai")
router = APIRouter()


# ── Schemas ──

class AIConfigResponse(BaseModel):
    provider: str = "mock"
    model: str = ""
    base_url: str = ""
    temperature: float = 0.3
    max_tokens: int = 2048
    has_api_key: bool = False
    api_key_masked: str = ""
    status: str = "not_configured"


class AIConfigUpdate(BaseModel):
    provider: str = Field(..., description="openai, gemini, ollama, or mock")
    api_key: Optional[str] = Field(None, description="API key (omit to keep existing)")
    model: Optional[str] = None
    base_url: Optional[str] = None
    temperature: Optional[float] = Field(None, ge=0, le=2)
    max_tokens: Optional[int] = Field(None, ge=100, le=16384)


class SummarizeRequest(BaseModel):
    item_ids: List[str] = Field(default=[], description="Specific item IDs to summarize")
    filters: Dict[str, Any] = Field(default={}, description="Filter criteria for items")
    custom_prompt: Optional[str] = None


class CorrelateRequest(BaseModel):
    item_ids: List[str] = Field(default=[], description="Item IDs to correlate")
    scope: str = Field(default="recent", description="recent, all, or custom")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    include_context: bool = Field(default=True, description="Include workspace threat context")


# ── Helpers ──

AI_PROVIDER_KEY = "ai_provider"


async def _get_ai_integration(db: AsyncSession, workspace_id: str) -> Optional[WorkspaceIntegration]:
    result = await db.execute(
        select(WorkspaceIntegration).where(
            WorkspaceIntegration.workspace_id == workspace_id,
            WorkspaceIntegration.provider == AI_PROVIDER_KEY,
        )
    )
    return result.scalar_one_or_none()


async def _build_ai_config(db: AsyncSession, workspace_id: str) -> AIConfig:
    integration = await _get_ai_integration(db, workspace_id)
    if not integration or not integration.enabled:
        return AIConfig(provider=AIProvider.MOCK)

    config_data = integration.config or {}
    api_key = ""
    if integration.encrypted_api_key:
        try:
            api_key = decrypt_api_key(integration.encrypted_api_key)
        except ValueError:
            logger.error(f"Failed to decrypt AI API key for workspace {workspace_id}")

    provider = AIProvider(config_data.get("provider", "mock"))
    # Ollama doesn't need an API key
    if provider == AIProvider.OLLAMA:
        api_key = "not-needed"

    return AIConfig(
        provider=provider,
        api_key=api_key,
        model=config_data.get("model", ""),
        base_url=config_data.get("base_url", ""),
        temperature=config_data.get("temperature", 0.3),
        max_tokens=config_data.get("max_tokens", 2048),
    )


async def _get_workspace_context(db: AsyncSession, workspace_id: str) -> str:
    """Get recent threat data as context for AI."""
    from app.models import IntelItem
    result = await db.execute(
        select(IntelItem)
        .where(IntelItem.workspace_id == workspace_id)
        .order_by(IntelItem.fetched_at.desc())
        .limit(20)
    )
    items = result.scalars().all()
    if not items:
        return "No recent threat data available."

    lines = [f"Recent threats ({len(items)} items):"]
    for item in items:
        lines.append(f"- [{item.id[:8]}] {item.title} (severity={item.severity}, "
                     f"type={item.observable_type}, value={item.observable_value})")
    return "\n".join(lines)


# ── Endpoints ──

@router.get("/config")
async def get_ai_config(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """Get AI configuration (API key is masked)."""
    integration = await _get_ai_integration(db, workspace_id)
    if not integration:
        return AIConfigResponse()

    config_data = integration.config or {}
    api_key_masked = ""
    has_key = False
    if integration.encrypted_api_key:
        try:
            plain = decrypt_api_key(integration.encrypted_api_key)
            api_key_masked = mask_api_key(plain)
            has_key = True
        except ValueError:
            api_key_masked = "⚠️ decryption failed"

    return AIConfigResponse(
        provider=config_data.get("provider", "mock"),
        model=config_data.get("model", ""),
        base_url=config_data.get("base_url", ""),
        temperature=config_data.get("temperature", 0.3),
        max_tokens=config_data.get("max_tokens", 2048),
        has_api_key=has_key,
        api_key_masked=api_key_masked,
        status=integration.status,
    )


@router.put("/config")
async def update_ai_config(
    req: AIConfigUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    workspace_id: str = Depends(get_workspace_id),
):
    """Update AI provider configuration. Admin only."""
    integration = await _get_ai_integration(db, workspace_id)
    if not integration:
        integration = WorkspaceIntegration(
            workspace_id=workspace_id,
            provider=AI_PROVIDER_KEY,
            enabled=True,
            status="active",
        )
        db.add(integration)

    # Update config
    config_data = integration.config or {}
    config_data["provider"] = req.provider
    if req.model is not None:
        config_data["model"] = req.model
    if req.base_url is not None:
        config_data["base_url"] = req.base_url
    if req.temperature is not None:
        config_data["temperature"] = req.temperature
    if req.max_tokens is not None:
        config_data["max_tokens"] = req.max_tokens

    integration.config = config_data
    integration.enabled = req.provider != "mock"
    integration.status = "active" if req.provider != "mock" else "not_configured"

    # Encrypt API key if provided
    if req.api_key:
        integration.encrypted_api_key = encrypt_api_key(req.api_key)

    await db.commit()
    logger.info(f"AI config updated for workspace {workspace_id}: provider={req.provider}")
    return {"message": "AI configuration updated", "provider": req.provider}


@router.post("/test")
async def test_ai_connection(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_team_admin),
    workspace_id: str = Depends(get_workspace_id),
):
    """Test the AI provider connection."""
    config = await _build_ai_config(db, workspace_id)
    service = get_ai_service(config)

    try:
        result = await service.chat([{"role": "user", "content": "Reply with: CATSHY AI connection successful."}])
        return {"success": True, "provider": config.provider.value, "response": result[:200]}
    except Exception as e:
        logger.error(f"AI test failed: {e}")
        return {"success": False, "provider": config.provider.value, "error": str(e)}


@router.post("/summarize")
async def summarize_threats(
    req: SummarizeRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """AI-powered threat summarization."""
    from app.models import IntelItem

    # Fetch items
    if req.item_ids:
        result = await db.execute(
            select(IntelItem).where(
                IntelItem.workspace_id == workspace_id,
                IntelItem.id.in_(req.item_ids),
            )
        )
    else:
        result = await db.execute(
            select(IntelItem)
            .where(IntelItem.workspace_id == workspace_id)
            .order_by(IntelItem.fetched_at.desc())
            .limit(30)
        )

    items = [{"id": i.id, "title": i.title, "severity": i.severity,
              "observable_type": i.observable_type, "observable_value": i.observable_value,
              "source_name": i.source_name, "description": i.description or ""}
             for i in result.scalars().all()]

    if not items:
        return {"summary": "No threat items found to summarize.", "item_count": 0}

    config = await _build_ai_config(db, workspace_id)
    service = get_ai_service(config)
    summary = await service.summarize_threats(items)
    return {"summary": summary, "item_count": len(items), "provider": config.provider.value}


@router.post("/correlate")
async def correlate_iocs(
    req: CorrelateRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """AI-powered IOC correlation."""
    from app.models import IntelItem

    if req.item_ids:
        result = await db.execute(
            select(IntelItem).where(
                IntelItem.workspace_id == workspace_id,
                IntelItem.id.in_(req.item_ids),
            )
        )
    else:
        result = await db.execute(
            select(IntelItem)
            .where(IntelItem.workspace_id == workspace_id)
            .order_by(IntelItem.fetched_at.desc())
            .limit(50)
        )

    items = [{"id": i.id, "title": i.title, "severity": i.severity,
              "observable_type": i.observable_type, "observable_value": i.observable_value,
              "source_name": i.source_name}
             for i in result.scalars().all()]

    config = await _build_ai_config(db, workspace_id)
    service = get_ai_service(config)
    correlation = await service.correlate_iocs(items)
    return {"correlation": correlation, "item_count": len(items), "provider": config.provider.value}


@router.post("/chat")
async def chat_with_ai(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """Chat with AI assistant."""
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    context = None
    if req.include_context:
        context = await _get_workspace_context(db, workspace_id)

    config = await _build_ai_config(db, workspace_id)
    service = get_ai_service(config)
    response = await service.chat(messages, context)
    return {"response": response, "provider": config.provider.value}


@router.post("/chat/stream")
async def chat_stream(
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    workspace_id: str = Depends(get_workspace_id),
):
    """Streaming chat with AI assistant."""
    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    context = None
    if req.include_context:
        context = await _get_workspace_context(db, workspace_id)

    config = await _build_ai_config(db, workspace_id)
    service = get_ai_service(config)

    async def generate():
        async for chunk in service.chat_stream(messages, context):
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
