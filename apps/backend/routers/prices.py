from fastapi import APIRouter, Query
from typing import List, Dict, Any
from models.domain import PriceForecastResponse, MaterialType
from services.price_forecaster import generate_arima_forecast, BASE_PRICES

router = APIRouter(prefix="/api/v1/prices", tags=["Market Intelligence & Pricing"])

@router.get("/daily")
def get_daily_spot_prices():
    """Returns today's daily mandi spot prices across all 12 scrap categories."""
    rates = []
    for mat, price in BASE_PRICES.items():
        rates.append({
            "material": mat,
            "current_price": price,
            "unit": "INR/kg",
            "demand": "HIGH" if mat in ["Copper cable", "Server boards", "Lithium-ion batteries"] else "MODERATE",
            "trend": "up" if mat in ["Copper cable", "Server boards", "Lithium-ion batteries", "Aluminium"] else "stable"
        })
    return {"zone": "Pune MIDC Cluster", "currency": "INR", "prices": rates}

@router.get("/forecast", response_model=PriceForecastResponse)
def get_arima_price_forecast(
    material: MaterialType = Query("Copper cable", description="Material to forecast"),
    zone: str = Query("Pune MIDC", description="Geographic industrial scrap zone")
):
    """
    Runs ARIMA time-series prediction to forecast commodity price movements 7 days ahead.
    """
    return generate_arima_forecast(material=material, zone=zone)
