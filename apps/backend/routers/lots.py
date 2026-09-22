from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from models.domain import LotResponse, LotCreate, LotStatus
from services.storage import store

router = APIRouter(prefix="/api/v1/lots", tags=["Lots & Inventory"])

@router.post("", response_model=LotResponse, status_code=201)
def create_lot(lot: LotCreate):
    """Creates a new digital scrap/e-waste lot from mobile app collection."""
    return store.create_lot(lot)

@router.get("", response_model=List[LotResponse])
def get_all_lots(status: Optional[str] = Query(None, description="Filter by lot status")):
    """Returns all available and scheduled lots in the system."""
    return store.list_lots(status=status)

@router.get("/{lot_id}", response_model=LotResponse)
def get_lot_by_id(lot_id: str):
    """Fetches full details and traceability lineage for a lot."""
    lot = store.get_lot(lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    return lot

@router.patch("/{lot_id}/status", response_model=LotResponse)
def update_lot_status(lot_id: str, status: LotStatus):
    """Updates lot status (e.g. AVAILABLE -> PICKUP_SCHEDULED -> PAID)."""
    updated = store.update_status(lot_id, status)
    if not updated:
        raise HTTPException(status_code=404, detail="Lot not found")
    return updated
