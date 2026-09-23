# apps/backend/routers/vision.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from models.domain import MLMaterialPrediction
from services.ml_classifier import ml_classifier

router = APIRouter(prefix="/api/v1/vision", tags=["AI Vision & ML Inference"])


class ImageAnalyzeRequest(BaseModel):
    imageUri: str


@router.post("/analyze", response_model=MLMaterialPrediction)
def analyze_material_image(request: ImageAnalyzeRequest):
    """
    Real zero-shot image classification using OpenAI CLIP (ViT-B/32).
    Runs locally on the backend. No API key. No training. Free forever.

    First request after server start downloads ~600 MB of model weights.
    """
    try:
        return ml_classifier.classify_image(request.imageUri)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Vision inference failed: {exc}")