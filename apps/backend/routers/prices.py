from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from db import get_db
from models.domain import MaterialType, PriceForecastResponse
from services import market_price_service as mps
from services.ml_classifier import MATERIAL_HAZARDS
from services.price_forecaster import BASE_PRICES, generate_arima_forecast

router = APIRouter(prefix="/api/v1/prices", tags=["Market Intelligence & Pricing"])

DEFAULT_LAT, DEFAULT_LON = 18.5204, 73.8567  # Pune


def _trend(history, current) -> tuple:
    prev = history[-2] if len(history) >= 2 else current
    change = round((current - prev) / prev * 100, 2) if prev else 0.0
    return prev, change, "up" if change > 0.3 else "down" if change < -0.3 else "stable"


@router.get("/daily")
def get_daily_spot_prices(
    latitude: Optional[float] = Query(None, description="Where the prices are for (default: Pune)"),
    longitude: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Today's price for every material at this location:
    market value (live metals exchange or city rate card) × (1 + nearby-industry premium).
    `current_price` is the dealer-level price a kabadiwala can sell at; `doorstep_price` is what a household gets.
    """
    lat = latitude if latitude is not None else DEFAULT_LAT
    lon = longitude if longitude is not None else DEFAULT_LON
    snap, mode = mps.market()
    factor = mps.doorstep_factor()
    rates = []
    for mat in BASE_PRICES:
        market, basis, history = mps.market_price(mat, snap, mode, lat, lon)
        premium, reasons = mps.local_premium(db, mat, lat, lon)
        local = mps._round(market * (1 + premium / 100))
        local_history = [mps._round(h * (1 + premium / 100)) for h in history[-7:]]
        prev, change, trend = _trend(local_history, local)
        rates.append({
            "material": mat,
            "category": MATERIAL_HAZARDS.get(mat, {}).get("category", "Other"),
            "current_price": local,
            "previous_price": prev,
            "change_percent": change,
            "trend": trend,
            "market_price": market,
            "local_premium_pct": premium,
            "premium_reasons": reasons,
            "doorstep_price": mps._round(local * factor),
            "basis": basis,
            "source": mps.price_source(mat, lat, lon),
            "history_7d": local_history,
            "demand": "HIGH" if premium >= 8 else "MODERATE" if premium >= 3 else "LOW",
            "unit": "INR/kg",
        })
    return {
        "location": {"latitude": lat, "longitude": lon},
        "currency": "INR",
        "market": {"mode": mode, "fetched_at": snap["fetched_at"] if snap else None, "usd_inr": snap["fx"] if snap else None,
                   "exchange_source": mps.config()["source"]["name"],
                   "rate_card_source": mps.rate_cards().get("source", {})},
        "prices": rates,
    }


@router.get("/market")
def get_market_quotes():
    """Raw exchange quotes behind the metal prices (₹ per kg, or ₹ per gram for precious metals)."""
    snap, mode = mps.market()
    return {"mode": mode, "fetched_at": snap["fetched_at"] if snap else None, "usd_inr": snap["fx"] if snap else None,
            "quotes": snap["quotes"] if snap else {}, "source": mps.config()["source"]}


@router.get("/forecast", response_model=PriceForecastResponse)
def get_arima_price_forecast(
    material: MaterialType = Query("Copper cable", description="Material to forecast"),
    zone: str = Query("Pune MIDC", description="Geographic industrial scrap zone")
):
    """7-day outlook starting from today's market price (the forecast curve itself is simulated)."""
    return generate_arima_forecast(material=material, zone=zone)
