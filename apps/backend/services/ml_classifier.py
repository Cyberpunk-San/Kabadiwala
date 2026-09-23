# apps/backend/services/ml_classifier.py
"""
Real zero-shot image classification using OpenAI CLIP (ViT-B/32).

This replaces the previous filename-keyword stub. CLIP is an open-source
vision-language model that classifies images into ANY set of text labels
you give it — no training required.

First run downloads ~600 MB of model weights to ~/.cache/huggingface/
Subsequent runs are fast (~1–2 s per image on CPU).
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Any, Dict, List

from models.domain import MLMaterialPrediction


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
]


# ─── Lazy model loading ──────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _load_clip():
    """Load CLIP model + processor once, cache forever."""
    try:
        import torch  # noqa: F401
        from transformers import CLIPModel, CLIPProcessor
    except ImportError as exc:
        raise RuntimeError(
            "CLIP dependencies missing. Run:\n"
            "  pip install torch --index-url https://download.pytorch.org/whl/cpu\n"
            "  pip install transformers pillow"
        ) from exc

    model_name = "openai/clip-vit-base-patch32"
    print(f"[MHK ML] Loading CLIP model '{model_name}' (first call only)...")

    model = CLIPModel.from_pretrained(model_name)
    processor = CLIPProcessor.from_pretrained(model_name)
    model.eval()

    print("[MHK ML] CLIP model ready.")
    return model, processor


# ─── Public classifier ───────────────────────────────────────────────────────

class CLIPMaterialClassifier:
    """
    Zero-shot e-waste material classifier using OpenAI CLIP.
    """

    def __init__(self):
        self.model_version = "openai/clip-vit-base-patch32 (zero-shot)"
        self.classes = [c["material"] for c in CANDIDATE_PROMPTS]

    def classify_image(self, image_uri: str) -> MLMaterialPrediction:
        try:
            from PIL import Image
        except ImportError as exc:
            raise RuntimeError("Pillow is required. Run: pip install pillow") from exc

        # Accept both "file:///C:/..." and "C:/..." paths
        path = image_uri.replace("file://", "")

        if not os.path.exists(path):
            print(f"[MHK ML] Image path not found: {path} — returning safe default.")
            return self._fallback_prediction()

        try:
            image = Image.open(path).convert("RGB")
        except Exception as exc:
            print(f"[MHK ML] Failed to open image '{path}': {exc}")
            return self._fallback_prediction()

        try:
            import torch
            model, processor = _load_clip()

            prompts = [c["prompt"] for c in CANDIDATE_PROMPTS]
            inputs = processor(
                text=prompts,
                images=image,
                return_tensors="pt",
                padding=True,
            )

            with torch.no_grad():
                outputs = model(**inputs)
                probs = outputs.logits_per_image.softmax(dim=1)[0]

            best_idx = int(torch.argmax(probs).item())
            confidence = float(probs[best_idx].item())
            material_name = CANDIDATE_PROMPTS[best_idx]["material"]

            print(
                f"[MHK ML] CLIP classified '{os.path.basename(path)}' as "
                f"'{material_name}' ({confidence:.2%})"
            )

        except Exception as exc:
            print(f"[MHK ML] CLIP inference failed: {exc}")
            return self._fallback_prediction()

        meta = MATERIAL_HAZARDS.get(material_name, MATERIAL_HAZARDS["Mixed e-waste"])

        return MLMaterialPrediction(
            material=material_name,  # type: ignore[arg-type]
            category=meta["category"],
            quality=meta["default_quality"],
            hazard=meta["hazard"],
            confidence=round(confidence, 4),
            safety_message=meta["safety_message"],
            bounding_box=None,
            model_version=self.model_version,
        )

    def _fallback_prediction(self) -> MLMaterialPrediction:
        """Safe default if image can't be loaded. Confidence=0.0 so callers know."""
        meta = MATERIAL_HAZARDS["Mixed e-waste"]
        return MLMaterialPrediction(
            material="Mixed e-waste",
            category=meta["category"],
            quality="low",
            hazard=False,
            confidence=0.0,
            safety_message="Could not analyse image. Please retake photo in clear light.",
            bounding_box=None,
            model_version=self.model_version + " (fallback)",
        )


ml_classifier = CLIPMaterialClassifier()