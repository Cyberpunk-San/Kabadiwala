# apps/backend/settings.py
"""
Central backend configuration.

Values come from real environment variables first, then from a `.env` file
(apps/backend/.env, falling back to the repo-root .env). No extra dependency
is needed — the loader below understands plain KEY=VALUE lines.

Free AI keys (both optional — the app still works without them):
  HF_API_TOKEN     Hugging Face token (huggingface.co/settings/tokens, "Read" is enough)
  GEMINI_API_KEY   Google AI Studio key (aistudio.google.com/apikey)
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

# ─── AI providers ────────────────────────────────────────────────────────────
HF_API_TOKEN = _get("HF_API_TOKEN")
HF_VISION_MODEL = _get("HF_VISION_MODEL", "openai/clip-vit-large-patch14")
HF_CHAT_MODEL = _get("HF_CHAT_MODEL", "meta-llama/Llama-3.1-8B-Instruct")
HF_ROUTER_URL = _get("HF_ROUTER_URL", "https://router.huggingface.co")

GEMINI_API_KEY = _get("GEMINI_API_KEY")
GEMINI_MODEL = _get("GEMINI_MODEL", "gemini-2.0-flash")

# "auto" tries HF API → local CLIP → safe fallback. Set to "hf", "local" or "off" to force.
VISION_BACKEND = _get("VISION_BACKEND", "auto").lower()
# Local CLIP downloads ~600 MB on first use; allow turning it off on small machines.
ENABLE_LOCAL_CLIP = _get("ENABLE_LOCAL_CLIP", "true").lower() != "false"

AI_TIMEOUT_S = float(_get("AI_TIMEOUT_S", "30"))
