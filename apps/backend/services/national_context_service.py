# apps/backend/services/national_context_service.py
"""
Loads national e-waste context numbers from data/national_context_seed.json.

The file starts as a placeholder. Until someone fills it with verified
numbers from CPCB / data.gov.in, this service returns {configured: false}
and the mobile UI shows "Data not yet configured".

No numbers are invented.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_JSON_PATH = os.path.join(_BACKEND_DIR, "data", "national_context_seed.json")


def get_national_context() -> Dict[str, Any]:
    if not os.path.exists(_JSON_PATH):
        return {
            "configured": False,
            "message": "National context data not seeded. Add apps/backend/data/national_context_seed.json with verified CPCB figures.",
        }
    with open(_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not data.get("configured"):
        return {
            "configured": False,
            "message": "National context data present but marked configured=false. Fill real numbers and set configured=true.",
            "source": data.get("source", {}),
        }
    return data