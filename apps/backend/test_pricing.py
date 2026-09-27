# apps/backend/test_pricing.py
"""
Pricing tests — every place a price is made or used.

  python -m pytest test_pricing.py -q                 (offline, deterministic)
  MHK_LIVE_TESTS=1 python -m pytest test_pricing.py   (also checks the real exchange feed)

Uses a throwaway SQLite DB (never data/mhk.db). The live feed is replaced by fixed snapshots
unless a test says otherwise.
"""

import json
import os
import tempfile
import time
from datetime import datetime, timedelta, timezone

_TMP = tempfile.mkdtemp(prefix="mhk_price_test_")
os.environ.setdefault("MHK_DB_PATH", os.path.join(_TMP, "test.db"))
os.environ.setdefault("HF_API_TOKEN", "")
os.environ.setdefault("GEMINI_API_KEY", "")
os.environ.setdefault("VISION_BACKEND", "off")
os.environ["MHK_MARKET_FEED"] = "off"

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from db import DB_PATH, RecyclerRow, SessionLocal  # noqa: E402
from main import app  # noqa: E402
from models.domain import MaterialType  # noqa: E402
from services import market_price_service as mps  # noqa: E402
from services.price_forecaster import BASE_PRICES  # noqa: E402

assert "mhk_" in DB_PATH and "data" + os.sep + "mhk.db" not in DB_PATH, "Refusing to run against the real database"

client = TestClient(app)
ALL_MATERIALS = list(MaterialType.__args__)
BHOSARI = (18.6279, 73.8488)
MUMBAI = (19.0760, 72.8777)
GUWAHATI = (26.1445, 91.7362)   # far from every rate-card city and industry cluster
DOOR = 0.70


def snapshot(age_hours: float = 0.0, **overrides) -> dict:
    """A fixed exchange snapshot (₹/kg for base metals, ₹/g for precious metals)."""
    quotes = {
        "copper": 1400.0, "aluminium": 330.0, "steel": 140.0,
        "gold": 13000.0, "silver": 200.0, "palladium": 3900.0,
    }
    quotes.update(overrides)
    t = datetime.now(timezone.utc) - timedelta(hours=age_hours)
    return {"fetched_at": t.isoformat(timespec="seconds"), "fx": 95.0,
            "quotes": {k: {"inr": v, "history_inr": [v * 0.95, v * 0.98, v]} for k, v in quotes.items()}}


@pytest.fixture(autouse=True)
def fresh_state(monkeypatch, tmp_path):
    """Isolate module caches and the snapshot file for every test."""
    monkeypatch.setattr(mps, "SNAPSHOT_PATH", str(tmp_path / "market_snapshot.json"))
    monkeypatch.setattr(mps, "_market", None)
    monkeypatch.setattr(mps, "_last_failure", 0.0)
    mps._refreshing.clear()
    mps._premium_cache.clear()
    yield
    mps._premium_cache.clear()
    mps._refreshing.clear()


def use_snapshot(monkeypatch, snap=None, mode="live"):
    snap = snap or snapshot()
    monkeypatch.setattr(mps, "market", lambda: (snap, mode))
    return snap


# ─── 1. Data files ───────────────────────────────────────────────────────────

def test_every_material_has_a_price_recipe_and_reference():
    cfg = mps.config()
    assert set(cfg["materials"]) == set(ALL_MATERIALS) == set(BASE_PRICES)
    for m, spec in cfg["materials"].items():
        kinds = [k for k in ("content", "reference", "rate_card") if k in spec]
        assert len(kinds) == 1, (m, kinds)
        if "content" in spec:
            assert 0 < spec["payable"] <= 1, m
            for key, amount in spec["content"].items():
                assert (key[:-2] if key.endswith("_g") else key) in cfg["commodities"], (m, key)
                assert amount > 0
        if "rate_card" in spec:
            item = mps.rate_cards()["items"][spec["rate_card"]]
            assert item["unit"] == "kg", (m, "rate card must be per kg")
    for name, c in cfg["commodities"].items():
        assert c["unit"] in ("usd_per_lb", "usd_per_tonne", "usd_per_short_ton", "usd_per_troy_oz"), name


def test_rate_card_dataset_is_clean():
    cards = mps.rate_cards()
    assert len(cards["cities"]) == 15 and cards["source"]["official"] is False
    for key, c in cards["cities"].items():
        assert 8 <= c["latitude"] <= 36 and 68 <= c["longitude"] <= 97, key   # inside India
    for name, item in cards["items"].items():
        vals = list(item["cities"].values())
        assert vals and all(v > 0 for v in vals), name
        n = item["national"]
        assert n["min"] <= n["median"] <= n["max"] and n["cities"] == len(vals), name
        assert max(vals) <= n["median"] * 3 and min(vals) >= n["median"] / 3, name   # outlier rule held
        assert set(item["cities"]) <= set(cards["cities"]), name
    assert all(d["reason"] for d in cards["dropped"])


def test_rate_card_builder_cleaning_rules(tmp_path):
    from tools.build_rate_cards import build
    raw = tmp_path / "raw_rate_cards_2026-01-01.txt"
    raw.write_text("\n".join([
        "## pune", "Newspaper | 10 | kg", "Iron | 24 | kg", "Tin | 0 | kg",
        "## mumbai", "Newspaper | 12 | kg", "Iron | 1000 | pcs", "Tin | 15 | kg",
        "## delhi", "Newspaper | 90 | kg", "Iron | 26 | kg", "Tin | 16 | kg",
        "## jaipur", "Newspaper | 11 | kg", "Iron | 25 | kg",
    ]), encoding="utf-8")
    out = build(str(raw))
    reasons = {(d["item"], d["city"]): d["reason"] for d in out["dropped"]}
    assert "unit" in reasons[("Iron", "mumbai")]                 # wrong unit
    assert "zero" in reasons[("Tin", "pune")]                     # not bought
    assert "outlier" in reasons[("Newspaper", "delhi")]           # 90 vs median 11.5
    assert out["items"]["Newspaper"]["cities"] == {"jaipur": 11, "mumbai": 12, "pune": 10}
    assert out["items"]["Iron"]["national"]["median"] == 25 and out["source"]["retrieved_on"] == "2026-01-01"


# ─── 2. Exchange feed ────────────────────────────────────────────────────────

def test_unit_conversions():
    assert mps._to_inr(1.0, "usd_per_lb", 100)[0] == pytest.approx(220.462, rel=1e-4)
    assert mps._to_inr(1000.0, "usd_per_tonne", 100) == (100.0, "kg")
    assert mps._to_inr(907.18474, "usd_per_short_ton", 100)[0] == pytest.approx(100.0)
    assert mps._to_inr(31.1035, "usd_per_troy_oz", 100) == (pytest.approx(100.0), "g")
    with pytest.raises(ValueError):
        mps._to_inr(1, "usd_per_bushel", 100)


def _yahoo(price, closes, stamps=None):
    return {"chart": {"result": [{"meta": {"regularMarketPrice": price}, "timestamp": stamps or [1790000000 + 86400 * i for i in range(len(closes))],
                                  "indicators": {"quote": [{"close": closes}]}}]}}


def test_fetch_symbol_parses_yahoo_and_skips_gaps():
    transport = httpx.MockTransport(lambda req: httpx.Response(200, json=_yahoo(4.5, [4.0, None, 4.2, 4.4])))
    with httpx.Client(transport=transport) as c:
        q = mps._fetch_symbol(c, "HG=F")
    assert q["price"] == 4.5 and q["closes"] == [4.0, 4.2, 4.4] and len(q["days"]) == 3


def test_fetch_live_converts_every_commodity(monkeypatch):
    usd = {"HG=F": 5.0, "ALI=F": 3000.0, "HRC=F": 1000.0, "GC=F": 4000.0, "SI=F": 50.0, "PA=F": 1200.0, "INR=X": 90.0}

    def handler(req):
        sym = req.url.path.rsplit("/", 1)[-1]
        return httpx.Response(200, json=_yahoo(usd[sym], [usd[sym]] * 10))
    real_client = httpx.Client
    monkeypatch.setattr(mps.httpx, "Client", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw))
    snap = mps.fetch_live()
    assert snap["fx"] == 90.0
    assert snap["quotes"]["copper"]["inr"] == pytest.approx(5.0 / 0.45359237 * 90, rel=1e-4)
    assert snap["quotes"]["gold"]["per"] == "g" and snap["quotes"]["gold"]["inr"] == pytest.approx(4000 / 31.1035 * 90, rel=1e-4)
    assert all(len(q["history_inr"]) == 8 for q in snap["quotes"].values())


def test_fetch_live_fails_without_fx(monkeypatch):
    def handler(req):
        if "INR" in req.url.path:
            return httpx.Response(404)
        return httpx.Response(200, json=_yahoo(1.0, [1.0, 1.0]))
    real_client = httpx.Client
    monkeypatch.setattr(mps.httpx, "Client", lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw))
    with pytest.raises(httpx.HTTPStatusError):
        mps.fetch_live()


# ─── 3. Fallback chain: live → saved snapshot → reference ────────────────────

def test_feed_off_uses_reference(monkeypatch):
    monkeypatch.setenv("MHK_MARKET_FEED", "off")
    assert mps.market() == (None, "reference")
    assert mps.market_price("Copper cable") == (BASE_PRICES["Copper cable"], "reference", [])


def test_first_run_fetches_once_and_saves_snapshot(monkeypatch):
    monkeypatch.setenv("MHK_MARKET_FEED", "on")
    calls = []
    monkeypatch.setattr(mps, "fetch_live", lambda: calls.append(1) or snapshot())
    snap, mode = mps.market()
    assert mode == "live" and snap["fx"] == 95.0 and len(calls) == 1
    assert json.load(open(mps.SNAPSHOT_PATH, encoding="utf-8"))["fx"] == 95.0
    mps.market()
    assert len(calls) == 1   # served from memory


def test_offline_first_run_does_not_retry_on_every_request(monkeypatch):
    """No internet and no snapshot: fall back to reference rates without re-trying the fetch per request."""
    monkeypatch.setenv("MHK_MARKET_FEED", "on")
    calls = []

    def boom():
        calls.append(1)
        raise httpx.ConnectError("offline")
    monkeypatch.setattr(mps, "fetch_live", boom)
    assert mps.market() == (None, "reference")
    for _ in range(5):
        assert mps.market() == (None, "reference")
    assert len(calls) == 1, f"fetched {len(calls)} times — each attempt can block a request for seconds"
    # After the back-off window it tries again
    monkeypatch.setattr(mps, "_last_failure", time.time() - mps.RETRY_AFTER_S - 1)
    monkeypatch.setattr(mps, "fetch_live", lambda: snapshot())
    assert mps.market()[1] == "live"


def test_saved_snapshot_is_used_without_fetching(monkeypatch):
    monkeypatch.setenv("MHK_MARKET_FEED", "on")
    json.dump(snapshot(age_hours=1), open(mps.SNAPSHOT_PATH, "w", encoding="utf-8"))
    monkeypatch.setattr(mps, "fetch_live", lambda: pytest.fail("must not fetch while the snapshot is fresh"))
    snap, mode = mps.market()
    assert mode == "live" and snap["fx"] == 95.0


def test_stale_snapshot_returns_immediately_and_refreshes_in_background(monkeypatch):
    monkeypatch.setenv("MHK_MARKET_FEED", "on")
    refresh_h = mps.config()["source"]["refresh_hours"]
    json.dump(snapshot(age_hours=refresh_h + 1), open(mps.SNAPSHOT_PATH, "w", encoding="utf-8"))
    started = []

    class FakeThread:
        def __init__(self, target, daemon):
            started.append(target)

        def start(self):
            pass
    monkeypatch.setattr(mps.threading, "Thread", FakeThread)
    snap, mode = mps.market()
    assert mode == "live" and started == [mps._refresh]           # still within 2× refresh window
    mps._refreshing.clear()
    monkeypatch.setattr(mps, "_market", snapshot(age_hours=refresh_h * 3))
    assert mps.market()[1] == "cached"                           # very old → labelled cached


def test_failed_refresh_keeps_last_prices(monkeypatch):
    old = snapshot()
    monkeypatch.setattr(mps, "_market", old)
    monkeypatch.setattr(mps, "fetch_live", lambda: (_ for _ in ()).throw(httpx.ConnectError("down")))
    mps._refreshing.set()
    mps._refresh()
    assert mps._market is old and not mps._refreshing.is_set()


def test_successful_refresh_clears_premium_cache(monkeypatch):
    mps._premium_cache[("Copper cable", 1.0, 1.0)] = (time.time(), (5.0, []))
    monkeypatch.setattr(mps, "fetch_live", lambda: snapshot())
    mps._refresh()
    assert mps._premium_cache == {} and mps._market["fx"] == 95.0


# ─── 4. Material values ──────────────────────────────────────────────────────

def test_metal_values_follow_their_recipe():
    snap = snapshot()
    cfg = mps.config()["materials"]
    for m, spec in cfg.items():
        if "content" not in spec:
            continue
        value, basis, history = mps.market_price(m, snap, "live")
        expected = sum(a * snap["quotes"][k[:-2] if k.endswith("_g") else k]["inr"] for k, a in spec["content"].items()) * spec["payable"]
        assert basis == "live" and value == mps._round(expected), m
        assert len(history) == 3 and history[-1] == value and history[0] < value, m


def test_metal_price_moves_with_the_exchange():
    low = mps.market_price("Copper cable", snapshot(copper=1000.0), "live")[0]
    high = mps.market_price("Copper cable", snapshot(copper=1500.0), "live")[0]
    assert high / low == pytest.approx(1.5, rel=0.01)


def test_missing_quote_falls_back_to_reference():
    snap = snapshot()
    del snap["quotes"]["gold"]
    assert mps.market_price("Printed Circuit Boards (PCB)", snap, "live")[1] == "reference"
    assert mps.market_price("Copper cable", snap, "live")[1] == "live"   # unaffected


def test_reference_materials_use_their_reference_rate():
    for m in ("Lithium-ion batteries", "Lead acid batteries", "CRT & monitor glass"):
        value, basis, _ = mps.market_price(m, snapshot(), "live")
        assert basis == "reference" and value == mps.config()["materials"][m]["reference"]


def test_rate_card_uses_nearest_city_then_india_median():
    cards = mps.rate_cards()
    for key, city in cards["cities"].items():
        if key in cards["items"]["Newspaper"]["cities"]:
            doorstep, where, dist = mps.rate_card("Newspaper", city["latitude"], city["longitude"])
            assert doorstep == cards["items"]["Newspaper"]["cities"][key] and where == city["name"] and dist == 0.0
    assert mps.rate_card("Newspaper", *GUWAHATI) == (cards["items"]["Newspaper"]["national"]["median"], "India median", None)
    assert mps.rate_card("Newspaper") [1] == "India median"
    assert mps.rate_card("Moon rock", *MUMBAI) is None


def test_rate_card_radius_boundary():
    pune = mps.rate_cards()["cities"]["pune"]
    radius = mps.config()["rate_cards"]["radius_km"]
    step = 1 / 111.0   # ≈1 km of latitude
    # Due south of Pune (nothing else near): inside the radius → Pune; outside → India median
    inside = mps.rate_card("Books", pune["latitude"] - (radius - 5) * step, pune["longitude"])
    outside = mps.rate_card("Books", pune["latitude"] - (radius + 5) * step, pune["longitude"])
    assert inside[1] == "Pune" and outside[1] == "India median"


def test_household_value_is_doorstep_card_divided_by_factor():
    doorstep = mps.rate_cards()["items"]["PET Bottle"]["cities"]["bhopal"]
    value, basis, _ = mps.market_price("PET bottles", lat=23.2599, lon=77.4126)
    assert basis == "rate_card" and value == round(doorstep / DOOR, 1)


def test_price_source_labels(monkeypatch):
    assert mps.price_source("Newspaper", *MUMBAI) == "Mumbai rate card"
    assert mps.price_source("Newspaper", *GUWAHATI) == "India median rate card"
    assert mps.price_source("Lead acid batteries") == "reference rate"
    use_snapshot(monkeypatch)
    assert mps.price_source("Copper cable") == "Copper (COMEX) (live)"
    use_snapshot(monkeypatch, mode="cached")
    assert mps.price_source("Aluminium") == "Aluminium (COMEX) (last known)"


# ─── 5. Local premium ────────────────────────────────────────────────────────

def test_premium_components_and_caps():
    db = SessionLocal()
    try:
        pct, reasons = mps.local_premium(db, "Copper cable", *BHOSARI)
        by_kind = {}
        for r in reasons:
            by_kind[r["kind"]] = by_kind.get(r["kind"], 0) + r["pct"]
        assert 0 < pct <= mps.PREMIUM_CAP
        assert sum(r["pct"] for r in reasons) == pytest.approx(pct, abs=0.3)   # reasons shown add up to the premium
        assert by_kind.get("industry", 0) <= mps.INDUSTRY_CAP + 0.2
        assert len([r for r in reasons if r["kind"] == "industry"]) <= 4
        assert by_kind.get("buyers", 0) <= mps.BUYER_CAP and by_kind.get("demand", 0) <= mps.DEMAND_CAP
        assert all(r["distance_km"] is None or r["distance_km"] <= mps.INDUSTRY_RADIUS_KM for r in reasons)
        assert mps.local_premium(db, "Copper cable", *GUWAHATI) == (0.0, [])
    finally:
        db.close()


def test_premium_counts_only_buyers_of_that_material():
    db = SessionLocal()
    try:
        near = [r for r in db.query(RecyclerRow).filter(RecyclerRow.is_active == 1).all()
                if mps._haversine_km(*BHOSARI, r.latitude, r.longitude) <= mps.BUYER_RADIUS_KM]
        for material in ("Newspaper", "Copper cable"):
            expected = len([r for r in near if mps._buys(r, material)])
            _, reasons = mps.local_premium(db, material, *BHOSARI)
            shown = [r for r in reasons if r["kind"] == "buyers"]
            assert (shown[0]["label"] if shown else "0 ") .startswith(f"{expected} "), (material, expected, shown)
        seeded = [r for r in near if r.id in ("eco-cycle", "green-loop", "urban-recover", "maha-e-metals")]
        assert seeded and not any(mps._buys(r, "Newspaper") for r in seeded)   # e-waste recyclers don't buy newspaper
    finally:
        db.close()


def test_premium_reacts_to_new_buyers_and_demand():
    db = SessionLocal()
    try:
        spot = (18.9000, 73.3000)   # Karjat area: no seeded buyers or demand within range
        before, _ = mps.local_premium(db, "Mixed plastic", *spot)
        buyer = client.post("/api/v1/companies/register", json={"phone": "9111000001", "name": "Plastic Buyer Test",
                                                                "company_type": "buyer", "latitude": spot[0], "longitude": spot[1]}).json()
        client.post(f"/api/v1/admin/companies/{buyer['id']}/approve")
        mps._premium_cache.clear()
        with_buyer, reasons = mps.local_premium(db, "Mixed plastic", *spot)
        assert with_buyer == before + mps.BUYER_PCT_EACH and any(r["kind"] == "buyers" for r in reasons)

        r = client.post("/api/v1/demands", json={"recycler_id": buyer["id"], "recycler_name": buyer["name"], "material": "Mixed plastic",
                                                 "quantity_kg": 5000, "offered_price_per_kg": 12})
        assert r.status_code == 201
        mps._premium_cache.clear()
        with_demand, reasons = mps.local_premium(db, "Mixed plastic", *spot)
        demand = [x for x in reasons if x["kind"] == "demand"]
        assert demand and demand[0]["pct"] == mps.DEMAND_CAP and with_demand == with_buyer + mps.DEMAND_CAP
        # Far away the new buyer and demand don't count
        assert mps.local_premium(db, "Mixed plastic", *GUWAHATI)[0] == 0.0
    finally:
        db.close()


def test_premium_is_cached_per_area():
    db = SessionLocal()
    try:
        first = mps.local_premium(db, "Aluminium", *BHOSARI)
        mps._premium_cache[("Aluminium", round(BHOSARI[0], 2), round(BHOSARI[1], 2))] = (time.time(), (1.5, []))
        assert mps.local_premium(db, "Aluminium", *BHOSARI) == (1.5, [])        # cached
        mps._premium_cache[("Aluminium", round(BHOSARI[0], 2), round(BHOSARI[1], 2))] = (time.time() - mps.PREMIUM_TTL_S - 1, (1.5, []))
        assert mps.local_premium(db, "Aluminium", *BHOSARI) == first            # expired → recomputed
    finally:
        db.close()


# ─── 6. Buyer price tables ───────────────────────────────────────────────────

def test_seeded_buyers_follow_the_market(monkeypatch):
    use_snapshot(monkeypatch)
    db = SessionLocal()
    try:
        row = db.query(RecyclerRow).filter(RecyclerRow.id == "green-loop").first()
        spreads = json.loads(row.price_spread_json)
        prices = mps.buyer_prices(db, row)
        for m, spread in spreads.items():
            assert prices[m] == mps._round(mps.local_price(db, m, row.latitude, row.longitude) * spread), m
        low = prices["Copper cable"]
        use_snapshot(monkeypatch, snapshot(copper=2800.0))
        mps._premium_cache.clear()
        assert mps.buyer_prices(db, row)["Copper cable"] == pytest.approx(low * 2, rel=0.02)
    finally:
        db.close()


def test_console_price_is_fixed_and_others_keep_following():
    before = client.get("/api/v1/recycler/urban-recover/prices").json()
    assert "Aluminium" in before["market_linked"] and "Copper cable" in before["market_linked"]
    r = client.put("/api/v1/recycler/urban-recover/prices", json={"prices": {"Aluminium": 222}})
    assert r.status_code == 200
    after = client.get("/api/v1/recycler/urban-recover/prices").json()
    assert after["prices"]["Aluminium"] == 222 and "Aluminium" not in after["market_linked"]
    assert "Copper cable" in after["market_linked"]


def test_new_buyer_company_is_market_linked_for_every_material():
    b = client.post("/api/v1/companies/register", json={"phone": "9111000002", "name": "All Scrap Buyer", "company_type": "buyer",
                                                        "latitude": MUMBAI[0], "longitude": MUMBAI[1]}).json()
    db = SessionLocal()
    try:
        row = db.query(RecyclerRow).filter(RecyclerRow.id == b["id"]).first()
        spreads = json.loads(row.price_spread_json)
        assert set(spreads) == set(BASE_PRICES) and set(spreads.values()) == {0.97}
    finally:
        db.close()


def test_legacy_rows_are_linked_only_where_untouched():
    from db import _link_prices_to_market
    from services.account_service import DEFAULT_BUYER_PRICE_FACTOR
    db = SessionLocal()
    try:
        defaults = {m: round(p * DEFAULT_BUYER_PRICE_FACTOR, 1) for m, p in BASE_PRICES.items()}
        defaults["Aluminium"] = 175.0   # the buyer changed this one
        db.add(RecyclerRow(id="legacy-buyer", recycler_name="Legacy", cpcb_license="X", latitude=19.0, longitude=73.0,
                           prices_json=json.dumps(defaults), price_spread_json=None, is_active=1))
        db.commit()
        _link_prices_to_market(db)
        row = db.query(RecyclerRow).filter(RecyclerRow.id == "legacy-buyer").first()
        spreads = json.loads(row.price_spread_json)
        assert "Aluminium" not in spreads and "Copper cable" in spreads
        assert mps.buyer_prices(db, row)["Aluminium"] == 175.0
        db.delete(row)
        db.commit()
    finally:
        db.close()


# ─── 7. Everything that quotes a price ───────────────────────────────────────

def test_daily_prices_are_internally_consistent(monkeypatch):
    use_snapshot(monkeypatch)
    for lat, lon in (BHOSARI, MUMBAI, GUWAHATI):
        d = client.get(f"/api/v1/prices/daily?latitude={lat}&longitude={lon}").json()
        assert d["market"]["mode"] == "live" and {p["material"] for p in d["prices"]} == set(ALL_MATERIALS)
        for p in d["prices"]:
            m = p["material"]
            assert p["current_price"] == mps._round(p["market_price"] * (1 + p["local_premium_pct"] / 100)), m
            assert p["doorstep_price"] == mps._round(p["current_price"] * DOOR), m
            assert 0 <= p["local_premium_pct"] <= 15, m
            assert p["demand"] == ("HIGH" if p["local_premium_pct"] >= 8 else "MODERATE" if p["local_premium_pct"] >= 3 else "LOW")
            assert p["category"] in ("Metals", "Electronics", "Batteries", "Heavy Scrap", "Paper", "Plastic"), m
            if p["basis"] == "live":
                prev = p["history_7d"][-2]
                assert p["previous_price"] == prev and p["change_percent"] == round((p["current_price"] - prev) / prev * 100, 2)
                assert p["trend"] == "up"   # snapshot history rises
            else:
                assert p["change_percent"] == 0 and p["trend"] == "stable"
    default = client.get("/api/v1/prices/daily").json()
    assert default["location"] == {"latitude": 18.5204, "longitude": 73.8567}


def test_market_quotes_endpoint(monkeypatch):
    use_snapshot(monkeypatch)
    d = client.get("/api/v1/prices/market").json()
    assert d["mode"] == "live" and d["usd_inr"] == 95.0 and set(d["quotes"]) == set(mps.config()["commodities"])


def test_valuation_formula(monkeypatch):
    use_snapshot(monkeypatch)
    db = SessionLocal()
    try:
        local = mps.local_price(db, "Copper cable", *BHOSARI)
        cases = [("low", 35, 0.72), ("medium", 35, 1.0), ("high", 35, 1.28)]
        for q, kg, qm in cases:
            v = client.post("/api/v1/ml/valuation", json={"material": "Copper cable", "quality": q, "weight_kg": kg,
                                                          "latitude": BHOSARI[0], "longitude": BHOSARI[1]}).json()
            vol = 0.96 + (35 - 10) / 40 * 0.04
            assert v["fair_price_per_kg"] == pytest.approx(local * qm * vol, rel=0.005), q
            assert v["fair_payout"] == pytest.approx(v["fair_price_per_kg"] * kg, rel=0.01)
            assert "Copper (COMEX)" in v["reasoning"]
        from services.ml_service import _volume_multiplier
        assert [_volume_multiplier(w) for w in (0.5, 1, 10, 50, 200, 1000, 5000)] == [0.9, 0.9, 0.96, 1.0, 1.05, 1.10, 1.10]
        news = client.post("/api/v1/ml/valuation", json={"material": "Newspaper", "weight_kg": 20, "latitude": MUMBAI[0], "longitude": MUMBAI[1]}).json()
        assert "Mumbai rate card" in news["reasoning"]
        ref = client.post("/api/v1/ml/valuation", json={"material": "Lead acid batteries", "weight_kg": 35}).json()
        assert ref["confidence"] == pytest.approx(0.88 - 0.15)
    finally:
        db.close()


def test_marketplace_offers_math_and_filtering(monkeypatch):
    use_snapshot(monkeypatch)
    kg = 35
    offers = client.get(f"/api/v1/marketplace/offers?material=Copper%20cable&weight_kg={kg}&latitude={BHOSARI[0]}&longitude={BHOSARI[1]}").json()
    assert offers
    db = SessionLocal()
    try:
        for o in offers:
            row = db.query(RecyclerRow).filter(RecyclerRow.id == o["id"]).first()
            pickup = row.pickup_base_cost + max(0.0, (o["distance_km"] - 2.0) * 15.0)
            assert o["pickup_cost"] == pytest.approx(pickup, abs=0.1)
            assert o["net_earnings"] == pytest.approx(o["listed_price_per_kg"] * kg - pickup - row.handling_cost - row.platform_fee, abs=0.1)
    finally:
        db.close()
    nets = [o["net_earnings"] for o in offers]
    assert nets == sorted(nets, reverse=True)
    # Buyers that don't buy newspaper are left out (no fallback to another material's price)
    news = client.get(f"/api/v1/marketplace/offers?material=Newspaper&weight_kg=20&latitude={BHOSARI[0]}&longitude={BHOSARI[1]}").json()
    seeded = {"eco-cycle", "green-loop", "urban-recover", "maha-e-metals"}
    assert not ({o["id"] for o in news} & seeded)


def test_pickup_quotes_use_local_price(monkeypatch):
    use_snapshot(monkeypatch)
    hh = client.post("/api/v1/households/register", json={"phone": "9111000003", "name": "Quote Test", "latitude": MUMBAI[0], "longitude": MUMBAI[1]}).json()
    pk = client.post("/api/v1/pickups", json={"requester_type": "household", "requester_id": hh["id"], "material": "Newspaper", "estimated_weight_kg": 20}).json()
    db = SessionLocal()
    try:
        local = mps.local_price(db, "Newspaper", *MUMBAI)
    finally:
        db.close()
    assert pk["estimated_value"] == round(local * DOOR * 20)
    acc = client.post(f"/api/v1/pickups/{pk['id']}/accept", json={"collector_id": "CLT-4218"}).json()
    assert acc["offered_price_per_kg"] == round(local * DOOR, 1)
    done = client.post(f"/api/v1/pickups/{pk['id']}/complete", json={"collector_id": "CLT-4218", "pickup_pin": pk["pickup_pin"], "actual_weight_kg": 18}).json()
    assert done["amount_paid"] == round(acc["offered_price_per_kg"] * 18)
    lot = client.get(f"/api/v1/lots/{done['lot_id']}").json()
    assert lot["expected_net_earnings"] == round(local * 18 - done["amount_paid"])


def test_forecast_starts_from_market_price(monkeypatch):
    use_snapshot(monkeypatch)
    f = client.get("/api/v1/prices/forecast?material=Copper%20cable&zone=Pune%20MIDC").json()
    assert f["current_price"] == round(mps.market_price("Copper cable")[0], 1)


def test_forecast_uses_arima_on_history_and_starts_at_market(monkeypatch):
    use_snapshot(monkeypatch)
    hist = client.get("/api/v1/prices/history?material=Copper%20cable&zone=Pune%20MIDC&days=90").json()
    assert len(hist) >= 14 and {h["source"] for h in hist} <= {"seed_demo", "market_live"}
    f = client.get("/api/v1/prices/forecast?material=Copper%20cable&zone=Pune%20MIDC&horizon=10").json()
    assert f["model_type"].startswith("ARIMA(2,1,1)") and len(f["forecast_7_days"]) == 10
    assert f["current_price"] == round(mps.market_price("Copper cable")[0], 1)
    for p in f["forecast_7_days"]:
        assert p["lower_ci"] <= p["forecast_price"] <= p["upper_ci"]
        assert abs(p["forecast_price"] / f["current_price"] - 1) < 0.25       # anchored to today's price, not the old seed level


def test_forecast_falls_back_when_history_is_short():
    from services.price_forecaster import generate_arima_forecast
    db = SessionLocal()
    try:
        f = generate_arima_forecast(db, "Copper cable", zone="Nowhere Zone")
        assert f.model_type.startswith("Drift outlook")
        assert len(f.forecast_7_days) == 7
    finally:
        db.close()


def test_live_price_is_recorded_once_a_day(monkeypatch):
    use_snapshot(monkeypatch)
    from db import PriceHistoryRow
    db = SessionLocal()
    try:
        live = lambda: db.query(PriceHistoryRow).filter(PriceHistoryRow.source == "market_live").count()
        before = live()
        client.get("/api/v1/prices/daily")
        after_first = live()
        client.get("/api/v1/prices/daily")
        assert after_first - before in (0, len(BASE_PRICES)) and live() == after_first   # second call adds nothing
        assert after_first >= len(BASE_PRICES)
    finally:
        db.close()


def test_assistant_rates_are_local_prices(monkeypatch):
    use_snapshot(monkeypatch)
    from services.assistant_service import tool_get_rates
    db = SessionLocal()
    try:
        ctx = type("Ctx", (), {"db": db, "lat": MUMBAI[0], "lon": MUMBAI[1]})()
        one = tool_get_rates(ctx, "newspaper")
        assert one["rate_per_kg"] == mps.local_price(db, "Newspaper", *MUMBAI) and one["source"] == "Mumbai rate card"
        all_rates = tool_get_rates(ctx)["rates_per_kg"]
        assert set(all_rates) == set(BASE_PRICES) and list(all_rates.values()) == sorted(all_rates.values(), reverse=True)
    finally:
        db.close()


def test_health_reports_price_sources(monkeypatch):
    monkeypatch.setenv("MHK_MARKET_FEED", "on")
    use_snapshot(monkeypatch)
    c = client.get("/health").json()["components"]
    assert c["market_prices"]["status"] == "real" and c["rate_cards"]["cities"] == 15


# ─── 8. Real feed (opt-in: needs internet) ───────────────────────────────────

@pytest.mark.skipif(os.getenv("MHK_LIVE_TESTS") != "1", reason="set MHK_LIVE_TESTS=1 to hit the real exchange feed")
def test_live_feed_is_sane():
    snap = mps.fetch_live()
    assert 60 < snap["fx"] < 150
    q = snap["quotes"]
    assert 300 < q["copper"]["inr"] < 3000 and 100 < q["aluminium"]["inr"] < 800
    assert 3000 < q["gold"]["inr"] < 30000 and q["gold"]["per"] == "g"
    for m in ("Copper cable", "Aluminium", "Printed Circuit Boards (PCB)"):
        value, basis, history = mps.market_price(m, snap, "live")
        assert basis == "live" and value > 0 and history
