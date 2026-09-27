# apps/backend/routers/collectors.py
"""
Collector registration, login, profile, KYC (simulated), and stats.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models.domain import (
    CollectorInsights,
    CollectorLoginRequest,
    CollectorProfileResponse,
    CollectorRegisterRequest,
    CollectorStatsResponse,
    CollectorUpdateRequest,
    KycStartRequest,
    KycVerifyRequest,
)
from services import collector_service, insights_service

router = APIRouter(prefix="/api/v1/collectors", tags=["Collectors & KYC"])


@router.post("/register", response_model=CollectorProfileResponse, status_code=201)
def register(data: CollectorRegisterRequest, db: Session = Depends(get_db)):
    """Register a new collector. Idempotent on phone."""
    return collector_service.register(db, data)


@router.post("/login", response_model=CollectorProfileResponse)
def login(data: CollectorLoginRequest, db: Session = Depends(get_db)):
    """Simple phone-based login (no password for demo)."""
    profile = collector_service.login(db, data)
    if not profile:
        raise HTTPException(status_code=404, detail="No collector registered with this phone")
    return profile


@router.get("/{collector_id}", response_model=CollectorProfileResponse)
def get_profile(collector_id: str, db: Session = Depends(get_db)):
    profile = collector_service.get(db, collector_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Collector {collector_id} not found")
    return profile


@router.patch("/{collector_id}", response_model=CollectorProfileResponse)
def update_profile(collector_id: str, data: CollectorUpdateRequest, db: Session = Depends(get_db)):
    updated = collector_service.update(db, collector_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Collector {collector_id} not found")
    return updated


@router.post("/{collector_id}/kyc/start", response_model=CollectorProfileResponse)
def kyc_start(collector_id: str, data: KycStartRequest, db: Session = Depends(get_db)):
    """SIMULATED: starts KYC with Aadhaar last4, PAN masked, bank last4."""
    updated = collector_service.kyc_start(db, collector_id, data)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Collector {collector_id} not found")
    return updated


@router.post("/{collector_id}/kyc/verify", response_model=CollectorProfileResponse)
def kyc_verify(collector_id: str, data: KycVerifyRequest, db: Session = Depends(get_db)):
    """SIMULATED: verifies KYC instantly (no real face match)."""
    updated = collector_service.kyc_verify(db, collector_id, data.selfie_uri)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Collector {collector_id} not found")
    return updated


@router.get("/{collector_id}/insights", response_model=CollectorInsights)
def get_insights(collector_id: str, db: Session = Depends(get_db)):
    """Underpriced sales, best material/buyer, collection pattern and money-first suggestions."""
    ins = insights_service.collector_insights(db, collector_id)
    if not ins:
        raise HTTPException(status_code=404, detail="Collector not found")
    return ins


@router.get("/{collector_id}/stats", response_model=CollectorStatsResponse)
def get_stats(collector_id: str, db: Session = Depends(get_db)):
    s = collector_service.stats(db, collector_id)
    if not s:
        raise HTTPException(status_code=404, detail=f"Collector {collector_id} not found")
    return s