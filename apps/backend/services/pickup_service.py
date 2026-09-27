# apps/backend/services/pickup_service.py
"""
Pickup requests connect households/companies with nearby kabadiwalas.

  OPEN ──accept──▶ ACCEPTED ──complete (PIN)──▶ COMPLETED  (creates the kabadiwala's lot)
    └──────────cancel──────────┘
"""

from __future__ import annotations

import hmac
import uuid
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from db import CollectorRow, CompanyRow, HouseholdRow, PickupRequestRow
from models.domain import GeoLocation, LotCreate, PickupAccept, PickupComplete, PickupCreate, PickupResponse, PickupSchedule
from services import lot_service
from services import market_price_service
from services.recycler_service import _haversine_km

# Kabadiwalas typically pay ~70% of the mandi rate at the door (their margin covers
# transport, sorting and risk). Used when they don't quote their own price.
DEFAULT_DOORSTEP_FACTOR = 0.70
PUNE = (18.5204, 73.8567)  # when a request has no location
MAX_SCHEDULE_DAYS = 14
SLOT_ORDER = {"morning": 0, "afternoon": 1, "evening": 2, "anytime": 3}


def _rate(db: Session, material: str, lat: Optional[float], lon: Optional[float]) -> float:
    """Dealer-level ₹/kg where the scrap is (live market / city rate card + nearby-industry premium)."""
    if lat is None or lon is None:
        lat, lon = PUNE
    return market_price_service.local_price(db, material, lat, lon)


def _check_date(d: Optional[date]) -> Optional[str]:
    """Pickups can be booked from today up to two weeks ahead (a day of slack for time zones)."""
    if d is None:
        return None
    today = datetime.utcnow().date()
    if d < today - timedelta(days=1) or d > today + timedelta(days=MAX_SCHEDULE_DAYS):
        raise HTTPException(422, f"Pickup date must be within the next {MAX_SCHEDULE_DAYS} days")
    return d.isoformat()


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def to_response(row: PickupRequestRow, *, include_pin: bool = False, distance_km: Optional[float] = None) -> PickupResponse:
    return PickupResponse(
        id=row.id, requester_type=row.requester_type, requester_id=row.requester_id,
        requester_name=row.requester_name, requester_phone=row.requester_phone,
        address=row.address, latitude=row.latitude, longitude=row.longitude,
        material=row.material,  # type: ignore[arg-type]
        estimated_weight_kg=row.estimated_weight_kg, estimated_value=row.estimated_value,
        notes=row.notes, preferred_time=row.preferred_time, status=row.status,  # type: ignore[arg-type]
        preferred_date=row.preferred_date, preferred_slot=row.preferred_slot,  # type: ignore[arg-type]
        collector_id=row.collector_id, collector_name=row.collector_name, collector_phone=row.collector_phone,
        offered_price_per_kg=row.offered_price_per_kg, actual_weight_kg=row.actual_weight_kg,
        amount_paid=row.amount_paid, lot_id=row.lot_id, distance_km=distance_km,
        created_at=row.created_at.isoformat(), accepted_at=_iso(row.accepted_at), completed_at=_iso(row.completed_at),
        pickup_pin=row.pickup_pin if include_pin else None,
    )


def _get(db: Session, pickup_id: str) -> PickupRequestRow:
    row = db.query(PickupRequestRow).filter(PickupRequestRow.id == pickup_id).first()
    if not row:
        raise HTTPException(404, f"Pickup {pickup_id} not found")
    return row


def create(db: Session, data: PickupCreate) -> PickupResponse:
    if data.requester_type == "household":
        who = db.query(HouseholdRow).filter(HouseholdRow.id == data.requester_id).first()
    else:
        who = db.query(CompanyRow).filter(CompanyRow.id == data.requester_id).first()
    if not who:
        raise HTTPException(404, f"{data.requester_type} {data.requester_id} not found")

    lat = data.latitude if data.latitude is not None else who.latitude
    lon = data.longitude if data.longitude is not None else who.longitude
    row = PickupRequestRow(
        id=f"pk_{uuid.uuid4().hex[:8]}",
        requester_type=data.requester_type, requester_id=who.id, requester_name=who.name,
        requester_phone=who.phone,
        address=data.address or who.address,
        latitude=lat,
        longitude=lon,
        material=data.material, estimated_weight_kg=data.estimated_weight_kg,
        estimated_value=round(_rate(db, data.material, lat, lon) * DEFAULT_DOORSTEP_FACTOR * data.estimated_weight_kg, 0),
        notes=data.notes, preferred_time=data.preferred_time,
        preferred_date=_check_date(data.preferred_date), preferred_slot=data.preferred_slot,
        status="OPEN", pickup_pin=lot_service.generate_pin(), created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return to_response(row, include_pin=True)


def list_for_requester(db: Session, requester_id: str) -> List[PickupResponse]:
    rows = db.query(PickupRequestRow).filter(PickupRequestRow.requester_id == requester_id).order_by(PickupRequestRow.created_at.desc()).all()
    return [to_response(r, include_pin=True) for r in rows]


def list_open_near(db: Session, latitude: float, longitude: float, radius_km: Optional[float] = None) -> List[PickupResponse]:
    """Every OPEN request, nearest first. radius_km (optional) drops the ones further away."""
    out = []
    for r in db.query(PickupRequestRow).filter(PickupRequestRow.status == "OPEN").all():
        if r.latitude is None or r.longitude is None:
            dist = None
        else:
            dist = round(_haversine_km(latitude, longitude, r.latitude, r.longitude), 1)
            if radius_km is not None and dist > radius_km:
                continue
        out.append(to_response(r, distance_km=dist))
    # Nearest first (no location = last); ties go to the soonest slot, then the oldest request.
    return sorted(out, key=lambda p: (
        p.distance_km is None, p.distance_km or 0.0,
        p.preferred_date or "9999-12-31", SLOT_ORDER.get(p.preferred_slot or "anytime", 3), p.created_at,
    ))


def list_for_collector(db: Session, collector_id: str) -> List[PickupResponse]:
    rows = db.query(PickupRequestRow).filter(PickupRequestRow.collector_id == collector_id).order_by(PickupRequestRow.accepted_at.desc()).all()
    return [to_response(r) for r in rows]


def list_all(db: Session) -> List[PickupResponse]:
    return [to_response(r) for r in db.query(PickupRequestRow).order_by(PickupRequestRow.created_at.desc()).all()]


def accept(db: Session, pickup_id: str, data: PickupAccept) -> PickupResponse:
    row = _get(db, pickup_id)
    collector = db.query(CollectorRow).filter(CollectorRow.id == data.collector_id).first()
    if not collector:
        raise HTTPException(404, "Collector not found")
    if collector.kyc_status != "VERIFIED":
        raise HTTPException(403, "Complete KYC before accepting pickups")
    if row.status != "OPEN":
        raise HTTPException(409, "This pickup was already taken or cancelled")

    row.status = "ACCEPTED"
    row.collector_id = collector.id
    row.collector_name = collector.name
    row.collector_phone = collector.phone
    row.offered_price_per_kg = data.offered_price_per_kg or round(_rate(db, row.material, row.latitude, row.longitude) * DEFAULT_DOORSTEP_FACTOR, 1)
    row.accepted_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return to_response(row)


def complete(db: Session, pickup_id: str, data: PickupComplete) -> PickupResponse:
    row = _get(db, pickup_id)
    if row.status != "ACCEPTED" or row.collector_id != data.collector_id:
        raise HTTPException(409, "Only the kabadiwala who accepted this pickup can complete it")
    if not hmac.compare_digest(row.pickup_pin.encode(), data.pickup_pin.encode()):
        raise HTTPException(401, "Wrong PIN — ask the customer for the 4-digit PIN in their app")

    collector = db.query(CollectorRow).filter(CollectorRow.id == data.collector_id).first()
    amount = round((row.offered_price_per_kg or 0.0) * data.actual_weight_kg, 0)

    # The collected scrap becomes the kabadiwala's lot, ready to sell in the marketplace.
    location = (
        GeoLocation(latitude=row.latitude, longitude=row.longitude, cluster_name=row.address or "Pickup")
        if row.latitude is not None and row.longitude is not None else None
    )
    lot = lot_service.create_lot(db, LotCreate(
        material=row.material,  # type: ignore[arg-type]
        quality="medium",
        weight_kg=data.actual_weight_kg,
        collector_id=data.collector_id,
        collector_name=collector.name if collector else (row.collector_name or "Kabadiwala"),
        location=location,
        expected_net_earnings=round(_rate(db, row.material, row.latitude, row.longitude) * data.actual_weight_kg - amount, 0),
    ))

    row.status = "COMPLETED"
    row.actual_weight_kg = data.actual_weight_kg
    row.amount_paid = amount
    row.lot_id = lot.id
    row.completed_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    return to_response(row)


def reschedule(db: Session, pickup_id: str, data: PickupSchedule) -> PickupResponse:
    row = _get(db, pickup_id)
    if row.requester_id != data.requester_id:
        raise HTTPException(403, "Only the requester can reschedule")
    if row.status not in ("OPEN", "ACCEPTED"):
        raise HTTPException(409, f"Cannot reschedule a {row.status.lower()} pickup")
    row.preferred_date = _check_date(data.preferred_date)
    row.preferred_slot = data.preferred_slot
    if data.preferred_time is not None:
        row.preferred_time = data.preferred_time
    db.commit()
    db.refresh(row)
    return to_response(row, include_pin=True)


def cancel(db: Session, pickup_id: str, requester_id: str) -> PickupResponse:
    row = _get(db, pickup_id)
    if row.requester_id != requester_id:
        raise HTTPException(403, "Only the requester can cancel")
    if row.status not in ("OPEN", "ACCEPTED"):
        raise HTTPException(409, f"Cannot cancel a {row.status.lower()} pickup")
    row.status = "CANCELLED"
    db.commit()
    db.refresh(row)
    return to_response(row, include_pin=True)
