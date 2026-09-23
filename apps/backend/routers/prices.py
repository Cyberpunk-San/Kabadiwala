from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from db import get_db
from models.domain import PriceForecastResponse, PriceHistoryPoint, MaterialType
from services.price_forecaster import generate_arima_forecast, list_history, BASE_PRICES

router = APIRouter(prefix="/api/v1/prices", tags=["Market Intelligence & Pricing"])

@router.get("/daily")
def get_daily_spot_prices(db: Session = Depends(get_db)):
    """Returns the latest database-backed observation for each material."""
    rates = []
    for mat, price in BASE_PRICES.items():
        history = list_history(db, material=mat, zone="Pune MIDC", days=365)
        current_price = history[-1].price if history else price
        previous_price = history[-2].price if len(history) > 1 else current_price
        change = round(((current_price - previous_price) / previous_price) * 100, 2) if previous_price else 0
        rates.append({
            "material": mat,
            "current_price": current_price,
            "unit": "INR/kg",
            "demand": "HIGH" if mat in ["Copper cable", "Server boards", "Lithium-ion batteries"] else "MODERATE",
            "previous_price": previous_price,
            "change_percent": change,
            "trend": "up" if change > 0.5 else "down" if change < -0.5 else "stable",
        })
    return {"zone": "Pune MIDC Cluster", "currency": "INR", "prices": rates}

@router.get("/forecast", response_model=PriceForecastResponse)
def get_arima_price_forecast(
    material: MaterialType = Query("Copper cable", description="Material to forecast"),
    zone: str = Query("Pune MIDC", description="Geographic industrial scrap zone"),
    horizon: int = Query(7, ge=7, le=30),
    db: Session = Depends(get_db),
):
    """
    Runs ARIMA time-series prediction to forecast commodity price movements 7 days ahead.
    """
    return generate_arima_forecast(db=db, material=material, zone=zone, horizon=horizon)


@router.get("/history", response_model=List[PriceHistoryPoint])
def get_price_history(
    material: MaterialType = Query("Copper cable"),
    zone: str = Query("Pune MIDC"),
    days: int = Query(90, ge=7, le=365),
    db: Session = Depends(get_db),
):
    return list_history(db=db, material=material, zone=zone, days=days)
