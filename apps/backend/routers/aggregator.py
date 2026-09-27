# apps/backend/routers/aggregator.py
"""
Aggregator bulk-pool endpoints — persisted to SQLite.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from db import get_db, AggregatorPoolRow
from models.domain import AggregatorPoolCreate, AggregatorPoolResponse
from services import lot_service
from services.ml_service import _avg_recycler_price
from services.price_forecaster import BASE_PRICES

router = APIRouter(prefix="/api/v1/aggregator", tags=["Aggregator Bulk Pooling"])


@router.post("/pool", response_model=AggregatorPoolResponse)
def create_bulk_pool(
    req: AggregatorPoolCreate,
    db: Session = Depends(get_db),
):
    """Consolidate multiple small lots into one bulk shipment."""
    if not req.lot_ids:
        raise HTTPException(status_code=400, detail="At least one lot_id is required")

    lots = [lot for lot in (lot_service.get_lot(db, i) for i in dict.fromkeys(req.lot_ids)) if lot]
    if not lots:
        raise HTTPException(status_code=404, detail="None of the supplied lot_ids exist")

    materials = {lot.material for lot in lots}
    if len(materials) > 1:
        raise HTTPException(status_code=400, detail="A bulk pool must contain a single material")
    settled = [lot.id for lot in lots if lot.status in ("PAID", "SOLD", "AGGREGATED")]
    if settled:
        raise HTTPException(status_code=409, detail=f"Lots already sold or pooled: {', '.join(settled)}")

    material = lots[0].material
    total_weight = sum(lot.weight_kg for lot in lots)
    aggregated_count = len(lots)
    for lot in lots:
        lot_service.update_status(db, lot.id, "AGGREGATED")

    from services.market_price_service import market_price
    base_rate = _avg_recycler_price(db, material) or market_price(material)[0] or BASE_PRICES.get(material, 85.0)
    bulk_rate = round(base_rate * 1.15, 1)  # +15% institutional premium

    pool = AggregatorPoolRow(
        id=f"POOL-{uuid.uuid4().hex[:6].upper()}",
        aggregator_id=req.aggregator_id,
        aggregator_name=getattr(req, "aggregator_name", None),
        material=material,
        total_weight_kg=round(total_weight, 2),
        lot_count=aggregated_count,
        negotiated_bulk_rate_per_kg=bulk_rate,
        premium_gain_percent=15.0,
        status="READY_FOR_SMELTER",
        created_at=datetime.utcnow(),
    )
    db.add(pool)
    db.commit()
    db.refresh(pool)

    return AggregatorPoolResponse(
        pool_id=pool.id,
        total_weight_kg=pool.total_weight_kg,
        lot_count=pool.lot_count,
        material=pool.material,
        negotiated_bulk_rate_per_kg=pool.negotiated_bulk_rate_per_kg,
        premium_gain_percent=pool.premium_gain_percent,
        status=pool.status,
    )


@router.get("/pools", response_model=List[AggregatorPoolResponse])
def list_bulk_pools(db: Session = Depends(get_db)):
    """List all pools, newest first."""
    rows = (
        db.query(AggregatorPoolRow)
        .order_by(AggregatorPoolRow.created_at.desc())
        .all()
    )
    return [
        AggregatorPoolResponse(
            pool_id=r.id,
            total_weight_kg=r.total_weight_kg,
            lot_count=r.lot_count,
            material=r.material,
            negotiated_bulk_rate_per_kg=r.negotiated_bulk_rate_per_kg,
            premium_gain_percent=r.premium_gain_percent,
            status=r.status,
        )
        for r in rows
    ]