"""Unified AI Service — routes requests to configured provider (OpenAI, Gemini, Ollama, or mock).

Supports:
- Threat summarization with citations
- IOC correlation with confidence levels
- Chat assistant for threat intel Q&A
- Streaming responses

Provider priority: workspace config > env config > mock fallback
"""
import logging
import json
import asyncio
from typing import AsyncGenerator, Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger("catshy.ai")


class AIProvider(str, Enum):
    OPENAI = "openai"
    GEMINI = "gemini"
    OLLAMA = "ollama"
    MOCK = "mock"


@dataclass
class AIConfig:
    provider: AIProvider = AIProvider.MOCK
    api_key: str = ""
    model: str = ""
    base_url: str = ""
    temperature: float = 0.3
    max_tokens: int = 2048

    @property
    def effective_model(self) -> str:
        if self.model:
            return self.model
        defaults = {
            AIProvider.OPENAI: "gpt-4o-mini",
            AIProvider.GEMINI: "gemini-2.0-flash",
            AIProvider.OLLAMA: "llama3.1",
            AIProvider.MOCK: "mock",
        }
        return defaults.get(self.provider, "mock")

    @property
    def effective_base_url(self) -> str:
        if self.base_url:
            return self.base_url
        defaults = {
            AIProvider.OPENAI: "https://api.openai.com/v1",
            AIProvider.GEMINI: "https://generativelanguage.googleapis.com/v1beta",
            AIProvider.OLLAMA: "http://localhost:11434",
            AIProvider.MOCK: "",
        }
        return defaults.get(self.provider, "")


# ── System prompts ──

THREAT_SUMMARIZER_PROMPT = """You are CATSHY AI — a specialized Threat Intelligence analyst.
Your job is to summarize threat data concisely and accurately.

Rules:
- Always cite source items by their IDs when referencing data
- Use threat intelligence terminology (IOC, TTP, APT, C2, etc.)
- Highlight severity and urgency clearly
- Structure output with: Executive Summary, Key Findings, Indicators, Recommendations
- If data is insufficient, say so — never fabricate intelligence
- Redact any credentials, passwords, or sensitive leak evidence
- Keep summaries actionable and prioritized"""

CORRELATION_ENGINE_PROMPT = """You are CATSHY AI — an advanced Threat Correlation Engine.
Your job is to find hidden relationships between IOCs, threats, and incidents.

Rules:
- Analyze patterns across multiple data points
- Assign confidence levels (high/medium/low) to each correlation
- Explain your reasoning for each connection found
- Look for: shared infrastructure, temporal patterns, TTP overlap, campaign linkage
- Never auto-apply changes — only suggest correlations for analyst review
- Output structured JSON with: correlations[], each having: entities, relationship_type, confidence, reasoning
- Redact sensitive fields before analysis"""

CHAT_ASSISTANT_PROMPT = """You are CATSHY AI Assistant — an integrated threat intelligence expert.
You help analysts investigate threats, analyze IOCs, and make security decisions.

Capabilities:
- Analyze and explain IOCs (IPs, domains, hashes, CVEs)
- Summarize threat reports and incidents
- Suggest response actions and playbook steps
- Explain MITRE ATT&CK techniques
- Help with threat hunting queries
- Provide context on threat actors and campaigns

Rules:
- Be concise but thorough
- Always cite sources when available
- Recommend verification steps for uncertain findings
- Never fabricate threat intelligence data
- Use markdown formatting for readability
- Redact credentials and sensitive data"""


# ── Mock responses ──

MOCK_SUMMARY = """## 🔍 AI Threat Summary (Mock Mode)

### Executive Summary
AI analysis is running in **mock mode**. Configure an AI provider in Settings → AI Configuration to enable real analysis.

### What AI Analysis Will Provide:
- **Automated threat summarization** with source citations
- **Pattern recognition** across IOCs and incidents
- **Risk prioritization** based on your asset context
- **Actionable recommendations** for response

### Setup Instructions
1. Go to **Settings → AI Configuration**
2. Choose a provider (OpenAI, Google Gemini, or Local Ollama)
3. Enter your API key or configure local endpoint
4. AI features will activate immediately

> 💡 *Mock mode provides sample responses so you can preview the UI and workflow.*"""

MOCK_CORRELATION = json.dumps({
    "correlations": [
        {
            "entities": ["IOC-001", "IOC-002"],
            "relationship_type": "shared_infrastructure",
            "confidence": "medium",
            "reasoning": "Mock correlation — configure AI provider for real analysis"
        }
    ],
    "summary": "AI correlation running in mock mode. Configure a provider to analyze real threat data.",
    "mock": True
}, indent=2)

MOCK_CHAT = """I'm CATSHY AI Assistant running in **mock mode**. 🤖

To enable real AI analysis:
1. Go to **Settings → AI Configuration**
2. Choose your preferred AI provider
3. Add your API key

Once configured, I can help you:
- 🔍 Analyze IOCs and threat indicators
- 📊 Summarize threat reports
- 🎯 Suggest response actions
- 🗺️ Map threats to MITRE ATT&CK
- 🔗 Find correlations between incidents

*Ask me anything about threat intelligence!*"""


class AIService:
    """Unified AI service that routes to the configured provider."""

    def __init__(self, config: AIConfig):
        self.config = config

    async def summarize_threats(self, items: List[Dict[str, Any]]) -> str:
        """Generate AI summary of threat items with citations."""
        if self.config.provider == AIProvider.MOCK:
            return MOCK_SUMMARY

        context = self._format_items_for_context(items)
        prompt = f"Analyze and summarize these threat intelligence items:\n\n{context}"
        return await self._call_llm(THREAT_SUMMARIZER_PROMPT, prompt)

    async def correlate_iocs(self, items: List[Dict[str, Any]]) -> str:
        """Find correlations between IOCs and return structured analysis."""
        if self.config.provider == AIProvider.MOCK:
            return MOCK_CORRELATION

        context = self._format_items_for_context(items)
        prompt = f"Analyze these items for correlations and hidden relationships:\n\n{context}"
        return await self._call_llm(CORRELATION_ENGINE_PROMPT, prompt)

    async def chat(self, messages: List[Dict[str, str]], context: Optional[str] = None) -> str:
        """Interactive chat with threat intel context."""
        if self.config.provider == AIProvider.MOCK:
            return MOCK_CHAT

        system = CHAT_ASSISTANT_PROMPT
        if context:
            system += f"\n\nCurrent workspace context:\n{context}"

        return await self._call_llm(system, messages=messages)

    async def chat_stream(self, messages: List[Dict[str, str]], context: Optional[str] = None) -> AsyncGenerator[str, None]:
        """Streaming chat responses."""
        if self.config.provider == AIProvider.MOCK:
            for word in MOCK_CHAT.split(" "):
                yield word + " "
                await asyncio.sleep(0.03)
            return

        system = CHAT_ASSISTANT_PROMPT
        if context:
            system += f"\n\nCurrent workspace context:\n{context}"

        async for chunk in self._stream_llm(system, messages=messages):
            yield chunk

    # ── Provider implementations ──

    async def _call_llm(self, system_prompt: str, user_prompt: str = "", messages: List[Dict[str, str]] = None) -> str:
        """Non-streaming LLM call."""
        import httpx

        if self.config.provider == AIProvider.OPENAI:
            return await self._call_openai(system_prompt, user_prompt, messages)
        elif self.config.provider == AIProvider.GEMINI:
            return await self._call_gemini(system_prompt, user_prompt, messages)
        elif self.config.provider == AIProvider.OLLAMA:
            return await self._call_ollama(system_prompt, user_prompt, messages)
        else:
            return MOCK_CHAT

    async def _call_openai(self, system: str, user_prompt: str = "", messages: List[Dict[str, str]] = None) -> str:
        import httpx
        msgs = [{"role": "system", "content": system}]
        if messages:
            msgs.extend(messages)
        elif user_prompt:
            msgs.append({"role": "user", "content": user_prompt})

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{self.config.effective_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.config.api_key}", "Content-Type": "application/json"},
                json={"model": self.config.effective_model, "messages": msgs,
                      "temperature": self.config.temperature, "max_tokens": self.config.max_tokens},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    async def _call_gemini(self, system: str, user_prompt: str = "", messages: List[Dict[str, str]] = None) -> str:
        import httpx
        # Use OpenAI-compatible endpoint for Gemini
        msgs = [{"role": "system", "content": system}]
        if messages:
            msgs.extend(messages)
        elif user_prompt:
            msgs.append({"role": "user", "content": user_prompt})

        base = self.config.effective_base_url
        # Support OpenAI-compatible Gemini endpoint
        if "generativelanguage.googleapis.com" in base:
            base = "https://generativelanguage.googleapis.com/v1beta/openai"

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{base}/chat/completions",
                headers={"Authorization": f"Bearer {self.config.api_key}", "Content-Type": "application/json"},
                json={"model": self.config.effective_model, "messages": msgs,
                      "temperature": self.config.temperature, "max_tokens": self.config.max_tokens},
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]

    async def _call_ollama(self, system: str, user_prompt: str = "", messages: List[Dict[str, str]] = None) -> str:
        import httpx
        msgs = [{"role": "system", "content": system}]
        if messages:
            msgs.extend(messages)
        elif user_prompt:
            msgs.append({"role": "user", "content": user_prompt})

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{self.config.effective_base_url}/api/chat",
                json={"model": self.config.effective_model, "messages": msgs, "stream": False},
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]

    async def _stream_llm(self, system: str, messages: List[Dict[str, str]] = None) -> AsyncGenerator[str, None]:
        """Streaming LLM call."""
        import httpx

        if self.config.provider == AIProvider.OPENAI or self.config.provider == AIProvider.GEMINI:
            async for chunk in self._stream_openai_compat(system, messages):
                yield chunk
        elif self.config.provider == AIProvider.OLLAMA:
            async for chunk in self._stream_ollama(system, messages):
                yield chunk

    async def _stream_openai_compat(self, system: str, messages: List[Dict[str, str]] = None) -> AsyncGenerator[str, None]:
        import httpx
        msgs = [{"role": "system", "content": system}]
        if messages:
            msgs.extend(messages)

        base = self.config.effective_base_url
        if self.config.provider == AIProvider.GEMINI and "generativelanguage.googleapis.com" in base:
            base = "https://generativelanguage.googleapis.com/v1beta/openai"

        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{base}/chat/completions",
                headers={"Authorization": f"Bearer {self.config.api_key}", "Content-Type": "application/json"},
                json={"model": self.config.effective_model, "messages": msgs,
                      "temperature": self.config.temperature, "max_tokens": self.config.max_tokens, "stream": True},
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        parsed = json.loads(data)
                        content = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue

    async def _stream_ollama(self, system: str, messages: List[Dict[str, str]] = None) -> AsyncGenerator[str, None]:
        import httpx
        msgs = [{"role": "system", "content": system}]
        if messages:
            msgs.extend(messages)

        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                f"{self.config.effective_base_url}/api/chat",
                json={"model": self.config.effective_model, "messages": msgs, "stream": True},
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        parsed = json.loads(line)
                        content = parsed.get("message", {}).get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        continue

    def _format_items_for_context(self, items: List[Dict[str, Any]], max_items: int = 50) -> str:
        """Format threat items as context for LLM."""
        lines = []
        for item in items[:max_items]:
            # Redact sensitive fields
            safe_item = {k: v for k, v in item.items()
                        if k not in ("evidence_excerpt", "credentials", "password", "secret")}
            lines.append(f"- [{safe_item.get('id', 'N/A')}] {safe_item.get('title', 'Untitled')} "
                        f"(severity={safe_item.get('severity', 'unknown')}, "
                        f"type={safe_item.get('observable_type', 'unknown')}, "
                        f"value={safe_item.get('observable_value', 'N/A')})")
        return "\n".join(lines)


def get_ai_service(config: AIConfig) -> AIService:
    """Factory function to create AI service."""
    return AIService(config)
