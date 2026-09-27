r"""
Pre-demo check: plays every role end-to-end against a RUNNING backend and prints PASS/FAIL per step.

It creates test households, pickups, a company and lots, so run it against a throwaway database:

    # terminal 1 — a separate server on :8001 with its own DB file
    set MHK_DB_PATH=%TEMP%\mhk_demo_check.db          (PowerShell: $env:MHK_DB_PATH="$env:TEMP\mhk_demo_check.db")
    python -m uvicorn main:app --port 8001
    # terminal 2
    python demo_check.py                     (defaults to http://localhost:8001)

Pointing it at your demo server (:8000) is refused unless you pass --allow-demo-db.
"""
import json
import sys
import time
import uuid
from datetime import date, timedelta

import httpx

_args = [a for a in sys.argv[1:] if not a.startswith("--")]
BASE = (_args[0] if _args else "http://localhost:8001").rstrip("/") + "/api/v1"
if ":8000" in BASE and "--allow-demo-db" not in sys.argv:
    sys.exit("Refusing to write test data into the demo server on :8000. Use a throwaway server on :8001 (see top of file).")
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = httpx.Client(timeout=30)
RUN = uuid.uuid4().hex[:4]
results = []


def step(name):
    def wrap(fn):
        t = time.time()
        try:
            out = fn()
            results.append(("PASS", name, f"{(time.time() - t) * 1000:.0f} ms"))
            return out
        except Exception as e:  # noqa: BLE001
            results.append(("FAIL", name, f"{type(e).__name__}: {e}"[:300]))
            return None
    return wrap


def ok(r, code=200):
    assert r.status_code == code, f"{r.request.method} {r.request.url.path} → {r.status_code} {r.text[:200]}"
    return r.json()


RUN_NUM = int(RUN, 16) % 10000


def phone(n):
    return f"9{RUN_NUM:04d}{n:05d}"[:10]
KAB = "CLT-4218"
PUNE, MUMBAI, DELHI, BLR, NAGPUR = (18.6279, 73.8488), (19.0760, 72.8777), (28.6139, 77.2090), (12.9716, 77.5946), (21.1458, 79.0882)
S = {}

# ── 0. System ────────────────────────────────────────────────────────────────
step("Server health")(lambda: ok(c.get(BASE.replace("/api/v1", "") + "/health")))
step("Assistant + vision status")(lambda: (ok(c.get(f"{BASE}/assistant/status")), ok(c.get(f"{BASE}/vision/status"))))


# ── 1. Kabadiwala logs in and looks around ──────────────────────────────────
@step("Kabadiwala login (unified login → kabadiwala)")
def _():
    d = ok(c.post(f"{BASE}/auth/login", json={"phone": "+919876543210"}))
    assert d["role"] == "kabadiwala"
    S["before"] = ok(c.get(f"{BASE}/collectors/{KAB}"))


step("Profile stats + business insights")(lambda: (ok(c.get(f"{BASE}/collectors/{KAB}/stats")), ok(c.get(f"{BASE}/collectors/{KAB}/insights"))))


@step("Bazar bhav: daily prices + 7-day forecast")
def _():
    daily = ok(c.get(f"{BASE}/prices/daily"))
    assert daily, "no prices"
    ok(c.get(f"{BASE}/prices/forecast", params={"material": "Copper cable"}))


@step("AI valuation of a scanned lot")
def _():
    v = ok(c.post(f"{BASE}/ml/valuation", json={"material": "Copper cable", "quality": "medium", "weight_kg": 35, "latitude": PUNE[0], "longitude": PUNE[1]}))
    assert v["weight_kg"] == 35


@step("Market: buyers ranked by take-home")
def _():
    offers = ok(c.get(f"{BASE}/marketplace/offers", params={"material": "Copper cable", "weight_kg": 35}))
    assert offers, "no buyers"


step("Opportunity feed")(lambda: ok(c.get(f"{BASE}/opportunities/feed")))
step("Buyer demands list")(lambda: ok(c.get(f"{BASE}/demands")))
step("Demand prediction")(lambda: ok(c.get(f"{BASE}/ml/demand-prediction")))


@step("Regional intelligence (Pune) + price heatmap")
def _():
    d = ok(c.get(f"{BASE}/regional/overview", params={"latitude": PUNE[0], "longitude": PUNE[1], "radius_km": 35}))
    assert d["cells"] and d["hotspots"]
    h = ok(c.get(f"{BASE}/regional/price-heatmap", params={"material": "Copper cable", "latitude": PUNE[0], "longitude": PUNE[1], "radius_km": 20}))
    assert h["cells"]


@step("Regional intelligence works outside Pune (Mumbai, Delhi, Bengaluru)")
def _():
    for lat, lon in (MUMBAI, DELHI, BLR):
        ok(c.get(f"{BASE}/regional/overview", params={"latitude": lat, "longitude": lon, "radius_km": 35}))
        ok(c.get(f"{BASE}/regional/price-heatmap", params={"material": "Aluminium", "latitude": lat, "longitude": lon, "radius_km": 20}))


@step("Assistant chat (Hindi)")
def _():
    d = ok(c.post(f"{BASE}/assistant/chat", json={"messages": [{"role": "user", "content": "आज तांबे का भाव क्या है?"}], "language": "hi", "collector_id": KAB}))
    assert d["reply"]


# ── 2. Households in different cities request pickups ───────────────────────
AREAS = {
    "Kothrud, Pune": (18.5074, 73.8077), "Pimpri, Pune": (18.6298, 73.7997), "Dadar, Mumbai": (19.0178, 72.8478),
    "Karol Bagh, Delhi": (28.6519, 77.1909), "Indiranagar, Bengaluru": (12.9784, 77.6408), "Sitabuldi, Nagpur": (21.1466, 79.0822),
}
S["hh"], S["pk"] = {}, {}


@step("6 households register across 5 cities and log in")
def _():
    for i, (area, (lat, lon)) in enumerate(AREAS.items()):
        h = ok(c.post(f"{BASE}/households/register", json={"phone": phone(i), "name": f"Demo {area.split(',')[0]}", "address": area, "latitude": lat, "longitude": lon}), 201)
        login = ok(c.post(f"{BASE}/auth/login", json={"phone": phone(i)}))
        assert login["role"] == "household"
        S["hh"][area] = h


@step("Each household books a pickup (date + slot); requester sees their PIN")
def _():
    day = (date.today() + timedelta(days=1)).isoformat()
    for area, h in S["hh"].items():
        p = ok(c.post(f"{BASE}/pickups", json={"requester_type": "household", "requester_id": h["id"], "material": "Aluminium", "estimated_weight_kg": 6, "preferred_date": day, "preferred_slot": "morning"}), 201)
        assert len(p["pickup_pin"]) == 4
        S["pk"][area] = p


def open_list(lat, lon):
    rows = ok(c.get(f"{BASE}/pickups", params={"latitude": lat, "longitude": lon}))
    assert all(p["pickup_pin"] is None for p in rows), "PIN leaked to kabadiwala"
    d = [p["distance_km"] for p in rows if p["distance_km"] is not None]
    assert d == sorted(d), "not nearest-first"
    ids = {p["id"]: area for area, p in S["pk"].items()}
    return [ids[p["id"]] for p in rows if p["id"] in ids], rows


@step("Kabadiwala in Pune sees ALL 6 requests, Pune ones on top")
def _():
    order, _ = open_list(*PUNE)
    assert len(order) == 6, order
    assert set(order[:2]) == {"Kothrud, Pune", "Pimpri, Pune"} and order[2] == "Dadar, Mumbai", order
    S["pune_order"] = order


@step("Same list from Delhi / Bengaluru / Nagpur puts the local request first")
def _():
    for loc, area in ((DELHI, "Karol Bagh, Delhi"), (BLR, "Indiranagar, Bengaluru"), (NAGPUR, "Sitabuldi, Nagpur"), (MUMBAI, "Dadar, Mumbai")):
        order, _ = open_list(*loc)
        assert order[0] == area and len(order) == 6, (area, order)


@step("Kabadiwala accepts the nearest; a second accept is refused")
def _():
    area = S["pune_order"][0]
    p = S["pk"][area]
    acc = ok(c.post(f"{BASE}/pickups/{p['id']}/accept", json={"collector_id": KAB}))
    assert acc["status"] == "ACCEPTED" and acc["collector_name"]
    assert c.post(f"{BASE}/pickups/{p['id']}/accept", json={"collector_id": KAB}).status_code == 409
    S["job"] = (area, p)


@step("Household sees who's coming; accepted job leaves the open list")
def _():
    area, p = S["job"]
    mine = ok(c.get(f"{BASE}/pickups", params={"requester_id": S["hh"][area]["id"]}))
    assert mine[0]["status"] == "ACCEPTED" and mine[0]["collector_name"] and mine[0]["pickup_pin"]
    order, _ = open_list(*PUNE)
    assert area not in order and len(order) == 5
    assert any(x["id"] == p["id"] for x in ok(c.get(f"{BASE}/pickups", params={"collector_id": KAB})))


@step("Household reschedules another pickup; cancels one")
def _():
    area = "Pimpri, Pune" if S["job"][0] != "Pimpri, Pune" else "Kothrud, Pune"
    p, h = S["pk"][area], S["hh"][area]
    moved = ok(c.post(f"{BASE}/pickups/{p['id']}/schedule", json={"requester_id": h["id"], "preferred_date": (date.today() + timedelta(days=3)).isoformat(), "preferred_slot": "evening"}))
    assert moved["preferred_slot"] == "evening"
    nag = S["pk"]["Sitabuldi, Nagpur"]
    assert ok(c.post(f"{BASE}/pickups/{nag['id']}/cancel", params={"requester_id": S["hh"]["Sitabuldi, Nagpur"]["id"]}))["status"] == "CANCELLED"


@step("Doorstep: wrong PIN refused, household PIN completes → kabadiwala lot")
def _():
    area, p = S["job"]
    bad = "0000" if p["pickup_pin"] != "0000" else "1111"
    assert c.post(f"{BASE}/pickups/{p['id']}/complete", json={"collector_id": KAB, "pickup_pin": bad, "actual_weight_kg": 5.5}).status_code == 401
    done = ok(c.post(f"{BASE}/pickups/{p['id']}/complete", json={"collector_id": KAB, "pickup_pin": p["pickup_pin"], "actual_weight_kg": 5.5}))
    assert done["status"] == "COMPLETED" and done["lot_id"] and done["amount_paid"] > 0
    lot = ok(c.get(f"{BASE}/lots/{done['lot_id']}"))
    assert lot["collector_id"] == KAB and lot["weight_kg"] == 5.5
    S["pickup_lot"] = lot
    assert ok(c.get(f"{BASE}/households/{S['hh'][area]['id']}"))["total_pickups"] == 1


# ── 3. Company (buyer) signs up, gets approved, posts demand ────────────────
@step("Buyer company registers → locked until admin approves")
def _():
    b = ok(c.post(f"{BASE}/companies/register", json={"phone": phone(90), "name": f"Demo Metals {RUN}", "company_type": "buyer", "cpcb_license": "MPCB-EW-2026-99", "latitude": 18.60, "longitude": 73.80}), 201)
    assert b["approved"] is False
    assert ok(c.post(f"{BASE}/auth/login", json={"phone": phone(90)}))["role"] == "company"
    assert c.post(f"{BASE}/demands", json={"recycler_id": b["id"], "recycler_name": b["name"], "material": "Aluminium", "quantity_kg": 100, "offered_price_per_kg": 150}).status_code == 403
    S["buyer"] = b


@step("Admin approves; company sets prices and posts a demand")
def _():
    b = S["buyer"]
    assert ok(c.post(f"{BASE}/admin/companies/{b['id']}/approve"))["approved"] is True
    ok(c.put(f"{BASE}/recycler/{b['id']}/prices", json={"prices": {"Aluminium": 175}}))
    d = ok(c.post(f"{BASE}/demands", json={"recycler_id": b["id"], "recycler_name": b["name"], "material": "Aluminium", "quantity_kg": 100, "offered_price_per_kg": 170, "deadline_days": 5}), 201)
    offers = ok(c.get(f"{BASE}/marketplace/offers", params={"material": "Aluminium", "weight_kg": 20}))
    assert any(o["id"] == b["id"] for o in offers), "approved buyer missing from market"
    S["demand"] = d


@step("Demand matches the kabadiwala's lot; lot is matched to the demand")
def _():
    d, lot = S["demand"], S["pickup_lot"]
    matches = ok(c.get(f"{BASE}/demands/{d['id']}/matches"))
    assert any(m.get("lot_id", m.get("id")) == lot["id"] for m in (matches if isinstance(matches, list) else matches.get("matches", []))), f"lot not in matches: {str(matches)[:200]}"
    ok(c.post(f"{BASE}/demands/{d['id']}/match/{lot['id']}"))


# ── 4. Scan → sell → handover with QR ───────────────────────────────────────
@step("Kabadiwala scans a new lot (with location) and gets a handover PIN")
def _():
    lot = ok(c.post(f"{BASE}/lots", json={"material": "Aluminium", "quality": "high", "weight_kg": 20, "collector_id": KAB, "collector_name": "Ramesh Kumar", "latitude": PUNE[0], "longitude": PUNE[1]}), 201)
    pin = ok(c.get(f"{BASE}/lots/{lot['id']}/pin"))["pickup_pin"]
    S["sell"] = (lot, pin)


@step("Recycler sends an offer on the lot; it's accepted")
def _():
    lot, _ = S["sell"]
    o = ok(c.post(f"{BASE}/recycler/offers", json={"recycler_id": S["buyer"]["id"], "lot_id": lot["id"], "offered_price_per_kg": 172}), 201)
    ok(c.patch(f"{BASE}/recycler/offers/{o['id']}/accept"))
    assert ok(c.get(f"{BASE}/recycler/{S['buyer']['id']}/offers"))


@step("Recycler scans the pass QR → verified; wrong PIN in QR refused")
def _():
    lot, pin = S["sell"]
    qr = json.dumps({"lotId": lot["id"], "pin": pin})  # exactly what HandoverScreen encodes
    v = ok(c.post(f"{BASE}/handover/verify", json={"qr_payload": qr}))
    assert v["verified"] is True and v["lot_id"] == lot["id"]
    bad = json.dumps({"lotId": lot["id"], "pin": "0000" if pin != "0000" else "1111"})
    assert c.post(f"{BASE}/handover/verify", json={"qr_payload": bad}).status_code == 401


@step("Recycler weighs + pays → lot PAID, UTR + EPR cert, kabadiwala credited")
def _():
    lot, pin = S["sell"]
    r = ok(c.post(f"{BASE}/handover/confirm", json={"lot_id": lot["id"], "pickup_pin": pin, "recycler_id": S["buyer"]["id"], "recycler_name": S["buyer"]["name"], "audited_weight_kg": 19.6, "agreed_payout": 3370, "payment_mode": "UPI"}))
    assert r["utr_number"].startswith("UTR-") and r["epr_certificate_id"]
    assert ok(c.get(f"{BASE}/lots/{lot['id']}"))["status"] == "PAID"
    after = ok(c.get(f"{BASE}/collectors/{KAB}"))
    assert round(after["total_earnings"] - S["before"]["total_earnings"], 2) >= 3370
    assert c.post(f"{BASE}/handover/confirm", json={"lot_id": lot["id"], "pickup_pin": pin, "recycler_id": S["buyer"]["id"], "audited_weight_kg": 19.6, "agreed_payout": 3370}).status_code == 409


step("Recycler console: incoming lots, transactions, analytics")(lambda: [ok(c.get(f"{BASE}/recycler/{S['buyer']['id']}/{p}")) for p in ("incoming-lots", "transactions", "analytics")])


# ── 5. Offline sync, pooling, compliance, admin ─────────────────────────────
@step("Offline-created lot syncs once; replay is a duplicate")
def _():
    key = f"demo-{RUN}"
    item = {"entity": "lot", "entity_id": f"local-{RUN}", "idempotency_key": key, "payload": {"material": "Aluminium", "quality": "medium", "weight_kg": 4, "collector_id": KAB, "collector_name": "Ramesh Kumar"}}
    first = ok(c.post(f"{BASE}/sync/batch", json={"device_id": "demo-phone", "items": [item]}))
    again = ok(c.post(f"{BASE}/sync/batch", json={"device_id": "demo-phone", "items": [item]}))
    s1, s2 = first["results"][0]["status"], again["results"][0]["status"]
    assert s1 == "APPLIED" and s2 == "DUPLICATE", (s1, s2, first)


@step("Aggregator pools two lots of the same material")
def _():
    ids = []
    for _ in range(2):
        ids.append(ok(c.post(f"{BASE}/lots", json={"material": "Copper cable", "weight_kg": 12, "collector_id": KAB, "collector_name": "Ramesh Kumar"}), 201)["id"])
    p = ok(c.post(f"{BASE}/aggregator/pool", json={"lot_ids": ids}))
    assert p["lot_count"] == 2 and p["total_weight_kg"] == 24
    ok(c.get(f"{BASE}/aggregator/pools"))


step("CPCB Form-2 report + national context")(lambda: (ok(c.get(f"{BASE}/reports/cpcb")), ok(c.get(f"{BASE}/reports/national-context"))))
step("Risk scan + alerts")(lambda: (ok(c.post(f"{BASE}/risk/scan")), ok(c.get(f"{BASE}/risk/alerts"))))


@step("Admin dashboard: every tab loads and includes the demo data")
def _():
    for p in ("overview", "collectors", "recyclers", "material-flow", "anomalies", "households", "companies", "pickups"):
        ok(c.get(f"{BASE}/admin/{p}"))
    pks = {p["id"] for p in ok(c.get(f"{BASE}/admin/pickups"))}
    assert all(p["id"] in pks for p in S["pk"].values())


@step("Kabadiwala KYC start → verify")
def _():
    r = c.post(f"{BASE}/collectors/register", json={"phone": phone(80), "name": f"Demo Kabadi {RUN}", "language": "hi", "latitude": DELHI[0], "longitude": DELHI[1]})
    new = ok(r, r.status_code if r.status_code in (200, 201) else 201)
    ok(c.post(f"{BASE}/collectors/{new['id']}/kyc/start", json={"aadhaar_last4": "1234", "pan_masked": "ABCDE****F", "bank_account_last4": "5678"}))
    v = ok(c.post(f"{BASE}/collectors/{new['id']}/kyc/verify", json={}))
    assert v.get("kyc_status", "VERIFIED") == "VERIFIED", v
    # A brand-new Delhi kabadiwala immediately sees every open request, Delhi first.
    order, _ = open_list(*DELHI)
    assert order[0] == "Karol Bagh, Delhi"


# ── Report ──────────────────────────────────────────────────────────────────
w = max(len(n) for _, n, _ in results)
for status, name, info in results:
    print(f"{'✓' if status == 'PASS' else '✗'} {name.ljust(w)}  {info}")
fails = sum(1 for s, _, _ in results if s == "FAIL")
print(f"\n{len(results) - fails}/{len(results)} steps passed")
sys.exit(1 if fails else 0)
