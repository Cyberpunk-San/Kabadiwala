# apps/backend/services/account_service.py
"""Households, companies and the unified phone login for all three roles."""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from db import CollectorRow, CompanyRow, HouseholdRow, PickupRequestRow, RecyclerRow
from models.domain import (
    CompanyProfile,
    CompanyRegisterRequest,
    HouseholdProfile,
    HouseholdRegisterRequest,
    LoginResponse,
)
from services import collector_service
from services.price_forecaster import BASE_PRICES

# A new buyer company starts slightly under mandi rates; it edits them in the portal.
DEFAULT_BUYER_PRICE_FACTOR = 0.97


def normalize_phone(phone: str) -> str:
    digits = "".join(ch for ch in phone if ch.isdigit())
    return f"+91{digits[-10:]}" if len(digits) >= 10 else phone.strip()


def _pickup_stats(db: Session, requester_id: str) -> tuple[int, float]:
    count, total = (
        db.query(func.count(PickupRequestRow.id), func.coalesce(func.sum(PickupRequestRow.amount_paid), 0.0))
        .filter(PickupRequestRow.requester_id == requester_id, PickupRequestRow.status == "COMPLETED")
        .one()
    )
    return int(count or 0), float(total or 0.0)


def household_to_profile(db: Session, row: HouseholdRow) -> HouseholdProfile:
    pickups, received = _pickup_stats(db, row.id)
    return HouseholdProfile(
        id=row.id, phone=row.phone, name=row.name, language=row.language,  # type: ignore[arg-type]
        address=row.address, latitude=row.latitude, longitude=row.longitude,
        created_at=row.created_at.isoformat(), total_pickups=pickups, total_received=round(received, 2),
    )


def company_to_profile(db: Session, row: CompanyRow) -> CompanyProfile:
    pickups, _ = _pickup_stats(db, row.id)
    return CompanyProfile(
        id=row.id, phone=row.phone, name=row.name, contact_name=row.contact_name,
        company_type=row.company_type,  # type: ignore[arg-type]
        gstin=row.gstin, cpcb_license=row.cpcb_license, address=row.address,
        latitude=row.latitude, longitude=row.longitude, approved=bool(row.approved),
        created_at=row.created_at.isoformat(), total_pickups=pickups,
    )


# ─── Households ──────────────────────────────────────────────────────────────

def register_household(db: Session, data: HouseholdRegisterRequest) -> HouseholdProfile:
    phone = normalize_phone(data.phone)
    existing = db.query(HouseholdRow).filter(HouseholdRow.phone == phone).first()
    if existing:
        return household_to_profile(db, existing)
    row = HouseholdRow(
        id=f"HH-{uuid.uuid4().hex[:6].upper()}", phone=phone, name=data.name.strip(), language=data.language,
        address=data.address, latitude=data.latitude, longitude=data.longitude, created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return household_to_profile(db, row)


def get_household(db: Session, household_id: str) -> Optional[HouseholdProfile]:
    row = db.query(HouseholdRow).filter(HouseholdRow.id == household_id).first()
    return household_to_profile(db, row) if row else None


def list_households(db: Session) -> List[HouseholdProfile]:
    return [household_to_profile(db, r) for r in db.query(HouseholdRow).order_by(HouseholdRow.created_at.desc()).all()]


# ─── Companies ───────────────────────────────────────────────────────────────

def register_company(db: Session, data: CompanyRegisterRequest) -> CompanyProfile:
    phone = normalize_phone(data.phone)
    existing = db.query(CompanyRow).filter(CompanyRow.phone == phone).first()
    if existing:
        return company_to_profile(db, existing)

    company_id = f"cmp-{uuid.uuid4().hex[:6]}"
    row = CompanyRow(
        id=company_id, name=data.name.strip(), contact_name=data.contact_name, phone=phone,
        company_type=data.company_type, gstin=data.gstin, cpcb_license=data.cpcb_license,
        address=data.address, latitude=data.latitude, longitude=data.longitude,
        approved=0, created_at=datetime.utcnow(),
    )
    db.add(row)

    if data.company_type in ("buyer", "both"):
        # Buyer side lives in the recyclers table so marketplace matching, demands
        # and the recycler console work unchanged. Inactive until admin approves.
        db.add(RecyclerRow(
            id=company_id, recycler_name=row.name,
            cpcb_license=data.cpcb_license or "PENDING-VERIFICATION",
            rating=4.5, pickup_base_cost=180, handling_cost=70, platform_fee=120,
            payment_reliability=95,
            latitude=data.latitude or 18.6279, longitude=data.longitude or 73.8488,
            cluster=data.address,
            prices_json=json.dumps({m: round(p * DEFAULT_BUYER_PRICE_FACTOR, 1) for m, p in BASE_PRICES.items()}),
            # Follows the live market (3% under local price) until the buyer sets its own prices.
            price_spread_json=json.dumps({m: DEFAULT_BUYER_PRICE_FACTOR for m in BASE_PRICES}),
            is_active=0,
        ))
    db.commit()
    db.refresh(row)
    return company_to_profile(db, row)


def get_company(db: Session, company_id: str) -> Optional[CompanyProfile]:
    row = db.query(CompanyRow).filter(CompanyRow.id == company_id).first()
    return company_to_profile(db, row) if row else None


def list_companies(db: Session) -> List[CompanyProfile]:
    return [company_to_profile(db, r) for r in db.query(CompanyRow).order_by(CompanyRow.created_at.desc()).all()]


def set_company_approval(db: Session, company_id: str, approved: bool) -> Optional[CompanyProfile]:
    row = db.query(CompanyRow).filter(CompanyRow.id == company_id).first()
    if not row:
        return None
    row.approved = 1 if approved else 0
    recycler = db.query(RecyclerRow).filter(RecyclerRow.id == company_id).first()
    if recycler:
        recycler.is_active = row.approved
    db.commit()
    db.refresh(row)
    return company_to_profile(db, row)


# ─── Unified login ───────────────────────────────────────────────────────────

def login(db: Session, phone: str) -> Optional[LoginResponse]:
    phone = normalize_phone(phone)
    collector = db.query(CollectorRow).filter(CollectorRow.phone == phone).first()
    if collector:
        return LoginResponse(role="kabadiwala", collector=collector_service._row_to_response(collector))
    household = db.query(HouseholdRow).filter(HouseholdRow.phone == phone).first()
    if household:
        return LoginResponse(role="household", household=household_to_profile(db, household))
    company = db.query(CompanyRow).filter(CompanyRow.phone == phone).first()
    if company:
        return LoginResponse(role="company", company=company_to_profile(db, company))
    return None
