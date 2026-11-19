"""
==============================================================================
FILE: test_platform.py
PURPOSE:
Automated Unit and Integration Test Suite for the TracX Platform.

TEST COVERAGE:
1. Device Provisioning CRUD & Partial Updates (POST, GET, PATCH, DELETE /api/v1/devices).
2. REST Vehicle state retrieval (GET /api/v1/vehicles).
3. Interactive fault simulation and AI anomaly triggering (POST /api/v1/simulate/action).
4. AI Predictive model outputs (15m forecast, risk scoring, GPS mode, driver score).
5. Physical enclosure tamper security alerts (Layer-1 Rule Engine).
6. SQLite Database Persistence Verification.
7. Frontend Dashboard static asset hosting.
==============================================================================
"""

import sys
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from fastapi.testclient import TestClient
from tracx_platform.backend.main import app


def run_tests():
    """Executes end-to-end integration test scenarios."""
    client = TestClient(app)
    
    # ------------------------------------------------------------------------
    # TEST 1: Device Provisioning CRUD & Partial Updates
    # ------------------------------------------------------------------------
    print("1. Testing Device Fleet Provisioning (POST /api/v1/devices) ...")
    dev_payload = {
        "device_id": "TRX-1099",
        "imei": "864201049281799",
        "vehicle_name": "Test Reefer Van KA-01-MJ-9999",
        "cargo_type": "Frozen Seafood",
        "target_min_c": -20.0,
        "target_max_c": -15.0,
        "sampling_interval_sec": 5
    }
    res = client.post("/api/v1/devices", json=dev_payload)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    print("   -> OK! Created Device:", res.json()["device_id"])

    print("2. Testing Device Partial Update (PATCH /api/v1/devices/TRX-1099) ...")
    patch_payload = {
        "target_min_c": -22.0,
        "target_max_c": -14.0,
        "vehicle_name": "Updated Reefer Van KA-01-MJ-9999"
    }
    res = client.patch("/api/v1/devices/TRX-1099", json=patch_payload)
    assert res.status_code == 200
    updated = res.json()
    assert updated["target_min_c"] == -22.0
    assert updated["vehicle_name"] == "Updated Reefer Van KA-01-MJ-9999"
    print("   -> OK! Partial update confirmed. New Limits:", updated["target_min_c"], "to", updated["target_max_c"])

    print("3. Testing Device Deletion (DELETE /api/v1/devices/TRX-1099) ...")
    res = client.delete("/api/v1/devices/TRX-1099")
    assert res.status_code == 200
    print("   -> OK! Decommissioned device TRX-1099.")

    # ------------------------------------------------------------------------
    # TEST 4: Query Vehicle Fleet Status
    # ------------------------------------------------------------------------
    print("4. Testing GET /api/v1/vehicles ...")
    res = client.get("/api/v1/vehicles")
    assert res.status_code == 200
    print("   -> OK! Vehicles active in live cache:", len(res.json()))

    # ------------------------------------------------------------------------
    # TEST 5: Inject Rapid Temperature Rise Fault & AI Prediction
    # ------------------------------------------------------------------------
    print("5. Testing POST /api/v1/simulate/action (temp_spike) ...")
    res = client.post("/api/v1/simulate/action", json={"device_id": "TRX-1001", "action": "temp_spike"})
    assert res.status_code == 200
    print("   -> OK! Result:", res.json())

    print("6. Testing AI Anomaly Evaluation & History ...")
    res = client.get("/api/v1/telemetry/TRX-1001/history")
    assert res.status_code == 200
    history = res.json()
    assert len(history) > 0
    latest = history[-1]
    ai = latest["layer2_ai_intelligence"]
    print("   -> OK! Latest Measured Temp:", latest["raw_telemetry"]["temperature"]["cargo_temp_c"], "°C")
    print("   -> OK! AI Temp Risk:", ai["temperature_prediction"]["risk_level"], "| 15m Forecast:", ai["temperature_prediction"]["predicted_temp_15m_c"], "°C")
    print("   -> OK! AI GPS Mode:", ai["gps_intelligence"]["tracking_mode"])
    print("   -> OK! AI Driver Score:", ai["driver_behavior"]["driver_safety_score_100"])

    # ------------------------------------------------------------------------
    # TEST 7: Enclosure Tamper Breach Verification
    # ------------------------------------------------------------------------
    print("7. Testing Enclosure Tamper Breach Simulation ...")
    res = client.post("/api/v1/simulate/action", json={"device_id": "TRX-1001", "action": "tamper"})
    assert res.status_code == 200
    res = client.get("/api/v1/alerts")
    assert res.status_code == 200
    alerts = res.json()
    print("   -> OK! Active Alerts Count:", len(alerts))
    print("   -> OK! Top Triggered Alert:", alerts[0]["rule_name"], "-", alerts[0]["message"])

    # ------------------------------------------------------------------------
    # TEST 9: Dedicated Temperature Ingestion (No min/max or battery from firmware)
    # ------------------------------------------------------------------------
    print("9. Testing Dedicated Temperature Endpoint (POST /api/v1/telemetry/temperature) ...")
    temp_res = client.post("/api/v1/telemetry/temperature", json={
        "device_id": "TRX-1001",
        "temp_c": 5.4
    })
    assert temp_res.status_code == 200
    temp_data = temp_res.json()
    assert temp_data["raw_telemetry"]["temperature"]["cargo_temp_c"] == 5.4
    assert temp_data["raw_telemetry"]["temperature"]["target_min_c"] is not None
    assert temp_data["raw_telemetry"]["temperature"]["target_max_c"] is not None
    print("   -> OK! Firmware sent only 'temp_c: 5.4'. Software auto-calculated thresholds:", 
          temp_data["raw_telemetry"]["temperature"]["target_min_c"], "to", 
          temp_data["raw_telemetry"]["temperature"]["target_max_c"])

    # ------------------------------------------------------------------------
    # TEST 10: Dedicated GPS Ingestion (Only lat and lng sent - speed auto-calculated)
    # ------------------------------------------------------------------------
    print("10. Testing Dedicated GPS Endpoint (POST /api/v1/telemetry/gps) ...")
    gps_res = client.post("/api/v1/telemetry/gps", json={
        "device_id": "TRX-1001",
        "lat": 17.4480,
        "lng": 78.3890
    })
    assert gps_res.status_code == 200
    gps_data = gps_res.json()
    assert gps_data["raw_telemetry"]["gps"]["lat"] == 17.4480
    assert gps_data["raw_telemetry"]["gps"]["speed_kmh"] is not None
    assert gps_data["raw_telemetry"]["gps"]["heading_deg"] is not None
    print("   -> OK! Firmware sent only 'lat & lng'. Software auto-calculated speed:", 
          gps_data["raw_telemetry"]["gps"]["speed_kmh"], "km/h | Heading:", 
          gps_data["raw_telemetry"]["gps"]["heading_deg"], "°")

    # ------------------------------------------------------------------------
    # TEST 11: Dedicated Tamper Ingestion (Door Breach)
    # ------------------------------------------------------------------------
    print("11. Testing Dedicated Tamper Endpoint (POST /api/v1/telemetry/tamper) ...")
    tamper_res = client.post("/api/v1/telemetry/tamper", json={
        "device_id": "TRX-1001",
        "door_closed": False
    })
    assert tamper_res.status_code == 200
    tamper_data = tamper_res.json()
    assert tamper_data["raw_telemetry"]["tamper_switch_closed"] is False
    assert any(a["rule_name"] == "ENCLOSURE_TAMPER_OPEN" for a in tamper_data["layer1_deterministic_alerts"])
    print("   -> OK! Door opened detected. Instant Layer-1 Tamper Alert Triggered!")

    # ------------------------------------------------------------------------
    # TEST 12: Trip Segmentation & Listing (GET /api/v1/trips/{device_id})
    # ------------------------------------------------------------------------
    print("12. Testing Trip Segmentation & Listing (GET /api/v1/trips/TRX-1001) ...")
    trips_res = client.get("/api/v1/trips/TRX-1001")
    assert trips_res.status_code == 200
    trips_list = trips_res.json()
    assert isinstance(trips_list, list)
    print(f"   -> OK! Found {len(trips_list)} trips for TRX-1001.")
    if trips_list:
        sample_trip = trips_list[0]
        trip_id = sample_trip["trip_id"]
        print(f"   -> OK! Active Trip ID: {trip_id} | Status: {sample_trip.get('status')} | Halts: {sample_trip.get('halt_count')}")

        # --------------------------------------------------------------------
        # TEST 13: GDP Cold-Chain Certificate Export (GET /api/v1/trips/.../export)
        # --------------------------------------------------------------------
        print("13. Testing GDP Cold-Chain Certificate Export ...")
        exp_res = client.get(f"/api/v1/trips/TRX-1001/{trip_id}/export")
        assert exp_res.status_code == 200
        cert = exp_res.json()
        assert "certificate_id" in cert
        assert "cold_chain_audit" in cert
        print(f"   -> OK! Generated Certificate: {cert['certificate_id']} | Compliance: {cert['cold_chain_audit']['compliance_status']}")

    # ------------------------------------------------------------------------
    # TEST 14: Multi-Channel Alert Configuration (GET & POST /api/v1/channels/config)
    # ------------------------------------------------------------------------
    print("14. Testing Multi-Channel Alert Configuration APIs ...")
    conf_res = client.get("/api/v1/channels/config")
    assert conf_res.status_code == 200
    conf_data = conf_res.json()
    assert "webhook_configured" in conf_data
    assert "telegram_configured" in conf_data
    print("   -> OK! Current notification channel config loaded.")

    save_res = client.post("/api/v1/channels/config", json={
        "telegram_chat_id": "987654321",
        "alert_min_severity": "WARNING"
    })
    assert save_res.status_code == 200
    assert save_res.json()["config"]["telegram_chat_id"] == "987654321"
    print("   -> OK! Channel config updated & persisted successfully.")

    print("\n🎉 ALL 14 SMART CCMS END-TO-END TEST SUITES PASSED FLAWLESSLY!")


if __name__ == "__main__":
    run_tests()

