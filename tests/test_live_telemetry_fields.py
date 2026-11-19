"""
Unit tests verifying Live Telemetry endpoint fields:
- gps_on (ON when coordinates are present, OFF when null or 0,0)
- distance_km (minimum 100m filter)
- total_time_str (HH:MM:SS format)
- raw_payload (exact unmodified payload)
"""

import json
import unittest
from tracx_platform.backend.services.telemetry_service import TelemetryService
from tracx_platform.backend.storage import store
from tracx_platform.backend.trip_engine import trip_engine
from tracx_platform.backend.api.routes.telemetry import get_latest_device_telemetry


class TestLiveTelemetryFields(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        store.clear()
        trip_engine.active_contexts.clear()
        from tracx_platform.backend.database import get_db_connection
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("DELETE FROM trips WHERE device_id LIKE 'GW-TEST-%' OR device_id LIKE 'GW-TRIP-%' OR device_id LIKE 'GW-TIME-%'")
        conn.commit()
        conn.close()

    async def test_gps_on_state(self):
        dev_id = "GW-TEST-GPS"
        
        # 1. Payload with null coordinates -> gps_on must be False
        payload_no_gps = {
            "gateway_id": dev_id,
            "node_id": "NODE-001",
            "temperature": 4.5,
            "latitude": None,
            "longitude": None,
            "door_status": "OPEN",
            "timestamp": "2026-10-10 12:00:00"
        }
        await TelemetryService.process_ec200u_gateway_payload(payload_no_gps)
        
        res1 = await get_latest_device_telemetry(dev_id)
        body1 = json.loads(res1.body.decode())
        self.assertFalse(body1["gps_on"], "GPS should be OFF when coordinates are null")
        self.assertEqual(body1["raw_payload"]["latitude"], None)
        self.assertEqual(body1["raw_payload"]["door_status"], "OPEN")

        # 2. Payload with valid coordinates -> gps_on must be True
        payload_with_gps = {
            "gateway_id": dev_id,
            "node_id": "NODE-001",
            "temperature": 4.6,
            "latitude": 17.4435,
            "longitude": 78.3772,
            "door_status": "SEALED",
            "timestamp": "2026-10-10 12:01:00"
        }
        await TelemetryService.process_ec200u_gateway_payload(payload_with_gps)
        res2 = await get_latest_device_telemetry(dev_id)
        body2 = json.loads(res2.body.decode())
        self.assertTrue(body2["gps_on"], "GPS should be ON when valid coordinates are present")
        self.assertEqual(body2["raw_payload"]["latitude"], 17.4435)

    async def test_trip_minimum_100m_condition(self):
        dev_id = "GW-TRIP-TEST"
        # Initial point
        p1 = {
            "gateway_id": dev_id,
            "latitude": 17.4400,
            "longitude": 78.3800,
            "speed_kmh": 20.0,
            "temperature": 4.5,
            "timestamp": "2026-10-10 10:00:00"
        }
        await TelemetryService.process_ec200u_gateway_payload(p1)
        res1 = await get_latest_device_telemetry(dev_id)
        body1 = json.loads(res1.body.decode())
        self.assertEqual(body1["distance_km"], 0.0)

        # Small 50m jitter (< 100m) (~0.00045 deg lat)
        p2 = {
            "gateway_id": dev_id,
            "latitude": 17.44045,
            "longitude": 78.3800,
            "speed_kmh": 5.0,
            "temperature": 4.5,
            "timestamp": "2026-10-10 10:00:30"
        }
        await TelemetryService.process_ec200u_gateway_payload(p2)
        res2 = await get_latest_device_telemetry(dev_id)
        body2 = json.loads(res2.body.decode())
        self.assertEqual(body2["distance_km"], 0.0, "Jitter < 100m should NOT accumulate distance")

        # Significant 200m move (>= 100m) (~0.0018 deg lat from initial)
        p3 = {
            "gateway_id": dev_id,
            "latitude": 17.44180,
            "longitude": 78.3800,
            "speed_kmh": 25.0,
            "temperature": 4.5,
            "timestamp": "2026-10-10 10:01:00"
        }
        await TelemetryService.process_ec200u_gateway_payload(p3)
        res3 = await get_latest_device_telemetry(dev_id)
        body3 = json.loads(res3.body.decode())
        self.assertGreater(body3["distance_km"], 0.15, "Displacement >= 100m should accumulate distance")

    async def test_total_time_format(self):
        dev_id = "GW-TIME-TEST"
        payload = {
            "gateway_id": dev_id,
            "node_id": "NODE-001",
            "temperature": 5.0,
            "timestamp": "2026-10-10 12:00:00"
        }
        await TelemetryService.process_ec200u_gateway_payload(payload)
        
        res = await get_latest_device_telemetry(dev_id)
        body = json.loads(res.body.decode())
        self.assertIn("total_time_str", body)
        # Should match HH:MM:SS
        parts = body["total_time_str"].split(":")
        self.assertEqual(len(parts), 3)
        self.assertEqual(len(parts[0]), 2)
        self.assertEqual(len(parts[1]), 2)
        self.assertEqual(len(parts[2]), 2)


if __name__ == "__main__":
    unittest.main()
