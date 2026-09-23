# apps/backend/routers/opportunities.py
"""Opportunity Engine — recommendation feed for collectors."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from db import get_db
from models.domain import OpportunityFeedResponse
from services import opportunity_service

router = APIRouter(prefix="/api/v1/opportunities", tags=["Opportunity Engine"])


@router.get("/feed", response_model=OpportunityFeedResponse)
def get_opportunity_feed(
    latitude: float = Query(18.6279),
    longitude: float = Query(73.8488),
    db: Session = Depends(get_db),
):
    """
    Returns a ranked list of materials to prioritize collecting,
    based on demand + prices + collector's approximate location.
    """
    location_label = "Pune Bhosari Cluster"
    if latitude < 19 and longitude < 74:
        location_label = "Pune Region"
    return opportunity_service.generate_feed(db, location_label=location_label)