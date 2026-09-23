"""Database-backed price history and ARIMA forecasting."""
from datetime import datetime, timedelta
from typing import Dict, List
from sqlalchemy.orm import Session
from statsmodels.tsa.arima.model import ARIMA
from db import PriceHistoryRow
from models.domain import PriceForecastResponse, PriceForecastPoint, PriceHistoryPoint, MaterialType

BASE_PRICES: Dict[str, float] = {
    "Copper cable": 620.0, "Server boards": 510.0, "Aluminium": 145.0,
    "Brass fittings": 430.0, "Printed Circuit Boards (PCB)": 340.0,
    "Electric motors": 195.0, "Lithium-ion batteries": 280.0,
    "Iron & steel scrap": 38.0, "Lead acid batteries": 98.0,
    "CRT & monitor glass": 18.0, "Compressors & cooling units": 165.0,
    "Mixed e-waste": 85.0,
}
ZONE_MULTIPLIERS = {"Pune MIDC": 1.00, "Mumbai Dharavi": 1.02, "Delhi Mayapuri": 1.03, "Bengaluru Peenya": 0.99}

def list_history(db: Session, material: MaterialType, zone: str, days: int = 90) -> List[PriceHistoryPoint]:
    since = datetime.utcnow() - timedelta(days=days)
    rows = (db.query(PriceHistoryRow).filter(
        PriceHistoryRow.material == material, PriceHistoryRow.zone == zone,
        PriceHistoryRow.observed_at >= since).order_by(PriceHistoryRow.observed_at.asc()).all())
    return [PriceHistoryPoint(date=r.observed_at.strftime("%Y-%m-%d"), price=round(r.price_per_kg, 2), source=r.source) for r in rows]

def generate_arima_forecast(db: Session, material: MaterialType, zone: str = "Pune MIDC", horizon: int = 7) -> PriceForecastResponse:
    history = list_history(db, material, zone, days=180)
    values = [point.price for point in history]
    if len(values) < 14:
        raise ValueError(f"Not enough price history for {material} in {zone}")
    fitted = ARIMA(values, order=(2, 1, 1), enforce_stationarity=False, enforce_invertibility=False).fit()
    forecast = fitted.get_forecast(steps=horizon)
    mean, interval = forecast.predicted_mean, forecast.conf_int(alpha=0.20)
    current_price = values[-1]
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
