# apps/backend/routers/demands.py
"""Reverse marketplace endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from db import get_db
from models.domain import (
    DemandCreate,
    DemandMatchResponse,
    DemandResponse,
)
from services import demand_service
from services.recycler_console_service import require_active

router = APIRouter(prefix="/api/v1/demands", tags=["Reverse Marketplace"])


@router.post("", response_model=DemandResponse, status_code=201)
def create_demand(data: DemandCreate, db: Session = Depends(get_db)):
    """Recycler posts a new demand."""
    require_active(db, data.recycler_id)
    return demand_service.create(db, data)


@router.get("", response_model=List[DemandResponse])
def list_demands(
    material: Optional[str] = Query(None),
    recycler_id: Optional[str] = Query(None, description="One recycler's demands, in every status"),
    db: Session = Depends(get_db),
):
    """List open + partial demands, optionally filtered by material — or all of one recycler's demands."""
    if recycler_id:
        return demand_service.list_for_recycler(db, recycler_id)
    return demand_service.list_open(db, material=material)


@router.get("/{demand_id}", response_model=DemandResponse)
def get_demand(demand_id: str, db: Session = Depends(get_db)):
    d = demand_service.get(db, demand_id)
    if not d:
        raise HTTPException(status_code=404, detail=f"Demand {demand_id} not found")
    return d


@router.get("/{demand_id}/matches", response_model=List[DemandMatchResponse])
def get_demand_matches(
    demand_id: str,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Find local lots that match this demand, ranked by match score."""
    return demand_service.match_lots(db, demand_id, limit=limit)


@router.post("/{demand_id}/match/{lot_id}", response_model=DemandResponse)
def accept_match(
    demand_id: str,
    lot_id: str,
    db: Session = Depends(get_db),
):
    """Record that a lot has been accepted to fulfil a demand."""
    demand = demand_service.get(db, demand_id)
    if not demand:
        raise HTTPException(status_code=404, detail="Demand not found")

    from db import LotRow
    lot = db.query(LotRow).filter(LotRow.id == lot_id).first()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    demand_service.record_match(
        db,
        demand_id=demand_id,
        lot_id=lot_id,
        collector_id=lot.collector_id,
        weight_kg=lot.weight_kg,
        score=100.0,
    )
    return demand_service.get(db, demand_id)  # type: ignore[return-value]