# apps/backend/settings.py
"""
Central backend configuration.

Values come from real environment variables first, then from a `.env` file
(apps/backend/.env, falling back to the repo-root .env). No extra dependency
is needed — the loader below understands plain KEY=VALUE lines.

No AI keys: photo recognition (CLIP) and the chat helper (Qwen) run locally.
"""

from __future__ import annotations

import os
import sys

# Windows consoles/pipes default to cp1252, which crashes on the ₹ / ✓ / Hindi
# text this app logs. Force UTF-8 (and never crash on an unprintable char).
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    except (AttributeError, ValueError):
        pass

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.abspath(os.path.join(_BACKEND_DIR, "..", ".."))


def _load_env_file(path: str) -> None:
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            # Real environment variables always win over the file.
            os.environ.setdefault(key, value)


_load_env_file(os.path.join(_BACKEND_DIR, ".env"))
_load_env_file(os.path.join(_REPO_ROOT, ".env"))


def _get(key: str, default: str = "") -> str:
    return os.environ.get(key, default).strip()


DATA_DIR = os.path.join(_BACKEND_DIR, "data")
DB_PATH = _get("MHK_DB_PATH") or os.path.join(DATA_DIR, "mhk.db")

# Default "*" so Expo web, file:// portals and phones on the LAN all work in dev.
ALLOWED_ORIGINS = [o.strip() for o in _get("MHK_ALLOWED_ORIGINS", "*").split(",") if o.strip()] or ["*"]

# ─── AI (all free and local — no keys) ────────────────────────────────────────
# "auto"/"local" use local CLIP (falls back safely if not installed); "off" disables photo AI.
VISION_BACKEND = _get("VISION_BACKEND", "auto").lower()
# Local CLIP downloads ~600 MB on first use; allow turning it off on small machines.
ENABLE_LOCAL_CLIP = _get("ENABLE_LOCAL_CLIP", "true").lower() != "false"

AI_TIMEOUT_S = float(_get("AI_TIMEOUT_S", "30"))

# Free local chat model (llama.cpp on CPU — no key, no limits). Helper only: it
# answers free-form questions the offline assistant doesn't understand.
# Needs `pip install llama-cpp-python`; the ~1 GB GGUF file downloads on first use.
ENABLE_LOCAL_LLM = _get("ENABLE_LOCAL_LLM", "true").lower() != "false"
LOCAL_LLM_REPO = _get("LOCAL_LLM_REPO", "Qwen/Qwen2.5-1.5B-Instruct-GGUF")
LOCAL_LLM_FILE = _get("LOCAL_LLM_FILE", "qwen2.5-1.5b-instruct-q4_k_m.gguf")
LOCAL_LLM_CTX = int(_get("LOCAL_LLM_CTX", "2048"))
LOCAL_LLM_THREADS = int(_get("LOCAL_LLM_THREADS", "0")) or None  # 0 = all CPU cores

