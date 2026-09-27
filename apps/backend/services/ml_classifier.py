# apps/backend/services/ml_classifier.py
"""
E-waste material classifier — zero-shot, no training data needed.

Providers are tried in order (see settings.VISION_BACKEND):
  1. Hugging Face Inference API (free token) — CLIP ViT-L/14 in the cloud.
     Fast, nothing to download, works on any laptop.
  2. Local CLIP ViT-B/32 via transformers + torch (if installed).
     Fully offline; first run downloads ~600 MB to ~/.cache/huggingface/.
  3. Safe fallback — confidence 0 so the app asks the collector to choose.

Images arrive as base64 (what the mobile app sends). A local file path is
still accepted for scripts/tests running on the same machine.
"""

from __future__ import annotations

import base64
import binascii
import io
import os
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

import settings
from models.domain import MaterialAlternative, MLMaterialPrediction
from services.ai_providers import AIProviderError, hf_available, hf_zero_shot_image


# ─── Safety rules (business rules, not ML) ───────────────────────────────────

MATERIAL_HAZARDS: Dict[str, Dict[str, Any]] = {
    "Lithium-ion batteries": {
        "hazard": True,
        "safety_message": "🔥 Critical Hazard: Thermal runaway & toxic fluoride release! Do not crush or short-circuit. Store in sand bin.",
        "category": "Batteries",
        "default_quality": "high",
    },
    "Lead acid batteries": {
        "hazard": True,
        "safety_message": "🧪 Severe Acid Hazard: Sulfuric acid leak & toxic lead oxide! Keep upright. Wear rubber apron & gloves.",
        "category": "Batteries",
        "default_quality": "medium",
    },
    "CRT & monitor glass": {
        "hazard": True,
        "safety_message": "⚡ Vacuum Implosion & Lead Oxide Hazard! Do not smash screen. Wear full face shield.",
        "category": "Electronics",
        "default_quality": "low",
    },
    "Copper cable": {
        "hazard": False,
        "safety_message": "Safe to handle: High purity electrical scrap. Remove PVC insulation without open burning.",
        "category": "Metals",
        "default_quality": "medium",
    },
    "Server boards": {
        "hazard": False,
        "safety_message": "Safe to handle: High value gold-plated PCI/DDR traces. Keep dry to prevent oxidation.",
        "category": "Electronics",
        "default_quality": "high",
    },
    "Printed Circuit Boards (PCB)": {
        "hazard": False,
        "safety_message": "Safe to handle: Telecom & PC motherboards. Do not use open acid baths.",
        "category": "Electronics",
        "default_quality": "medium",
    },
    "Aluminium": {
        "hazard": False,
        "safety_message": "Safe to handle: Heat sinks and alloy casings. Clean away non-metallic attachments.",
        "category": "Metals",
        "default_quality": "medium",
    },
    "Brass fittings": {
        "hazard": False,
        "safety_message": "Safe to handle: Heavy plumbing & electrical connector scrap.",
        "category": "Metals",
        "default_quality": "high",
    },
    "Electric motors": {
        "hazard": False,
        "safety_message": "Safe to handle: Heavy mechanical scrap with high copper winding yield.",
        "category": "Heavy Scrap",
        "default_quality": "medium",
    },
    "Iron & steel scrap": {
        "hazard": False,
        "safety_message": "Safe to handle: Magnetic ferrous frame scrap. Keep away from moisture to avoid rust.",
        "category": "Heavy Scrap",
        "default_quality": "medium",
    },
    "Compressors & cooling units": {
        "hazard": False,
        "safety_message": "Ensure refrigerant gas (CFC/HFC) has been safely evacuated by licensed technician.",
        "category": "Heavy Scrap",
        "default_quality": "high",
    },
    "Mixed e-waste": {
        "hazard": False,
        "safety_message": "Assorted consumer electronics. Sort into distinct bins for 2.4x higher valuation.",
        "category": "Electronics",
        "default_quality": "low",
    },
    "Newspaper": {
        "hazard": False,
        "safety_message": "Safe to handle: keep dry — wet paper is weighed down and fetches less.",
        "category": "Paper",
        "default_quality": "medium",
    },
    "Books & notebooks": {
        "hazard": False,
        "safety_message": "Safe to handle: remove plastic covers and spiral bindings for a better rate.",
        "category": "Paper",
        "default_quality": "medium",
    },
    "Cardboard": {
        "hazard": False,
        "safety_message": "Safe to handle: flatten boxes and keep them dry.",
        "category": "Paper",
        "default_quality": "medium",
    },
    "Mixed plastic": {
        "hazard": False,
        "safety_message": "Safe to handle: empty and rinse containers; keep bags and thin film separate.",
        "category": "Plastic",
        "default_quality": "medium",
    },
    "PET bottles": {
        "hazard": False,
        "safety_message": "Safe to handle: empty bottles, remove caps if possible, crush to save space.",
        "category": "Plastic",
        "default_quality": "medium",
    },
    "Stainless steel": {
        "hazard": False,
        "safety_message": "Safe to handle: watch for sharp edges on cut sheets and broken utensils.",
        "category": "Metals",
        "default_quality": "medium",
    },
}


# ─── CLIP candidate labels ───────────────────────────────────────────────────
# CLIP scores an image against each text prompt. Prompts are descriptive
# sentences because CLIP was trained on captions, not single words.

CANDIDATE_PROMPTS: List[Dict[str, str]] = [
    {"material": "Copper cable",                  "prompt": "a bundle of copper electrical wire or cable scrap"},
    {"material": "Server boards",                 "prompt": "a computer server motherboard with gold-coloured circuits"},
    {"material": "Aluminium",                     "prompt": "silver-coloured aluminium metal scrap pieces or heat sinks"},
    {"material": "Mixed e-waste",                 "prompt": "assorted broken consumer electronics piled together"},
    {"material": "Lithium-ion batteries",         "prompt": "a swollen lithium-ion battery cell or laptop battery pack"},
    {"material": "Brass fittings",                "prompt": "golden-coloured brass plumbing fittings or taps"},
    {"material": "Printed Circuit Boards (PCB)",  "prompt": "a green printed circuit board with electronic components"},
    {"material": "Electric motors",               "prompt": "a metal electric motor with copper windings visible"},
    {"material": "Iron & steel scrap",            "prompt": "rusty iron or steel metal scrap pieces"},
    {"material": "CRT & monitor glass",           "prompt": "a cathode ray tube television or old glass monitor"},
    {"material": "Lead acid batteries",           "prompt": "a large lead-acid car battery with acid caps"},
    {"material": "Compressors & cooling units",   "prompt": "a refrigerator compressor or air conditioner cooling unit"},
    {"material": "Newspaper",                     "prompt": "a stack of old folded newspapers"},
    {"material": "Books & notebooks",             "prompt": "a pile of old books and school notebooks"},
    {"material": "Cardboard",                     "prompt": "flattened brown cardboard boxes and cartons"},
    {"material": "Mixed plastic",                 "prompt": "old plastic buckets, tubs and household plastic containers"},
    {"material": "PET bottles",                   "prompt": "empty clear plastic water and soft drink bottles"},
    {"material": "Stainless steel",               "prompt": "shiny stainless steel utensils, vessels and kitchen scrap"},
]


# ─── Image decoding ──────────────────────────────────────────────────────────

MAX_IMAGE_BYTES = 8 * 1024 * 1024


def decode_image(image_base64: Optional[str] = None, image_uri: Optional[str] = None) -> Optional[bytes]:
    """Return raw image bytes from a base64 string / data URL, or a local path."""
    if image_base64:
        data = image_base64.split(",", 1)[1] if image_base64.startswith("data:") else image_base64
        try:
            raw = base64.b64decode(data, validate=False)
        except (binascii.Error, ValueError):
            return None
        return raw if 0 < len(raw) <= MAX_IMAGE_BYTES else None

    if image_uri:
        path = image_uri.replace("file://", "")
        if os.path.isfile(path) and os.path.getsize(path) <= MAX_IMAGE_BYTES:
            with open(path, "rb") as f:
                return f.read()
    return None


# ─── Local CLIP (optional) ───────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_clip():
    """Load CLIP model + processor once, cache forever."""
    from transformers import CLIPModel, CLIPProcessor  # noqa: WPS433 (optional dependency)

    model_name = "openai/clip-vit-base-patch32"
    print(f"[MHK ML] Loading local CLIP '{model_name}' (first call only)...")
    model = CLIPModel.from_pretrained(model_name)
    processor = CLIPProcessor.from_pretrained(model_name)
    model.eval()
    print("[MHK ML] Local CLIP ready.")
    return model, processor


def local_clip_installed() -> bool:
    if not settings.ENABLE_LOCAL_CLIP:
        return False
    try:
        import torch  # noqa: F401
        import transformers  # noqa: F401
    except ImportError:
        return False
    return True


def _classify_local(image_bytes: bytes) -> List[Tuple[str, float]]:
    import torch
    from PIL import Image

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    model, processor = _load_clip()
    prompts = [c["prompt"] for c in CANDIDATE_PROMPTS]
    inputs = processor(text=prompts, images=image, return_tensors="pt", padding=True)
    with torch.no_grad():
        probs = model(**inputs).logits_per_image.softmax(dim=1)[0]
    scored = [(CANDIDATE_PROMPTS[i]["material"], float(probs[i].item())) for i in range(len(prompts))]
    return sorted(scored, key=lambda x: x[1], reverse=True)


def _classify_hf(image_bytes: bytes) -> List[Tuple[str, float]]:
    by_prompt = {c["prompt"]: c["material"] for c in CANDIDATE_PROMPTS}
    results = hf_zero_shot_image(image_bytes, list(by_prompt.keys()))
    return [(by_prompt[r["label"]], float(r["score"])) for r in results if r.get("label") in by_prompt]


# ─── Public classifier ───────────────────────────────────────────────────────

class MaterialClassifier:
    def __init__(self) -> None:
        self.classes = [c["material"] for c in CANDIDATE_PROMPTS]

    def status(self) -> Dict[str, Any]:
        return {
            "backend": settings.VISION_BACKEND,
            "huggingface_api": settings.HF_VISION_MODEL if hf_available() else None,
            "local_clip": local_clip_installed(),
        }

    def classify(self, image_bytes: Optional[bytes]) -> MLMaterialPrediction:
        if not image_bytes:
            return self._fallback("No readable image received. Please retake the photo.")

        backend = settings.VISION_BACKEND
        attempts: List[Tuple[str, Any]] = []
        if backend in ("auto", "hf") and hf_available():
            attempts.append((f"huggingface:{settings.HF_VISION_MODEL}", _classify_hf))
        if backend in ("auto", "local") and local_clip_installed():
            attempts.append(("local:openai/clip-vit-base-patch32", _classify_local))

        errors: List[str] = []
        for source, fn in attempts:
            try:
                ranked = fn(image_bytes)
                if ranked:
                    return self._build(ranked, source)
            except (AIProviderError, Exception) as exc:  # any provider failure → try next
                print(f"[MHK ML] {source} failed: {exc}")
                errors.append(f"{source}: {exc}")

        if not attempts:
            return self._fallback(
                "AI vision is not configured. Add a free HF_API_TOKEN to the backend .env, "
                "or choose the material manually."
            )
        return self._fallback("AI could not analyse this photo. Please choose the material manually.")

    # Kept for scripts that pass a path.
    def classify_image(self, image_uri: str) -> MLMaterialPrediction:
        return self.classify(decode_image(image_uri=image_uri))

    def _build(self, ranked: List[Tuple[str, float]], source: str) -> MLMaterialPrediction:
        material, confidence = ranked[0]
        meta = MATERIAL_HAZARDS.get(material, MATERIAL_HAZARDS["Mixed e-waste"])
        print(f"[MHK ML] {source} → {material} ({confidence:.1%})")
        return MLMaterialPrediction(
            material=material,  # type: ignore[arg-type]
            category=meta["category"],
            quality=meta["default_quality"],
            hazard=meta["hazard"],
            confidence=round(confidence, 4),
            safety_message=meta["safety_message"],
            alternatives=[
                MaterialAlternative(material=m, confidence=round(c, 4))  # type: ignore[arg-type]
                for m, c in ranked[1:4]
            ],
            model_version=source,
            source=source.split(":", 1)[0],
        )

    def _fallback(self, message: str) -> MLMaterialPrediction:
        """Confidence=0 tells the client to ask the collector instead of trusting it."""
        meta = MATERIAL_HAZARDS["Mixed e-waste"]
        return MLMaterialPrediction(
            material="Mixed e-waste",
            category=meta["category"],
            quality="low",
            hazard=False,
            confidence=0.0,
            safety_message=message,
            alternatives=[],
            model_version="fallback",
            source="fallback",
        )


ml_classifier = MaterialClassifier()
