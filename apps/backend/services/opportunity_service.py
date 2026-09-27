# apps/backend/services/opportunity_service.py
"""
Opportunity Engine — "what should I collect, where, and when?"
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import List

from sqlalchemy.orm import Session

from db import DemandRow, RecyclerRow
from services import market_price_service
from models.domain import OpportunityFeedResponse, OpportunityItem


MATERIALS_FOR_OPPORTUNITY = [
    "Copper cable",
    "Server boards",
    "Aluminium",
    "Mixed e-waste",
    "Lithium-ion batteries",
    "Brass fittings",
    "Printed Circuit Boards (PCB)",
    "Electric motors",
    "Iron & steel scrap",
    "Newspaper",
    "Mixed plastic",
    "PET bottles",
    "Cardboard",
]


def _avg_listed_price_for_material(db: Session, material: str) -> float:
    rows = db.query(RecyclerRow).filter(RecyclerRow.is_active == 1).all()
    prices = []
    for r in rows:
        try:
            p = market_price_service.buyer_prices(db, r).get(material)
            if p:
                prices.append(float(p))
        except Exception:
            continue
    return sum(prices) / len(prices) if prices else 0.0


def _best_net_price_for_material(db: Session, material: str, weight_kg: float) -> float:
    rows = db.query(RecyclerRow).filter(RecyclerRow.is_active == 1).all()
    best_net_per_kg = 0.0
    for r in rows:
        try:
            listed = float(market_price_service.buyer_prices(db, r).get(material) or 0.0)
        except Exception:
            listed = 0.0
        if listed <= 0:
            continue
        gross = listed * weight_kg
        fees = r.pickup_base_cost + r.handling_cost + r.platform_fee
        net = max(0.0, gross - fees) / max(1.0, weight_kg)
        best_net_per_kg = max(best_net_per_kg, net)
    return best_net_per_kg


def _open_demand_stats(db: Session, material: str) -> tuple[float, int]:
    rows = (
        db.query(DemandRow)
        .filter(DemandRow.material == material)
        .filter(DemandRow.status.in_(["OPEN", "PARTIAL"]))
        .all()
    )
    total_kg = 0.0
    count = 0
    for r in rows:
        remaining = max(0.0, r.quantity_kg - r.filled_kg)
        if remaining > 0:
            total_kg += remaining
            count += 1
    return total_kg, count


def generate_feed(db: Session, location_label: str = "Pune Bhosari Cluster") -> OpportunityFeedResponse:
    """
    Rank materials by opportunity.
    Score = demand_pull * 0.5 + price_strength * 0.3 + market_liquidity * 0.2
    """
    raw = []
    for mat in MATERIALS_FOR_OPPORTUNITY:
        avg_price = _avg_listed_price_for_material(db, mat)
        best_net = _best_net_price_for_material(db, mat, weight_kg=35.0)
        demand_kg, demand_count = _open_demand_stats(db, mat)
        raw.append({
            "material": mat,
            "avg_price": avg_price,
            "best_net": best_net,
            "demand_kg": demand_kg,
            "demand_count": demand_count,
        })

    max_demand = max((r["demand_kg"] for r in raw), default=1.0) or 1.0
    max_price = max((r["avg_price"] for r in raw), default=1.0) or 1.0
    max_demand_count = max((r["demand_count"] for r in raw), default=1) or 1

    items: List[OpportunityItem] = []
    for r in raw:
        if r["avg_price"] <= 0:
            continue

        demand_pull = (r["demand_kg"] / max_demand) * 100
        price_strength = (r["avg_price"] / max_price) * 100
        liquidity = (r["demand_count"] / max_demand_count) * 100

        score = demand_pull * 0.5 + price_strength * 0.3 + liquidity * 0.2

        reasons = []
        if r["demand_count"] > 0:
            reasons.append(
                f"{r['demand_count']} open buyer{'s' if r['demand_count'] > 1 else ''} · "
                f"{r['demand_kg']:.0f}kg needed"
            )
        if r["best_net"] > r["avg_price"] * 0.9:
            reasons.append("High net take-home after pickup")
        if r["avg_price"] >= max_price * 0.8:
            reasons.append("Top-tier price bracket")

        rec_weight = 35.0
        if r["demand_kg"] > 0:
            rec_weight = min(35.0, max(5.0, r["demand_kg"] / max(1, r["demand_count"])))
        expected = r["best_net"] * rec_weight

        items.append(OpportunityItem(
            material=r["material"],  # type: ignore[arg-type]
            opportunity_score=round(score, 1),
            avg_listed_price_per_kg=round(r["avg_price"], 1),
            best_net_per_kg=round(r["best_net"], 1),
            demand_kg_open=round(r["demand_kg"], 1),
            active_demand_count=r["demand_count"],
            recommended_weight_kg=round(rec_weight, 1),
            expected_payout=round(expected, 1),
            reasoning=" · ".join(reasons) or "Steady local demand",
        ))

    items.sort(key=lambda x: x.opportunity_score, reverse=True)

    return OpportunityFeedResponse(
        generated_at=datetime.utcnow().isoformat(),
        location_label=location_label,
        items=items,
    )