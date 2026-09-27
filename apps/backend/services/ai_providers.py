# apps/backend/services/ai_providers.py
"""
Thin HTTP clients for the free AI providers.

  • Hugging Face Inference (router.huggingface.co) — zero-shot image
    classification + OpenAI-compatible chat completions.
  • Google Gemini (generativelanguage.googleapis.com) — chat.

Every function raises AIProviderError on any failure so callers can fall back
to the next provider without caring about HTTP details.
"""

from __future__ import annotations

import base64
from typing import Dict, List, Optional

import httpx

import settings


class AIProviderError(RuntimeError):
    pass


def hf_available() -> bool:
    return bool(settings.HF_API_TOKEN)


def gemini_available() -> bool:
    return bool(settings.GEMINI_API_KEY)


def _raise_for(res: httpx.Response, provider: str) -> None:
    if res.status_code >= 400:
        detail = res.text[:300]
        raise AIProviderError(f"{provider} HTTP {res.status_code}: {detail}")


# ─── Hugging Face ────────────────────────────────────────────────────────────

def hf_zero_shot_image(image_bytes: bytes, labels: List[str]) -> List[Dict[str, float]]:
    """Return [{label, score}, ...] sorted by score (desc)."""
    if not hf_available():
        raise AIProviderError("HF_API_TOKEN not configured")

    url = f"{settings.HF_ROUTER_URL}/hf-inference/models/{settings.HF_VISION_MODEL}"
    payload = {
        "inputs": base64.b64encode(image_bytes).decode("ascii"),
        "parameters": {"candidate_labels": labels},
    }
    try:
        res = httpx.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {settings.HF_API_TOKEN}"},
            timeout=settings.AI_TIMEOUT_S,
        )
    except httpx.HTTPError as exc:
        raise AIProviderError(f"Hugging Face unreachable: {exc}") from exc

    _raise_for(res, "Hugging Face")
    data = res.json()
    if not isinstance(data, list) or not data or "label" not in data[0]:
        raise AIProviderError(f"Unexpected Hugging Face response: {str(data)[:200]}")
    return sorted(data, key=lambda d: d.get("score", 0.0), reverse=True)


def hf_chat(messages: List[Dict[str, str]], max_tokens: int = 400) -> str:
    if not hf_available():
        raise AIProviderError("HF_API_TOKEN not configured")

    try:
        res = httpx.post(
            f"{settings.HF_ROUTER_URL}/v1/chat/completions",
            json={
                "model": settings.HF_CHAT_MODEL,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": 0.4,
            },
            headers={"Authorization": f"Bearer {settings.HF_API_TOKEN}"},
            timeout=settings.AI_TIMEOUT_S,
        )
    except httpx.HTTPError as exc:
        raise AIProviderError(f"Hugging Face unreachable: {exc}") from exc

    _raise_for(res, "Hugging Face")
    try:
        return res.json()["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise AIProviderError(f"Unexpected Hugging Face chat response: {res.text[:200]}") from exc


# ─── Gemini ──────────────────────────────────────────────────────────────────

def gemini_chat(system: str, messages: List[Dict[str, str]], max_tokens: int = 400) -> str:
    if not gemini_available():
        raise AIProviderError("GEMINI_API_KEY not configured")

    contents = [
        {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
        for m in messages
        if m["role"] in ("user", "assistant")
    ]
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent"
    )
    try:
        res = httpx.post(
            url,
            params={"key": settings.GEMINI_API_KEY},
            json={
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": contents,
                "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.4},
            },
            timeout=settings.AI_TIMEOUT_S,
        )
    except httpx.HTTPError as exc:
        raise AIProviderError(f"Gemini unreachable: {exc}") from exc

    _raise_for(res, "Gemini")
    try:
        parts = res.json()["candidates"][0]["content"]["parts"]
        return "".join(p.get("text", "") for p in parts).strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise AIProviderError(f"Unexpected Gemini response: {res.text[:200]}") from exc


def provider_status() -> Dict[str, Optional[str]]:
    return {
        "huggingface": settings.HF_VISION_MODEL if hf_available() else None,
        "gemini": settings.GEMINI_MODEL if gemini_available() else None,
    }
