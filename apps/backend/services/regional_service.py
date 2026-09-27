# apps/backend/services/regional_service.py
"""
Regional e-waste intelligence around a point.

  • Grid (~2 km cells) of live platform activity: unsold supply, open pickups,
    open recycler demand, recyclers, and nearby industry clusters.
  • Hotspots: cells scoring high on supply + demand + industry potential, with reasons.
  • Industry clusters → expected e-waste mix (heuristic sector profiles from
    data/regional_context_seed.json) valued at today's best listed prices.
  • Material balance: where demand outruns local supply.
  • Price heatmap: best net ₹/kg a collector standing in each cell would get for a material.

Everything except the cluster seed file is computed from live data.
"""

from __future__ import annotations

import json
import math
import os
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from db import DemandRow, LotRow, PickupRequestRow, RecyclerRow
from models.domain import (
    PriceHeatCell,
    PriceHeatmapResponse,
    RegionalCell,
    RegionalCluster,
    RegionalClusterMaterial,
    RegionalDataset,
    RegionalHotspot,
    RegionalMaterialBalance,
    RegionalOverviewResponse,
    RegionalRecycler,
)
from services import market_price_service, recycler_service
from services.recycler_service import _haversine_km
from settings import DATA_DIR

CELL_DEG = 0.02            # ≈ 2.2 km
HEATMAP_STEPS = 10         # price heatmap is HEATMAP_STEPS × HEATMAP_STEPS
UNSOLD = ("DRAFT", "IDENTIFIED", "AVAILABLE", "MATCHED", "PICKUP_SCHEDULED")
SEED_PATH = os.path.join(DATA_DIR, "regional_context_seed.json")

_seed_cache: Optional[dict] = None


def load_seed() -> dict:
    """Cluster seed file (read once; edit the JSON and restart to change it)."""
    global _seed_cache
    if _seed_cache is None:
        try:
            with open(SEED_PATH, encoding="utf-8") as f:
                _seed_cache = json.load(f)
        except FileNotFoundError:
            _seed_cache = {"clusters": [], "sector_profiles": {}, "source": {"name": "none", "approximate": True}}
    return _seed_cache


def _cell_key(lat: float, lon: float) -> Tuple[int, int]:
    return math.floor(lat / CELL_DEG), math.floor(lon / CELL_DEG)


def _cell_center(key: Tuple[int, int]) -> Tuple[float, float]:
    return round((key[0] + 0.5) * CELL_DEG, 5), round((key[1] + 0.5) * CELL_DEG, 5)


def _best_listed_prices(db: Session, recyclers: List[RecyclerRow]) -> Dict[str, float]:
    best: Dict[str, float] = {}
    for r in recyclers:
        for mat, p in market_price_service.buyer_prices(db, r).items():
            best[mat] = max(best.get(mat, 0.0), float(p))
    return best


def _norm(values: Dict[Tuple[int, int], float]) -> Dict[Tuple[int, int], float]:
    top = max(values.values(), default=0.0)
    return {k: (v / top if top > 0 else 0.0) for k, v in values.items()}


def overview(db: Session, latitude: float, longitude: float, radius_km: float) -> RegionalOverviewResponse:
    near = lambda lat, lon: lat is not None and lon is not None and _haversine_km(latitude, longitude, lat, lon) <= radius_km  # noqa: E731

    lots = [l for l in db.query(LotRow).all() if near(l.latitude, l.longitude)]
    pickups = [p for p in db.query(PickupRequestRow).filter(PickupRequestRow.status == "OPEN").all() if near(p.latitude, p.longitude)]
    demands = [d for d in db.query(DemandRow).filter(DemandRow.status.in_(["OPEN", "PARTIAL"])).all() if near(d.latitude, d.longitude)]
    recyclers = [r for r in db.query(RecyclerRow).filter(RecyclerRow.is_active == 1).all() if near(r.latitude, r.longitude)]
    seed = load_seed()
    profiles = seed.get("sector_profiles", {})
    clusters = [c for c in seed.get("clusters", []) if near(c["latitude"], c["longitude"])]
    best_price = _best_listed_prices(db, db.query(RecyclerRow).filter(RecyclerRow.is_active == 1).all())

    # ── Grid
    acc: Dict[Tuple[int, int], Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for l in lots:
        c = acc[_cell_key(l.latitude, l.longitude)]
        c["collected_kg"] += l.weight_kg
        if l.status in UNSOLD:
            c["supply_kg"] += l.weight_kg
    for p in pickups:
        c = acc[_cell_key(p.latitude, p.longitude)]
        c["pickup_kg"] += p.estimated_weight_kg
        c["pickups"] += 1
    for d in demands:
        acc[_cell_key(d.latitude, d.longitude)]["demand_kg"] += max(0.0, d.quantity_kg - d.filled_kg)
    for r in recyclers:
        acc[_cell_key(r.latitude, r.longitude)]["recyclers"] += 1
    cluster_cells: Dict[Tuple[int, int], List[dict]] = defaultdict(list)
    for c in clusters:
        key = _cell_key(c["latitude"], c["longitude"])
        acc[key]["industry"] += c.get("size", 1)
        cluster_cells[key].append(c)

    supply_n = _norm({k: v["supply_kg"] + v["pickup_kg"] for k, v in acc.items()})
    demand_n = _norm({k: v["demand_kg"] for k, v in acc.items()})
    industry_n = _norm({k: v["industry"] for k, v in acc.items()})
    score = {k: round(100 * (0.35 * supply_n[k] + 0.25 * demand_n[k] + 0.40 * industry_n[k]), 1) for k in acc}

    cells = []
    for k, v in acc.items():
        lat, lon = _cell_center(k)
        cells.append(RegionalCell(
            latitude=lat, longitude=lon, supply_kg=round(v["supply_kg"], 1), collected_kg=round(v["collected_kg"], 1),
            pickup_kg=round(v["pickup_kg"], 1), pickups=int(v["pickups"]), demand_kg=round(v["demand_kg"], 1),
            recyclers=int(v["recyclers"]), industry=round(v["industry"], 1), score=score[k],
        ))
    cells.sort(key=lambda c: c.score, reverse=True)

    # ── Hotspots with human reasons
    hotspots = []
    for k in sorted(score, key=score.get, reverse=True)[:6]:  # type: ignore[arg-type]
        if score[k] <= 0:
            continue
        v, reasons = acc[k], []
        if supply_n[k] >= 0.3:
            reasons.append("SUPPLY")
        if v["pickups"]:
            reasons.append("PICKUPS")
        if demand_n[k] >= 0.3:
            reasons.append("DEMAND")
        if v["industry"]:
            reasons.append("INDUSTRY")
        lat, lon = _cell_center(k)
        nearest = min(clusters, key=lambda c: _haversine_km(lat, lon, c["latitude"], c["longitude"]), default=None)
        hotspots.append(RegionalHotspot(
            latitude=lat, longitude=lon, score=score[k], reasons=reasons,
            area=(cluster_cells[k][0]["name"] if cluster_cells[k] else (nearest["name"] if nearest else None)),
            distance_km=round(_haversine_km(latitude, longitude, lat, lon), 1),
        ))

    # ── Industry clusters → expected e-waste, valued at today's best prices
    demand_by_mat: Dict[str, float] = defaultdict(float)
    for d in demands:
        demand_by_mat[d.material] += max(0.0, d.quantity_kg - d.filled_kg)
    raw_scores = []
    for c in clusters:
        prof = profiles.get(c["sector"], {"label": c["sector"], "materials": {}})
        mats = sorted(prof["materials"].items(), key=lambda kv: kv[1], reverse=True)
        value_index = sum(share * best_price.get(m, 0.0) for m, share in mats)  # ₹ per kg of this cluster's typical mix
        dist = _haversine_km(latitude, longitude, c["latitude"], c["longitude"])
        wanted = sum(demand_by_mat[m] for m, _ in mats)
        raw = value_index * c.get("size", 1) * (1 + min(wanted, 1000) / 1000) / (1 + dist / 10)
        raw_scores.append((c, prof, mats, value_index, dist, wanted, raw))
    top_raw = max((r[-1] for r in raw_scores), default=0.0) or 1.0
    out_clusters = sorted(
        (RegionalCluster(
            id=c["id"], name=c["name"], sector=c["sector"], sector_label=prof.get("label", c["sector"]),
            latitude=c["latitude"], longitude=c["longitude"], size=c.get("size", 1),
            distance_km=round(dist, 1), value_per_kg=round(value_index, 1), open_demand_kg=round(wanted, 1),
            opportunity_score=round(raw / top_raw * 100, 1),
            materials=[RegionalClusterMaterial(material=m, share=share, best_price_per_kg=best_price.get(m)) for m, share in mats],  # type: ignore[arg-type]
        ) for c, prof, mats, value_index, dist, wanted, raw in raw_scores),
        key=lambda c: c.opportunity_score, reverse=True,
    )

    # ── Material balance (region): supply vs demand
    supply_by_mat: Dict[str, float] = defaultdict(float)
    for l in lots:
        if l.status in UNSOLD:
            supply_by_mat[l.material] += l.weight_kg
    for p in pickups:
        supply_by_mat[p.material] += p.estimated_weight_kg
    balance = sorted(
        (RegionalMaterialBalance(
            material=m, supply_kg=round(supply_by_mat[m], 1), demand_kg=round(demand_by_mat[m], 1),  # type: ignore[arg-type]
            gap_kg=round(demand_by_mat[m] - supply_by_mat[m], 1), best_price_per_kg=best_price.get(m),
        ) for m in set(supply_by_mat) | set(demand_by_mat) if supply_by_mat[m] or demand_by_mat[m]),
        key=lambda b: b.gap_kg, reverse=True,
    )

    src = seed.get("source", {})
    return RegionalOverviewResponse(
        latitude=latitude, longitude=longitude, radius_km=radius_km, cell_deg=CELL_DEG,
        cells=cells, hotspots=hotspots, clusters=out_clusters, balance=balance,
        recyclers=[RegionalRecycler(id=r.id, name=r.recycler_name, latitude=r.latitude, longitude=r.longitude) for r in recyclers],
        dataset=RegionalDataset(name=src.get("name", "unknown"), approximate=bool(src.get("approximate", True)),
                                clusters=len(seed.get("clusters", [])), retrieved_on=src.get("retrieved_on")),
    )


def price_heatmap(db: Session, material: str, latitude: float, longitude: float, radius_km: float) -> PriceHeatmapResponse:
    """Best net ₹/kg (35 kg lot, after pickup/handling/platform costs) at each point of a grid."""
    dlat = radius_km / 111.0
    dlon = radius_km / (111.0 * max(0.2, math.cos(math.radians(latitude))))
    step_lat, step_lon = 2 * dlat / HEATMAP_STEPS, 2 * dlon / HEATMAP_STEPS
    cells: List[PriceHeatCell] = []
    for i in range(HEATMAP_STEPS):
        for j in range(HEATMAP_STEPS):
            lat = latitude - dlat + (i + 0.5) * step_lat
            lon = longitude - dlon + (j + 0.5) * step_lon
            offers = recycler_service.match_recyclers_spatially(db, lat, lon, material, weight_kg=35.0)
            best = max(offers, key=lambda o: o.net_earnings, default=None)
            cells.append(PriceHeatCell(
                latitude=round(lat, 5), longitude=round(lon, 5),
                best_net_per_kg=round(best.net_earnings / 35.0, 1) if best else None,
                best_recycler=best.recycler_name if best else None,
            ))
    priced = [c.best_net_per_kg for c in cells if c.best_net_per_kg is not None]
    return PriceHeatmapResponse(
        material=material, latitude=latitude, longitude=longitude, radius_km=radius_km,  # type: ignore[arg-type]
        step_lat=round(step_lat, 5), step_lon=round(step_lon, 5), cells=cells,
        min_price=min(priced) if priced else None, max_price=max(priced) if priced else None,
    )
