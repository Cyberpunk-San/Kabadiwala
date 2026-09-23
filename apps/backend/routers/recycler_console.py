# apps/backend/routers/recycler_console.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from db import get_db
from models.domain import (
    RecyclerAnalytics,
    RecyclerIncomingLot,
    RecyclerOfferCreate,
    RecyclerOfferResponse,
    RecyclerTransaction,
)
from services import recycler_console_service as rc

router = APIRouter(prefix="/api/v1/recycler", tags=["Recycler Console"])


@router.post("/offers", response_model=RecyclerOfferResponse, status_code=201)
def create_offer(data: RecyclerOfferCreate, db: Session = Depends(get_db)):
    return rc.create_offer(db, data)


@router.get("/{recycler_id}/offers", response_model=List[RecyclerOfferResponse])
def list_offers(recycler_id: str, db: Session = Depends(get_db)):
    return rc.list_offers(db, recycler_id)


@router.patch("/offers/{offer_id}/accept", response_model=RecyclerOfferResponse)
def accept_offer(offer_id: str, db: Session = Depends(get_db)):
    r = rc.update_offer_status(db, offer_id, "ACCEPTED")
    if not r:
        raise HTTPException(404, "Offer not found")
    return r


@router.patch("/offers/{offer_id}/reject", response_model=RecyclerOfferResponse)
def reject_offer(offer_id: str, db: Session = Depends(get_db)):
    r = rc.update_offer_status(db, offer_id, "REJECTED")
    if not r:
        raise HTTPException(404, "Offer not found")
    return r


@router.get("/{recycler_id}/incoming-lots", response_model=List[RecyclerIncomingLot])
def incoming_lots(recycler_id: str, db: Session = Depends(get_db)):
    return rc.incoming_lots(db, recycler_id)


@router.get("/{recycler_id}/transactions", response_model=List[RecyclerTransaction])
def transactions(recycler_id: str, db: Session = Depends(get_db)):
    return rc.transactions(db, recycler_id)


@router.get("/{recycler_id}/analytics", response_model=RecyclerAnalytics)
def analytics(recycler_id: str, db: Session = Depends(get_db)):
    return rc.analytics(db, recycler_id)