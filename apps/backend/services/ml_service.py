# apps/backend/services/ml_service.py
"""
Lightweight, explainable ML — valuation + demand prediction.

Valuation: fair_price = avg_recycler_price × quality_mult × volume_mult
Demand prediction: time-weighted moving average with trend label.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import List

from sqlalchemy.orm import Session

from db import DemandRow, RecyclerRow
from models.domain import (
    DemandPredictionPoint,
    DemandPredictionResponse,
    MaterialType,
    QualityLevel,
    ValuationResponse,
)


QUALITY_MULT = {"low": 0.72, "medium": 1.00, "high": 1.28}

VOLUME_CURVE = [
    (1, 0.90), (10, 0.96), (50, 1.00), (200, 1.05), (1000, 1.10),
]


def _volume_multiplier(weight_kg: float) -> float:
    prev_w, prev_m = VOLUME_CURVE[0]
    if weight_kg <= prev_w:
        return prev_m
    for w, m in VOLUME_CURVE[1:]:
        if weight_kg <= w:
            frac = (weight_kg - prev_w) / (w - prev_w)
            return prev_m + frac * (m - prev_m)
        prev_w, prev_m = w, m
    return VOLUME_CURVE[-1][1]


def _avg_recycler_price(db: Session, material: str) -> float:
    prices: List[float] = []
    for r in db.query(RecyclerRow).filter(RecyclerRow.is_active == 1).all():
        try:
            p = json.loads(r.prices_json).get(material)
            if p:
                prices.append(float(p))
        except Exception:
            continue
    return sum(prices) / len(prices) if prices else 0.0


def valuate(
    db: Session,
    material: MaterialType,
    quality: QualityLevel,
    weight_kg: float,
) -> ValuationResponse:
    base = _avg_recycler_price(db, material)
    if base <= 0:
        return ValuationResponse(
            material=material, weight_kg=weight_kg, quality=quality,
            fair_price_per_kg=0.0, fair_payout=0.0, confidence=0.0,
            reasoning=f"No active recyclers listing {material}.",
        )

    q = QUALITY_MULT[quality]
    v = _volume_multiplier(weight_kg)
    fair_per_kg = base * q * v
    payout = fair_per_kg * weight_kg

    conf = 0.88 if 10 <= weight_kg <= 200 else (0.72 if weight_kg < 10 else 0.80)

    return ValuationResponse(
        material=material, weight_kg=weight_kg, quality=quality,
        fair_price_per_kg=round(fair_per_kg, 1),
        fair_payout=round(payout, 1),
        confidence=round(conf, 2),
        reasoning=(
            f"Market avg ₹{base:.0f}/kg × quality {quality} (×{q:.2f}) "
            f"× volume {weight_kg}kg (×{v:.2f}) = ₹{fair_per_kg:.1f}/kg"
        ),
    )


def _demand_ma(db: Session, material: str) -> tuple[float, float]:
    rows = db.query(DemandRow).filter(DemandRow.material == material).all()
    if not rows:
        return 0.0, 0.0
    current = sum(max(0.0, r.quantity_kg - r.filled_kg) for r in rows)
    now = datetime.utcnow()
    weighted = 0.0; wsum = 0.0
    for r in rows:
        age = max(0.0, (now - r.created_at).total_seconds() / 86400.0)
        w = 1.0 / (1.0 + age / 7.0)
        weighted += r.quantity_kg * w
        wsum += w
    avg = weighted / wsum if wsum > 0 else 0.0
    predicted = max(current, avg)
    return round(current, 1), round(predicted, 1)


def predict_demand(db: Session) -> DemandPredictionResponse:
    materials = [
        "Copper cable", "Server boards", "Aluminium", "Mixed e-waste",
        "Lithium-ion batteries", "Brass fittings", "Printed Circuit Boards (PCB)",
        "Electric motors", "Iron & steel scrap",
    ]
    points: List[DemandPredictionPoint] = []
    for mat in materials:
        current, predicted = _demand_ma(db, mat)
        if predicted > current * 1.15:
            trend = "up"
        elif predicted < current * 0.85:
            trend = "down"
        else:
            trend = "stable"
        count = db.query(DemandRow).filter(DemandRow.material == mat).count()
        conf = min(0.95, 0.55 + count * 0.05)
        points.append(DemandPredictionPoint(
            material=mat, current_open_kg=current,
            predicted_kg_next_7d=predicted, trend=trend,
            confidence=round(conf, 2),
        ))
    return DemandPredictionResponse(
        generated_at=datetime.utcnow().isoformat(),
        points=points,
    )