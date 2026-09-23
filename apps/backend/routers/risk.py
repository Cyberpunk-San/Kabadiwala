# apps/backend/routers/risk.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from db import get_db
from models.domain import RiskAlert, RiskScanResponse
from services import risk_service

router = APIRouter(prefix="/api/v1/risk", tags=["Fraud & Anomaly Detection"])


@router.post("/scan", response_model=RiskScanResponse)
def run_scan(db: Session = Depends(get_db)):
    return risk_service.scan(db, persist=True)


@router.get("/alerts", response_model=List[RiskAlert])
def list_alerts(
    unresolved_only: bool = Query(True),
    db: Session = Depends(get_db),
):
    return risk_service.list_persisted(db, unresolved_only=unresolved_only)


@router.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str, db: Session = Depends(get_db)):
    if not risk_service.resolve(db, alert_id):
        raise HTTPException(404, "Alert not found")
    return {"resolved": True, "alert_id": alert_id}