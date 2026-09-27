# apps/backend/services/demand_service.py
"""Reverse marketplace — recyclers post demand, collectors get matched."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from db import DemandMatchRow, DemandRow, LotRow, RecyclerRow
from models.domain import (
    DemandCreate,
    DemandMatchResponse,
    DemandResponse,
)


def _row_to_response(row: DemandRow, match_count: int = 0) -> DemandResponse:
    hours_remaining = max(0.0, (row.deadline - datetime.utcnow()).total_seconds() / 3600.0)
    return DemandResponse(
        id=row.id,
        recycler_id=row.recycler_id,
        recycler_name=row.recycler_name,
        material=row.material,          # type: ignore[arg-type]
        quality_required=row.quality_required,  # type: ignore[arg-type]
        quantity_kg=row.quantity_kg,
        offered_price_per_kg=row.offered_price_per_kg,
        deadline=row.deadline.isoformat(),
        hub=row.hub,
        latitude=row.latitude,
        longitude=row.longitude,
        notes=row.notes,
        status=row.status,              # type: ignore[arg-type]
        filled_kg=row.filled_kg,
        created_at=row.created_at.isoformat(),
        match_count=match_count,
        hours_remaining=round(hours_remaining, 1),
    )


def create(db: Session, data: DemandCreate) -> DemandResponse:
    deadline = datetime.utcnow() + timedelta(days=data.deadline_days)
    buyer = db.query(RecyclerRow).filter(RecyclerRow.id == data.recycler_id).first()
    row = DemandRow(
        id=f"demand_{uuid.uuid4().hex[:8]}",
        recycler_id=data.recycler_id,
        recycler_name=data.recycler_name,
        material=data.material,
        quality_required=data.quality_required,
        quantity_kg=data.quantity_kg,
        offered_price_per_kg=data.offered_price_per_kg,
        deadline=deadline,
        hub=data.hub,
        latitude=data.latitude if data.latitude is not None else (buyer.latitude if buyer else None),
        longitude=data.longitude if data.longitude is not None else (buyer.longitude if buyer else None),
        notes=data.notes,
        status="OPEN",
        filled_kg=0.0,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    print(f"[MHK demand] {row.id} · {row.material} · {row.quantity_kg}kg @ ₹{row.offered_price_per_kg}/kg")
    return _row_to_response(row)


def list_open(db: Session, material: Optional[str] = None) -> List[DemandResponse]:
    q = db.query(DemandRow).filter(DemandRow.status.in_(["OPEN", "PARTIAL"]))
    if material:
        q = q.filter(DemandRow.material == material)
    q = q.order_by(DemandRow.deadline.asc())
    rows = q.all()
    out: List[DemandResponse] = []
    for r in rows:
        count = db.query(DemandMatchRow).filter(DemandMatchRow.demand_id == r.id).count()
        out.append(_row_to_response(r, match_count=count))
    return out


def list_for_recycler(db: Session, recycler_id: str) -> List[DemandResponse]:
    rows = db.query(DemandRow).filter(DemandRow.recycler_id == recycler_id).order_by(DemandRow.created_at.desc()).all()
    return [
        _row_to_response(r, match_count=db.query(DemandMatchRow).filter(DemandMatchRow.demand_id == r.id).count())
        for r in rows
    ]


def get(db: Session, demand_id: str) -> Optional[DemandResponse]:
    row = db.query(DemandRow).filter(DemandRow.id == demand_id).first()
    if not row:
        return None
    count = db.query(DemandMatchRow).filter(DemandMatchRow.demand_id == row.id).count()
    return _row_to_response(row, match_count=count)


def _score_match(demand: DemandRow, lot_material: str, lot_quality: str, lot_weight: float) -> tuple[float, List[str]]:
    reasons: List[str] = []
    score = 0.0

    if lot_material == demand.material:
        score += 50
        reasons.append("Material matches")
    else:
        return 0.0, []

    quality_order = {"low": 0, "medium": 1, "high": 2}
    req = quality_order.get(demand.quality_required, 1)
    got = quality_order.get(lot_quality, 1)
    if got >= req:
        score += 20
        reasons.append(f"Quality meets requirement ({lot_quality} ≥ {demand.quality_required})")
    elif got == req - 1:
        score += 8
        reasons.append("Quality one step below requirement")
    else:
        return 5.0, ["Quality too low"]

    remaining = max(0.0, demand.quantity_kg - demand.filled_kg)
    coverage = min(1.0, lot_weight / max(1.0, remaining))
    score += coverage * 20
    if coverage >= 0.5:
        reasons.append(f"Fills {coverage*100:.0f}% of remaining demand")

    hours_left = max(0.0, (demand.deadline - datetime.utcnow()).total_seconds() / 3600.0)
    if hours_left < 24:
        score += 10
        reasons.append("Urgent — under 24h to deadline")
    elif hours_left < 72:
        score += 5
        reasons.append("Deadline approaching")

    return min(100.0, round(score, 1)), reasons


def match_lots(db: Session, demand_id: str, limit: int = 10) -> List[DemandMatchResponse]:
    demand = db.query(DemandRow).filter(DemandRow.id == demand_id).first()
    if not demand:
        return []

    candidates = (
        db.query(LotRow)
        .filter(LotRow.material == demand.material)
        .order_by(LotRow.created_at.desc())
        .limit(50)
        .all()
    )

    scored: List[tuple[float, List[str], LotRow]] = []
    for lot in candidates:
        s, reasons = _score_match(demand, lot.material, lot.quality, lot.weight_kg)
        if s > 0:
            scored.append((s, reasons, lot))

    scored.sort(key=lambda t: t[0], reverse=True)

    out: List[DemandMatchResponse] = []
    for s, reasons, lot in scored[:limit]:
        out.append(DemandMatchResponse(
            demand_id=demand.id,
            lot_id=lot.id,
            collector_id=lot.collector_id,
            weight_kg=lot.weight_kg,
            match_score=s,
            match_reasons=reasons,
        ))
    return out


def record_match(
    db: Session,
    demand_id: str,
    lot_id: str,
    collector_id: str,
    weight_kg: float,
    score: float,
) -> None:
    db.add(DemandMatchRow(
        id=f"match_{uuid.uuid4().hex[:10]}",
        demand_id=demand_id,
        lot_id=lot_id,
        collector_id=collector_id,
        weight_kg=weight_kg,
        match_score=score,
    ))
    row = db.query(DemandRow).filter(DemandRow.id == demand_id).first()
    if row:
        row.filled_kg = min(row.quantity_kg, row.filled_kg + weight_kg)
        if row.filled_kg >= row.quantity_kg:
            row.status = "FULFILLED"
        elif row.filled_kg > 0:
            row.status = "PARTIAL"
        db.commit()
    print(f"[MHK demand] Match recorded · {demand_id} ← {lot_id} ({weight_kg}kg)")