# apps/backend/services/ai_providers.py
"""
Free, keyless local chat model (llama.cpp) — no cloud APIs, no accounts.

Every function raises AIProviderError on any failure so callers can fall back
to the offline assistant.
"""

from __future__ import annotations

import importlib.util
import threading
from typing import Dict, List, Optional

import settings


class AIProviderError(RuntimeError):
    pass


# ─── Local LLM (llama.cpp) ───────────────────────────────────────────────────
# Free, keyless, runs on CPU. Used only as a helper for free-form questions the
# offline assistant doesn't understand — never for prices or live data.

_local_llm = None
_local_llm_lock = threading.Lock()


def local_llm_available() -> bool:
    return settings.ENABLE_LOCAL_LLM and importlib.util.find_spec("llama_cpp") is not None


def _load_local_llm():
    """Download (once) and load the GGUF model. Caller must hold _local_llm_lock."""
    global _local_llm
    if _local_llm is None:
        from huggingface_hub import hf_hub_download  # noqa: WPS433 (optional dependency)
        from llama_cpp import Llama  # noqa: WPS433

        path = hf_hub_download(settings.LOCAL_LLM_REPO, settings.LOCAL_LLM_FILE)
        _local_llm = Llama(model_path=path, n_ctx=settings.LOCAL_LLM_CTX, n_threads=settings.LOCAL_LLM_THREADS, verbose=False)
    return _local_llm


def warm_up_local_llm() -> None:
    """Load the model in the background at startup so the first chat isn't slow."""
    if not local_llm_available():
        return

    def _load() -> None:
        try:
            with _local_llm_lock:
                _load_local_llm()
            print(f"[MHK AI] local chat model ready: {settings.LOCAL_LLM_FILE}")
        except Exception as exc:  # noqa: BLE001 — never crash startup over an optional model
            print(f"[MHK AI] local chat model unavailable: {exc}")

    threading.Thread(target=_load, daemon=True).start()


def local_chat(messages: List[Dict[str, str]], max_tokens: int = 250) -> str:
    """Plain-text chat with the local model."""
    if not local_llm_available():
        raise AIProviderError("llama-cpp-python not installed or ENABLE_LOCAL_LLM=false")
    try:
        with _local_llm_lock:  # llama.cpp is not thread-safe: one request at a time
            out = _load_local_llm().create_chat_completion(messages=messages, max_tokens=max_tokens, temperature=0.3)
        return (out["choices"][0]["message"]["content"] or "").strip()
    except Exception as exc:  # noqa: BLE001
        raise AIProviderError(f"Local LLM failed: {exc}") from exc


def provider_status() -> Dict[str, Optional[str]]:
    return {
        "local": settings.LOCAL_LLM_FILE if local_llm_available() else None,
    }
