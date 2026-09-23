# apps/backend/routers/sync.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from models.domain import SyncBatchRequest, SyncBatchResponse
from services import sync_service

router = APIRouter(prefix="/api/v1/sync", tags=["Offline & Data Sync"])


@router.post("/batch", response_model=SyncBatchResponse)
def sync_batch(req: SyncBatchRequest, db: Session = Depends(get_db)):
    """Process a batch of offline mutations from a mobile device."""
    return sync_service.process_batch(db, req)