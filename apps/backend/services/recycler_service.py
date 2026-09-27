# apps/backend/services/recycler_service.py
"""
Recycler directory + spatial matching — reads from SQLite, not a hardcoded list.

The recycler list is seeded from data/recyclers_seed.json on first DB init.
To update the directory, edit that JSON and delete data/mhk.db (or add a
migration), then restart the server.
"""

from __future__ import annotations

import json
import math
from typing import List

from sqlalchemy.orm import Session

from db import RecyclerRow
from services import market_price_service
from models.domain import GeoLocation, RecyclerOffer


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 1)


def generate_postgis_sql_query(lat: float, lon: float, radius_meters: int = 25000) -> str:
    """Return the PostGIS SQL that production would use (for audit/docs)."""
    return f"""
    SELECT id, recycler_name, cpcb_license, rating,
           ST_Distance(geom, ST_SetSRID(ST_MakePoint({lon}, {lat}), 4326)::geography) / 1000.0 AS distance_km
    FROM recyclers
    WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint({lon}, {lat}), 4326)::geography, {radius_meters})
      AND is_active = TRUE
    ORDER BY distance_km ASC;
    """.strip()


def match_recyclers_spatially(
    db: Session,
    collector_lat: float,
    collector_lon: float,
    material: str,
    weight_kg: float = 35.0,
    max_radius_km: float = 30.0,
) -> List[RecyclerOffer]:
    """
    Score every active recycler by net take-home earnings.
    Pricing per material comes from each recycler's JSON price table.
    """
    rows = db.query(RecyclerRow).filter(RecyclerRow.is_active == 1).all()
    offers: List[RecyclerOffer] = []

    for r in rows:
        dist_km = _haversine_km(collector_lat, collector_lon, r.latitude, r.longitude)
        if dist_km > max_radius_km:
            continue

        prices = market_price_service.buyer_prices(db, r)
        listed_price = prices.get(material)
        if not listed_price:
            continue  # this buyer doesn't buy this material

        variable_pickup = max(0.0, (dist_km - 2.0) * 15.0)
        total_pickup = r.pickup_base_cost + variable_pickup

        gross = listed_price * weight_kg
        net = max(0.0, gross - total_pickup - r.handling_cost - r.platform_fee)

        offers.append(RecyclerOffer(
            id=r.id,
            recycler_name=r.recycler_name,
            verified=True,
            cpcb_license=r.cpcb_license,
            rating=r.rating,
            listed_price_per_kg=float(listed_price),
            pickup_cost=round(total_pickup, 1),
            handling_cost=float(r.handling_cost),
            platform_fee=float(r.platform_fee),
            distance_km=dist_km,
            payment_reliability=r.payment_reliability,
            net_earnings=round(net, 1),
            location=GeoLocation(
                latitude=r.latitude, longitude=r.longitude,
                cluster_name=r.cluster or "Pune Region",
            ),
        ))

    offers.sort(key=lambda x: x.net_earnings, reverse=True)
    return offers