"""
Unit tests for GPSProcessor deterministic validation.
Validates:
1. Valid coordinates
2. Out-of-bounds coordinates
3. Null Island (0,0) rejection
4. Accuracy quality ratings
5. Physically impossible teleport jump rejection (> 140 km/h)
"""

import unittest
from datetime import datetime, timedelta
from tracx_platform.backend.processors.gps_processor import GPSProcessor


class TestGPSProcessor(unittest.TestCase):

    def test_valid_coordinates(self):
        result = GPSProcessor.process_coordinates(
            lat=17.4435,
            lon=78.3772,
            accuracy_m=8.5,
            location_source="GNSS"
        )
        self.assertTrue(result["is_valid"])
        self.assertEqual(result["fix_status"], "3D_FIX")
        self.assertEqual(result["accuracy_quality"], "HIGH")

    def test_null_island_rejected(self):
        result = GPSProcessor.process_coordinates(
            lat=0.0,
            lon=0.0
        )
        self.assertFalse(result["is_valid"])
        self.assertEqual(result["fix_status"], "NO_FIX")

    def test_out_of_bounds_coordinates(self):
        result = GPSProcessor.process_coordinates(
            lat=195.0,  # Invalid latitude
            lon=78.0
        )
        self.assertFalse(result["is_valid"])

    def test_impossible_jump_detected(self):
        t0 = datetime(2026, 10, 7, 12, 0, 0)
        t1 = t0 + timedelta(seconds=30)
        # 20 km displacement in 30s = 2400 km/h (Physically impossible)
        result = GPSProcessor.process_coordinates(
            lat=17.6500,
            lon=78.5500,
            prev_lat=17.4400,
            prev_lon=78.3480,
            prev_time=t0,
            curr_time=t1
        )
        self.assertTrue(result["is_technically_impossible_jump"])
        self.assertFalse(result["is_valid"])
        self.assertEqual(result["fix_status"], "REJECTED_JUMP")


if __name__ == "__main__":
    unittest.main()
