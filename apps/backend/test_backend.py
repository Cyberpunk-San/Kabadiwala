# apps/backend/test_backend.py
"""
Backend test suite.

Run with:  python test_backend.py      (or: python -m pytest test_backend.py)

Each run uses a brand-new temporary SQLite file, so your real data/mhk.db is
never touched and tests are repeatable. AI providers are switched off so the
suite is offline and deterministic.
"""

import base64
import io
import os
import sys
import tempfile

# Must be set BEFORE importing the app — settings/db read them at import time.
_TMP_DIR = tempfile.mkdtemp(prefix="mhk_test_")
os.environ["MHK_DB_PATH"] = os.path.join(_TMP_DIR, "test.db")
os.environ["HF_API_TOKEN"] = ""
os.environ["GEMINI_API_KEY"] = ""
os.environ["VISION_BACKEND"] = "off"
os.environ["MHK_MARKET_FEED"] = "off"  # no network in tests: metals use reference rates

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
from db import DB_PATH  # noqa: E402

assert DB_PATH.startswith(_TMP_DIR), "Refusing to run tests against the real database"
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

client = TestClient(app)


# ─── 1. Health ───────────────────────────────────────────────────────────────

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    # The new /health returns a components breakdown
    assert "components" in body
    assert body["components"]["database"]["status"] == "real"
    assert body["components"]["vision_ai"]["status"] == "real"
    assert body["components"]["payment_gateway"]["status"] == "simulated"
    print("✓ /health passed (honest real/simulated report)")


# ─── 2. Lots CRUD ────────────────────────────────────────────────────────────

def test_lots_flow():
    # 2.1 List lots — should be at least the 3 seeded ones
    res = client.get("/api/v1/lots")
    assert res.status_code == 200
    assert len(res.json()) >= 1
    print(f"✓ GET /api/v1/lots passed ({len(res.json())} lots)")

    # 2.2 Create lot
    lot_payload = {
        "material": "Copper cable",
        "quality": "medium",
        "weight_kg": 40.0,
        "collector_id": "CLT-4218",
        "collector_name": "Ramesh Kumar",
    }
    res_create = client.post("/api/v1/lots", json=lot_payload)
    assert res_create.status_code == 201
    created = res_create.json()
    created_id = created["id"]
    assert created["weight_kg"] == 40.0
    assert created["status"] == "AVAILABLE"
    print(f"✓ POST /api/v1/lots passed (Created: {created_id})")

    # 2.3 Get created lot
    res_get = client.get(f"/api/v1/lots/{created_id}")
    assert res_get.status_code == 200
    assert res_get.json()["weight_kg"] == 40.0
    print(f"✓ GET /api/v1/lots/{created_id} passed")

    # 2.4 Get PIN for created lot — should be a 4-digit string
    res_pin = client.get(f"/api/v1/lots/{created_id}/pin")
    assert res_pin.status_code == 200
    pin = res_pin.json()["pickup_pin"]
    assert len(pin) == 4 and pin.isdigit()
    print(f"✓ GET /api/v1/lots/{created_id}/pin passed (PIN: {pin})")

    # 2.5 404 for missing lot
    res_404 = client.get("/api/v1/lots/lot_does_not_exist")
    assert res_404.status_code == 404
    print("✓ 404 on missing lot passed")

    # 2.6 Filter by status
    res_filter = client.get("/api/v1/lots?status=AVAILABLE")
    assert res_filter.status_code == 200
    for lot in res_filter.json():
        assert lot["status"] == "AVAILABLE"
    print(f"✓ Status filter passed ({len(res_filter.json())} AVAILABLE lots)")


# ─── 3. Spatial Marketplace ──────────────────────────────────────────────────

def test_spatial_offers():
    res = client.get(
        "/api/v1/marketplace/offers"
        "?material=Copper%20cable&weight_kg=35"
        "&latitude=18.6279&longitude=73.8488"
    )
    assert res.status_code == 200
    offers = res.json()
    assert len(offers) >= 1
    assert "distance_km" in offers[0]
    assert "net_earnings" in offers[0]
    # Must be sorted by net_earnings descending
    for i in range(len(offers) - 1):
        assert offers[i]["net_earnings"] >= offers[i + 1]["net_earnings"]
    print(f"✓ Spatial Matching passed ({len(offers)} recyclers ranked by net take-home)")

    # Far-away location returns empty
    res_far = client.get(
        "/api/v1/marketplace/offers"
        "?material=Copper%20cable&weight_kg=35"
        "&latitude=28.6139&longitude=77.2090"
    )
    assert res_far.status_code == 200
    assert res_far.json() == []
    print("✓ Far-away location correctly returns no offers")


# ─── 4. Vision (CLIP) ────────────────────────────────────────────────────────

def test_ml_inference():
    """With AI switched off the endpoint must degrade to a confidence-0 answer, never a 500."""
    res = client.post(
        "/api/v1/vision/analyze",
        json={"imageUri": "file:///nonexistent/path.jpg"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["confidence"] == 0.0
    assert data["source"] == "fallback"

    # A real (tiny) JPEG as base64 is accepted too.
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), (184, 115, 51)).save(buf, format="JPEG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    res_b64 = client.post("/api/v1/vision/analyze", json={"image_base64": f"data:image/jpeg;base64,{b64}"})
    assert res_b64.status_code == 200
    assert res_b64.json()["material"] in {"Mixed e-waste"}
    print("✓ Vision endpoint passed (graceful fallback, base64 accepted)")

    status = client.get("/api/v1/vision/status").json()
    assert status["backend"] == "off"
    print("✓ Vision status endpoint passed")


# ─── 5. ARIMA Price Forecast ─────────────────────────────────────────────────

def test_arima_forecaster():
    res = client.get("/api/v1/prices/forecast?material=Copper%20cable&zone=Pune%20MIDC")
    assert res.status_code == 200
    data = res.json()
    assert len(data["forecast_7_days"]) == 7
    assert "advice" in data
    assert data["material"] == "Copper cable"
    print("✓ ARIMA 7-Day Price Forecaster passed (simulated)")

    res_daily = client.get("/api/v1/prices/daily")
    assert res_daily.status_code == 200
    assert "prices" in res_daily.json()
    print(f"✓ Daily spot prices passed ({len(res_daily.json()['prices'])} materials)")


# ─── 6. Handover + EPR ───────────────────────────────────────────────────────

def test_handover_and_epr():
    """
    Uses the seeded copper lot (PIN 1234). If you've already run this test
    against an existing DB, the lot will be PAID and the PIN still matches —
    so the verify test still passes. But if you want a clean slate,
    delete data/mhk.db and restart the server once before running this.
    """
    # 6.1 Verify with correct PIN
    res_verify = client.post(
        "/api/v1/handover/verify",
        json={"lot_id": "lot_demo_copper_01", "pickup_pin": "1234"},
    )
    assert res_verify.status_code == 200
    assert res_verify.json()["verified"] is True
    print("✓ Handover PIN Verification passed")

    # 6.2 Wrong PIN rejected with 401
    res_bad = client.post(
        "/api/v1/handover/verify",
        json={"lot_id": "lot_demo_copper_01", "pickup_pin": "0000"},
    )
    assert res_bad.status_code == 401
    print("✓ Wrong PIN correctly rejected (401)")

    # 6.3 Nonexistent lot returns 404
    res_404 = client.post(
        "/api/v1/handover/verify",
        json={"lot_id": "lot_fake", "pickup_pin": "1234"},
    )
    assert res_404.status_code == 404
    print("✓ Nonexistent lot rejected (404)")

    # 6.4 Confirm handover
    confirm_payload = {
        "lot_id": "lot_demo_copper_01",
        "pickup_pin": "1234",
        "recycler_id": "eco-cycle",
        "recycler_name": "EcoCycle Recyclers Pvt Ltd",
        "audited_weight_kg": 35.0,
        "agreed_payout": 18450.0,
        "payment_mode": "UPI",
    }
    res_confirm = client.post("/api/v1/handover/confirm", json=confirm_payload)
    assert res_confirm.status_code == 200
    receipt = res_confirm.json()
    assert receipt["status"] == "CONFIRMED"
    assert "utr_number" in receipt and receipt["utr_number"].startswith("UTR-MHK-")
    assert "epr_certificate_id" in receipt and receipt["epr_certificate_id"].startswith("EPR-CPCB-")
    assert receipt["carbon_offset_kg"] > 0
    print(f"✓ Settlement & EPR Tagging passed (UTR: {receipt['utr_number']})")
    print(f"  EPR Cert: {receipt['epr_certificate_id']}")

    # 6.5 Lot status is now PAID
    res_lot = client.get("/api/v1/lots/lot_demo_copper_01")
    assert res_lot.status_code == 200
    assert res_lot.json()["status"] == "PAID"
    print("✓ Lot status correctly flips to PAID")

    # 6.6 Paying the same lot twice is refused
    res_again = client.post("/api/v1/handover/confirm", json=confirm_payload)
    assert res_again.status_code == 409
    print("✓ Double settlement rejected (409)")

    # 6.7 Verify also accepts the scanned QR payload
    res_qr = client.post(
        "/api/v1/handover/verify",
        json={"qr_payload": '{"lotId": "lot_demo_copper_01", "pin": "1234"}'},
    )
    assert res_qr.status_code == 200 and res_qr.json()["already_settled"] is True
    print("✓ QR payload verification passed")


def test_settlement_credits_collector():
    before = client.get("/api/v1/collectors/CLT-4218").json()
    lot = client.post("/api/v1/lots", json={
        "material": "Aluminium", "weight_kg": 10.0,
        "collector_id": "CLT-4218", "collector_name": "Ramesh Kumar",
    }).json()
    pin = client.get(f"/api/v1/lots/{lot['id']}/pin").json()["pickup_pin"]
    res = client.post("/api/v1/handover/confirm", json={
        "lot_id": lot["id"], "pickup_pin": pin, "recycler_id": "eco-cycle",
        "audited_weight_kg": 10.0, "agreed_payout": 1200.0,
    })
    assert res.status_code == 200
    after = client.get("/api/v1/collectors/CLT-4218").json()
    assert after["total_lots"] == before["total_lots"] + 1
    assert round(after["total_earnings"] - before["total_earnings"], 2) == 1200.0
    assert round(after["total_weight_kg"] - before["total_weight_kg"], 2) == 10.0
    print("✓ Settlement credits collector lifetime stats")

    mine = client.get("/api/v1/lots?collector_id=CLT-4218").json()
    assert mine and all(l["collector_id"] == "CLT-4218" for l in mine)
    print("✓ Lots filter by collector passed")


def test_sync_retry_after_reject():
    item = {
        "entity": "lot", "entity_id": "lot_sync_retry_01", "idempotency_key": "idem_retry_01",
        "payload": {"material": "Copper cable", "weight_kg": 5},  # missing collector_id → rejected
    }
    first = client.post("/api/v1/sync/batch", json={"device_id": "dev1", "items": [item]})
    assert first.status_code == 200 and first.json()["rejected"] == 1

    item["payload"] = {**item["payload"], "collector_id": "CLT-4218", "pickup_pin": "0000"}
    retry = client.post("/api/v1/sync/batch", json={"device_id": "dev1", "items": [item]})
    assert retry.status_code == 200 and retry.json()["accepted"] == 1

    replay = client.post("/api/v1/sync/batch", json={"device_id": "dev1", "items": [item]})
    assert replay.json()["duplicates"] == 1

    pin = client.get("/api/v1/lots/lot_sync_retry_01/pin").json()["pickup_pin"]
    assert pin != "0000"
    print("✓ Sync retry after rejection, replay and server-owned PIN passed")


def test_assistant_offline():
    res = client.post("/api/v1/assistant/chat", json={
        "language": "en", "collector_id": "CLT-4218",
        "messages": [{"role": "user", "content": "best price for 40 kg copper?"}],
    })
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "offline"
    assert data["steps"] and data["steps"][0]["tool"] == "get_best_offers"
    assert data["actions"][0] == {"type": "open_market", "material": "Copper cable", "weight_kg": 40.0}
    assert "40 kg Copper cable" in data["reply"]

    res_hi = client.post("/api/v1/assistant/chat", json={
        "language": "hi", "messages": [{"role": "user", "content": "फूली बैटरी सुरक्षित है?"}],
    })
    assert res_hi.status_code == 200 and res_hi.json()["steps"][0]["tool"] == "get_safety"
    print("✓ Offline agent (tools + actions) passed")


def test_assistant_llm_agent_loop():
    """Drive the real agent loop with a scripted fake model: tool call → final answer."""
    from db import SessionLocal
    from models.domain import AssistantChatRequest
    from services import assistant_service as a

    script = iter([
        '```json\n{"tool": "get_best_offers", "args": {"material": "copper", "weight_kg": 20}}\n```',
        '{"final": "EcoCycle gives the most.", "actions": [{"type": "open_market", "material": "Copper cable", "weight_kg": 20}]}',
    ])
    seen = []

    def fake_complete(system, msgs):
        seen.append(msgs[-1]["content"])
        return next(script)

    db = SessionLocal()
    try:
        req = AssistantChatRequest(language="en", messages=[{"role": "user", "content": "copper 20kg"}])
        reply, actions, steps = a._llm_agent(a.AgentContext(db, req), fake_complete)
    finally:
        db.close()
    assert reply == "EcoCycle gives the most."
    assert [s.tool for s in steps] == ["get_best_offers"]
    assert actions[0].material == "Copper cable" and actions[0].weight_kg == 20
    assert "TOOL RESULT (get_best_offers)" in seen[1] and "take_home_inr" in seen[1]
    print("✓ LLM agent loop (tool call → result → final + actions) passed")


def test_roles_and_pickups():
    """Household + company sign-up, unified login, pickup lifecycle, admin approval."""
    # Unified login knows every role
    assert client.post("/api/v1/auth/login", json={"phone": "+919876543210"}).json()["role"] == "kabadiwala"
    assert client.post("/api/v1/auth/login", json={"phone": "9000000001"}).status_code == 404

    hh = client.post("/api/v1/households/register", json={
        "phone": "9000000001", "name": "Priya Sharma", "address": "Kothrud, Pune",
        "latitude": 18.6300, "longitude": 73.8500,
    })
    assert hh.status_code == 201
    household = hh.json()
    login = client.post("/api/v1/auth/login", json={"phone": "+91 90000 00001"}).json()
    assert login["role"] == "household" and login["household"]["id"] == household["id"]

    # Household posts a pickup; requester sees the PIN, kabadiwalas nearby don't.
    pk = client.post("/api/v1/pickups", json={
        "requester_type": "household", "requester_id": household["id"],
        "material": "Copper cable", "estimated_weight_kg": 8,
    })
    assert pk.status_code == 201
    pickup = pk.json()
    assert len(pickup["pickup_pin"]) == 4 and pickup["estimated_value"] > 0

    near = client.get("/api/v1/pickups?latitude=18.6279&longitude=73.8488").json()
    mine_near = [p for p in near if p["id"] == pickup["id"]]
    assert mine_near and mine_near[0]["pickup_pin"] is None and mine_near[0]["distance_km"] < 5
    # Far-away kabadiwalas still see it (with its distance); an explicit radius filters it out.
    far = [p for p in client.get("/api/v1/pickups?latitude=28.6&longitude=77.2").json() if p["id"] == pickup["id"]]
    assert far and far[0]["distance_km"] > 1000
    assert all(p["id"] != pickup["id"] for p in client.get("/api/v1/pickups?latitude=28.6&longitude=77.2&radius_km=50").json())

    # Accept → second accept is refused
    acc = client.post(f"/api/v1/pickups/{pickup['id']}/accept", json={"collector_id": "CLT-4218"})
    assert acc.status_code == 200 and acc.json()["status"] == "ACCEPTED"
    assert client.post(f"/api/v1/pickups/{pickup['id']}/accept", json={"collector_id": "CLT-4218"}).status_code == 409

    # Wrong PIN refused, right PIN completes and creates the kabadiwala's lot
    wrong_pin = "1000" if pickup["pickup_pin"] != "1000" else "1001"
    bad = client.post(f"/api/v1/pickups/{pickup['id']}/complete", json={"collector_id": "CLT-4218", "pickup_pin": wrong_pin, "actual_weight_kg": 7.5})
    assert bad.status_code == 401
    done = client.post(f"/api/v1/pickups/{pickup['id']}/complete", json={
        "collector_id": "CLT-4218", "pickup_pin": pickup["pickup_pin"], "actual_weight_kg": 7.5,
    }).json()
    assert done["status"] == "COMPLETED" and done["amount_paid"] > 0 and done["lot_id"]
    lot = client.get(f"/api/v1/lots/{done['lot_id']}").json()
    assert lot["collector_id"] == "CLT-4218" and lot["weight_kg"] == 7.5
    assert client.get(f"/api/v1/households/{household['id']}").json()["total_pickups"] == 1
    print("✓ Household pickup lifecycle (post → accept → PIN complete → lot) passed")

    # Buyer company: invisible in marketplace until admin approves
    cmp = client.post("/api/v1/companies/register", json={
        "phone": "9000000002", "name": "GreenCorp Recycling", "company_type": "both",
        "latitude": 18.6290, "longitude": 73.8495,
    }).json()
    assert cmp["approved"] is False
    offers = lambda: [o["id"] for o in client.get("/api/v1/marketplace/offers?material=Copper%20cable&weight_kg=35").json()]
    assert cmp["id"] not in offers()
    appr = client.post(f"/api/v1/admin/companies/{cmp['id']}/approve")
    assert appr.status_code == 200 and appr.json()["approved"] is True
    assert cmp["id"] in offers()

    # Company can also request a bulk pickup, then cancel it
    bulk = client.post("/api/v1/pickups", json={
        "requester_type": "company", "requester_id": cmp["id"], "material": "Server boards", "estimated_weight_kg": 250,
    }).json()
    assert client.post(f"/api/v1/pickups/{bulk['id']}/cancel?requester_id=someone-else").status_code == 403
    assert client.post(f"/api/v1/pickups/{bulk['id']}/cancel?requester_id={cmp['id']}").json()["status"] == "CANCELLED"

    overview = client.get("/api/v1/admin/overview").json()
    assert overview["totals"]["households"] >= 1 and overview["totals"]["companies"] >= 1
    assert len(client.get("/api/v1/admin/pickups").json()) >= 2
    print("✓ Company registration, admin approval and bulk pickup passed")


def test_buyer_company_console():
    """A buyer company is locked out of the recycler console until approved, then posts demand and sets prices."""
    buyer = client.post("/api/v1/companies/register", json={
        "phone": "9000000003", "name": "Deccan E-Recyclers", "company_type": "buyer", "cpcb_license": "MPCB-EW-2026-77",
    }).json()
    rid = buyer["id"]
    demand = {"recycler_id": rid, "recycler_name": buyer["name"], "material": "Aluminium", "quantity_kg": 400, "offered_price_per_kg": 150}

    # Not approved: every write is refused, reads still work
    assert client.post("/api/v1/demands", json=demand).status_code == 403
    assert client.put(f"/api/v1/recycler/{rid}/prices", json={"prices": {"Aluminium": 160}}).status_code == 403
    lot = client.post("/api/v1/lots", json={"material": "Aluminium", "weight_kg": 20, "collector_id": "CLT-4218", "collector_name": "Ramesh Kumar"}).json()
    assert client.post("/api/v1/recycler/offers", json={"recycler_id": rid, "lot_id": lot["id"], "offered_price_per_kg": 150}).status_code == 403
    pin = client.get(f"/api/v1/lots/{lot['id']}/pin").json()["pickup_pin"]
    settle = {"lot_id": lot["id"], "pickup_pin": pin, "recycler_id": rid, "audited_weight_kg": 20, "agreed_payout": 2900}
    assert client.post("/api/v1/handover/confirm", json=settle).status_code == 403
    prices = client.get(f"/api/v1/recycler/{rid}/prices").json()
    assert prices["is_active"] is False and prices["prices"]["Aluminium"] > 0

    # Approved: prices are validated and immediately used by the marketplace
    client.post(f"/api/v1/admin/companies/{rid}/approve")
    assert client.put(f"/api/v1/recycler/{rid}/prices", json={"prices": {"Aluminium": -5}}).status_code == 422
    assert client.put(f"/api/v1/recycler/{rid}/prices", json={"prices": {"Unobtainium": 5}}).status_code == 422
    saved = client.put(f"/api/v1/recycler/{rid}/prices", json={"prices": {"Aluminium": 999}}).json()
    assert saved["prices"]["Aluminium"] == 999 and saved["prices"]["Copper cable"] > 0  # others untouched
    offers = client.get("/api/v1/marketplace/offers?material=Aluminium&weight_kg=20").json()
    assert any(o["id"] == rid and o["listed_price_per_kg"] == 999 for o in offers)

    # Demand posting + "my demands" (all statuses), and the handover now settles
    posted = client.post("/api/v1/demands", json=demand)
    assert posted.status_code == 201
    mine = client.get(f"/api/v1/demands?recycler_id={rid}").json()
    assert [d["id"] for d in mine] == [posted.json()["id"]]
    assert client.post("/api/v1/handover/confirm", json=settle).status_code == 200
    print("✓ Buyer company console (approval gate, price setting, demand posting) passed")


def test_pickup_scheduling():
    """Requester books a date + slot, can reschedule; kabadiwalas see the soonest jobs first."""
    from datetime import date, timedelta
    hh = client.post("/api/v1/households/register", json={"phone": "9000000004", "name": "Anil Joshi", "latitude": 18.6285, "longitude": 73.8490}).json()
    day = lambda n: (date.today() + timedelta(days=n)).isoformat()
    base = {"requester_type": "household", "requester_id": hh["id"], "material": "Aluminium", "estimated_weight_kg": 4}

    later = client.post("/api/v1/pickups", json={**base, "preferred_date": day(5), "preferred_slot": "evening"}).json()
    sooner = client.post("/api/v1/pickups", json={**base, "preferred_date": day(1), "preferred_slot": "morning"}).json()
    flexible = client.post("/api/v1/pickups", json=base).json()
    assert later["preferred_date"] == day(5) and later["preferred_slot"] == "evening"
    assert client.post("/api/v1/pickups", json={**base, "preferred_date": day(30)}).status_code == 422
    assert client.post("/api/v1/pickups", json={**base, "preferred_slot": "midnight"}).status_code == 422

    ids = [p["id"] for p in client.get("/api/v1/pickups?latitude=18.6279&longitude=73.8488").json()]
    assert ids.index(sooner["id"]) < ids.index(later["id"]) < ids.index(flexible["id"])

    # Reschedule: only the requester, only while open/accepted, and the date is validated
    move = {"requester_id": hh["id"], "preferred_date": day(2), "preferred_slot": "afternoon"}
    assert client.post(f"/api/v1/pickups/{later['id']}/schedule", json={**move, "requester_id": "someone"}).status_code == 403
    assert client.post(f"/api/v1/pickups/{later['id']}/schedule", json={**move, "preferred_date": day(40)}).status_code == 422
    moved = client.post(f"/api/v1/pickups/{later['id']}/schedule", json=move).json()
    assert moved["preferred_date"] == day(2) and moved["preferred_slot"] == "afternoon" and moved["pickup_pin"]
    client.post(f"/api/v1/pickups/{flexible['id']}/cancel?requester_id={hh['id']}")
    assert client.post(f"/api/v1/pickups/{flexible['id']}/schedule", json=move).status_code == 409
    print("✓ Pickup scheduling (date + slot, soonest-first, reschedule rules) passed")


def test_pickups_every_area_nearest_first():
    """A kabadiwala anywhere sees every open request in the country, nearest on top."""
    cities = {  # household → (lat, lon)
        "Pimpri": (18.6298, 73.7997), "Hadapsar": (18.5089, 73.9260),
        "Dadar": (19.0178, 72.8478), "T. Nagar": (13.0418, 80.2341),
    }
    ids = {}
    for i, (area, (lat, lon)) in enumerate(cities.items()):
        hh = client.post("/api/v1/households/register", json={
            "phone": f"91000001{i:02d}", "name": f"Test {area}", "address": area, "latitude": lat, "longitude": lon,
        }).json()
        ids[area] = client.post("/api/v1/pickups", json={
            "requester_type": "household", "requester_id": hh["id"], "material": "Aluminium", "estimated_weight_kg": 3,
        }).json()["id"]

    def order(lat, lon, **q):
        qs = "&".join(f"{k}={v}" for k, v in q.items())
        rows = client.get(f"/api/v1/pickups?latitude={lat}&longitude={lon}{'&' + qs if qs else ''}").json()
        dists = [p["distance_km"] for p in rows if p["distance_km"] is not None]
        assert dists == sorted(dists), "open requests must be nearest-first"
        return [p["id"] for p in rows if p["id"] in ids.values()]

    # From Bhosari (Pune): both Pune requests first, then Mumbai, then Chennai — nothing hidden.
    pune = order(18.6279, 73.8488)
    assert pune[:2] == [ids["Pimpri"], ids["Hadapsar"]] and pune[2:] == [ids["Dadar"], ids["T. Nagar"]]
    # From Chennai the order flips; Chennai is on top.
    assert order(13.0827, 80.2707)[0] == ids["T. Nagar"]
    # From Mumbai, Dadar leads.
    assert order(19.0760, 72.8777)[0] == ids["Dadar"]
    # An explicit radius still works as a filter.
    assert order(18.6279, 73.8488, radius_km=30) == [ids["Pimpri"], ids["Hadapsar"]]
    print("✓ Pickups: every area visible, nearest first, optional radius filter passed")


def test_market_pricing():
    """Metals from exchange quotes, household scrap from city rate cards, plus the nearby-industry premium."""
    from db import SessionLocal
    from services import market_price_service as mps

    # 1. Metals: content × commodity price × payable, from an injected exchange snapshot
    snap = {"fetched_at": "2026-09-27T00:00:00+00:00", "fx": 95.0, "quotes": {
        "copper": {"inr": 1400.0, "history_inr": [1300.0, 1400.0]}, "aluminium": {"inr": 330.0, "history_inr": [330.0, 330.0]},
        "steel": {"inr": 140.0, "history_inr": [140.0, 140.0]}, "gold": {"inr": 13000.0, "history_inr": [13000.0, 13000.0]},
        "silver": {"inr": 200.0, "history_inr": [200.0, 200.0]}, "palladium": {"inr": 3900.0, "history_inr": [3900.0, 3900.0]}}}
    value, basis, history = mps.market_price("Copper cable", snap, "live")
    assert basis == "live" and value == round(1400 * 0.60 * 0.88) and history == [round(1300 * 0.6 * 0.88), value]
    pcb, _, _ = mps.market_price("Printed Circuit Boards (PCB)", snap, "live")
    assert pcb == round((0.18 * 1400 + 0.15 * 13000 + 0.8 * 200 + 0.05 * 3900) * 0.15)
    assert mps.market_price("Lithium-ion batteries", snap, "live")[1] == "reference"

    # 2. Household scrap: nearest city's doorstep card ÷ 0.70; far from every city → India median
    mumbai = mps.market_price("Newspaper", lat=19.0760, lon=72.8777)
    assert mumbai[1] == "rate_card" and mumbai[0] == round(10 / 0.70, 1)
    assert mps.price_source("Newspaper", 19.0760, 72.8777) == "Mumbai rate card"
    assert mps.price_source("Newspaper", 26.1445, 91.7362) == "India median rate card"  # Guwahati
    assert mps.market_price("PET bottles", lat=23.2599, lon=77.4126)[0] == round(25 / 0.70, 1)  # Bhopal pays ₹25

    db = SessionLocal()
    try:
        # 3. Premium: industry + buyers near Bhosari MIDC; nothing near Guwahati
        near, reasons = mps.local_premium(db, "Copper cable", 18.6279, 73.8488)
        far, none = mps.local_premium(db, "Copper cable", 26.1445, 91.7362)
        assert 0 < near <= 15 and far == 0 and none == []
        assert any(r["kind"] == "industry" for r in reasons) and any(r["kind"] == "buyers" for r in reasons)

        # 4. Seeded buyers follow the market; a price typed in the console is fixed and wins
        prices = client.get("/api/v1/recycler/eco-cycle/prices").json()
        assert "Copper cable" in prices["market_linked"]
        client.put("/api/v1/recycler/eco-cycle/prices", json={"prices": {"Copper cable": 777}})
        fixed = client.get("/api/v1/recycler/eco-cycle/prices").json()
        assert fixed["prices"]["Copper cable"] == 777 and "Copper cable" not in fixed["market_linked"]
    finally:
        db.close()

    # 5. API: every material, with basis and source; a household's newspaper pickup in Mumbai is quoted at the card rate
    daily = client.get("/api/v1/prices/daily?latitude=19.0760&longitude=72.8777").json()
    by = {p["material"]: p for p in daily["prices"]}
    assert by["Newspaper"]["basis"] == "rate_card" and by["Newspaper"]["doorstep_price"] > 0
    assert set(by) >= {"Newspaper", "Books & notebooks", "Cardboard", "Mixed plastic", "PET bottles", "Stainless steel"}
    hh = client.post("/api/v1/households/register", json={"phone": "9000000099", "name": "Raddi Test", "latitude": 19.0760, "longitude": 72.8777}).json()
    pk = client.post("/api/v1/pickups", json={"requester_type": "household", "requester_id": hh["id"], "material": "Newspaper", "estimated_weight_kg": 20}).json()
    assert 190 <= pk["estimated_value"] <= 240, pk["estimated_value"]  # ≈ ₹10/kg × 20 kg (+ any local premium)
    print("✓ Market pricing (exchange metals, city rate cards, industry premium, buyer indexing) passed")


def test_collector_insights():
    """Underpriced sales are flagged against today's best net offer; suggestions are ranked by money."""
    def lot(material, kg):
        return client.post("/api/v1/lots", json={"material": material, "weight_kg": kg, "collector_id": "CLT-4218", "collector_name": "Ramesh Kumar"}).json()

    def sell(l, recycler_id, per_kg):
        pin = client.get(f"/api/v1/lots/{l['id']}/pin").json()["pickup_pin"]
        r = client.post("/api/v1/handover/confirm", json={"lot_id": l["id"], "pickup_pin": pin, "recycler_id": recycler_id,
                                                          "audited_weight_kg": l["weight_kg"], "agreed_payout": per_kg * l["weight_kg"]})
        assert r.status_code == 200, r.text

    fair_lot, cheap_lot = lot("Brass fittings", 30), lot("Brass fittings", 30)
    sell(fair_lot, "eco-cycle", 300)
    sell(cheap_lot, "green-loop", 150)   # far below any current offer

    ins = client.get("/api/v1/collectors/CLT-4218/insights")
    assert ins.status_code == 200
    d = ins.json()
    flagged = {u["lot_id"]: u for u in d["underpriced"]}
    assert cheap_lot["id"] in flagged and flagged[cheap_lot["id"]]["lost_inr"] > 0
    assert flagged[cheap_lot["id"]]["fair_per_kg"] > flagged[cheap_lot["id"]]["sold_per_kg"] == 150
    brass = next(m for m in d["materials"] if m["material"] == "Brass fittings")
    assert brass["sales"] == 2 and brass["realised_percent"] < 100
    codes = [s["code"] for s in d["suggestions"]]
    assert "UNDERPRICED" in codes and "SWITCH_RECYCLER" in codes
    impacts = [s["impact_inr"] for s in d["suggestions"]]
    assert impacts == sorted(impacts, reverse=True)
    assert len(d["weekdays"]) == 7
    assert client.get("/api/v1/collectors/NOPE/insights").status_code == 404
    print("✓ Collector insights (underpriced sales, buyer switch, ranked suggestions) passed")


def test_regional_intelligence():
    """Hotspots, industry clusters, supply/demand balance and the price heatmap."""
    r = client.get("/api/v1/regional/overview?latitude=18.6279&longitude=73.8488&radius_km=35")
    assert r.status_code == 200
    d = r.json()
    assert d["cells"] and d["cells"] == sorted(d["cells"], key=lambda c: c["score"], reverse=True)
    assert d["hotspots"] and all(h["reasons"] for h in d["hotspots"])
    assert d["dataset"]["approximate"] is True and d["dataset"]["clusters"] >= 10
    top = d["clusters"][0]
    assert top["opportunity_score"] == 100 and top["materials"] and abs(sum(m["share"] for m in top["materials"]) - 1) < 0.01
    assert all(b["supply_kg"] or b["demand_kg"] for b in d["balance"])
    # Far away: nothing from Pune leaks in
    far = client.get("/api/v1/regional/overview?latitude=28.6&longitude=77.2&radius_km=20").json()
    assert far["cells"] == [] and far["clusters"] == []

    h = client.get("/api/v1/regional/price-heatmap?material=Copper%20cable&radius_km=20").json()
    assert len(h["cells"]) == 100 and h["min_price"] <= h["max_price"]
    priced = [c for c in h["cells"] if c["best_net_per_kg"] is not None]
    assert priced and all(c["best_recycler"] for c in priced)
    assert client.get("/api/v1/regional/price-heatmap?material=Gold").status_code == 422
    print("✓ Regional intelligence (hotspots, clusters, balance, price heatmap) passed")


# ─── 7. Aggregator Pooling ───────────────────────────────────────────────────

def test_aggregator_pooling():
    # Create two fresh lots to pool
    def make_lot(weight: float):
        return client.post(
            "/api/v1/lots",
            json={
                "material": "Copper cable",
                "quality": "medium",
                "weight_kg": weight,
                "collector_id": "CLT-4218",
                "collector_name": "Ramesh Kumar",
            },
        ).json()

    lot1 = make_lot(12.5)
    lot2 = make_lot(18.0)

    pool_payload = {
        "lot_ids": [lot1["id"], lot2["id"]],
        "aggregator_id": "AGG-PUNE-01",
        "aggregator_name": "Pune Central Scrap Aggregator",
    }
    res = client.post("/api/v1/aggregator/pool", json=pool_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["premium_gain_percent"] == 15.0
    assert data["lot_count"] == 2
    assert data["total_weight_kg"] == 30.5
    print(f"✓ Aggregator Bulk Pooling passed (Pool {data['pool_id']}, +15% premium)")

    # Pool list endpoint returns it
    res_list = client.get("/api/v1/aggregator/pools")
    assert res_list.status_code == 200
    assert any(p["pool_id"] == data["pool_id"] for p in res_list.json())
    print("✓ Pool list endpoint passed")


# ─── 8. CPCB + National Context ──────────────────────────────────────────────

def test_cpcb_form2_report():
    res = client.get("/api/v1/reports/cpcb")
    assert res.status_code == 200
    data = res.json()
    assert data["total_e_waste_collected_mt"] > 0
    assert len(data["materials_breakdown"]) >= 5
    assert "digital_signature" in data
    print("✓ CPCB Form-2 report passed (simulated)")

    # National context — either configured or not, both OK
    res_nat = client.get("/api/v1/reports/national-context")
    assert res_nat.status_code == 200
    nat = res_nat.json()
    assert "configured" in nat
    if nat["configured"]:
        print("✓ National context passed (configured with real data)")
    else:
        print("✓ National context passed (not yet configured — expected)")


# ─── Runner ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n--- Running FastAPI Backend Test Suite ---\n")
    test_health()
    test_lots_flow()
    test_spatial_offers()
    test_ml_inference()
    test_arima_forecaster()
    test_handover_and_epr()
    test_settlement_credits_collector()
    test_sync_retry_after_reject()
    test_assistant_offline()
    test_assistant_llm_agent_loop()
    test_roles_and_pickups()
    test_buyer_company_console()
    test_pickup_scheduling()
    test_pickups_every_area_nearest_first()
    test_market_pricing()
    test_collector_insights()
    test_regional_intelligence()
    test_aggregator_pooling()
    test_cpcb_form2_report()
    print("\nALL 19 BACKEND TEST SUITES PASSED\n")