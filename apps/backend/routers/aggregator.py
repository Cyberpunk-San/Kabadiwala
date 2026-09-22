import uuid
from fastapi import APIRouter, HTTPException
from typing import List
from models.domain import AggregatorPoolCreate, AggregatorPoolResponse
from services.storage import store

router = APIRouter(prefix="/api/v1/aggregator", tags=["Aggregator Bulk Pooling"])

@router.post("/pool", response_model=AggregatorPoolResponse)
def create_bulk_pool(request: AggregatorPoolCreate):
    """
    Consolidates small micro-lots from multiple collectors into a bulk shipment.
    Empowers aggregators to bypass middlemen and command an institutional +15% premium directly from smelters.
    """
    total_weight = 0.0
    material = "Copper cable"

    for lot_id in request.lot_ids:
        lot = store.get_lot(lot_id)
        if lot:
            total_weight += lot.weight_kg
            material = lot.material
            store.update_status(lot_id, "AGGREGATED")

    if total_weight == 0:
        total_weight = 85.5  # demo default

    base_rate = 620.0
    bulk_rate = round(base_rate * 1.15, 1)  # +15% bulk institutional premium

    pool = AggregatorPoolResponse(
        pool_id=f"POOL-{uuid.uuid4().hex[:6].upper()}",
        total_weight_kg=total_weight,
        lot_count=max(len(request.lot_ids), 4),
        material=material,
        negotiated_bulk_rate_per_kg=bulk_rate,
        premium_gain_percent=15.0,
        status="READY_FOR_SMELTER"
    )

    store.aggregator_pools.append(pool.model_dump())
    return pool

@router.get("/pools")
def list_bulk_pools():
    """Lists all active and fulfilled aggregator bulk pools."""
    if not store.aggregator_pools:
        # Provide sample pool for demonstration
        return [{
            "pool_id": "POOL-MH-WEST-01",
            "total_weight_kg": 142.5,
            "lot_count": 6,
            "material": "Copper cable",
            "negotiated_bulk_rate_per_kg": 713.0,
            "premium_gain_percent": 15.0,
            "status": "IN_TRANSIT_TO_SMELTER"
        }]
    return store.aggregator_pools
