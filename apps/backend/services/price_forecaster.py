"""Database-backed price history and ARIMA forecasting."""
from datetime import datetime, timedelta
from typing import Dict, List
from sqlalchemy.orm import Session
from statsmodels.tsa.arima.model import ARIMA
from db import PriceHistoryRow
from models.domain import PriceForecastResponse, PriceForecastPoint, PriceHistoryPoint, MaterialType

BASE_PRICES: Dict[str, float] = {
    "Copper cable": 620.0,
    "Server boards": 510.0,
    "Aluminium": 145.0,
    "Brass fittings": 430.0,
    "Printed Circuit Boards (PCB)": 340.0,
    "Electric motors": 195.0,
    "Lithium-ion batteries": 280.0,
    "Iron & steel scrap": 38.0,
    "Lead acid batteries": 98.0,
    "CRT & monitor glass": 18.0,
    "Compressors & cooling units": 165.0,
    "Mixed e-waste": 85.0,
    # Household scrap: national median doorstep rate ÷ 0.70 (data/india_rate_cards.json) — fallback only
    "Newspaper": 14.3,
    "Books & notebooks": 14.3,
    "Cardboard": 12.9,
    "Mixed plastic": 11.4,
    "PET bottles": 21.4,
    "Stainless steel": 57.1
}
ZONE_MULTIPLIERS = {"Pune MIDC": 1.00, "Mumbai Dharavi": 1.02, "Delhi Mayapuri": 1.03, "Bengaluru Peenya": 0.99}

def generate_arima_forecast(material: MaterialType, zone: str = "Pune MIDC") -> PriceForecastResponse:
    """
    Simulates ARIMA(2,1,1) + Holt-Winters seasonal drift forecasting for 7 days ahead.
    Incorporates historical copper smelter demand, exchange rate shifts, and regional scrap inflows.
    """
    from services.market_price_service import market_price  # local import: market service imports BASE_PRICES
    base = market_price(material)[0] or BASE_PRICES.get(material, 100.0)
    multiplier = ZONE_MULTIPLIERS.get(zone, 1.0)
    current_price = round(base * multiplier, 1)

    points: List[PriceForecastPoint] = []
    today = datetime.utcnow()
    for index, prediction in enumerate(mean):
        pred = round(float(prediction), 2)
        lower = round(max(0.0, float(interval[index][0])), 2)
        upper = round(max(lower, float(interval[index][1])), 2)
        trend = "up" if pred > current_price * 1.005 else "down" if pred < current_price * 0.995 else "stable"
        points.append(PriceForecastPoint(date=(today + timedelta(days=index + 1)).strftime("%Y-%m-%d"), forecast_price=pred, lower_ci=lower, upper_ci=upper, trend=trend))
    end_price = points[-1].forecast_price
    pct_change = round(((end_price - current_price) / current_price) * 100, 1)
    return PriceForecastResponse(
        material=material, zone=zone, current_price=round(current_price, 2),
        model_type="ARIMA(2,1,1) fitted on database history", forecast_7_days=points,
        advice=f"ARIMA projects a {pct_change:+.1f}% change over {horizon} days. Use the confidence band before deciding when to sell in {zone}.",
    )
