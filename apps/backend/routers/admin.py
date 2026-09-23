# apps/backend/routers/admin.py
"""Admin dashboard — platform oversight + anomaly detection."""

from fastapi import APIRouter, Depends
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
from services import admin_service

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