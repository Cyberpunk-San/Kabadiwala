# apps/backend/routers/regional.py
"""Regional intelligence: hotspots, industry clusters, supply/demand balance, price heatmap."""

from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from db import get_db
from models.domain import MaterialType, PriceHeatmapResponse, RegionalOverviewResponse
from services import regional_service

router = APIRouter(prefix="/api/v1/regional", tags=["Regional Intelligence"])

DEFAULT_LAT, DEFAULT_LON = 18.6279, 73.8488  # Pune Bhosari cluster


@router.get("/overview", response_model=RegionalOverviewResponse)
def overview(
    latitude: float = Query(DEFAULT_LAT, ge=-90, le=90),
    longitude: float = Query(DEFAULT_LON, ge=-180, le=180),
    radius_km: float = Query(35.0, gt=0, le=100),
    db: Session = Depends(get_db),
):
    return regional_service.overview(db, latitude, longitude, radius_km)


@router.get("/price-heatmap", response_model=PriceHeatmapResponse)
async def price_heatmap(
    material: MaterialType,
    latitude: float = Query(DEFAULT_LAT, ge=-90, le=90),
    longitude: float = Query(DEFAULT_LON, ge=-180, le=180),
    radius_km: float = Query(25.0, gt=0, le=60),
    db: Session = Depends(get_db),
):
    return await run_in_threadpool(regional_service.price_heatmap, db, material, latitude, longitude, radius_km)
