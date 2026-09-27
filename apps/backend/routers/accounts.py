# apps/backend/routers/accounts.py
"""Unified login + household and company accounts."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db import get_db
from models.domain import (
    CompanyProfile,
    CompanyRegisterRequest,
    HouseholdProfile,
    HouseholdRegisterRequest,
    LoginRequest,
    LoginResponse,
)
from services import account_service

router = APIRouter(prefix="/api/v1", tags=["Accounts (all roles)"])


@router.post("/auth/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Find the account for a phone number, whatever its role. 404 → show the role picker."""
    res = account_service.login(db, data.phone)
    if not res:
        raise HTTPException(404, "No account registered with this phone")
    return res


@router.post("/households/register", response_model=HouseholdProfile, status_code=201)
def register_household(data: HouseholdRegisterRequest, db: Session = Depends(get_db)):
    return account_service.register_household(db, data)


@router.get("/households/{household_id}", response_model=HouseholdProfile)
def get_household(household_id: str, db: Session = Depends(get_db)):
    h = account_service.get_household(db, household_id)
    if not h:
        raise HTTPException(404, "Household not found")
    return h


@router.post("/companies/register", response_model=CompanyProfile, status_code=201)
def register_company(data: CompanyRegisterRequest, db: Session = Depends(get_db)):
    """Buyer companies become marketplace recyclers once an admin approves them."""
    return account_service.register_company(db, data)


@router.get("/companies/{company_id}", response_model=CompanyProfile)
def get_company(company_id: str, db: Session = Depends(get_db)):
    c = account_service.get_company(db, company_id)
    if not c:
        raise HTTPException(404, "Company not found")
    return c
