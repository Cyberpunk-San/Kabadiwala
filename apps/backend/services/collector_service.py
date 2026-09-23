# apps/backend/services/collector_service.py
"""
Collector CRUD + KYC (simulated) + reputation/tier calculation.

KYC is a SIMULATION: we store Aadhaar last4, masked PAN, bank last4, and a
selfie URI. No real verification happens. Production would call UIDAI/NSDL
verification APIs and run face-match + liveness detection.
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from db import CollectorRow
from models.domain import (
    CollectorLoginRequest,
    CollectorProfileResponse,
    CollectorRegisterRequest,
    CollectorStatsResponse,
    CollectorUpdateRequest,
    KycStartRequest,
)


# ─── Tier thresholds (lifetime kg) ───────────────────────────────────────────

TIER_THRESHOLDS = [
    ("platinum", 5000.0),
    ("gold",     1000.0),
    ("silver",   250.0),
    ("bronze",   0.0),
]


def _compute_tier(total_weight_kg: float) -> str:
    for tier, threshold in TIER_THRESHOLDS:
        if total_weight_kg >= threshold:
            return tier
    return "bronze"


def _next_tier_threshold(total_weight_kg: float) -> Optional[float]:
    """Return the kg needed to reach the next tier, or None if already platinum."""
    for _tier, threshold in TIER_THRESHOLDS:
        if total_weight_kg < threshold:
            return threshold
    return None


# ─── ORM → Response ──────────────────────────────────────────────────────────

def _row_to_response(row: CollectorRow) -> CollectorProfileResponse:
    expertise: Optional[List[str]] = None
    if row.material_expertise:
        expertise = [s.strip() for s in row.material_expertise.split(",") if s.strip()]

    return CollectorProfileResponse(
        id=row.id,
        phone=row.phone,
        name=row.name,
        language=row.language,  # type: ignore[arg-type]
        operating_area=row.operating_area,
        latitude=row.latitude,
        longitude=row.longitude,
        collection_radius_km=row.collection_radius_km,
        material_expertise=expertise,
        kyc_status=row.kyc_status,  # type: ignore[arg-type]
        kyc_aadhaar_last4=row.kyc_aadhaar_last4,
        kyc_pan_masked=row.kyc_pan_masked,
        kyc_bank_account_last4=row.kyc_bank_account_last4,
        kyc_verified_at=row.kyc_verified_at.isoformat() if row.kyc_verified_at else None,
        tier=row.tier,  # type: ignore[arg-type]
        rating=row.rating,
        total_lots=row.total_lots,
        total_weight_kg=row.total_weight_kg,
        total_earnings=row.total_earnings,
        created_at=row.created_at.isoformat() if row.created_at else datetime.utcnow().isoformat(),
    )


# ─── ID generation ───────────────────────────────────────────────────────────

def _generate_collector_id() -> str:
    return f"CLT-{random.randint(1000, 9999)}"


# ─── CRUD ────────────────────────────────────────────────────────────────────

def register(db: Session, data: CollectorRegisterRequest) -> CollectorProfileResponse:
    existing = db.query(CollectorRow).filter(CollectorRow.phone == data.phone).first()
    if existing:
        return _row_to_response(existing)

    # Generate a unique id (retry on collision)
    candidate_id = None
    for _ in range(20):
        candidate = _generate_collector_id()
        if not db.query(CollectorRow).filter(CollectorRow.id == candidate).first():
            candidate_id = candidate
            break
    if candidate_id is None:
        candidate_id = f"CLT-{uuid.uuid4().hex[:6].upper()}"

    row = CollectorRow(
        id=candidate_id,
        phone=data.phone,
        name=data.name,
        language=data.language,
        operating_area=data.operating_area,
        latitude=data.latitude,
        longitude=data.longitude,
        collection_radius_km=data.collection_radius_km,
        material_expertise=None,
        kyc_status="PENDING",
        tier="bronze",
        rating=5.0,
        total_lots=0,
        total_weight_kg=0.0,
        total_earnings=0.0,
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    print(f"[MHK collectors] Registered {row.id} · {row.name} · {row.phone}")
    return _row_to_response(row)


def login(db: Session, data: CollectorLoginRequest) -> Optional[CollectorProfileResponse]:
    row = db.query(CollectorRow).filter(CollectorRow.phone == data.phone).first()
    if not row:
        return None
    print(f"[MHK collectors] Login {row.id} · {row.name}")
    return _row_to_response(row)


def get(db: Session, collector_id: str) -> Optional[CollectorProfileResponse]:
    row = db.query(CollectorRow).filter(CollectorRow.id == collector_id).first()
    return _row_to_response(row) if row else None


def update(db: Session, collector_id: str, data: CollectorUpdateRequest) -> Optional[CollectorProfileResponse]:
    row = db.query(CollectorRow).filter(CollectorRow.id == collector_id).first()
    if not row:
        return None

    if data.name is not None:
        row.name = data.name
    if data.language is not None:
        row.language = data.language
    if data.operating_area is not None:
        row.operating_area = data.operating_area
    if data.latitude is not None:
        row.latitude = data.latitude
    if data.longitude is not None:
        row.longitude = data.longitude
    if data.collection_radius_km is not None:
        row.collection_radius_km = data.collection_radius_km
    if data.material_expertise is not None:
        row.material_expertise = ",".join(data.material_expertise)

    db.commit()
    db.refresh(row)
    return _row_to_response(row)


# ─── KYC (simulated) ─────────────────────────────────────────────────────────

def kyc_start(db: Session, collector_id: str, data: KycStartRequest) -> Optional[CollectorProfileResponse]:
    """Step 1 of KYC — collector provides ID details (no real verification)."""
    row = db.query(CollectorRow).filter(CollectorRow.id == collector_id).first()
    if not row:
        return None

    row.kyc_aadhaar_last4 = data.aadhaar_last4
    row.kyc_pan_masked = data.pan_masked
    row.kyc_bank_account_last4 = data.bank_account_last4
    row.kyc_status = "IN_PROGRESS"
    db.commit()
    db.refresh(row)
    print(f"[MHK KYC] {collector_id} started · Aadhaar ****{data.aadhaar_last4}")
    return _row_to_response(row)


def kyc_verify(db: Session, collector_id: str, selfie_uri: Optional[str]) -> Optional[CollectorProfileResponse]:
    """Step 2 of KYC — collector provides selfie, we mark VERIFIED instantly (simulated)."""
    row = db.query(CollectorRow).filter(CollectorRow.id == collector_id).first()
    if not row:
        return None

    row.kyc_selfie_uri = selfie_uri
    row.kyc_status = "VERIFIED"
    row.kyc_verified_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    print(f"[MHK KYC] {collector_id} VERIFIED (simulated)")
    return _row_to_response(row)


# ─── Stats ───────────────────────────────────────────────────────────────────

def stats(db: Session, collector_id: str) -> Optional[CollectorStatsResponse]:
    row = db.query(CollectorRow).filter(CollectorRow.id == collector_id).first()
    if not row:
        return None

    avg_per_lot = (row.total_earnings / row.total_lots) if row.total_lots else 0.0
    avg_per_kg = (row.total_earnings / row.total_weight_kg) if row.total_weight_kg else 0.0

    return CollectorStatsResponse(
        total_lots=row.total_lots,
        total_weight_kg=row.total_weight_kg,
        total_earnings=row.total_earnings,
        avg_earnings_per_lot=round(avg_per_lot, 2),
        avg_price_per_kg=round(avg_per_kg, 2),
        tier=row.tier,  # type: ignore[arg-type]
        rating=row.rating,
        next_tier_at_kg=_next_tier_threshold(row.total_weight_kg),
    )