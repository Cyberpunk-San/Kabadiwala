# apps/backend/routers/offers.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

from db import get_db
from models.domain import RecyclerOffer
from services import recycler_service

router = APIRouter(prefix="/api/v1/marketplace", tags=["Marketplace & Smart Matching"])


@router.get("/offers", response_model=List[RecyclerOffer])
def get_marketplace_offers(
    material: str = Query("Copper cable"),
    weight_kg: float = Query(35.0, gt=0),
    latitude: float = Query(18.6279),
    longitude: float = Query(73.8488),
    db: Session = Depends(get_db),
):
    return recycler_service.match_recyclers_spatially(
        db=db,
        collector_lat=latitude,
        collector_lon=longitude,
        material=material,
        weight_kg=weight_kg,
    )


@router.get("/spatial/audit-query")
def get_spatial_sql(latitude: float = Query(18.6279), longitude: float = Query(73.8488)):
    return {
        "engine": "PostgreSQL 16 with PostGIS 3.4 (production target)",
        "srid": 4326,
        "note": "Production SQL below. Dev uses in-process Haversine because SQLite has no PostGIS.",
        "query": recycler_service.generate_postgis_sql_query(latitude, longitude),
    }