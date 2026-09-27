# apps/backend/services/market_price_service.py
"""
Scrap prices from the real metals market, raised for nearby industry.

  metals & e-waste:   market value (₹/kg) = Σ content × live commodity price (₹/kg or ₹/g) × payable
  household scrap:    market value (₹/kg) = nearest city's doorstep rate card ÷ 0.70 (dealer level)
                      (data/india_rate_cards.json, 15 cities; India median beyond 150 km)
  local price         = market value × (1 + local premium)             — recipes in data/material_markets.json

Live quotes: Yahoo Finance delayed futures (copper, aluminium, steel HRC, gold, silver, palladium) and USD/INR,
fetched at most every few hours, kept in memory and in data/market_snapshot.json so the app keeps working
offline. Chain: fresh quotes → last saved snapshot ("cached") → reference rates ("reference").

Local premium (0–15%) — why the same scrap is worth more in some places:
  • industry: industrial clusters within 40 km whose sector works with this material
    (size × material share × distance decay, data/regional_context_seed.json)            up to +8%
  • buyers: verified buyers within 25 km competing for it                                 up to +4%
  • demand: open buyer demand for it within 50 km (remaining kg)                          up to +3%
"""

from __future__ import annotations

import json
import math
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import httpx
from sqlalchemy.orm import Session

from db import DemandRow, RecyclerRow
from services.price_forecaster import BASE_PRICES
from settings import DATA_DIR

MARKETS_PATH = os.path.join(DATA_DIR, "material_markets.json")
SNAPSHOT_PATH = os.path.join(DATA_DIR, "market_snapshot.json")
CLUSTERS_PATH = os.path.join(DATA_DIR, "regional_context_seed.json")
YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1mo&interval=1d"
HTTP_TIMEOUT_S = 6.0

TROY_OZ_G = 31.1035
LB_KG = 0.45359237
SHORT_TON_KG = 907.18474

INDUSTRY_RADIUS_KM, INDUSTRY_PCT_PER_UNIT, INDUSTRY_CAP = 40.0, 5.0, 8.0
BUYER_RADIUS_KM, BUYER_PCT_EACH, BUYER_CAP = 25.0, 1.0, 4.0
DEMAND_RADIUS_KM, DEMAND_KG_PER_PCT, DEMAND_CAP = 50.0, 250.0, 3.0
PREMIUM_CAP = 15.0
PREMIUM_TTL_S = 600
RETRY_AFTER_S = 300        # after a failed fetch, don't try again for 5 minutes (offline must not stall requests)

_lock = threading.Lock()
_refreshing = threading.Event()
_last_failure = 0.0
_market: Optional[dict] = None          # {"fetched_at", "fx", "quotes": {name: {...}}}
_premium_cache: Dict[Tuple[str, float, float], Tuple[float, Tuple[float, List[dict]]]] = {}
_config_cache: Optional[dict] = None
_clusters_cache: Optional[dict] = None
_cards_cache: Optional[dict] = None


# ─── Config ──────────────────────────────────────────────────────────────────

def config() -> dict:
    global _config_cache
    if _config_cache is None:
        with open(MARKETS_PATH, encoding="utf-8") as f:
            _config_cache = json.load(f)
    return _config_cache


def _clusters() -> dict:
    global _clusters_cache
    if _clusters_cache is None:
        try:
            with open(CLUSTERS_PATH, encoding="utf-8") as f:
                _clusters_cache = json.load(f)
        except FileNotFoundError:
            _clusters_cache = {"clusters": [], "sector_profiles": {}}
    return _clusters_cache


def rate_cards() -> dict:
    global _cards_cache
    if _cards_cache is None:
        path = os.path.join(DATA_DIR, config().get("rate_cards", {}).get("path", "india_rate_cards.json"))
        try:
            with open(path, encoding="utf-8") as f:
                _cards_cache = json.load(f)
        except FileNotFoundError:
            _cards_cache = {"cities": {}, "items": {}}
    return _cards_cache


def rate_card(item: str, lat: Optional[float] = None, lon: Optional[float] = None) -> Optional[Tuple[float, str, Optional[float]]]:
    """(doorstep ₹, where the rate is from, distance km) — the nearest city within the radius, else the India median."""
    cards = rate_cards()
    entry = cards["items"].get(item)
    if not entry:
        return None
    radius = float(config().get("rate_cards", {}).get("radius_km", 150))
    if lat is not None and lon is not None:
        best = None
        for key, value in entry["cities"].items():
            city = cards["cities"].get(key)
            if not city:
                continue
            d = _haversine_km(lat, lon, city["latitude"], city["longitude"])
            if d <= radius and (best is None or d < best[2]):
                best = (float(value), city["name"], round(d, 1))
        if best:
            return best
    return float(entry["national"]["median"]), "India median", None


def doorstep_factor() -> float:
    return float(config().get("rate_cards", {}).get("doorstep_factor", 0.70))


def feed_enabled() -> bool:
    return os.getenv("MHK_MARKET_FEED", "on").strip().lower() not in ("off", "0", "false", "no")


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


# ─── Live quotes ─────────────────────────────────────────────────────────────

def _fetch_symbol(client: httpx.Client, symbol: str) -> dict:
    """Latest price + daily closes (oldest → newest) for one Yahoo symbol."""
    res = client.get(YAHOO_URL.format(symbol=symbol))
    res.raise_for_status()
    result = res.json()["chart"]["result"][0]
    closes = [c for c in (result.get("indicators", {}).get("quote", [{}])[0].get("close") or []) if c]
    stamps = result.get("timestamp") or []
    price = result["meta"].get("regularMarketPrice") or (closes[-1] if closes else None)
    if not price:
        raise ValueError(f"no price for {symbol}")
    days = [datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d") for t in stamps][-len(closes):] if stamps else []
    return {"price": float(price), "closes": [float(c) for c in closes], "days": days}


def _to_inr(value_usd: float, unit: str, fx: float) -> Tuple[float, str]:
    """Convert a quote to ₹ per kg (base metals) or ₹ per gram (precious metals)."""
    if unit == "usd_per_lb":
        return value_usd / LB_KG * fx, "kg"
    if unit == "usd_per_tonne":
        return value_usd / 1000 * fx, "kg"
    if unit == "usd_per_short_ton":
        return value_usd / SHORT_TON_KG * fx, "kg"
    if unit == "usd_per_troy_oz":
        return value_usd / TROY_OZ_G * fx, "g"
    raise ValueError(unit)


def fetch_live() -> dict:
    """Fetch every commodity + USD/INR in parallel. Raises if the FX rate or any quote fails."""
    cfg = config()
    symbols = {name: c["symbol"] for name, c in cfg["commodities"].items()}
    symbols["_fx"] = cfg["fx_symbol"]
    with httpx.Client(timeout=HTTP_TIMEOUT_S, headers={"User-Agent": "Mozilla/5.0 (MaiHuKabadiwala price feed)"}) as client:
        with ThreadPoolExecutor(max_workers=len(symbols)) as pool:
            raw = dict(zip(symbols, pool.map(lambda s: _fetch_symbol(client, s), symbols.values())))
    fx = raw.pop("_fx")["price"]
    quotes = {}
    for name, q in raw.items():
        unit = cfg["commodities"][name]["unit"]
        inr, per = _to_inr(q["price"], unit, fx)
        quotes[name] = {
            "label": cfg["commodities"][name]["label"], "symbol": symbols[name], "usd": q["price"], "usd_unit": unit,
            "inr": round(inr, 3), "per": per,
            "history_inr": [round(_to_inr(c, unit, fx)[0], 3) for c in q["closes"][-8:]],
            "history_days": q["days"][-8:],
        }
    return {"fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "fx": round(fx, 4), "quotes": quotes}


def _age_hours(snapshot: dict) -> float:
    try:
        t = datetime.fromisoformat(snapshot["fetched_at"])
        return (datetime.now(timezone.utc) - t).total_seconds() / 3600
    except Exception:
        return 1e9


def _refresh() -> None:
    global _market, _last_failure
    try:
        snap = fetch_live()
        with _lock:
            _market = snap
            _premium_cache.clear()
        with open(SNAPSHOT_PATH, "w", encoding="utf-8") as f:
            json.dump(snap, f, indent=1)
        print(f"[MHK market] live quotes updated (USD/INR {snap['fx']})")
    except Exception as e:  # noqa: BLE001 — network/format errors fall back to the last snapshot
        _last_failure = time.time()
        print(f"[MHK market] live refresh failed, keeping last known prices: {e}")
    finally:
        _refreshing.clear()


def market() -> Tuple[Optional[dict], str]:
    """(snapshot or None, mode) where mode is 'live' | 'cached' | 'reference'. Never blocks on a stale cache."""
    global _market
    if not feed_enabled():
        return None, "reference"
    refresh_h = float(config()["source"].get("refresh_hours", 6))
    with _lock:
        if _market is None and os.path.exists(SNAPSHOT_PATH):
            try:
                with open(SNAPSHOT_PATH, encoding="utf-8") as f:
                    _market = json.load(f)
            except Exception:
                _market = None
        snap = _market
    backing_off = time.time() - _last_failure < RETRY_AFTER_S
    if snap is None:
        # First run: fetch once, synchronously (≈1 s). After a failure, reference rates until the back-off ends.
        if not _refreshing.is_set() and not backing_off:
            _refreshing.set()
            _refresh()
        with _lock:
            snap = _market
        return (snap, "live") if snap else (None, "reference")
    if _age_hours(snap) > refresh_h and not _refreshing.is_set() and not backing_off:
        _refreshing.set()
        threading.Thread(target=_refresh, daemon=True).start()
    return snap, ("live" if _age_hours(snap) <= refresh_h * 2 else "cached")


# ─── Material values ─────────────────────────────────────────────────────────

def _value_from(content: Dict[str, float], payable: float, price_of) -> Optional[float]:
    total = 0.0
    for key, amount in content.items():
        name = key[:-2] if key.endswith("_g") else key
        p = price_of(name)
        if p is None:
            return None
        total += amount * p
    return total * payable


def market_price(material: str, snap: Optional[dict] = None, mode: Optional[str] = None,
                 lat: Optional[float] = None, lon: Optional[float] = None) -> Tuple[float, str, List[float]]:
    """(₹/kg dealer-level market value, basis 'live'|'rate_card'|'reference', recent daily values oldest → newest)."""
    spec = config()["materials"].get(material)
    ref = float(BASE_PRICES.get(material, 85.0))
    if spec and "rate_card" in spec:
        card = rate_card(spec["rate_card"], lat, lon)
        if card:
            return _round(card[0] / doorstep_factor()), "rate_card", []
        return _round(ref), "reference", []
    if snap is None and mode is None:
        snap, mode = market()
    if not spec or "reference" in spec or snap is None:
        value = float(spec["reference"]) if spec and "reference" in spec else ref
        return _round(value), "reference", []
    quotes = snap["quotes"]
    now = _value_from(spec["content"], spec["payable"], lambda n: quotes[n]["inr"] if n in quotes else None)
    if now is None:
        return _round(ref), "reference", []
    depth = min(len(quotes[k[:-2] if k.endswith("_g") else k]["history_inr"]) for k in spec["content"])
    history = []
    for i in range(depth):
        v = _value_from(spec["content"], spec["payable"], lambda n: quotes[n]["history_inr"][-depth + i])
        if v is not None:
            history.append(_round(v))
    return _round(now), "live", history


def _round(v: float) -> float:
    return float(round(v)) if v >= 100 else round(v, 1)


# ─── Local premium ───────────────────────────────────────────────────────────

def _buys(row: RecyclerRow, material: str) -> bool:
    """Whether a buyer lists this material (fixed price or market-linked)."""
    if material in json.loads(row.prices_json or "{}"):
        return True
    return bool(getattr(row, "price_spread_json", None)) and material in json.loads(row.price_spread_json)


def local_premium(db: Session, material: str, lat: float, lon: float) -> Tuple[float, List[dict]]:
    """(premium %, reasons) for this material at this point. Cached for 10 minutes per ~1 km."""
    key = (material, round(lat, 2), round(lon, 2))
    hit = _premium_cache.get(key)
    if hit and time.time() - hit[0] < PREMIUM_TTL_S:
        return hit[1]

    reasons: List[dict] = []
    seed = _clusters()
    profiles = seed.get("sector_profiles", {})
    industry = 0.0
    parts = []
    for c in seed.get("clusters", []):
        d = _haversine_km(lat, lon, c["latitude"], c["longitude"])
        share = profiles.get(c["sector"], {}).get("materials", {}).get(material, 0.0)
        if d > INDUSTRY_RADIUS_KM or share <= 0:
            continue
        w = c.get("size", 1) * share * (1 - d / INDUSTRY_RADIUS_KM)
        industry += w
        parts.append((w, c, d))
    industry_pct = min(INDUSTRY_CAP, industry * INDUSTRY_PCT_PER_UNIT)
    # Each area's share of the (capped) industry premium, so the reasons shown add up to the premium.
    scale = industry_pct / industry if industry else 0.0
    parts.sort(key=lambda p: p[0], reverse=True)
    for w, c, d in parts[:3]:
        reasons.append({"kind": "industry", "label": c["name"], "detail": profiles[c["sector"]].get("label", c["sector"]),
                        "distance_km": round(d, 1), "pct": round(w * scale, 1)})
    if len(parts) > 3:
        rest = sum(w for w, _, _ in parts[3:])
        reasons.append({"kind": "industry", "label": f"{len(parts) - 3} more industrial areas", "detail": f"within {int(INDUSTRY_RADIUS_KM)} km",
                        "distance_km": None, "pct": round(rest * scale, 1)})

    buyers = [r for r in db.query(RecyclerRow).filter(RecyclerRow.is_active == 1).all()
              if _buys(r, material) and _haversine_km(lat, lon, r.latitude, r.longitude) <= BUYER_RADIUS_KM]
    buyer_pct = min(BUYER_CAP, len(buyers) * BUYER_PCT_EACH)
    if buyers:
        reasons.append({"kind": "buyers", "label": f"{len(buyers)} verified buyers", "detail": f"within {int(BUYER_RADIUS_KM)} km",
                        "distance_km": None, "pct": round(buyer_pct, 1)})

    open_kg = 0.0
    buyer_at = {r.id: (r.latitude, r.longitude) for r in db.query(RecyclerRow).all()}
    for dmd in db.query(DemandRow).filter(DemandRow.status.in_(["OPEN", "PARTIAL"]), DemandRow.material == material).all():
        # Demand posted without a location is placed at the buyer's premises.
        where = (dmd.latitude, dmd.longitude) if dmd.latitude is not None and dmd.longitude is not None else buyer_at.get(dmd.recycler_id)
        if not where:
            continue
        if _haversine_km(lat, lon, where[0], where[1]) <= DEMAND_RADIUS_KM:
            open_kg += max(0.0, dmd.quantity_kg - (dmd.filled_kg or 0.0))
    demand_pct = min(DEMAND_CAP, open_kg / DEMAND_KG_PER_PCT)
    if open_kg > 0:
        reasons.append({"kind": "demand", "label": f"{round(open_kg):,} kg open demand", "detail": f"within {int(DEMAND_RADIUS_KM)} km",
                        "distance_km": None, "pct": round(demand_pct, 1)})

    pct = round(min(PREMIUM_CAP, industry_pct + buyer_pct + demand_pct), 1)
    result = (pct, reasons)
    _premium_cache[key] = (time.time(), result)
    return result


def price_source(material: str, lat: Optional[float] = None, lon: Optional[float] = None) -> str:
    """Human-readable basis, e.g. 'COMEX copper (live)' or 'Pune rate card' — shown next to prices."""
    spec = config()["materials"].get(material) or {}
    if "rate_card" in spec:
        card = rate_card(spec["rate_card"], lat, lon)
        return f"{card[1]} rate card" if card else "reference rate"
    if "reference" in spec:
        return "reference rate"
    snap, mode = market()
    if snap is None:
        return "reference rate"
    names = [config()["commodities"][k[:-2] if k.endswith("_g") else k]["label"] for k in spec.get("content", {})]
    return f"{', '.join(names)} ({'live' if mode == 'live' else 'last known'})"


def local_price(db: Session, material: str, lat: float, lon: float) -> float:
    base, _, _ = market_price(material, lat=lat, lon=lon)
    pct, _ = local_premium(db, material, lat, lon)
    return _round(base * (1 + pct / 100))


# ─── Buyer price tables ──────────────────────────────────────────────────────

def buyer_prices(db: Session, row: RecyclerRow) -> Dict[str, float]:
    """
    Effective ₹/kg a buyer pays. Materials in price_spread_json follow the market at the buyer's location
    (local price × spread); the rest are the fixed prices the buyer set in the console.
    """
    prices = json.loads(row.prices_json or "{}")
    spreads = json.loads(row.price_spread_json or "{}") if getattr(row, "price_spread_json", None) else {}
    for material, spread in spreads.items():
        prices[material] = _round(local_price(db, material, row.latitude, row.longitude) * float(spread))
    return prices


def market_linked(row: RecyclerRow) -> List[str]:
    return sorted(json.loads(row.price_spread_json or "{}").keys()) if getattr(row, "price_spread_json", None) else []


def status() -> dict:
    """For /health."""
    if not feed_enabled():
        return {"status": "reference", "reason": "MHK_MARKET_FEED=off"}
    snap, mode = market()
    return {"status": "real" if mode == "live" else mode, "source": config()["source"]["name"],
            "fetched_at": snap["fetched_at"] if snap else None, "usd_inr": snap["fx"] if snap else None}
