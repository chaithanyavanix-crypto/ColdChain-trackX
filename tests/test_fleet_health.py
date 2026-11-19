"""
Unit tests for deterministic Fleet Health Scoring Service.
Tests 7 components:
1. Temperature Health (30%)
2. Gateway/Node Connectivity (20%)
3. GPS/Location Health (10%)
4. Network & Node Signal (10%)
5. Door & Tamper Security (10%)
6. Telemetry Data Quality (10%)
7. Movement / Kinematic Health (10%)
"""

import unittest
from tracx_platform.backend.services.fleet_health_service import FleetHealthService


class TestFleetHealthService(unittest.TestCase):

    def test_optimal_healthy_vehicle(self):
        """Vehicle with safe temp, paired node, strong LTE and sealed door scores >= 90."""
        data = {
            "device_id": "GW-001",
            "temperature": 4.2,
            "target_min": 2.0,
            "target_max": 8.0,
            "is_online": True,
            "packet_age_sec": 25,
            "node_connected": True,
            "latitude": 17.4401,
            "longitude": 78.3489,
            "location_accuracy": 5.4,
            "network_rssi": -72,
            "node_rssi": -65,
            "door_status": "SEALED",
            "tamper": False,
            "speed_kmh": 42.0
        }
        res = FleetHealthService.calculate_vehicle_health(data)
        self.assertGreaterEqual(res["score"], 90.0)
        self.assertEqual(res["status_tier"], "GOOD")
        self.assertEqual(res["components"]["temperature"], 100.0)
        self.assertEqual(res["components"]["connectivity"], 100.0)
        self.assertEqual(res["components"]["security"], 100.0)

    def test_temperature_excursion_penalty(self):
        """Severe temperature excursion drops temperature component to 0."""
        data = {
            "device_id": "GW-003",
            "temperature": 11.5,
            "target_min": 2.0,
            "target_max": 8.0,
            "is_online": True,
            "packet_age_sec": 20,
            "node_connected": True,
            "latitude": 17.44,
            "longitude": 78.38,
            "location_accuracy": 8.0,
            "network_rssi": -70,
            "node_rssi": -60,
            "door_status": "SEALED",
            "tamper": False,
            "speed_kmh": 40.0
        }
        res = FleetHealthService.calculate_vehicle_health(data)
        self.assertEqual(res["components"]["temperature"], 0.0)
        self.assertLess(res["score"], 75.0)

    def test_offline_gateway_penalty(self):
        """Gateway packet delayed > 300s receives 0 connectivity score."""
        data = {
            "device_id": "GW-011",
            "temperature": None,
            "is_online": False,
            "packet_age_sec": 360,
            "node_connected": False,
            "latitude": None,
            "longitude": None,
            "door_status": "UNKNOWN",
            "tamper": False,
            "speed_kmh": 0.0
        }
        res = FleetHealthService.calculate_vehicle_health(data)
        self.assertEqual(res["components"]["connectivity"], 0.0)
        self.assertEqual(res["status_tier"], "CRITICAL")

    def test_fleet_aggregation_does_not_hide_critical_vehicles(self):
        """Critical vehicles are identified and listed in fleet aggregation."""
        fleet = [
            {"device_id": "GW-001", "temperature": 4.5, "is_online": True, "packet_age_sec": 20, "node_connected": True, "latitude": 17.44, "longitude": 78.38, "door_status": "SEALED", "tamper": False, "speed_kmh": 35.0},
            {"device_id": "GW-002", "temperature": 5.0, "is_online": True, "packet_age_sec": 25, "node_connected": True, "latitude": 17.44, "longitude": 78.38, "door_status": "SEALED", "tamper": False, "speed_kmh": 40.0},
            {"device_id": "GW-003", "temperature": 12.0, "is_online": False, "packet_age_sec": 400, "node_connected": False, "latitude": None, "longitude": None, "door_status": "OPEN", "tamper": True, "speed_kmh": 0.0}
        ]
        agg = FleetHealthService.calculate_fleet_health(fleet)
        self.assertEqual(agg["total_vehicles"], 3)
        self.assertEqual(agg["critical_count"], 1)
        self.assertEqual(len(agg["critical_vehicles"]), 1)
        self.assertEqual(agg["critical_vehicles"][0]["device_id"], "GW-003")


if __name__ == "__main__":
    unittest.main()
