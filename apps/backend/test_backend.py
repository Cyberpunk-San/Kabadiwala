import sys
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    print("✓ /health passed")

def test_lots_flow():
    # 1. List lots
    res = client.get("/api/v1/lots")
    assert res.status_code == 200
    assert len(res.json()) >= 1
    print("✓ GET /api/v1/lots passed")

    # 2. Create lot
    lot_payload = {
        "material": "Copper cable",
        "quality": "medium",
        "weight_kg": 40.0,
        "collector_id": "CLT-4218",
        "collector_name": "Ramesh Kumar"
    }
    res_create = client.post("/api/v1/lots", json=lot_payload)
    assert res_create.status_code == 201
    created_id = res_create.json()["id"]
    print(f"✓ POST /api/v1/lots passed (Created: {created_id})")

    # 3. Get created lot
    res_get = client.get(f"/api/v1/lots/{created_id}")
    assert res_get.status_code == 200
    assert res_get.json()["weight_kg"] == 40.0
    print(f"✓ GET /api/v1/lots/{created_id} passed")

def test_spatial_offers():
    res = client.get("/api/v1/marketplace/offers?material=Copper%20cable&weight_kg=35&latitude=18.6279&longitude=73.8488")
    assert res.status_code == 200
    offers = res.json()
    assert len(offers) >= 1
    assert "distance_km" in offers[0]
    assert "net_earnings" in offers[0]
    # Check ranking
    assert offers[0]["net_earnings"] >= offers[-1]["net_earnings"]
    print(f"✓ Spatial Matching passed ({len(offers)} recyclers ranked by net take-home)")

def test_ml_inference():
    res = client.post("/api/v1/vision/analyze", json={"imageUri": "file:///camera/sample_lithium_cell.jpg"})
    assert res.status_code == 200
    data = res.json()
    assert data["material"] == "Lithium-ion batteries"
    assert data["hazard"] is True
    assert "safety_message" in data
    print("✓ MobileNetV3 ML Classifier & Hazard Detection passed")

def test_arima_forecaster():
    res = client.get("/api/v1/prices/forecast?material=Copper%20cable&zone=Pune%20MIDC")
    assert res.status_code == 200
    data = res.json()
    assert len(data["forecast_7_days"]) == 7
    assert "advice" in data
    print("✓ ARIMA 7-Day Price Forecaster passed")

def test_handover_and_epr():
    # Verify handover
    res_verify = client.post("/api/v1/handover/verify", json={"lot_id": "lot_demo_copper_01"})
    assert res_verify.status_code == 200
    assert res_verify.json()["verified"] is True
    print("✓ Handover QR/PIN Verification passed")

    # Confirm handover
    confirm_payload = {
        "lot_id": "lot_demo_copper_01",
        "pickup_pin": "5821",
        "recycler_id": "REC-PUNE-01",
        "audited_weight_kg": 35.0,
        "agreed_payout": 18450.0,
        "payment_mode": "UPI"
    }
    res_confirm = client.post("/api/v1/handover/confirm", json=confirm_payload)
    assert res_confirm.status_code == 200
    receipt = res_confirm.json()
    assert "utr_number" in receipt
    assert "epr_certificate_id" in receipt
    assert receipt["carbon_offset_kg"] > 0
    print(f"✓ Settlement & CPCB EPR Tagging passed (Cert: {receipt['epr_certificate_id']})")

def test_aggregator_pooling():
    pool_payload = {
        "lot_ids": ["lot_demo_copper_01"],
        "aggregator_id": "AGG-PUNE-01"
    }
    res = client.post("/api/v1/aggregator/pool", json=pool_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["premium_gain_percent"] == 15.0
    print("✓ Aggregator Bulk Pooling (+15% Premium) passed")

def test_cpcb_form2_report():
    res = client.get("/api/v1/reports/cpcb")
    assert res.status_code == 200
    data = res.json()
    assert data["total_e_waste_collected_mt"] > 0
    assert len(data["materials_breakdown"]) >= 5
    assert "digital_signature" in data
    print("✓ CPCB Form-2 Compliance Report Generator passed")

if __name__ == "__main__":
    print("\n--- Running FastAPI Backend Test Suite ---")
    test_health()
    test_lots_flow()
    test_spatial_offers()
    test_ml_inference()
    test_arima_forecaster()
    test_handover_and_epr()
    test_aggregator_pooling()
    test_cpcb_form2_report()
    print("\nALL 8 BACKEND TEST SUITES PASSED PERFECTLY!\n")
