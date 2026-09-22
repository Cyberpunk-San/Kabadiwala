from fastapi import APIRouter
from pydantic import BaseModel
from models.domain import MLMaterialPrediction
from services.ml_classifier import ml_classifier

router = APIRouter(prefix="/api/v1/vision", tags=["AI Vision & ML Inference"])

class ImageAnalyzeRequest(BaseModel):
    imageUri: str

@router.post("/analyze", response_model=MLMaterialPrediction)
def analyze_material_image(request: ImageAnalyzeRequest):
    """
    Simulates MobileNetV3 edge/cloud inference on photographed e-waste items.
    Detects material class, hazard risk, bounding box, and automatic voice prompt text.
    """
    return ml_classifier.classify_image(request.imageUri)
