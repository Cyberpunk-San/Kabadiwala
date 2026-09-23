# apps/backend/test_backend.py
"""
Backend test suite — updated for SQLite-backed lots and real PIN verification.

Run with:  python test_backend.py
Requires the DB to be freshly seeded (the copper lot must have PIN 1234).
If you've already confirmed handover on lot_demo_copper_01, reset the DB first:
    del data\\mhk.db
Then start the server once (which re-seeds), stop it, and run this file.
"""

from fastapi.testclient import TestClient
from main import app

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
    """
    Note: this uses a fake image URI, so CLIP will fall back to 'Mixed e-waste'
    with confidence 0.0. That's the expected behavior for missing files.
    To test real classification, run the curl command with a real image.
    """
    res = client.post(
        "/api/v1/vision/analyze",
        json={"imageUri": "file:///nonexistent/path.jpg"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "material" in data
    assert "hazard" in data
    assert "confidence" in data
    assert "model_version" in data
    assert "clip" in data["model_version"].lower()
    print(f"✓ Vision endpoint passed (fallback: {data['material']}, conf={data['confidence']})")


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
        "recycler_id": "REC-PUNE-01",
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
    test_aggregator_pooling()
    test_cpcb_form2_report()
    print("\nALL 8 BACKEND TEST SUITES PASSED PERFECTLY!\n")