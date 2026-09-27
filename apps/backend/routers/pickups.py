# apps/backend/routers/pickups.py
"""Pickup requests: households/companies ↔ nearby kabadiwalas."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db import get_db
from models.domain import PickupAccept, PickupComplete, PickupCreate, PickupResponse, PickupSchedule
from services import pickup_service

router = APIRouter(prefix="/api/v1/pickups", tags=["Pickup Requests"])


@router.post("", response_model=PickupResponse, status_code=201)
def create_pickup(data: PickupCreate, db: Session = Depends(get_db)):
    return pickup_service.create(db, data)


@router.get("", response_model=List[PickupResponse])
def list_pickups(
    requester_id: Optional[str] = Query(None, description="A household/company's own requests (includes PIN)"),
    collector_id: Optional[str] = Query(None, description="Pickups a kabadiwala has accepted"),
    latitude: Optional[float] = Query(None, description="With longitude: all OPEN requests, sorted by distance from this point"),
    longitude: Optional[float] = Query(None),
    radius_km: Optional[float] = Query(None, gt=0, description="Optional cut-off; omit to list every open request, nearest first"),
    db: Session = Depends(get_db),
):
    if requester_id:
        return pickup_service.list_for_requester(db, requester_id)
    if collector_id:
        return pickup_service.list_for_collector(db, collector_id)
    if latitude is not None and longitude is not None:
        return pickup_service.list_open_near(db, latitude, longitude, radius_km)
    raise HTTPException(400, "Pass requester_id, collector_id, or latitude+longitude")


@router.get("/{pickup_id}", response_model=PickupResponse)
def get_pickup(pickup_id: str, viewer_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """The PIN is included only when the viewer is the requester."""
    row = pickup_service._get(db, pickup_id)
    return pickup_service.to_response(row, include_pin=viewer_id == row.requester_id)


@router.post("/{pickup_id}/accept", response_model=PickupResponse)
def accept_pickup(pickup_id: str, data: PickupAccept, db: Session = Depends(get_db)):
    return pickup_service.accept(db, pickup_id, data)


@router.post("/{pickup_id}/complete", response_model=PickupResponse)
def complete_pickup(pickup_id: str, data: PickupComplete, db: Session = Depends(get_db)):
    """Kabadiwala enters the customer's PIN + real weight. Creates their sellable lot."""
    return pickup_service.complete(db, pickup_id, data)


@router.post("/{pickup_id}/schedule", response_model=PickupResponse)
def reschedule_pickup(pickup_id: str, data: PickupSchedule, db: Session = Depends(get_db)):
    """Requester changes the pickup date / time slot (while OPEN or ACCEPTED)."""
    return pickup_service.reschedule(db, pickup_id, data)


@router.post("/{pickup_id}/cancel", response_model=PickupResponse)
def cancel_pickup(pickup_id: str, requester_id: str = Query(...), db: Session = Depends(get_db)):
    return pickup_service.cancel(db, pickup_id, requester_id)
