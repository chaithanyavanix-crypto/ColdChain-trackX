"""
Comprehensive Unit Tests verifying fixes for the 6 reported GPS & Telemetry issues:
1. Reverse geocoding outside Hyderabad (e.g. Mumbai, Bangalore) resolves real address, not hardcoded Hyderabad.
2. No invented ±8.5m accuracy or 10 satellites fallback.
3. (0,0) Null Island coordinates rejected as NO_FIX.
4. Bad kinematic jump does not move location card to bad point; holds last known fix.
5. Tracking mode changes to ANOMALY_REJECTED (not GNSS_LOCKED) and next valid point is added to path.
6. Naive device local timestamps (IST, +05:30) converted to true UTC (no 5.5 hour offset).
"""

import unittest
import asyncio
from datetime import datetime, timezone, timedelta

from tracx_platform.backend.services.geocoding_service import GeocodingService
from tracx_platform.backend.services.telemetry_service import TelemetryService
from tracx_platform.backend.services.trip_service import TripEngine
from tracx_platform.backend.schemas.telemetry import RawTelemetryPacket, GPSCoordinates, TemperatureReading
from tracx_platform.backend.ai.anomaly_detection import GPSAnomalyDetector
from tracx_platform.backend.utils.time_utils import parse_timestamp, IST, utc_now
from tracx_platform.backend.storage import store


class TestTelemetryGpsFixes(unittest.TestCase):

    def setUp(self):
        store.clear()

    def test_1_mumbai_geocoding_not_hyderabad(self):
        """A vehicle in Mumbai (19.0760, 72.8777) must NOT be labeled 'Hyderabad Region, Hyderabad, Telangana'."""
        result = GeocodingService.resolve_location(
            device_id="GW-MUM-01",
            lat=19.0760,
            lng=72.8777,
            speed_kmh=25.0
        )
        self.assertNotIn("Hyderabad", result["display_address"])
        self.assertNotIn("Hyderabad", result["city"])
        self.assertIn("Mumbai", result["city"])
        self.assertIn("Maharashtra", result["state"])

    def test_2_accuracy_no_invented_value(self):
        """If device sends no accuracy, the card must NOT invent '±8.5m'."""
        # Case A: No accuracy provided
        res_no_acc = GeocodingService.resolve_location(
            device_id="GW-ACC-01",
            lat=17.4450,
            lng=78.3750,
            accuracy_m=None
        )
        self.assertNotIn("±8.5m", res_no_acc["accuracy_label"])
        self.assertEqual(res_no_acc["accuracy_label"], "GPS Active (3D Fix)")

        # Case B: Real accuracy provided (e.g. 14.2m)
        res_with_acc = GeocodingService.resolve_location(
            device_id="GW-ACC-02",
            lat=17.4450,
            lng=78.3750,
            accuracy_m=14.2
        )
        self.assertIn("±14.2m", res_with_acc["accuracy_label"])

    def test_2b_satellites_not_assumed_ten(self):
        """If device sends fix but no satellite count, code must NOT invent 10."""
        payload = {
            "gateway_id": "GW-SAT-01",
            "lat": 17.4450,
            "lng": 78.3750,
            "speed_kmh": 20.0
            # satellites is omitted
        }
        resp = asyncio.run(TelemetryService.process_ec200u_gateway_payload(payload))
        self.assertEqual(resp["status"], "received")

        latest = store.get_latest("GW-SAT-01")
        self.assertIsNotNone(latest)
        self.assertIsNone(latest.raw_telemetry.gps.satellites_count)

    def test_3_null_island_rejected_as_no_fix(self):
        """A (0,0) point must be rejected with fix_status='NO_FIX' and coordinates None."""
        payload = {
            "gateway_id": "GW-NULL-01",
            "lat": 0.0,
            "lng": 0.0,
            "speed_kmh": 0.0
        }
        resp = asyncio.run(TelemetryService.process_ec200u_gateway_payload(payload))
        self.assertEqual(resp["status"], "received")

        latest = store.get_latest("GW-NULL-01")
        self.assertIsNotNone(latest)
        self.assertEqual(latest.raw_telemetry.gps.fix_status, "NO_FIX")
        self.assertIsNone(latest.raw_telemetry.gps.lat)
        self.assertIsNone(latest.raw_telemetry.gps.lng)

    def test_4_and_5_bad_jump_and_subsequent_valid_point(self):
        """
        After a bad jump:
        1. AI flags anomaly and tracking mode becomes ANOMALY_REJECTED (not GNSS_LOCKED).
        2. Location card / context holds last valid position (does not move to bad jump).
        3. Bad jump is NOT added to trip engine path.
        4. Next valid point is compared against PREVIOUS VALID POINT (not bad jump) and IS added to path.
        """
        engine = TripEngine()
        dev_id = "GW-JUMP-01"
        t0 = utc_now() - timedelta(minutes=5)
        t1 = t0 + timedelta(seconds=10)
        t2 = t1 + timedelta(seconds=10)

        # 1. First valid point in Hyderabad (HITEC City)
        p1 = RawTelemetryPacket(
            device_id=dev_id,
            timestamp=t0,
            gps=GPSCoordinates(lat=17.4435, lng=78.3772, speed_kmh=30.0, fix_status="3D_FIX"),
            temperature=TemperatureReading(cargo_temp_c=4.5)
        )
        asyncio.run(TelemetryService.process_and_broadcast_packet(p1))
        engine.process_telemetry(p1)

        ctx = engine.active_contexts.get(dev_id)
        self.assertIsNotNone(ctx)
        self.assertAlmostEqual(ctx["last_lat"], 17.4435, places=3)
        loc1 = store.get_location_context(dev_id)
        self.assertEqual(loc1["area"], "HITEC City")

        # 2. Bad jump point (teleports to Delhi, 1200 km away in 10s)
        p_jump = RawTelemetryPacket(
            device_id=dev_id,
            timestamp=t1,
            gps=GPSCoordinates(lat=28.6139, lng=77.2090, speed_kmh=30.0, fix_status="3D_FIX"),
            temperature=TemperatureReading(cargo_temp_c=4.5)
        )
        asyncio.run(TelemetryService.process_and_broadcast_packet(p_jump))

        # Check anomaly detection output
        ai_res = GPSAnomalyDetector.detect(p_jump, [p1])
        self.assertTrue(ai_res.kinematic_anomaly_detected)
        self.assertEqual(ai_res.tracking_mode, "ANOMALY_REJECTED")

        # Location card must NOT have moved to Delhi! Must hold Hyderabad
        loc_after_jump = store.get_location_context(dev_id)
        self.assertNotIn("Delhi", loc_after_jump["display_address"])
        self.assertIn("HITEC City", loc_after_jump["display_address"])
        self.assertEqual(loc_after_jump["movement_status"], "ANOMALY_REJECTED")

        # Trip engine must reject p_jump and NOT update ctx last_lat to Delhi
        trip_res = engine.process_telemetry(p_jump)
        self.assertIsNone(trip_res)
        self.assertAlmostEqual(ctx["last_lat"], 17.4435, places=3)  # Still Hyderabad!

        # 3. Next valid point (moved 100 meters forward in Hyderabad)
        p_valid_next = RawTelemetryPacket(
            device_id=dev_id,
            timestamp=t2,
            gps=GPSCoordinates(lat=17.4445, lng=78.3780, speed_kmh=32.0, fix_status="3D_FIX"),
            temperature=TemperatureReading(cargo_temp_c=4.5)
        )
        asyncio.run(TelemetryService.process_and_broadcast_packet(p_valid_next))

        # AI must compare against p1 (skipping p_jump) and consider it normal
        ai_res_next = GPSAnomalyDetector.detect(p_valid_next, [p_jump, p1])
        self.assertFalse(ai_res_next.kinematic_anomaly_detected)
        self.assertEqual(ai_res_next.tracking_mode, "GNSS_LOCKED")

        # Trip engine MUST process p_valid_next and update last_lat
        engine.process_telemetry(p_valid_next)
        self.assertAlmostEqual(ctx["last_lat"], 17.4445, places=3)
        self.assertGreater(ctx["total_distance_km"], 0.0)

    def test_6_timestamps_naive_ist_converted_to_utc(self):
        """
        Device sending local IST timestamp (e.g. without Z offset)
        must be normalized to UTC to prevent 5.5 hour trip start/end offset.
        """
        # Current time in IST is UTC + 5h30m
        now_utc = utc_now()
        local_ist_now = now_utc.astimezone(IST)
        naive_ist_str = local_ist_now.strftime("%Y-%m-%d %H:%M:%S")

        parsed_utc = parse_timestamp(naive_ist_str, reject_far_off=True)
        # Difference between parsed UTC and actual UTC must be < 5 seconds, not 5.5 hours (19800 sec)!
        diff_sec = abs((parsed_utc - now_utc).total_seconds())
        self.assertLess(diff_sec, 5.0)


if __name__ == "__main__":
    unittest.main()
