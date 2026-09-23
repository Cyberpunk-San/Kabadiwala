# apps/backend/services/risk_service.py
"""
Fraud & anomaly detection — rule-based risk engine.

Detectors (8):
  1. DUPLICATE_LOT       same material + weight within 5 min
  2. DUPLICATE_PHOTO     same image URI across lots
  3. WEIGHT_MISMATCH     declared vs audited > 10%
  4. PRICE_OUTLIER       offer > 2× market average
  5. SUSPICIOUS_PATTERN  collector creates ≥5 lots in 30 min
  6. UNVERIFIED_ACTIVITY non-KYC collector with lots
  7. ABNORMAL_RECYCLER   ≥3 offers, zero accepted
  8. TRANSACTION_RISK    payout < ₹50
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta
from statistics import mean
from typing import Dict, List

from sqlalchemy.orm import Session

from db import (
    CollectorRow,
    HandoverRow,
    LotRow,
    RecyclerOfferRow,
    RecyclerRow,
    RiskAlertRow,
)
from models.domain import RiskAlert, RiskScanResponse


RISK_WEIGHTS = {
    "DUPLICATE_LOT": 45,
    "DUPLICATE_PHOTO": 55,
    "WEIGHT_MISMATCH": 65,
    "PRICE_OUTLIER": 40,
    "SUSPICIOUS_PATTERN": 50,
    "UNVERIFIED_ACTIVITY": 30,
    "ABNORMAL_RECYCLER": 35,
    "TRANSACTION_RISK": 60,
}


def _severity_for(score: float) -> str:
    if score >= 80: return "critical"
    if score >= 60: return "high"
    if score >= 35: return "medium"
    return "low"


def _add_alert(db, type_, message, score, lot_id=None, collector_id=None, recycler_id=None):
    row = RiskAlertRow(
        id=f"alert_{uuid.uuid4().hex[:10]}",
        severity=_severity_for(score),
        type=type_, message=message,
        lot_id=lot_id, collector_id=collector_id, recycler_id=recycler_id,
        risk_score=round(score, 1), resolved=0,
    )
    db.add(row)
    return row


def _detect_duplicate_lots(db, alerts):
    recent = (
        db.query(LotRow)
        .filter(LotRow.created_at >= datetime.utcnow() - timedelta(hours=6))
        .all()
    )
    seen: dict[tuple, LotRow] = {}
    for lot in recent:
        key = (lot.material, round(lot.weight_kg, 1))
        if key in seen:
            delta = abs((lot.created_at - seen[key].created_at).total_seconds())
            if delta < 300:
                alerts.append(_add_alert(
                    db, "DUPLICATE_LOT",
                    f"Lot {lot.id} duplicates {seen[key].id} ({lot.material}, {lot.weight_kg}kg) within 5 min",
                    RISK_WEIGHTS["DUPLICATE_LOT"] + (30 if delta < 60 else 0),
                    lot_id=lot.id, collector_id=lot.collector_id,
                ))
        else:
            seen[key] = lot


def _detect_duplicate_photos(db, alerts):
    by_uri: dict[str, List[LotRow]] = {}
    for lot in db.query(LotRow).filter(LotRow.image_uri.isnot(None)).all():
        by_uri.setdefault(lot.image_uri, []).append(lot)
    for uri, lots in by_uri.items():
        if len(lots) > 1:
            alerts.append(_add_alert(
                db, "DUPLICATE_PHOTO",
                f"{len(lots)} lots share the same photo",
                RISK_WEIGHTS["DUPLICATE_PHOTO"] + (len(lots) - 2) * 10,
                lot_id=lots[0].id, collector_id=lots[0].collector_id,
            ))


def _detect_weight_mismatch(db, alerts):
    for h in db.query(HandoverRow).all():
        lot = db.query(LotRow).filter(LotRow.id == h.lot_id).first()
        if not lot or lot.weight_kg <= 0:
            continue
        pct = abs(h.audited_weight_kg - lot.weight_kg) / lot.weight_kg * 100
        if pct > 10:
            alerts.append(_add_alert(
                db, "WEIGHT_MISMATCH",
                f"{lot.id}: declared {lot.weight_kg}kg, audited {h.audited_weight_kg}kg ({pct:.1f}% diff)",
                RISK_WEIGHTS["WEIGHT_MISMATCH"] + min(30, (pct - 10) * 1.5),
                lot_id=lot.id, collector_id=lot.collector_id, recycler_id=h.recycler_id,
            ))


def _detect_price_outliers(db, alerts):
    prices_by_material: dict[str, List[float]] = {}
    for r in db.query(RecyclerRow).all():
        try:
            for mat, p in json.loads(r.prices_json).items():
                prices_by_material.setdefault(mat, []).append(float(p))
        except Exception:
            continue
    avg = {m: mean(ps) for m, ps in prices_by_material.items() if len(ps) >= 3}

    for offer in db.query(RecyclerOfferRow).all():
        lot = db.query(LotRow).filter(LotRow.id == offer.lot_id).first()
        if not lot: continue
        a = avg.get(lot.material)
        if a and offer.offered_price_per_kg > a * 2.0:
            alerts.append(_add_alert(
                db, "PRICE_OUTLIER",
                f"Offer {offer.id} for {lot.id} at ₹{offer.offered_price_per_kg}/kg is >2× market avg (₹{a:.0f})",
                RISK_WEIGHTS["PRICE_OUTLIER"] + 20,
                lot_id=lot.id, recycler_id=offer.recycler_id,
            ))


def _detect_suspicious_patterns(db, alerts):
    since = datetime.utcnow() - timedelta(minutes=30)
    by_collector: dict[str, List[LotRow]] = {}
    for lot in db.query(LotRow).filter(LotRow.created_at >= since).all():
        by_collector.setdefault(lot.collector_id, []).append(lot)
    for cid, lots in by_collector.items():
        if len(lots) >= 5:
            alerts.append(_add_alert(
                db, "SUSPICIOUS_PATTERN",
                f"Collector {cid} created {len(lots)} lots in 30 min",
                RISK_WEIGHTS["SUSPICIOUS_PATTERN"] + (len(lots) - 5) * 5,
                collector_id=cid,
            ))


def _detect_unverified_activity(db, alerts):
    for c in db.query(CollectorRow).filter(CollectorRow.kyc_status != "VERIFIED").all():
        count = db.query(LotRow).filter(LotRow.collector_id == c.id).count()
        if count > 0:
            alerts.append(_add_alert(
                db, "UNVERIFIED_ACTIVITY",
                f"{c.id} ({c.name}) has {count} lot(s) but KYC is {c.kyc_status}",
                RISK_WEIGHTS["UNVERIFIED_ACTIVITY"],
                collector_id=c.id,
            ))


def _detect_abnormal_recycler(db, alerts):
    by: dict[str, dict[str, int]] = {}
    for o in db.query(RecyclerOfferRow).all():
        b = by.setdefault(o.recycler_id, {"total": 0, "accepted": 0})
        b["total"] += 1
        if o.status == "ACCEPTED":
            b["accepted"] += 1
    for rid, b in by.items():
        if b["total"] >= 3 and b["accepted"] == 0:
            alerts.append(_add_alert(
                db, "ABNORMAL_RECYCLER",
                f"Recycler {rid} made {b['total']} offers but none were accepted",
                RISK_WEIGHTS["ABNORMAL_RECYCLER"] + 10,
                recycler_id=rid,
            ))


def _detect_transaction_risk(db, alerts):
    for h in db.query(HandoverRow).all():
        if h.amount_paid < 50:
            alerts.append(_add_alert(
                db, "TRANSACTION_RISK",
                f"Handover {h.id} paid only ₹{h.amount_paid} (below ₹50)",
                RISK_WEIGHTS["TRANSACTION_RISK"],
                lot_id=h.lot_id, recycler_id=h.recycler_id,
            ))


def scan(db: Session, persist: bool = True) -> RiskScanResponse:
    alerts: List[RiskAlertRow] = []
    _detect_duplicate_lots(db, alerts)
    _detect_duplicate_photos(db, alerts)
    _detect_weight_mismatch(db, alerts)
    _detect_price_outliers(db, alerts)
    _detect_suspicious_patterns(db, alerts)
    _detect_unverified_activity(db, alerts)
    _detect_abnormal_recycler(db, alerts)
    _detect_transaction_risk(db, alerts)

    if persist:
        db.commit()

    by_sev = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for a in alerts:
        by_sev[a.severity] = by_sev.get(a.severity, 0) + 1

    return RiskScanResponse(
        generated_at=datetime.utcnow().isoformat(),
        total_alerts=len(alerts),
        by_severity=by_sev,
        alerts=[
            RiskAlert(
                id=a.id, severity=a.severity, type=a.type, message=a.message,
                lot_id=a.lot_id, collector_id=a.collector_id, recycler_id=a.recycler_id,
                risk_score=a.risk_score, resolved=bool(a.resolved),
                created_at=a.created_at.isoformat(),
            )
            for a in sorted(alerts, key=lambda x: -x.risk_score)
        ],
    )


def list_persisted(db: Session, unresolved_only: bool = True) -> List[RiskAlert]:
    q = db.query(RiskAlertRow)
    if unresolved_only:
        q = q.filter(RiskAlertRow.resolved == 0)
    q = q.order_by(RiskAlertRow.risk_score.desc())
    return [
        RiskAlert(
            id=a.id, severity=a.severity, type=a.type, message=a.message,
            lot_id=a.lot_id, collector_id=a.collector_id, recycler_id=a.recycler_id,
            risk_score=a.risk_score, resolved=bool(a.resolved),
            created_at=a.created_at.isoformat(),
        )
        for a in q.all()
    ]


def resolve(db: Session, alert_id: str) -> bool:
    row = db.query(RiskAlertRow).filter(RiskAlertRow.id == alert_id).first()
    if not row:
        return False
    row.resolved = 1
    db.commit()
    return True