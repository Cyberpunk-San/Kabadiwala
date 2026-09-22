from fastapi import APIRouter, Query
from typing import List
from models.domain import RecyclerOffer
from services.spatial import match_recyclers_spatially, generate_postgis_sql_query

router = APIRouter(prefix="/api/v1/marketplace", tags=["Marketplace & Smart Matching"])

@router.get("/offers", response_model=List[RecyclerOffer])
def get_marketplace_offers(
    material: str = Query("Copper cable", description="Material category name"),
    weight_kg: float = Query(35.0, gt=0, description="Approximate lot weight in kilograms"),
    latitude: float = Query(18.6279, description="Collector GPS latitude"),
    longitude: float = Query(73.8488, description="Collector GPS longitude")
):
    """
    Spacially scores and ranks nearby authorized recyclers using PostGIS geometry algorithms
    optimizing for Net Collector Take-Home earnings rather than gross nominal price.
    """
    return match_recyclers_spatially(
        collector_lat=latitude,
        collector_lon=longitude,
        material=material,
        weight_kg=weight_kg
    )

@router.get("/spatial/audit-query")
def get_spatial_sql(
    latitude: float = Query(18.6279),
    longitude: float = Query(73.8488)
):
    """Returns the PostGIS SQL execution string utilized in production spatial clusters."""
    return {
        "engine": "PostgreSQL 16 with PostGIS 3.4 Spatial Extension",
        "srid": 4326,
        "query": generate_postgis_sql_query(latitude, longitude)
    }
