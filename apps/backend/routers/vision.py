# apps/backend/routers/vision.py
from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool

from models.domain import ImageAnalyzeRequest, MLMaterialPrediction
from services.ml_classifier import decode_image, ml_classifier

router = APIRouter(prefix="/api/v1/vision", tags=["AI Vision & ML Inference"])


@router.post("/analyze", response_model=MLMaterialPrediction)
async def analyze_material_image(request: ImageAnalyzeRequest):
    """
    Zero-shot e-waste classification. Send the photo as base64 in `image_base64`.

    Tries the free Hugging Face Inference API, then local CLIP, then returns a
    confidence-0 fallback (never a 500) so the app can ask the collector.
    """
    image_bytes = decode_image(request.image_base64, request.imageUri)
    # Model calls block (HTTP / torch) — keep them off the event loop.
    return await run_in_threadpool(ml_classifier.classify, image_bytes)


@router.get("/status")
def vision_status():
    """Which vision providers are configured right now."""
    return ml_classifier.status()
