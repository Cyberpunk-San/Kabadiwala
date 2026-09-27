# apps/backend/services/insights_service.py
"""
Business intelligence for one kabadiwala: how well did they sell, and what should they do next?

"Fair" for a sale = the net ₹/kg the best offer on the platform would pay *today* for the
same material, weight and location (after pickup/handling/platform costs), so it is
compared like-for-like with the net amount the collector actually received.

Suggestions are returned as codes + params; the app turns them into sentences in the
collector's language.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from db import CollectorRow, DemandRow, HandoverRow, LotRow
from models.domain import (
    CollectorInsights,
    InsightMaterial,
    InsightRecycler,
    InsightSuggestion,
    InsightWeekday,
    UnderpricedSale,
)
from services import recycler_service

DEFAULT_LAT, DEFAULT_LON = 18.6279, 73.8488  # Pune Bhosari cluster
UNDERPRICED_BELOW = 0.90   # sold for < 90% of today's best net ⇒ flagged
SWITCH_GAIN_MIN = 0.05     # suggest another buyer only if it paid ≥5% more per kg
SMALL_LOT_KG = 10.0        # lots below this are worth pooling
STALE_DAYS = 7             # unsold stock older than this ⇒ "sell it"
UNSOLD = ("DRAFT", "IDENTIFIED", "AVAILABLE", "MATCHED", "PICKUP_SCHEDULED")
WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _best_net_per_kg(db: Session, material: str, weight_kg: float, lat: float, lon: float) -> Optional[float]:
    offers = recycler_service.match_recyclers_spatially(db, lat, lon, material, weight_kg=max(weight_kg, 1.0))
    if not offers:
        return None
    return max(o.net_earnings for o in offers) / max(weight_kg, 1.0)


def collector_insights(db: Session, collector_id: str) -> Optional[CollectorInsights]:
    collector = db.query(CollectorRow).filter(CollectorRow.id == collector_id).first()
    if not collector:
        return None
    home_lat = collector.latitude or DEFAULT_LAT
    home_lon = collector.longitude or DEFAULT_LON

    lots = db.query(LotRow).filter(LotRow.collector_id == collector_id).all()
    lot_by_id = {l.id: l for l in lots}
    handovers = db.query(HandoverRow).filter(HandoverRow.lot_id.in_(lot_by_id.keys())).all() if lots else []

    # ── Sales vs today's best net price
    fair_cache: Dict[tuple, Optional[float]] = {}
    underpriced: List[UnderpricedSale] = []
    by_material: Dict[str, Dict[str, float]] = defaultdict(lambda: {"kg": 0.0, "earned": 0.0, "fair": 0.0, "sales": 0})
    by_recycler: Dict[str, Dict] = defaultdict(lambda: {"name": "", "kg": 0.0, "earned": 0.0, "sales": 0, "materials": defaultdict(lambda: [0.0, 0.0])})
    total_earned = total_kg = total_fair = 0.0

    for h in handovers:
        lot = lot_by_id[h.lot_id]
        kg = h.audited_weight_kg or lot.weight_kg
        if kg <= 0:
            continue
        per_kg = h.amount_paid / kg
        lat, lon = lot.latitude or home_lat, lot.longitude or home_lon
        key = (lot.material, round(kg), round(lat, 2), round(lon, 2))
        if key not in fair_cache:
            fair_cache[key] = _best_net_per_kg(db, lot.material, kg, lat, lon)
        fair = fair_cache[key]

        total_earned += h.amount_paid
        total_kg += kg
        total_fair += (fair or per_kg) * kg
        m = by_material[lot.material]
        m["kg"] += kg
        m["earned"] += h.amount_paid
        m["fair"] += (fair or per_kg) * kg
        m["sales"] += 1
        r = by_recycler[h.recycler_id]
        r["name"] = h.recycler_name or h.recycler_id
        r["kg"] += kg
        r["earned"] += h.amount_paid
        r["sales"] += 1
        r["materials"][lot.material][0] += kg
        r["materials"][lot.material][1] += h.amount_paid

        if fair and per_kg < UNDERPRICED_BELOW * fair:
            underpriced.append(UnderpricedSale(
                lot_id=lot.id, material=lot.material, weight_kg=round(kg, 1),  # type: ignore[arg-type]
                sold_per_kg=round(per_kg, 1), fair_per_kg=round(fair, 1),
                gap_percent=round((1 - per_kg / fair) * 100, 1),
                lost_inr=round((fair - per_kg) * kg, 0),
                recycler_name=h.recycler_name or h.recycler_id,
                sold_at=h.created_at.isoformat(),
            ))
    underpriced.sort(key=lambda u: u.lost_inr, reverse=True)

    materials = sorted(
        (InsightMaterial(
            material=mat, kg=round(v["kg"], 1), earned=round(v["earned"], 0), sales=int(v["sales"]),  # type: ignore[arg-type]
            avg_per_kg=round(v["earned"] / v["kg"], 1) if v["kg"] else 0.0,
            share_percent=round(v["earned"] / total_earned * 100, 1) if total_earned else 0.0,
            realised_percent=round(v["earned"] / v["fair"] * 100, 1) if v["fair"] else 100.0,
        ) for mat, v in by_material.items()),
        key=lambda m: m.earned, reverse=True,
    )
    recyclers = sorted(
        (InsightRecycler(
            recycler_id=rid, recycler_name=v["name"], sales=v["sales"], kg=round(v["kg"], 1),
            earned=round(v["earned"], 0), avg_per_kg=round(v["earned"] / v["kg"], 1) if v["kg"] else 0.0,
        ) for rid, v in by_recycler.items()),
        key=lambda r: r.avg_per_kg, reverse=True,
    )

    # ── Collection pattern (lots created per weekday)
    wd: Dict[int, List[float]] = defaultdict(lambda: [0, 0.0])
    for l in lots:
        d = l.created_at.weekday()
        wd[d][0] += 1
        wd[d][1] += l.weight_kg
    weekdays = [InsightWeekday(day=WEEKDAYS[i], lots=int(wd[i][0]), kg=round(wd[i][1], 1)) for i in range(7)]
    best_day = max(weekdays, key=lambda w: w.kg) if lots else None

    # ── Unsold stock
    now = datetime.utcnow()
    unsold = [l for l in lots if l.status in UNSOLD]
    stale = [l for l in unsold if now - l.created_at > timedelta(days=STALE_DAYS)]
    stale_ids = {l.id for l in stale}
    unsold_value = stale_value = 0.0
    for l in unsold:
        value = (_best_net_per_kg(db, l.material, l.weight_kg, l.latitude or home_lat, l.longitude or home_lon) or 0.0) * l.weight_kg
        unsold_value += value
        if l.id in stale_ids:
            stale_value += value

    # ── Suggestions (most money first)
    suggestions: List[InsightSuggestion] = []
    if underpriced:
        suggestions.append(InsightSuggestion(code="UNDERPRICED", impact_inr=sum(u.lost_inr for u in underpriced),
                                             params={"n": len(underpriced), "lost": round(sum(u.lost_inr for u in underpriced))}))

    for m in materials:  # a better buyer already paid more for the same material
        paid = [(rid, v["materials"][m.material]) for rid, v in by_recycler.items() if v["materials"][m.material][0] > 0]
        if len(paid) < 2:
            continue
        rates = sorted(((earned / kg, rid) for rid, (kg, earned) in paid), reverse=True)
        best_rate, best_rid = rates[0]
        worst_rate, _ = rates[-1]
        if worst_rate > 0 and best_rate / worst_rate - 1 >= SWITCH_GAIN_MIN:
            suggestions.append(InsightSuggestion(
                code="SWITCH_RECYCLER", impact_inr=round((best_rate - worst_rate) * m.kg / 2),
                params={"material": m.material, "recycler": by_recycler[best_rid]["name"],
                        "gain_percent": round((best_rate / worst_rate - 1) * 100)},
            ))

    if stale:
        suggestions.append(InsightSuggestion(code="SELL_STALE", impact_inr=round(stale_value),
                                             params={"n": len(stale), "days": STALE_DAYS, "value": round(stale_value)}))

    small: Dict[str, List[LotRow]] = defaultdict(list)
    for l in unsold:
        if l.weight_kg < SMALL_LOT_KG:
            small[l.material].append(l)
    for mat, group in small.items():
        if len(group) >= 2:
            kg = sum(l.weight_kg for l in group)
            fair = _best_net_per_kg(db, mat, kg, home_lat, home_lon) or 0.0
            suggestions.append(InsightSuggestion(code="POOL_SMALL_LOTS", impact_inr=round(fair * kg * 0.15),
                                                 params={"n": len(group), "material": mat, "kg": round(kg, 1)}))

    collected = {l.material for l in lots}
    open_demand: Dict[str, float] = defaultdict(float)
    for d in db.query(DemandRow).filter(DemandRow.status.in_(["OPEN", "PARTIAL"])).all():
        open_demand[d.material] += max(0.0, d.quantity_kg - d.filled_kg)
    new_demand = sorted(((kg, mat) for mat, kg in open_demand.items() if mat not in collected and kg > 0), reverse=True)
    if new_demand:
        kg, mat = new_demand[0]
        rate = _best_net_per_kg(db, mat, 35, home_lat, home_lon) or 0.0
        suggestions.append(InsightSuggestion(code="NEW_DEMAND", impact_inr=round(rate * min(kg, 50)),
                                             params={"material": mat, "kg": round(kg)}))

    if best_day and best_day.lots >= 2:
        suggestions.append(InsightSuggestion(code="BEST_DAY", impact_inr=0, params={"day": best_day.day, "kg": best_day.kg}))

    suggestions.sort(key=lambda s: s.impact_inr, reverse=True)

    return CollectorInsights(
        collector_id=collector_id,
        generated_at=now.isoformat(),
        sold_lots=len(handovers),
        sold_kg=round(total_kg, 1),
        earned=round(total_earned, 0),
        avg_per_kg=round(total_earned / total_kg, 1) if total_kg else 0.0,
        realised_percent=round(total_earned / total_fair * 100, 1) if total_fair else 100.0,
        unsold_lots=len(unsold),
        unsold_value=round(unsold_value, 0),
        underpriced=underpriced[:10],
        materials=materials,
        recyclers=recyclers,
        weekdays=weekdays,
        best_material=materials[0].material if materials else None,
        best_recycler=recyclers[0].recycler_name if recyclers else None,
        suggestions=suggestions,
    )
