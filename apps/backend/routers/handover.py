# apps/backend/routers/handover.py
"""
Handover verification + settlement.

Uses REAL server-side PIN verification against the SQLite DB.
"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db, HandoverRow
from models.domain import (
    HandoverVerificationRequest,
    HandoverConfirmRequest,
    HandoverReceipt,
)
from services import lot_service
from services.epr_service import generate_epr_credit

router = APIRouter(prefix="/api/v1/handover", tags=["Handover & Settlement"])


@router.post("/verify")
def verify_handover_pass(
    req: HandoverVerificationRequest,
    db: Session = Depends(get_db),
):
    """Recycler submits { lot_id, pickup_pin } and we check against the DB."""
    if not req.lot_id or not req.pickup_pin:
        raise HTTPException(
            status_code=400,
            detail="Both lot_id and pickup_pin are required.",
        )

    lot = lot_service.get_lot(db, req.lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail=f"Lot {req.lot_id} not found")

    if not lot_service.verify_pin(db, req.lot_id, req.pickup_pin):
        raise HTTPException(status_code=401, detail="Invalid pickup PIN for this lot")

    return {
        "verified": True,
        "lot_id": lot.id,
        "collector_name": lot.collector_name,
        "collector_id": lot.collector_id,
        "material": lot.material,
        "declared_weight_kg": lot.weight_kg,
        "expected_net_earnings": lot.expected_net_earnings or 0.0,
        "status": lot.status,
    }


@router.post("/confirm", response_model=HandoverReceipt)
def confirm_handover_settlement(
    req: HandoverConfirmRequest,
    db: Session = Depends(get_db),
):
    """Final step — PIN must match, then persist + settle."""
    if not lot_service.verify_pin(db, req.lot_id, req.pickup_pin):
        raise HTTPException(status_code=401, detail="Invalid pickup PIN")

    lot = lot_service.get_lot(db, req.lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail=f"Lot {req.lot_id} not found")

    # SIMULATED payment — no real gateway is called.
    utr_number = f"UTR-MHK-{uuid.uuid4().int % 100_000_000:08d}"

    epr = generate_epr_credit(
        lot_id=lot.id,
        material=lot.material,
        weight_kg=req.audited_weight_kg,
        recycler_id=req.recycler_id,
    )

    handover_row = HandoverRow(
        id=str(uuid.uuid4()),
        lot_id=lot.id,
        utr_number=utr_number,
        amount_paid=req.agreed_payout,
        payment_mode=req.payment_mode,
        recycler_id=req.recycler_id,
        recycler_name=getattr(req, "recycler_name", None),
        audited_weight_kg=req.audited_weight_kg,
        epr_certificate_id=epr["epr_certificate_id"],
        carbon_offset_kg=epr["carbon_offset_kg"],
    )
    db.add(handover_row)

    lot_service.attach_epr_certificate(db, lot.id, epr["epr_certificate_id"])
    lot_service.update_status(db, lot.id, "PAID")
    db.commit()

    return HandoverReceipt(
        status="CONFIRMED",
        lot_id=lot.id,
        utr_number=utr_number,
        amount_paid=req.agreed_payout,
        beneficiary=f"{lot.collector_name} ({lot.collector_id})",
        payment_mode=req.payment_mode,
        timestamp=datetime.utcnow().isoformat(),
        epr_certificate_id=epr["epr_certificate_id"],
        carbon_offset_kg=epr["carbon_offset_kg"],
        cpcb_compliance_hash=epr["cpcb_compliance_hash"],
    )