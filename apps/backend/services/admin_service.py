# apps/backend/services/admin_service.py
"""Admin dashboard — platform-wide aggregates + anomaly detection."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import List

from sqlalchemy.orm import Session

from db import (
    CollectorRow,
    CompanyRow,
    HouseholdRow,
    PickupRequestRow,
    DemandRow,
    HandoverRow,
    LotRow,
    RecyclerRow,
)
from models.domain import (
    AdminAnomalyRow,
    AdminCollectorRow,
    AdminMaterialFlowRow,
    AdminOverviewResponse,
    AdminRecyclerRow,
)


def overview(db: Session) -> AdminOverviewResponse:
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    collectors = db.query(CollectorRow).count()
    recyclers = db.query(RecyclerRow).count()
    all_lots = db.query(LotRow).all()
    lots = len(all_lots)
    total_kg = sum(r.weight_kg for r in all_lots)
    total_inr = sum((r.expected_net_earnings or 0.0) for r in all_lots)

    lots_today_rows = db.query(LotRow).filter(LotRow.created_at >= today_start).all()
    lots_today = len(lots_today_rows)
    kg_today = sum(r.weight_kg for r in lots_today_rows)
    inr_today = sum((r.expected_net_earnings or 0.0) for r in lots_today_rows)

    unverified_kyc = (
        db.query(CollectorRow)
        .filter(CollectorRow.kyc_status != "VERIFIED")
        .count()
    )
    open_demands = (
        db.query(DemandRow).filter(DemandRow.status.in_(["OPEN", "PARTIAL"])).count()
    )
    pending_payouts = (
        db.query(LotRow)
        .filter(LotRow.status.in_(["PICKUP_SCHEDULED", "MATCHED", "SOLD"]))
        .count()
    )

    by_material: dict[str, dict[str, float]] = {}
    for r in all_lots:
        bucket = by_material.setdefault(r.material, {"lots": 0, "kg": 0.0, "inr": 0.0})
        bucket["lots"] += 1
        bucket["kg"] += r.weight_kg
        bucket["inr"] += r.expected_net_earnings or 0.0

    top_materials = sorted(
        [{"material": k, **v} for k, v in by_material.items()],
        key=lambda x: x["kg"],
        reverse=True,
    )[:5]

    by_recycler: dict[str, dict[str, float]] = {}
    for h in db.query(HandoverRow).all():
        bucket = by_recycler.setdefault(
            h.recycler_id, {"lots": 0, "kg": 0.0, "inr": 0.0}
        )
        bucket["lots"] += 1
        bucket["kg"] += h.audited_weight_kg
        bucket["inr"] += h.amount_paid

    top_recyclers = sorted(
        [{"recycler_id": k, **v} for k, v in by_recycler.items()],
        key=lambda x: x["kg"],
        reverse=True,
    )[:5]

    return AdminOverviewResponse(
        generated_at=now.isoformat(),
        totals={
            "collectors": collectors,
            "recyclers": recyclers,
            "households": db.query(HouseholdRow).count(),
            "companies": db.query(CompanyRow).count(),
            "pickups_completed": db.query(PickupRequestRow).filter(PickupRequestRow.status == "COMPLETED").count(),
            "lots": lots,
            "weight_kg": round(total_kg, 1),
            "payout_inr": round(total_inr, 1),
        },
        today={
            "lots": lots_today,
            "weight_kg": round(kg_today, 1),
            "payout_inr": round(inr_today, 1),
        },
        pending_actions={
            "unverified_kyc": unverified_kyc,
            "open_demands": open_demands,
            "pending_payouts": pending_payouts,
            "companies_awaiting_approval": db.query(CompanyRow).filter(CompanyRow.approved == 0).count(),
            "open_pickups": db.query(PickupRequestRow).filter(PickupRequestRow.status == "OPEN").count(),
        },
        top_materials=top_materials,
        top_recyclers=top_recyclers,
    )


def list_collectors(db: Session) -> List[AdminCollectorRow]:
    rows = db.query(CollectorRow).order_by(CollectorRow.created_at.desc()).all()
    return [
        AdminCollectorRow(
            id=r.id, name=r.name, phone=r.phone,
            operating_area=r.operating_area,
            kyc_status=r.kyc_status,   # type: ignore[arg-type]
            tier=r.tier,               # type: ignore[arg-type]
            rating=r.rating,
            total_lots=r.total_lots,
            total_weight_kg=r.total_weight_kg,
            total_earnings=r.total_earnings,
            created_at=r.created_at.isoformat(),
        )
        for r in rows
    ]


def list_recyclers(db: Session) -> List[AdminRecyclerRow]:
    rows = db.query(RecyclerRow).order_by(RecyclerRow.recycler_name.asc()).all()
    return [
        AdminRecyclerRow(
            id=r.id,
            recycler_name=r.recycler_name,
            cpcb_license=r.cpcb_license,
            rating=r.rating,
            cluster=r.cluster,
            is_active=bool(r.is_active),
            payment_reliability=r.payment_reliability,
        )
        for r in rows
    ]


def material_flow(db: Session) -> List[AdminMaterialFlowRow]:
    buckets: dict[str, dict[str, float]] = {}
    for r in db.query(LotRow).all():
        b = buckets.setdefault(r.material, {"lots": 0, "kg": 0.0, "inr": 0.0})
        b["lots"] += 1
        b["kg"] += r.weight_kg
        b["inr"] += r.expected_net_earnings or 0.0

    out = []
    for mat, b in buckets.items():
        avg = b["inr"] / b["kg"] if b["kg"] > 0 else 0.0
        out.append(AdminMaterialFlowRow(
            material=mat,  # type: ignore[arg-type]
            lots=int(b["lots"]),
            weight_kg=round(b["kg"], 1),
            payout_inr=round(b["inr"], 1),
            avg_price_per_kg=round(avg, 1),
        ))
    out.sort(key=lambda x: x.weight_kg, reverse=True)
    return out


def anomalies(db: Session) -> List[AdminAnomalyRow]:
    """
    Rule-based anomaly detection:
      - Duplicate lots (same material + weight within 5 min)
      - Weight mismatch on handover (>10% diff)
      - Unverified collector with activity
    """
    out: List[AdminAnomalyRow] = []
    now = datetime.utcnow()

    recent = (
        db.query(LotRow)
        .filter(LotRow.created_at >= now - timedelta(minutes=15))
        .all()
    )
    seen: dict[tuple[str, float], LotRow] = {}
    for lot in recent:
        key = (lot.material, round(lot.weight_kg, 1))
        if key in seen:
            delta = abs((lot.created_at - seen[key].created_at).total_seconds())
            if delta < 300:
                out.append(AdminAnomalyRow(
                    severity="medium",
                    type="DUPLICATE_LOT",
                    message=f"Lot {lot.id} duplicates {seen[key].id} ({lot.material}, {lot.weight_kg}kg) within 5 min",
                    lot_id=lot.id,
                    collector_id=lot.collector_id,
                    created_at=now.isoformat(),
                ))
        else:
            seen[key] = lot

    for h in db.query(HandoverRow).all():
        lot = db.query(LotRow).filter(LotRow.id == h.lot_id).first()
        if not lot or lot.weight_kg <= 0:
            continue
        pct_diff = abs(h.audited_weight_kg - lot.weight_kg) / lot.weight_kg * 100
        if pct_diff > 10:
            out.append(AdminAnomalyRow(
                severity="high" if pct_diff > 25 else "medium",
                type="WEIGHT_MISMATCH",
                message=f"{lot.id}: declared {lot.weight_kg}kg, audited {h.audited_weight_kg}kg ({pct_diff:.1f}% diff)",
                lot_id=lot.id,
                collector_id=lot.collector_id,
                created_at=now.isoformat(),
            ))

    for c in db.query(CollectorRow).filter(CollectorRow.kyc_status != "VERIFIED").all():
        lots_count = db.query(LotRow).filter(LotRow.collector_id == c.id).count()
        if lots_count > 0:
            out.append(AdminAnomalyRow(
                severity="low",
                type="UNVERIFIED_ACTIVITY",
                message=f"{c.id} ({c.name}) has {lots_count} lot(s) but KYC is {c.kyc_status}",
                collector_id=c.id,
                created_at=now.isoformat(),
            ))

    order = {"high": 0, "medium": 1, "low": 2}
    out.sort(key=lambda x: order[x.severity])
    return out