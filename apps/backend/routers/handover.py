# apps/backend/routers/handover.py
"""
Handover verification + settlement.

Uses REAL server-side PIN verification against the SQLite DB.
"""

import json
import uuid
from datetime import datetime
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db, HandoverRow, LotRow, RecyclerRow
from models.domain import (
    HandoverVerificationRequest,
    HandoverConfirmRequest,
    HandoverReceipt,
)
from services import lot_service
from services.epr_service import generate_epr_credit

router = APIRouter(prefix="/api/v1/handover", tags=["Handover & Settlement"])

SETTLED_STATUSES = {"PAID", "SOLD"}


def _parse_qr(qr_payload: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """The mobile pass encodes {"lotId": ..., "pin": ...} as JSON."""
    if not qr_payload:
        return None, None
    try:
        data = json.loads(qr_payload)
        return data.get("lotId") or data.get("lot_id"), data.get("pin") or data.get("pickup_pin")
    except (ValueError, AttributeError):
        return None, None


@router.post("/verify")
def verify_handover_pass(
    req: HandoverVerificationRequest,
    db: Session = Depends(get_db),
):
    """Recycler submits { lot_id, pickup_pin } (or the scanned qr_payload)."""
    qr_lot, qr_pin = _parse_qr(req.qr_payload)
    lot_id = req.lot_id or qr_lot
    pin = req.pickup_pin or qr_pin
    if not lot_id or not pin:
        raise HTTPException(
            status_code=400,
            detail="Both lot_id and pickup_pin are required.",
        )

    lot = lot_service.get_lot(db, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail=f"Lot {lot_id} not found")

    if not lot_service.verify_pin(db, lot_id, pin):
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
        "already_settled": lot.status in SETTLED_STATUSES,
    }


@router.post("/confirm", response_model=HandoverReceipt)
def confirm_handover_settlement(
    req: HandoverConfirmRequest,
    db: Session = Depends(get_db),
):
    """Final step — PIN must match, then persist + settle (exactly once)."""
    lot = lot_service.get_lot(db, req.lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail=f"Lot {req.lot_id} not found")

    if not lot_service.verify_pin(db, req.lot_id, req.pickup_pin):
        raise HTTPException(status_code=401, detail="Invalid pickup PIN")

    if lot.status in SETTLED_STATUSES:
        raise HTTPException(status_code=409, detail=f"Lot {lot.id} is already settled")

    recycler = db.query(RecyclerRow).filter(RecyclerRow.id == req.recycler_id).first()
    if recycler and not recycler.is_active:
        raise HTTPException(status_code=403, detail="This buyer account is awaiting admin approval")
    recycler_name = recycler.recycler_name if recycler else req.recycler_name

    # SIMULATED payment — no real gateway is called.
    utr_number = f"UTR-MHK-{uuid.uuid4().int % 100_000_000:08d}"

    epr = generate_epr_credit(
        lot_id=lot.id,
        material=lot.material,
        weight_kg=req.audited_weight_kg,
        recycler_id=req.recycler_id,
    )

    db.add(HandoverRow(
        id=str(uuid.uuid4()),
        lot_id=lot.id,
        utr_number=utr_number,
        amount_paid=req.agreed_payout,
        payment_mode=req.payment_mode,
        recycler_id=req.recycler_id,
        recycler_name=recycler_name,
        audited_weight_kg=req.audited_weight_kg,
        epr_certificate_id=epr["epr_certificate_id"],
        carbon_offset_kg=epr["carbon_offset_kg"],
    ))

    # Lot + collector totals change in the same transaction as the handover row.
    row = db.query(LotRow).filter(LotRow.id == lot.id).first()
    row.status = "PAID"
    row.epr_certificate_id = epr["epr_certificate_id"]
    lot_service.credit_collector(db, lot.collector_id, req.audited_weight_kg, req.agreed_payout)
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
