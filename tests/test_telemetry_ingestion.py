"""
==============================================================================
FILE: test_telemetry_ingestion.py
PURPOSE:
Comprehensive automated tests verifying that telemetry ingestion succeeds 100%
under all hardware and firmware transmission conditions:
- Trailing slashes (/api/v1/telemetry/ vs /api/v1/telemetry)
- Path aliases (/api/telemetry, /telemetry, /data, /api/container/data, /)
- HTTP methods (POST, GET with query parameters, PUT)
- Body formats (JSON dict, double-encoded JSON string, text/plain, x-www-form-urlencoded)
- Query parameter fallbacks
- Field aliases (temp, lat, lng, spd, door_open, tamper_open, csq)
- Smart auto-detection (node_connected inferred from temp, online status without rssi)
==============================================================================
"""

import unittest
from fastapi.testclient import TestClient
from tracx_platform.backend.main import app
from tracx_platform.backend.storage import store


class TestTelemetryIngestion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        from tracx_platform.backend.database.database import db_clear_all_telemetry_and_trips
        db_clear_all_telemetry_and_trips()
        store.clear_all()

    def test_standard_json_post(self):
        """Standard JSON payload to /api/v1/telemetry."""
        payload = {
            "gateway_id": "GW-TEST-01",
            "temperature": 4.2,
            "latitude": 17.445,
            "longitude": 78.375,
            "speed_kmh": 22.5,
            "node_connected": True
        }
        res = self.client.post("/api/v1/telemetry", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "received")
        self.assertEqual(data.get("gateway_id"), "GW-TEST-01")

    def test_trailing_slash_post(self):
        """Hardware modem posting to /api/v1/telemetry/ with trailing slash."""
        payload = {
            "gateway_id": "GW-TEST-02",
            "temperature": 5.1
        }
        res = self.client.post("/api/v1/telemetry/", json=payload)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("status"), "received")

    def test_versionless_api_aliases(self):
        """Firmware posting to /api/telemetry and /telemetry."""
        payload = {"gateway_id": "GW-TEST-03", "temp": 3.8}
        
        res1 = self.client.post("/api/telemetry", json=payload)
        self.assertEqual(res1.status_code, 200)
        
        res2 = self.client.post("/api/telemetry/", json=payload)
        self.assertEqual(res2.status_code, 200)
        
        res3 = self.client.post("/telemetry", json=payload)
        self.assertEqual(res3.status_code, 200)
        
        res4 = self.client.post("/telemetry/", json=payload)
        self.assertEqual(res4.status_code, 200)

    def test_hardware_data_routes(self):
        """Endpoints /data and /api/container/data with and without trailing slash."""
        payload = {"gateway_id": "GW-TEST-04", "temperature": 4.0}
        
        for path in ["/data", "/data/", "/api/container/data", "/api/container/data/", "/"]:
            res = self.client.post(path, json=payload)
            self.assertEqual(res.status_code, 200, f"Failed on path {path}")

    def test_get_with_telemetry_query_params(self):
        """Cellular modem using HTTP GET with URL query parameters."""
        res = self.client.get("/api/v1/telemetry?gateway_id=GW-TEST-05&temp=4.8&lat=17.44&lng=78.38&spd=15.0")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "received")
        summary = data.get("received_summary", {})
        self.assertEqual(summary.get("gateway_id"), "GW-TEST-05")
        self.assertEqual(summary.get("temperature_c"), 4.8)
        self.assertEqual(summary.get("lat"), 17.44)
        self.assertEqual(summary.get("lng"), 78.38)
        self.assertEqual(summary.get("speed_kmh"), 15.0)

    def test_get_without_params_returns_online_info(self):
        """Browser or uptime probe visiting GET /api/v1/telemetry."""
        res = self.client.get("/api/v1/telemetry")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("status"), "online")
        self.assertIn("Smart CCMS", data.get("message", ""))

    def test_post_with_query_params(self):
        """POST with parameters passed in URL query string."""
        res = self.client.post("/api/v1/telemetry?gateway_id=GW-TEST-06&temperature=6.2")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("gateway_id"), "GW-TEST-06")

    def test_double_encoded_json_string(self):
        """Arduino / ESP32 sending JSON serialized into a string."""
        raw_str = '"{\\"gateway_id\\": \\"GW-TEST-07\\", \\"temperature\\": 3.9}"'
        res = self.client.post(
            "/api/v1/telemetry",
            content=raw_str,
            headers={"Content-Type": "application/json"}
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("gateway_id"), "GW-TEST-07")

    def test_text_plain_content_type(self):
        """Modem sending text/plain Content-Type."""
        res = self.client.post(
            "/api/v1/telemetry",
            content='{"gateway_id": "GW-TEST-08", "temp": 5.5}',
            headers={"Content-Type": "text/plain"}
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("received_summary", {}).get("temperature_c"), 5.5)

    def test_single_quoted_python_dict_string(self):
        """Payload using single quotes."""
        res = self.client.post(
            "/api/v1/telemetry",
            content="{'gateway_id': 'GW-TEST-09', 'temperature': 4.7}",
            headers={"Content-Type": "text/plain"}
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("gateway_id"), "GW-TEST-09")

    def test_url_encoded_form_data(self):
        """GPRS HTTP client using application/x-www-form-urlencoded."""
        form_data = "gateway_id=GW-TEST-10&temp=4.1&lat=17.44&lng=78.38&node_connected=true"
        res = self.client.post(
            "/api/v1/telemetry",
            content=form_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        summary = data.get("received_summary", {})
        self.assertEqual(summary.get("gateway_id"), "GW-TEST-10")
        self.assertEqual(summary.get("temperature_c"), 4.1)
        self.assertTrue(summary.get("node_connected"))

    def test_empty_post_graceful_fallback(self):
        """Empty POST body does not crash with 400."""
        res = self.client.post("/api/v1/telemetry", content="")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json().get("status"), "received")

    def test_field_aliases_and_smart_inference(self):
        """Verify temperature, coordinates, door, tamper, and node auto-inference."""
        payload = {
            "device_id": "GW-TEST-11",
            "temp": 4.6,
            "lat": 17.50,
            "lon": 78.40,
            "spd": 45.0,
            "door_open": 1,
            "tamper_open": True,
            "csq": 24
        }
        res = self.client.post("/api/v1/telemetry", json=payload)
        self.assertEqual(res.status_code, 200)
        summary = res.json().get("received_summary", {})
        self.assertEqual(summary.get("temperature_c"), 4.6)
        self.assertTrue(summary.get("node_connected"))  # Inferred from temp
        self.assertEqual(summary.get("door_status"), "OPEN")
        self.assertFalse(summary.get("door_sealed"))
        self.assertTrue(summary.get("tamper_tripped"))
        self.assertEqual(summary.get("lte_csq"), 24)

    def test_device_online_status_without_rssi(self):
        """Device transmitting without network_rssi must still be reported online."""
        dev_id = "GW-TEST-ONLINE"
        self.client.post("/api/v1/telemetry", json={"gateway_id": dev_id, "temp": 4.5})
        
        res = self.client.get(f"/api/v1/telemetry/{dev_id}/latest")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("is_online"))
        self.assertLess(data.get("packet_age_sec"), 10)


if __name__ == "__main__":
    unittest.main()
