# apps/backend/routers/ml.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from models.domain import (
    DemandPredictionResponse,
    ValuationRequest,
    ValuationResponse,
)
from services import ml_service

router = APIRouter(prefix="/api/v1/ml", tags=["AI / ML"])


@router.post("/valuation", response_model=ValuationResponse)
def get_valuation(req: ValuationRequest, db: Session = Depends(get_db)):
    """Fair-price estimate for a lot — no external API, deterministic math."""
    return ml_service.valuate(db, req.material, req.quality, req.weight_kg)


@router.get("/demand-prediction", response_model=DemandPredictionResponse)
def get_demand_prediction(db: Session = Depends(get_db)):
    """7-day demand projection per material — moving average with trend label."""
    return ml_service.predict_demand(db)