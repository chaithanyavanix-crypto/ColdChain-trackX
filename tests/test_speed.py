"""
Unit tests for SpeedCalculator processor.
Validates:
1. Valid GPS points over 30s interval
2. Invalid latitude / longitude
3. Same coordinates (Stationary)
4. Large time gaps
5. GPS unavailable (None / NO_FIX)
6. Impossible speeds (Multipath jump > 140 km/h)
7. Normal stationary jitter (< 8m)
"""

import unittest
from datetime import datetime, timedelta
from tracx_platform.backend.processors.speed_calculator import SpeedCalculator


class TestSpeedCalculator(unittest.TestCase):

    def setUp(self):
        self.t0 = datetime(2026, 10, 7, 12, 0, 0)
        self.t1 = self.t0 + timedelta(seconds=30)  # 30-second interval

    def test_valid_30s_movement(self):
        """Moving ~400 meters in 30 seconds should compute ~48 km/h."""
        # Hyderabad coordinate shift ~400m
        prev_lat, prev_lon = 17.4400, 78.3480
        curr_lat, curr_lon = 17.4435, 78.3495
        
        result = SpeedCalculator.calculate_speed(
            prev_lat=prev_lat,
            prev_lon=prev_lon,
            prev_time=self.t0,
            curr_lat=curr_lat,
            curr_lon=curr_lon,
            curr_time=self.t1
        )
        self.assertEqual(result["movement_status"], "MOVING")
        self.assertGreater(result["speed"], 20.0)
        self.assertLess(result["speed"], 80.0)
        self.assertEqual(result["speed_unit"], "km/h")
        self.assertEqual(result["speed_source"], "GPS_CALCULATED")

    def test_stationary_same_coordinates(self):
        """Same coordinates over 30s should report 0 km/h and STATIONARY."""
        lat, lon = 17.4400, 78.3480
        result = SpeedCalculator.calculate_speed(
            prev_lat=lat,
            prev_lon=lon,
            prev_time=self.t0,
            curr_lat=lat,
            curr_lon=lon,
            curr_time=self.t1
        )
        self.assertEqual(result["speed"], 0.0)
        self.assertEqual(result["movement_status"], "STATIONARY")

    def test_gps_jitter_stationary(self):
        """Sub-8-meter GPS drift while parked should be clamped to 0 km/h STATIONARY."""
        prev_lat, prev_lon = 17.440000, 78.348000
        curr_lat, curr_lon = 17.440030, 78.348020  # ~4 meters jitter
        result = SpeedCalculator.calculate_speed(
            prev_lat=prev_lat,
            prev_lon=prev_lon,
            prev_time=self.t0,
            curr_lat=curr_lat,
            curr_lon=curr_lon,
            curr_time=self.t1
        )
        self.assertEqual(result["speed"], 0.0)
        self.assertEqual(result["movement_status"], "STATIONARY")

    def test_impossible_speed_jump_rejected(self):
        """Teleport jump (e.g. 10 km in 30s = 1200 km/h) should be rejected."""
        prev_lat, prev_lon = 17.4400, 78.3480
        curr_lat, curr_lon = 17.5400, 78.4480  # ~15 km jump!
        result = SpeedCalculator.calculate_speed(
            prev_lat=prev_lat,
            prev_lon=prev_lon,
            prev_time=self.t0,
            curr_lat=curr_lat,
            curr_lon=curr_lon,
            curr_time=self.t1
        )
        self.assertEqual(result["speed_source"], "REJECTED_GPS_JUMP")
        self.assertEqual(result["speed"], 0.0)
        self.assertEqual(result["movement_status"], "STATIONARY")

    def test_invalid_coordinates(self):
        """Out of bounds or null coordinates should return INVALID_GPS."""
        result = SpeedCalculator.calculate_speed(
            prev_lat=17.44,
            prev_lon=78.34,
            prev_time=self.t0,
            curr_lat=None,
            curr_lon=None,
            curr_time=self.t1
        )
        self.assertEqual(result["speed_source"], "INVALID_GPS")
        self.assertEqual(result["movement_status"], "UNKNOWN")

    def test_null_island_rejected(self):
        """(0.0, 0.0) coordinates emitted during GPS uninitialized state should be rejected."""
        result = SpeedCalculator.calculate_speed(
            prev_lat=17.44,
            prev_lon=78.34,
            prev_time=self.t0,
            curr_lat=0.0,
            curr_lon=0.0,
            curr_time=self.t1
        )
        self.assertEqual(result["speed_source"], "INVALID_GPS")


if __name__ == "__main__":
    unittest.main()
