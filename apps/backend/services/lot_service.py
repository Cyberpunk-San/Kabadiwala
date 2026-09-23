# apps/backend/services/lot_service.py
"""
Real CRUD + business logic for lots, backed by SQLite (see db.py).

This module replaces the in-memory `store` dict from the old storage.py.
All routers must go through here — no direct DB access from routers.

Key responsibilities:
  - create / read / update lots
  - generate a server-owned 4-digit PIN for each new lot
  - verify a lot's PIN (used by handover verification)
  - expose plain Pydantic responses (never raw ORM rows) to routers
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from db import LotRow
from models.domain import GeoLocation, LotCreate, LotResponse, LotStatus


# ─── Internal: ORM → Pydantic mapper ─────────────────────────────────────────

def _row_to_response(row: LotRow) -> LotResponse:
    """Convert a LotRow ORM instance to the LotResponse Pydantic model."""
    location = None
    if row.latitude is not None and row.longitude is not None:
        location = GeoLocation(
            latitude=row.latitude,
            longitude=row.longitude,
            cluster_name=row.cluster_name or "Bhosari MIDC, Pune",
        )

    return LotResponse(
        id=row.id,
        material=row.material,
        quality=row.quality,
        weight_kg=row.weight_kg,
        status=row.status,
        collector_id=row.collector_id,
        collector_name=row.collector_name,
        location=location,
        image_uri=row.image_uri,
        created_at=row.created_at.isoformat() if row.created_at else datetime.utcnow().isoformat(),
        expected_net_earnings=row.expected_net_earnings,
        sync_state=row.sync_state,
        epr_certificate_id=row.epr_certificate_id,
    )


# ─── PIN Generation ──────────────────────────────────────────────────────────

def _generate_pin() -> str:
    """
    4-digit PIN, avoiding 0000 and any leading-zero ambiguity is not needed
    here because the recycler will type digits anyway. Range 1000–9999.
    """
    return f"{random.randint(1000, 9999)}"


# ─── CRUD ────────────────────────────────────────────────────────────────────

def create_lot(db: Session, data: LotCreate) -> LotResponse:
    """
    Insert a new lot. Server generates:
      - lot id (date-prefixed + random suffix)
      - 4-digit pickup PIN
      - created_at timestamp
    """
    lot_id = f"lot_{datetime.utcnow().strftime('%y%m%d')}_{uuid.uuid4().hex[:6]}"
    pin = _generate_pin()

    # Location defaults (Pune Bhosari) if the collector did not supply GPS.
    lat = data.location.latitude if data.location else 18.6279
    lon = data.location.longitude if data.location else 73.8488
    cluster = data.location.cluster_name if data.location else "Bhosari MIDC, Pune"

    row = LotRow(
        id=lot_id,
        material=data.material,
        quality=data.quality,
        weight_kg=data.weight_kg,
        status="AVAILABLE",
        collector_id=data.collector_id,
        collector_name=data.collector_name,
        latitude=lat,
        longitude=lon,
        cluster_name=cluster,
        image_uri=data.image_uri,
        created_at=datetime.utcnow(),
        expected_net_earnings=data.expected_net_earnings,
        sync_state="SYNCED",
        pickup_pin=pin,
        epr_certificate_id=None,
    )

    db.add(row)
    db.commit()
    db.refresh(row)

    print(f"[MHK lots] Created {lot_id} · {data.material} · {data.weight_kg}kg · PIN={pin}")
    return _row_to_response(row)


def list_lots(db: Session, status: Optional[str] = None) -> List[LotResponse]:
    """List lots, newest first, optionally filtered by status."""
    q = db.query(LotRow).order_by(LotRow.created_at.desc())
    if status:
        q = q.filter(LotRow.status == status)
    return [_row_to_response(r) for r in q.all()]


def get_lot(db: Session, lot_id: str) -> Optional[LotResponse]:
    """Fetch one lot by id, or None."""
    row = db.query(LotRow).filter(LotRow.id == lot_id).first()
    return _row_to_response(row) if row else None


def get_lot_pin(db: Session, lot_id: str) -> Optional[str]:
    """
    Return the server-owned PIN for a lot. Used by:
      - GET /v1/lots/{id}/pin   (mobile HandoverScreen reads it for display)
      - POST /v1/handover/verify (recycler web submits it)
    """
    row = db.query(LotRow).filter(LotRow.id == lot_id).first()
    return row.pickup_pin if row else None


def verify_pin(db: Session, lot_id: str, pin: str) -> bool:
    """Constant-time-ish PIN check for a lot."""
    row = db.query(LotRow).filter(LotRow.id == lot_id).first()
    if not row:
        return False
    return row.pickup_pin == pin


def update_status(db: Session, lot_id: str, status: LotStatus) -> Optional[LotResponse]:
    """Update a lot's status (e.g. AVAILABLE -> PICKUP_SCHEDULED -> PAID)."""
    row = db.query(LotRow).filter(LotRow.id == lot_id).first()
    if not row:
        return None
    row.status = status
    db.commit()
    db.refresh(row)
    return _row_to_response(row)


def attach_epr_certificate(db: Session, lot_id: str, epr_certificate_id: str) -> Optional[LotResponse]:
    """Called by handover confirmation to link the EPR credit to the lot."""
    row = db.query(LotRow).filter(LotRow.id == lot_id).first()
    if not row:
        return None
    row.epr_certificate_id = epr_certificate_id
    db.commit()
    db.refresh(row)
    return _row_to_response(row)