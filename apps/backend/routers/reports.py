# apps/backend/routers/reports.py
import uuid
import hashlib
from datetime import datetime
from fastapi import APIRouter

from models.domain import CPCBReportResponse, CPCBMaterialTonnage
from services.national_context_service import get_national_context

router = APIRouter(prefix="/api/v1/reports", tags=["CPCB Compliance & Governance"])


@router.get("/national-context")
def national_context():
    """
    Returns verified national e-waste figures loaded from
    apps/backend/data/national_context_seed.json.

    If the file is not yet populated with real CPCB/data.gov.in numbers,
    returns {configured: false} — the mobile UI then hides the Impact card.
    """
    return get_national_context()


@router.get("/cpcb", response_model=CPCBReportResponse)
def generate_cpcb_form2_report():
    """
    SIMULATED CPCB Form-2 report.

    The FORMAT matches the official Form-2 template, but the numbers here are
    placeholder. Production would pull real tonnage from the lots table and
    submit to the CPCB portal.
    """
    now = datetime.now()
    breakdown = [
        CPCBMaterialTonnage(material="Copper cable", tonnage_mt=24.5, recycled_mt=23.8,
                            disposed_mt=0.7, recovery_rate_percent=97.1, epr_credits_generated=117.6),
        CPCBMaterialTonnage(material="Server boards", tonnage_mt=14.2, recycled_mt=13.7,
                            disposed_mt=0.5, recovery_rate_percent=96.5, epr_credits_generated=258.4),
        CPCBMaterialTonnage(material="Lithium-ion batteries", tonnage_mt=8.8, recycled_mt=8.1,
                            disposed_mt=0.7, recovery_rate_percent=92.0, epr_credits_generated=73.9),
        CPCBMaterialTonnage(material="Aluminium", tonnage_mt=32.0, recycled_mt=31.2,
                            disposed_mt=0.8, recovery_rate_percent=97.5, epr_credits_generated=291.2),
        CPCBMaterialTonnage(material="Printed Circuit Boards (PCB)", tonnage_mt=19.4, recycled_mt=18.5,
                            disposed_mt=0.9, recovery_rate_percent=95.3, epr_credits_generated=281.3),
    ]
    total_mt = sum(i.tonnage_mt for i in breakdown)
    total_epr = sum(i.epr_credits_generated for i in breakdown)
    report_id = f"CPCB-F2-{now.strftime('%Y%m')}-{uuid.uuid4().hex[:6].upper()}"
    sig = hashlib.sha256(f"{report_id}|{total_mt}|{total_epr}|CPCB_PORTAL_GOV_IN".encode()).hexdigest()[:32].upper()

    return CPCBReportResponse(
        report_id=report_id,
        total_e_waste_collected_mt=round(total_mt, 2),
        total_epr_credits=round(total_epr, 2),
        materials_breakdown=breakdown,
        verified_recyclers_count=18,
        registered_collectors_count=1420,
        generated_at=now.isoformat(),
        digital_signature=sig,
    )