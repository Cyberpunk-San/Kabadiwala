"""
Price history and ARIMA forecasting.

History lives in the `price_history` table: 90 days of clearly-labelled demo observations are seeded on first run
(source="seed_demo"), and every day the real market price is recorded (source="market_live"), so the series becomes
real over time. The forecast fits ARIMA(2,1,1) to that history and applies the predicted path to *today's* market
price (services/market_price_service.py), so it starts where the live price is even while the history is still
mostly demo data. Too little history → a simple drift outlook, clearly labelled.
"""

import hashlib
import warnings
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from db import PriceHistoryRow
from models.domain import MaterialType, PriceForecastPoint, PriceForecastResponse, PriceHistoryPoint

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
    "Stainless steel": 57.1,
    "Stainless steel": 57.1,
}
ZONE_MULTIPLIERS: Dict[str, float] = {"Pune MIDC": 1.00, "Mumbai Dharavi": 1.02, "Delhi Mayapuri": 1.03, "Bengaluru Peenya": 0.99}
MIN_HISTORY = 14
LIVE_ZONE = "Pune MIDC"                 # where the daily live observation is recorded
PUNE = (18.5204, 73.8567)


def list_history(db: Session, material: MaterialType, zone: str, days: int = 90) -> List[PriceHistoryPoint]:
    since = datetime.utcnow() - timedelta(days=days)
    rows = (db.query(PriceHistoryRow)
            .filter(PriceHistoryRow.material == material, PriceHistoryRow.zone == zone, PriceHistoryRow.observed_at >= since)
            .order_by(PriceHistoryRow.observed_at.asc()).all())
    return [PriceHistoryPoint(date=r.observed_at.strftime("%Y-%m-%d"), price=round(r.price_per_kg, 2), source=r.source) for r in rows]


def record_live_prices(db: Session, prices: Dict[str, float], zone: str = LIVE_ZONE) -> int:
    """Store today's market price once per material/day (source='market_live'). Returns rows added."""
    today = datetime.utcnow().date()
    start = datetime(today.year, today.month, today.day)
    have = {m for (m,) in db.query(PriceHistoryRow.material).filter(
        PriceHistoryRow.zone == zone, PriceHistoryRow.source == "market_live", PriceHistoryRow.observed_at >= start).all()}
    added = 0
    for material, price in prices.items():
        if material in have or not price:
            continue
        db.add(PriceHistoryRow(id=f"ph_live_{today.isoformat()}_{zone[:3]}_{hashlib.sha1(material.encode()).hexdigest()[:10]}", material=material, zone=zone,
                               price_per_kg=float(price), observed_at=datetime.utcnow(), source="market_live"))
        added += 1
    if added:
        db.commit()
    return added


def _drift_path(current: float, material: str, horizon: int) -> List[tuple]:
    """Fallback outlook when history is too short: small drift with a ±3.5% band."""
    drift = 0.008 if material in ("Copper cable", "Server boards", "Lithium-ion batteries") else 0.002
    out, running = [], current
    for d in range(1, horizon + 1):
        running = running * (1.0 + drift + ((-1) ** d) * 0.012 * 0.4)
        out.append((running, running * 0.965, running * 1.035))
    return out


def _arima_path(values: List[float], horizon: int) -> List[tuple]:
    """ARIMA(2,1,1) forecast as ratios to the last observation: (mean, lower, upper) for each day ahead."""
    from statsmodels.tsa.arima.model import ARIMA  # imported lazily: statsmodels is slow to import
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fitted = ARIMA(values, order=(2, 1, 1), enforce_stationarity=False, enforce_invertibility=False).fit()
        forecast = fitted.get_forecast(steps=horizon)
    mean, interval = forecast.predicted_mean, forecast.conf_int(alpha=0.20)
    last = values[-1]
    return [(float(mean[i]) / last, max(0.0, float(interval[i][0])) / last, float(interval[i][1]) / last) for i in range(horizon)]


def generate_arima_forecast(db: Optional[Session], material: MaterialType, zone: str = "Pune MIDC", horizon: int = 7) -> PriceForecastResponse:
    from services.market_price_service import market_price  # local import: market service imports BASE_PRICES
    current = round((market_price(material, lat=PUNE[0], lon=PUNE[1])[0] or BASE_PRICES.get(material, 100.0)) * ZONE_MULTIPLIERS.get(zone, 1.0), 1)
    history = list_history(db, material, zone, days=180) if db is not None else []
    values = [p.price for p in history]

    points: List[PriceForecastPoint] = []
    if len(values) >= MIN_HISTORY:
        try:
            ratios = _arima_path(values, horizon)
            path = [(current * m, current * lo, current * hi) for m, lo, hi in ratios]
            live_days = sum(1 for p in history if p.source == "market_live")
            model = f"ARIMA(2,1,1) on {len(values)} days of price history ({live_days} live), anchored to today's market price"
        except Exception:  # noqa: BLE001 — a failed fit falls back rather than erroring the screen
            path, model = _drift_path(current, material, horizon), "Drift outlook (ARIMA fit failed)"
    else:
        path, model = _drift_path(current, material, horizon), f"Drift outlook (only {len(values)} days of history; ARIMA needs {MIN_HISTORY})"

    today = datetime.utcnow()
    for i, (mean, low, high) in enumerate(path):
        pred = round(mean, 2)
        lower = round(max(0.0, low), 2)
        upper = round(max(lower, high), 2)
        trend = "up" if pred > current * 1.005 else "down" if pred < current * 0.995 else "stable"
        points.append(PriceForecastPoint(date=(today + timedelta(days=i + 1)).strftime("%Y-%m-%d"), forecast_price=pred,
                                         lower_ci=lower, upper_ci=upper, trend=trend))
    pct_change = round(((points[-1].forecast_price - current) / current) * 100, 1)
    return PriceForecastResponse(
        material=material, zone=zone, current_price=current, model_type=model, forecast_7_days=points,
        advice=f"Projected {pct_change:+.1f}% over {horizon} days. Use the confidence band before deciding when to sell in {zone}.",
    )
