# apps/backend/services/recycler_console_service.py
"""Recycler console — offers, incoming lots, transactions, analytics."""

from __future__ import annotations

import json
import math
import uuid
from datetime import datetime, timedelta
from typing import Dict, List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from db import HandoverRow, LotRow, RecyclerOfferRow, RecyclerRow
from services import market_price_service
from models.domain import (
    RecyclerAnalytics,
    RecyclerPrices,
    RecyclerIncomingLot,
    RecyclerOfferCreate,
    RecyclerOfferResponse,
    RecyclerTransaction,
)


def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 1)


# ─── Offers ──────────────────────────────────────────────────────────────────

def _offer_to_response(db: Session, o: RecyclerOfferRow) -> RecyclerOfferResponse:
    lot = db.query(LotRow).filter(LotRow.id == o.lot_id).first()
    weight = lot.weight_kg if lot else 0.0
    net = max(0.0, o.offered_price_per_kg * weight - o.pickup_cost - o.handling_cost - o.platform_fee)
    return RecyclerOfferResponse(
        id=o.id, recycler_id=o.recycler_id, lot_id=o.lot_id,
        offered_price_per_kg=o.offered_price_per_kg,
        pickup_cost=o.pickup_cost, handling_cost=o.handling_cost,
        platform_fee=o.platform_fee, net_earnings=round(net, 1),
        notes=o.notes, status=o.status,
        expires_at=o.expires_at.isoformat() if o.expires_at else None,
        created_at=o.created_at.isoformat(),
    )


def require_active(db: Session, recycler_id: str) -> RecyclerRow:
    """The recycler must exist and be active — buyer companies stay inactive until admin approval."""
    row = db.query(RecyclerRow).filter(RecyclerRow.id == recycler_id).first()
    if not row:
        raise HTTPException(404, "Recycler not found")
    if not row.is_active:
        raise HTTPException(403, "This buyer account is awaiting admin approval")
    return row


def get_prices(db: Session, recycler_id: str) -> RecyclerPrices:
    row = db.query(RecyclerRow).filter(RecyclerRow.id == recycler_id).first()
    if not row:
        raise HTTPException(404, "Recycler not found")
    return RecyclerPrices(recycler_id=row.id, recycler_name=row.recycler_name, is_active=bool(row.is_active),
                          prices=market_price_service.buyer_prices(db, row), market_linked=market_price_service.market_linked(row))


def set_prices(db: Session, recycler_id: str, prices: Dict[str, float]) -> RecyclerPrices:
    """Update buy prices (₹/kg). Marketplace matching reads them live, so offers change immediately."""
    row = require_active(db, recycler_id)
    current = json.loads(row.prices_json)
    current.update({m: round(p, 1) for m, p in prices.items()})
    row.prices_json = json.dumps(current)
    # A price the buyer typed is fixed from now on; the rest keep following the market.
    spreads = json.loads(row.price_spread_json or "{}")
    row.price_spread_json = json.dumps({m: s for m, s in spreads.items() if m not in prices})
    db.commit()
    return get_prices(db, recycler_id)


def create_offer(db: Session, data: RecyclerOfferCreate) -> RecyclerOfferResponse:
    require_active(db, data.recycler_id)
    expires = datetime.utcnow() + timedelta(hours=data.expires_in_hours)
    row = RecyclerOfferRow(
        id=f"offer_{uuid.uuid4().hex[:10]}",
        recycler_id=data.recycler_id, lot_id=data.lot_id,
        offered_price_per_kg=data.offered_price_per_kg,
        pickup_cost=data.pickup_cost, handling_cost=data.handling_cost,
        platform_fee=data.platform_fee, notes=data.notes,
        status="PENDING", expires_at=expires,
    )
    db.add(row); db.commit(); db.refresh(row)
    print(f"[MHK offer] {row.id} → lot {row.lot_id} @ ₹{row.offered_price_per_kg}/kg")
    return _offer_to_response(db, row)


def list_offers(db: Session, recycler_id: str) -> List[RecyclerOfferResponse]:
    rows = (
        db.query(RecyclerOfferRow)
        .filter(RecyclerOfferRow.recycler_id == recycler_id)
        .order_by(RecyclerOfferRow.created_at.desc())
        .all()
    )
    return [_offer_to_response(db, r) for r in rows]


def update_offer_status(db: Session, offer_id: str, status: str) -> RecyclerOfferResponse | None:
    row = db.query(RecyclerOfferRow).filter(RecyclerOfferRow.id == offer_id).first()
    if not row:
        return None
    row.status = status
    db.commit(); db.refresh(row)
    return _offer_to_response(db, row)


# ─── Incoming lots ───────────────────────────────────────────────────────────

def incoming_lots(db: Session, recycler_id: str) -> List[RecyclerIncomingLot]:
    recycler = db.query(RecyclerRow).filter(RecyclerRow.id == recycler_id).first()
    if not recycler:
        return []
    lots = (
        db.query(LotRow)
        .filter(LotRow.status.in_(["AVAILABLE", "MATCHED", "PICKUP_SCHEDULED"]))
        .order_by(LotRow.created_at.desc())
        .limit(50)
        .all()
    )
    out = []
    for lot in lots:
        dist = None
        if lot.latitude and lot.longitude:
            dist = _haversine(lot.latitude, lot.longitude, recycler.latitude, recycler.longitude)
        out.append(RecyclerIncomingLot(
            id=lot.id, material=lot.material, quality=lot.quality,
            weight_kg=lot.weight_kg, status=lot.status,
            collector_id=lot.collector_id, collector_name=lot.collector_name,
            expected_net_earnings=lot.expected_net_earnings,
            created_at=lot.created_at.isoformat(),
            distance_km=dist,
        ))
    return out


# ─── Transactions ────────────────────────────────────────────────────────────

def transactions(db: Session, recycler_id: str) -> List[RecyclerTransaction]:
    rows = (
        db.query(HandoverRow)
        .filter(HandoverRow.recycler_id == recycler_id)
        .order_by(HandoverRow.created_at.desc())
        .all()
    )
    return [
        RecyclerTransaction(
            handover_id=r.id, lot_id=r.lot_id, utr_number=r.utr_number,
            amount_paid=r.amount_paid, audited_weight_kg=r.audited_weight_kg,
            epr_certificate_id=r.epr_certificate_id,
            carbon_offset_kg=r.carbon_offset_kg,
            payment_mode=r.payment_mode, created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


# ─── Analytics ───────────────────────────────────────────────────────────────

def analytics(db: Session, recycler_id: str) -> RecyclerAnalytics:
    handovers = db.query(HandoverRow).filter(HandoverRow.recycler_id == recycler_id).all()
    total_kg = sum(h.audited_weight_kg for h in handovers)
    total_paid = sum(h.amount_paid for h in handovers)

    by_material: dict[str, float] = {}
    for h in handovers:
        lot = db.query(LotRow).filter(LotRow.id == h.lot_id).first()
        if lot:
            by_material[lot.material] = by_material.get(lot.material, 0.0) + h.audited_weight_kg
    top = max(by_material.items(), key=lambda kv: kv[1])[0] if by_material else None

    open_offers = (
        db.query(RecyclerOfferRow)
        .filter(RecyclerOfferRow.recycler_id == recycler_id, RecyclerOfferRow.status == "PENDING")
        .count()
    )
    accepted_offers = (
        db.query(RecyclerOfferRow)
        .filter(RecyclerOfferRow.recycler_id == recycler_id, RecyclerOfferRow.status == "ACCEPTED")
        .count()
    )

    return RecyclerAnalytics(
        recycler_id=recycler_id,
        total_handovers=len(handovers),
        total_kg=round(total_kg, 1),
        total_paid_inr=round(total_paid, 1),
        avg_price_per_kg=round(total_paid / total_kg, 1) if total_kg > 0 else 0.0,
        top_material=top,
        open_offers=open_offers,
        accepted_offers=accepted_offers,
        incoming_lots_pending=(
            db.query(LotRow).filter(LotRow.status == "AVAILABLE").count()
        ),
    )