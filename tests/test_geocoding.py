"""
Unit tests for GeocodingService.
Validates:
1. Geofence zone matching (e.g. Gachibowli Cold Storage Zone)
2. Nearest landmark and corridor resolution
3. Last-known location fallback during GNSS dropouts
4. Stationary vs. Moving operational labeling
5. Null Island rejection
"""

import unittest
from datetime import datetime
from tracx_platform.backend.services.geocoding_service import GeocodingService


class TestGeocodingService(unittest.TestCase):

    def test_geofence_match_gachibowli(self):
        """Coordinates inside Gachibowli Cold Hub should identify the certified geofence."""
        result = GeocodingService.resolve_location(
            device_id="GW-001",
            lat=17.4410,
            lng=78.3490,
            accuracy_m=6.5,
            speed_kmh=0.0
        )
        self.assertEqual(result["area"], "Gachibowli")
        self.assertEqual(result["city"], "Hyderabad")
        self.assertTrue(result["geofence"]["is_inside"])
        self.assertIn("Gachibowli Cold Storage Zone", result["geofence"]["name"])
        self.assertEqual(result["movement_status"], "STATIONARY")
        self.assertIn("Stationary", result["movement_label"])

    def test_moving_vehicle_label(self):
        """Moving vehicle should reflect speed and movement label."""
        result = GeocodingService.resolve_location(
            device_id="GW-001",
            lat=17.4485,
            lng=78.3750,
            accuracy_m=5.0,
            speed_kmh=45.2
        )
        self.assertEqual(result["area"], "HITEC City")
        self.assertEqual(result["movement_status"], "MOVING")
        self.assertIn("45.2 km/h", result["movement_label"])

    def test_last_known_location_fallback(self):
        """When GPS drops, last-known location should gracefully provide previous fix info."""
        # 1. Establish a known fix
        GeocodingService.resolve_location(
            device_id="GW-002",
            lat=17.4401,
            lng=78.3489,
            speed_kmh=0.0
        )
        # 2. GPS fix lost (None, None)
        result_lost = GeocodingService.resolve_location(
            device_id="GW-002",
            lat=None,
            lng=None
        )
        self.assertTrue(result_lost["is_last_known"])
        self.assertFalse(result_lost["has_fix"])
        self.assertEqual(result_lost["area"], "Gachibowli")
        self.assertIn("Last Known", result_lost["sub_area"])

    def test_null_island_rejected(self):
        """Null Island (0.0, 0.0) should be treated as unacquired fix."""
        result = GeocodingService.resolve_location(
            device_id="GW-NEW",
            lat=0.0,
            lng=0.0
        )
        self.assertFalse(result["has_fix"])
        self.assertIn("Acquiring", result["display_address"])


if __name__ == "__main__":
    unittest.main()
