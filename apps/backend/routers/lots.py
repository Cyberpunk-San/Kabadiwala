# apps/backend/routers/lots.py
"""
Lot CRUD endpoints — backed by SQLite via services.lot_service.

Endpoints:
  POST   /api/v1/lots                   -> create a lot
  GET    /api/v1/lots                   -> list lots (optional ?status=)
  GET    /api/v1/lots/{lot_id}          -> fetch one lot
  GET    /api/v1/lots/{lot_id}/pin      -> fetch the server-generated PIN
  PATCH  /api/v1/lots/{lot_id}/status   -> update status
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from db import get_db
from models.domain import LotCreate, LotResponse, LotStatus
from services import lot_service

router = APIRouter(prefix="/api/v1/lots", tags=["Lots & Inventory"])


@router.post("", response_model=LotResponse, status_code=201)
def create_lot(lot: LotCreate, db: Session = Depends(get_db)):
    """Create a new lot. Server generates the id, timestamp, and pickup PIN."""
    return lot_service.create_lot(db, lot)


@router.get("", response_model=List[LotResponse])
def get_all_lots(
    status: Optional[str] = Query(None, description="Filter by lot status"),
    db: Session = Depends(get_db),
):
    """List all lots, newest first, optionally filtered by status."""
    return lot_service.list_lots(db, status=status)


@router.get("/{lot_id}", response_model=LotResponse)
def get_lot_by_id(lot_id: str, db: Session = Depends(get_db)):
    """Fetch a single lot's full traceability record."""
    lot = lot_service.get_lot(db, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail=f"Lot {lot_id} not found")
    return lot


@router.get("/{lot_id}/pin")
def get_lot_pin(lot_id: str, db: Session = Depends(get_db)):
    """Return the server-owned PIN for this lot.

    In production this would be gated behind collector auth. For the demo we
    return it directly so the mobile HandoverScreen can display the same PIN
    the recycler will type.
    """
    pin = lot_service.get_lot_pin(db, lot_id)
    if not pin:
        raise HTTPException(status_code=404, detail=f"Lot {lot_id} not found")
    return {"lot_id": lot_id, "pickup_pin": pin}


@router.patch("/{lot_id}/status", response_model=LotResponse)
def update_lot_status(
    lot_id: str,
    status: LotStatus,
    db: Session = Depends(get_db),
):
    """Update a lot's status (AVAILABLE -> PICKUP_SCHEDULED -> PAID -> ...)."""
    updated = lot_service.update_status(db, lot_id, status)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Lot {lot_id} not found")
    return updated