# apps/backend/routers/admin.py
"""Admin dashboard — platform oversight + anomaly detection."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from db import get_db
from models.domain import (
    AdminAnomalyRow,
    AdminCollectorRow,
    AdminMaterialFlowRow,
    AdminOverviewResponse,
    AdminRecyclerRow,
)
from models.domain import CompanyProfile, HouseholdProfile, PickupResponse
from services import account_service, admin_service, pickup_service

router = APIRouter(prefix="/api/v1/admin", tags=["Admin / Authority"])


@router.get("/overview", response_model=AdminOverviewResponse)
def get_overview(db: Session = Depends(get_db)):
    """Platform-wide KPIs: totals, today, pending actions, top items."""
    return admin_service.overview(db)


@router.get("/collectors", response_model=List[AdminCollectorRow])
def list_collectors(db: Session = Depends(get_db)):
    """List all collectors with KYC and activity stats."""
    return admin_service.list_collectors(db)


@router.get("/recyclers", response_model=List[AdminRecyclerRow])
def list_recyclers(db: Session = Depends(get_db)):
    """List all recyclers with CPCB license and reliability."""
    return admin_service.list_recyclers(db)


@router.get("/material-flow", response_model=List[AdminMaterialFlowRow])
def get_material_flow(db: Session = Depends(get_db)):
    """Material flow breakdown: lots, kg, payout per material."""
    return admin_service.material_flow(db)


@router.get("/anomalies", response_model=List[AdminAnomalyRow])
def get_anomalies(db: Session = Depends(get_db)):
    """
    Rule-based anomaly detection:
      - Duplicate lots
      - Weight mismatch on handover
      - Unverified collector activity
    """
    return admin_service.anomalies(db)


@router.get("/households", response_model=List[HouseholdProfile])
def list_households(db: Session = Depends(get_db)):
    return account_service.list_households(db)


@router.get("/companies", response_model=List[CompanyProfile])
def list_companies(db: Session = Depends(get_db)):
    return account_service.list_companies(db)


@router.post("/companies/{company_id}/approve", response_model=CompanyProfile)
def approve_company(company_id: str, approved: bool = Query(True), db: Session = Depends(get_db)):
    """Approve (or suspend with ?approved=false) a company. Buyers go live in the marketplace."""
    c = account_service.set_company_approval(db, company_id, approved)
    if not c:
        raise HTTPException(404, "Company not found")
    return c


@router.get("/pickups", response_model=List[PickupResponse])
def list_pickups(db: Session = Depends(get_db)):
    return pickup_service.list_all(db)
