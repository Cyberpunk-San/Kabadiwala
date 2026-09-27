# apps/backend/services/sync_service.py
"""
Server-side sync engine — processes batches of offline mutations from mobile.

Idempotent: identical idempotency_key is applied at most once.
Conflict-safe: flags when server already has the entity.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import List

from sqlalchemy.orm import Session

from db import LotRow, SyncOutboxRow
from services.lot_service import generate_pin
from models.domain import (
    SyncBatchItem,
    SyncBatchRequest,
    SyncBatchResponse,
    SyncBatchResult,
)


def _apply_lot(db: Session, item: SyncBatchItem) -> SyncBatchResult:
    lot_id = item.entity_id
    existing = db.query(LotRow).filter(LotRow.id == lot_id).first()
    if existing:
        return SyncBatchResult(
            entity=item.entity, entity_id=lot_id,
            idempotency_key=item.idempotency_key,
            status="DUPLICATE", server_id=existing.id,
            message="Lot already exists — replayed safely",
        )
    payload = item.payload
    try:
        row = LotRow(
            id=lot_id,
            material=payload["material"],
            quality=payload.get("quality", "medium"),
            weight_kg=float(payload["weight_kg"]),
            status=payload.get("status", "AVAILABLE"),
            collector_id=payload["collector_id"],
            collector_name=payload.get("collector_name", "Unknown"),
            latitude=payload.get("latitude"),
            longitude=payload.get("longitude"),
            cluster_name=payload.get("cluster_name"),
            image_uri=payload.get("image_uri"),
            expected_net_earnings=payload.get("expected_net_earnings"),
            sync_state="SYNCED",
            # PINs are always server-owned — never trust one sent by the device.
            pickup_pin=generate_pin(),
        )
        db.add(row); db.commit()
        return SyncBatchResult(
            entity=item.entity, entity_id=lot_id,
            idempotency_key=item.idempotency_key,
            status="APPLIED", server_id=lot_id,
        )
    except Exception as exc:
        db.rollback()
        return SyncBatchResult(
            entity=item.entity, entity_id=lot_id,
            idempotency_key=item.idempotency_key,
            status="REJECTED", message=str(exc),
        )


def process_batch(db: Session, request: SyncBatchRequest) -> SyncBatchResponse:
    results: List[SyncBatchResult] = []
    applied = duplicates = conflicts = rejected = 0

    for item in request.items:
        seen = (
            db.query(SyncOutboxRow)
            .filter(SyncOutboxRow.idempotency_key == item.idempotency_key)
            .first()
        )
        if seen and seen.status in ("APPLIED", "DUPLICATE"):
            duplicates += 1
            results.append(SyncBatchResult(
                entity=item.entity, entity_id=item.entity_id,
                idempotency_key=item.idempotency_key,
                status="DUPLICATE", server_id=item.entity_id, message="Previously applied",
            ))
            continue

        if item.entity == "lot":
            result = _apply_lot(db, item)
        else:
            result = SyncBatchResult(
                entity=item.entity, entity_id=item.entity_id,
                idempotency_key=item.idempotency_key,
                status="REJECTED",
                message=f"Entity type '{item.entity}' not supported in this sync path",
            )

        # A previously REJECTED key is being retried: update that outbox row
        # instead of inserting a second one (idempotency_key is UNIQUE).
        outbox = seen or SyncOutboxRow(
            id=f"outbox_{uuid.uuid4().hex[:10]}",
            device_id=request.device_id,
            entity=item.entity, entity_id=item.entity_id,
            idempotency_key=item.idempotency_key,
        )
        outbox.payload_json = json.dumps(item.payload)
        outbox.status = result.status
        outbox.server_response_json = result.model_dump_json()
        outbox.applied_at = datetime.utcnow() if result.status == "APPLIED" else None
        if not seen:
            db.add(outbox)
        db.commit()

        if result.status == "APPLIED":    applied += 1
        elif result.status == "DUPLICATE": duplicates += 1
        elif result.status == "CONFLICT":  conflicts += 1
        else:                              rejected += 1
        results.append(result)

    return SyncBatchResponse(
        device_id=request.device_id,
        accepted=applied, duplicates=duplicates,
        conflicts=conflicts, rejected=rejected,
        results=results,
    )