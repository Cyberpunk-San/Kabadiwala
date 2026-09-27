# apps/backend/db.py
"""
SQLAlchemy + SQLite persistence layer.

Tables:
  lots · handovers · aggregator_pools · recyclers · collectors
  demands · demand_matches · risk_alerts · sync_outbox · recycler_offers
  price_history
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta

from sqlalchemy import (
    Column, DateTime, Float, Integer, String, Text, create_engine, inspect, text,
)
from sqlalchemy.orm import declarative_base, sessionmaker

from settings import DATA_DIR as _DATA_DIR, DB_PATH

os.makedirs(os.path.dirname(DB_PATH) or ".", exist_ok=True)
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
    future=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


# ─── ORM Models ──────────────────────────────────────────────────────────────

class LotRow(Base):
    __tablename__ = "lots"
    id = Column(String, primary_key=True)
    material = Column(String, nullable=False)
    quality = Column(String, nullable=False, default="medium")
    weight_kg = Column(Float, nullable=False)
    status = Column(String, nullable=False, default="AVAILABLE")
    collector_id = Column(String, nullable=False)
    collector_name = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    cluster_name = Column(String, nullable=True)
    image_uri = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expected_net_earnings = Column(Float, nullable=True)
    sync_state = Column(String, nullable=False, default="SYNCED")
    pickup_pin = Column(String(4), nullable=False)
    epr_certificate_id = Column(String, nullable=True)


class HandoverRow(Base):
    __tablename__ = "handovers"
    id = Column(String, primary_key=True)
    lot_id = Column(String, nullable=False, index=True)
    utr_number = Column(String, nullable=False)
    amount_paid = Column(Float, nullable=False)
    payment_mode = Column(String, nullable=False, default="UPI")
    recycler_id = Column(String, nullable=False)
    recycler_name = Column(String, nullable=True)
    audited_weight_kg = Column(Float, nullable=False)
    epr_certificate_id = Column(String, nullable=True)
    carbon_offset_kg = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class AggregatorPoolRow(Base):
    __tablename__ = "aggregator_pools"
    id = Column(String, primary_key=True)
    aggregator_id = Column(String, nullable=False)
    aggregator_name = Column(String, nullable=True)
    material = Column(String, nullable=False)
    total_weight_kg = Column(Float, nullable=False)
    lot_count = Column(Integer, nullable=False)
    negotiated_bulk_rate_per_kg = Column(Float, nullable=False)
    premium_gain_percent = Column(Float, nullable=False, default=15.0)
    status = Column(String, nullable=False, default="READY_FOR_SMELTER")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class RecyclerRow(Base):
    __tablename__ = "recyclers"
    id = Column(String, primary_key=True)
    recycler_name = Column(String, nullable=False)
    cpcb_license = Column(String, nullable=False)
    rating = Column(Float, nullable=False, default=4.5)
    pickup_base_cost = Column(Float, nullable=False, default=180)
    handling_cost = Column(Float, nullable=False, default=70)
    platform_fee = Column(Float, nullable=False, default=120)
    payment_reliability = Column(Integer, nullable=False, default=95)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    cluster = Column(String, nullable=True)
    prices_json = Column(Text, nullable=False)
    # {material: spread} — these materials follow the live market (local price × spread) instead of a fixed ₹.
    # Setting a price in the recycler console removes the material from here (the buyer's price wins).
    price_spread_json = Column(Text, nullable=True)
    is_active = Column(Integer, nullable=False, default=1)


class CollectorRow(Base):
    __tablename__ = "collectors"
    id = Column(String, primary_key=True)
    phone = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    language = Column(String, nullable=False, default="hi")
    operating_area = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    collection_radius_km = Column(Float, nullable=False, default=10.0)
    material_expertise = Column(String, nullable=True)
    kyc_status = Column(String, nullable=False, default="PENDING")
    kyc_aadhaar_last4 = Column(String(4), nullable=True)
    kyc_pan_masked = Column(String, nullable=True)
    kyc_bank_account_last4 = Column(String(4), nullable=True)
    kyc_selfie_uri = Column(Text, nullable=True)
    kyc_verified_at = Column(DateTime, nullable=True)
    tier = Column(String, nullable=False, default="bronze")
    rating = Column(Float, nullable=False, default=5.0)
    total_lots = Column(Integer, nullable=False, default=0)
    total_weight_kg = Column(Float, nullable=False, default=0.0)
    total_earnings = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class DemandRow(Base):
    __tablename__ = "demands"
    id = Column(String, primary_key=True)
    recycler_id = Column(String, nullable=False, index=True)
    recycler_name = Column(String, nullable=False)
    material = Column(String, nullable=False)
    quality_required = Column(String, nullable=False, default="medium")
    quantity_kg = Column(Float, nullable=False)
    offered_price_per_kg = Column(Float, nullable=False)
    deadline = Column(DateTime, nullable=False)
    hub = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="OPEN")
    filled_kg = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class DemandMatchRow(Base):
    __tablename__ = "demand_matches"
    id = Column(String, primary_key=True)
    demand_id = Column(String, nullable=False, index=True)
    lot_id = Column(String, nullable=False, index=True)
    collector_id = Column(String, nullable=False)
    weight_kg = Column(Float, nullable=False)
    match_score = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class RiskAlertRow(Base):
    __tablename__ = "risk_alerts"
    id = Column(String, primary_key=True)
    severity = Column(String, nullable=False)
    type = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    lot_id = Column(String, nullable=True, index=True)
    collector_id = Column(String, nullable=True, index=True)
    recycler_id = Column(String, nullable=True, index=True)
    risk_score = Column(Float, nullable=False, default=0.0)
    resolved = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class SyncOutboxRow(Base):
    __tablename__ = "sync_outbox"
    id = Column(String, primary_key=True)
    device_id = Column(String, nullable=False, index=True)
    entity = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    payload_json = Column(Text, nullable=False)
    idempotency_key = Column(String, nullable=False, unique=True, index=True)
    status = Column(String, nullable=False, default="PENDING")
    server_response_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    applied_at = Column(DateTime, nullable=True)


class RecyclerOfferRow(Base):
    __tablename__ = "recycler_offers"
    id = Column(String, primary_key=True)
    recycler_id = Column(String, nullable=False, index=True)
    lot_id = Column(String, nullable=False, index=True)
    offered_price_per_kg = Column(Float, nullable=False)
    pickup_cost = Column(Float, nullable=False, default=0.0)
    handling_cost = Column(Float, nullable=False, default=0.0)
    platform_fee = Column(Float, nullable=False, default=0.0)
    notes = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="PENDING")
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class HouseholdRow(Base):
    """A home / shop that wants its scrap picked up by a kabadiwala."""
    __tablename__ = "households"
    id = Column(String, primary_key=True)
    phone = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    language = Column(String, nullable=False, default="hi")
    address = Column(Text, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class CompanyRow(Base):
    """
    A business. company_type:
      buyer  — recycler that buys from kabadiwalas (gets a RecyclerRow with the same id)
      seller — office / factory / society with bulk e-waste to be picked up
      both
    Admin approval activates the buyer side in the marketplace.
    """
    __tablename__ = "companies"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    contact_name = Column(String, nullable=True)
    phone = Column(String, unique=True, nullable=False, index=True)
    company_type = Column(String, nullable=False, default="seller")
    gstin = Column(String, nullable=True)
    cpcb_license = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    approved = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PickupRequestRow(Base):
    """A household or company asks nearby kabadiwalas to collect scrap."""
    __tablename__ = "pickup_requests"
    id = Column(String, primary_key=True)
    requester_type = Column(String, nullable=False)  # household | company
    requester_id = Column(String, nullable=False, index=True)
    requester_name = Column(String, nullable=False)
    requester_phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    material = Column(String, nullable=False)
    estimated_weight_kg = Column(Float, nullable=False)
    estimated_value = Column(Float, nullable=False, default=0.0)
    notes = Column(Text, nullable=True)
    preferred_time = Column(String, nullable=True)  # free-text label (legacy / admin display)
    preferred_date = Column(String, nullable=True)  # YYYY-MM-DD chosen by the requester
    preferred_slot = Column(String, nullable=True)  # morning | afternoon | evening | anytime
    status = Column(String, nullable=False, default="OPEN", index=True)  # OPEN | ACCEPTED | COMPLETED | CANCELLED
    pickup_pin = Column(String(4), nullable=False)
    collector_id = Column(String, nullable=True, index=True)
    collector_name = Column(String, nullable=True)
    collector_phone = Column(String, nullable=True)
    offered_price_per_kg = Column(Float, nullable=True)
    actual_weight_kg = Column(Float, nullable=True)
    amount_paid = Column(Float, nullable=True)
    lot_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


class PriceHistoryRow(Base):
    __tablename__ = "price_history"
    id = Column(String, primary_key=True)
    material = Column(String, nullable=False, index=True)
    zone = Column(String, nullable=False, index=True)
    price_per_kg = Column(Float, nullable=False)
    observed_at = Column(DateTime, nullable=False, index=True)
    source = Column(String, nullable=False, default="seed_demo")   # seed_demo | market_live
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# ─── Lifecycle ───────────────────────────────────────────────────────────────

def _add_missing_columns() -> None:
    """
    create_all() never alters existing tables, so a DB created by an older version
    would lack new columns. Add any missing *nullable* column (additive only).
    """
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name):
                continue
            existing = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name not in existing and col.nullable:
                    conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {col.type.compile(engine.dialect)}'))
                    print(f"[MHK DB] Migrated: added {table.name}.{col.name}")


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()
    db = SessionLocal()
    try:
        if db.query(LotRow).count() == 0:
            _seed_demo_lots(db)
        if db.query(RecyclerRow).count() == 0:
            _seed_recyclers_from_json(db)
        if db.query(CollectorRow).count() == 0:
            _seed_demo_collector(db)
        if db.query(DemandRow).count() == 0:
            _seed_demo_demands(db)
        if db.query(PriceHistoryRow).count() == 0:
            _seed_price_history(db)
        _link_prices_to_market(db)
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Seeders ─────────────────────────────────────────────────────────────────

def _seed_demo_lots(db) -> None:
    demo = [
        LotRow(id="lot_demo_copper_01", material="Copper cable", quality="medium",
               weight_kg=35.0, status="PICKUP_SCHEDULED",
               collector_id="CLT-4218", collector_name="Ramesh Kumar",
               latitude=18.6279, longitude=73.8488, cluster_name="Bhosari MIDC, Pune",
               created_at=datetime(2026, 3, 20, 10, 30, 0),
               expected_net_earnings=18450.0, sync_state="SYNCED", pickup_pin="1234"),
        LotRow(id="lot_demo_server_02", material="Server boards", quality="high",
               weight_kg=22.5, status="AVAILABLE",
               collector_id="CLT-4218", collector_name="Ramesh Kumar",
               latitude=18.6279, longitude=73.8488, cluster_name="Bhosari MIDC, Pune",
               created_at=datetime(2026, 3, 21, 14, 15, 0),
               expected_net_earnings=11475.0, sync_state="SYNCED", pickup_pin="5678"),
        LotRow(id="lot_demo_battery_03", material="Lithium-ion batteries", quality="high",
               weight_kg=18.0, status="IDENTIFIED",
               collector_id="CLT-9921", collector_name="Santosh Patil",
               latitude=18.6310, longitude=73.8510, cluster_name="Bhosari MIDC, Pune",
               created_at=datetime(2026, 3, 22, 8, 0, 0),
               expected_net_earnings=5040.0, sync_state="SYNCED", pickup_pin="9012"),
    ]
    for r in demo:
        db.add(r)
    db.commit()
    print(f"[MHK DB] Seeded {len(demo)} demo lots.")


def _seed_spreads(prices: dict) -> dict:
    """A seeded buyer's premium/discount vs the reference rate, e.g. 640 / 620 → 1.032."""
    from services.price_forecaster import BASE_PRICES  # local import: services import db
    return {m: round(p / BASE_PRICES[m], 4) for m, p in prices.items() if BASE_PRICES.get(m)}


def _link_prices_to_market(db) -> None:
    """
    Older databases have no price_spread_json. Link every price that is still the untouched default
    (seed-file price for demo buyers, reference × default factor for company buyers) to the market;
    prices a buyer changed in the console stay fixed.
    """
    from services.account_service import DEFAULT_BUYER_PRICE_FACTOR
    from services.price_forecaster import BASE_PRICES
    path = os.path.join(_DATA_DIR, "recyclers_seed.json")
    seed = {}
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            seed = {r["id"]: r["prices"] for r in json.load(f).get("recyclers", [])}
    changed = 0
    for row in db.query(RecyclerRow).filter(RecyclerRow.price_spread_json.is_(None)).all():
        current = json.loads(row.prices_json or "{}")
        defaults = seed.get(row.id) or {m: round(p * DEFAULT_BUYER_PRICE_FACTOR, 1) for m, p in BASE_PRICES.items()}
        spreads = {m: round(defaults[m] / BASE_PRICES[m], 4) for m, p in current.items()
                   if m in defaults and BASE_PRICES.get(m) and abs(float(p) - float(defaults[m])) < 0.051}
        row.price_spread_json = json.dumps(spreads)
        changed += 1
    if changed:
        db.commit()
        print(f"[MHK DB] Linked {changed} buyer price tables to the live market")


def _seed_recyclers_from_json(db) -> None:
    path = os.path.join(_DATA_DIR, "recyclers_seed.json")
    if not os.path.exists(path):
        print(f"[MHK DB] No recycler seed file at {path}, skipping.")
        return
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)
    rows = payload.get("recyclers", [])
    for r in rows:
        db.add(RecyclerRow(
            id=r["id"], recycler_name=r["recycler_name"], cpcb_license=r["cpcb_license"],
            rating=r["rating"], pickup_base_cost=r["pickup_base_cost"],
            handling_cost=r["handling_cost"], platform_fee=r["platform_fee"],
            payment_reliability=r["payment_reliability"],
            latitude=r["latitude"], longitude=r["longitude"],
            cluster=r.get("cluster"), prices_json=json.dumps(r["prices"]),
            price_spread_json=json.dumps(_seed_spreads(r["prices"])), is_active=1,
        ))
    db.commit()
    print(f"[MHK DB] Seeded {len(rows)} recyclers from {path}")


def _seed_demo_collector(db) -> None:
    db.add(CollectorRow(
        id="CLT-4218", phone="+919876543210", name="Ramesh Kumar",
        language="hi", operating_area="Bhosari MIDC, Pune",
        latitude=18.6279, longitude=73.8488, collection_radius_km=12.0,
        material_expertise="Copper cable,Server boards,Lithium-ion batteries",
        kyc_status="VERIFIED", kyc_aadhaar_last4="4231",
        kyc_pan_masked="ABCPX****K", kyc_bank_account_last4="8891",
        kyc_verified_at=datetime(2026, 3, 1, 10, 0, 0),
        tier="gold", rating=4.8, total_lots=47, total_weight_kg=1420.5,
        total_earnings=34800.0, created_at=datetime(2026, 1, 15, 9, 0, 0),
    ))
    db.commit()
    print("[MHK DB] Seeded demo collector CLT-4218 (phone +919876543210)")


def _seed_price_history(db) -> None:
    """Clearly-labelled demo observations (source='seed_demo') so forecasting works on day one."""
    from services.price_forecaster import BASE_PRICES, ZONE_MULTIPLIERS
    import hashlib
    rows = []
    for material, base in BASE_PRICES.items():
        for zone, zone_factor in ZONE_MULTIPLIERS.items():
            for days_ago in range(90, -1, -1):
                seed = int(hashlib.sha256(f"{material}:{zone}:{days_ago}".encode()).hexdigest()[:8], 16)
                variation = ((seed % 1001) - 500) / 10000
                trend = (90 - days_ago) * 0.00015
                price = round(base * zone_factor * (1 + variation + trend), 2)
                rows.append(PriceHistoryRow(
                    id=f"ph_{hashlib.sha1(material.encode()).hexdigest()[:6]}_{zone[:3]}_{days_ago}",
                    material=material, zone=zone, price_per_kg=price,
                    observed_at=datetime.utcnow() - timedelta(days=days_ago),
                    source="seed_demo",
                ))
    db.bulk_save_objects(rows)
    db.commit()
    print(f"[MHK DB] Seeded {len(rows)} demo price observations.")


def _seed_demo_demands(db) -> None:
    now = datetime.utcnow()
    rows = [
        DemandRow(id="demand_eco_001", recycler_id="eco-cycle",
                  recycler_name="EcoCycle Recyclers Pvt Ltd",
                  material="Copper cable", quality_required="medium",
                  quantity_kg=200.0, offered_price_per_kg=640.0,
                  deadline=now + timedelta(days=7),
                  hub="Bhosari MIDC, Pune", latitude=18.6320, longitude=73.8540,
                  notes="Smelter batch due next week. Need 200kg minimum.",
                  status="OPEN", filled_kg=0.0),
        DemandRow(id="demand_maha_002", recycler_id="maha-e-metals",
                  recycler_name="Maharashtra E-Metals Authorized Disassembler",
                  material="Server boards", quality_required="high",
                  quantity_kg=80.0, offered_price_per_kg=555.0,
                  deadline=now + timedelta(days=5),
                  hub="Hinjawadi Tech Corridor, Pune", latitude=18.5900, longitude=73.7850,
                  notes="Gold-plated server-only boards. No consumer-grade PCBs.",
                  status="OPEN", filled_kg=0.0),
        DemandRow(id="demand_green_003", recycler_id="green-loop",
                  recycler_name="GreenLoop Smelters & Refining",
                  material="Lithium-ion batteries", quality_required="high",
                  quantity_kg=120.0, offered_price_per_kg=295.0,
                  deadline=now + timedelta(days=10),
                  hub="Chakan Industrial Zone, Pune", latitude=18.6810, longitude=73.8920,
                  notes="EV battery pack recall batch. Intact cells only.",
                  status="OPEN", filled_kg=0.0),
    ]
    for r in rows:
        db.add(r)
    db.commit()
    print(f"[MHK DB] Seeded {len(rows)} demo demands.")
