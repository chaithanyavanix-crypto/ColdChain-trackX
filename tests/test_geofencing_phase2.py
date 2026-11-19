"""
==============================================================================
FILE: tests/test_geofencing_phase2.py
PURPOSE:
Verification test suite for Phase 2: Real Geofence System.
Tests Geometry Engine, State Machine Debounce & GPS Protection,
Rule Violations (Dwell, Speed, Cold-Chain Temperature), and API CRUD Endpoints.
==============================================================================
"""

import time
import unittest
from datetime import datetime

try:
    from backend.geofencing.geometry import (
        haversine_distance_m,
        point_inside_circle,
        point_inside_polygon,
        point_inside_corridor,
        generate_corridor_polygon
    )
    from backend.geofencing.evaluator import evaluate_geofence_boundary
    from backend.geofencing.state_machine import (
        GeofenceState,
        DeviceGeofenceTracker,
        GeofenceStateMachineManager
    )
    from backend.geofencing.rules import GeofenceRuleEvaluator
    from backend.services.geofence_service import GeofenceService
    from backend.database.database import (
        init_database,
        db_save_geofence,
        db_get_geofence,
        db_get_geofences,
        db_update_geofence,
        db_delete_geofence,
        db_save_geofence_event,
        db_get_geofence_events
    )
except ModuleNotFoundError:
    from tracx_platform.backend.geofencing.geometry import (
        haversine_distance_m,
        point_inside_circle,
        point_inside_polygon,
        point_inside_corridor,
        generate_corridor_polygon
    )
    from tracx_platform.backend.geofencing.evaluator import evaluate_geofence_boundary
    from tracx_platform.backend.geofencing.state_machine import (
        GeofenceState,
        DeviceGeofenceTracker,
        GeofenceStateMachineManager
    )
    from tracx_platform.backend.geofencing.rules import GeofenceRuleEvaluator
    from tracx_platform.backend.services.geofence_service import GeofenceService
    from tracx_platform.backend.database.database import (
        init_database,
        db_save_geofence,
        db_get_geofence,
        db_get_geofences,
        db_update_geofence,
        db_delete_geofence,
        db_save_geofence_event,
        db_get_geofence_events
    )


class TestGeofenceGeometry(unittest.TestCase):
    """1. Tests mathematical accuracy of spherical distance and containment."""

    def test_haversine_same_point(self):
        d = haversine_distance_m(17.4483, 78.3915, 17.4483, 78.3915)
        self.assertAlmostEqual(d, 0.0, places=2)

    def test_haversine_known_distance(self):
        # Hyderabad HITEC (17.4485, 78.3750) to Gachibowli (17.4401, 78.3489) ~ 2.9 km
        d = haversine_distance_m(17.4485, 78.3750, 17.4401, 78.3489)
        self.assertGreater(d, 2700)
        self.assertLess(d, 3200)

    def test_point_inside_circle(self):
        center_lat, center_lng, radius = 17.4483, 78.3915, 500.0
        # Point 38 meters away from center
        res_inside = point_inside_circle(17.4480, 78.3917, center_lat, center_lng, radius)
        self.assertTrue(res_inside["inside"])
        self.assertLess(res_inside["distance_from_center_m"], 50.0)
        self.assertGreater(res_inside["distance_to_boundary_m"], 450.0)

        # Point 2000 meters away
        res_outside = point_inside_circle(17.4650, 78.3915, center_lat, center_lng, radius)
        self.assertFalse(res_outside["inside"])
        self.assertGreater(res_outside["distance_from_center_m"], 1800.0)

    def test_point_inside_polygon(self):
        # Triangle around (10, 10)
        polygon = [
            [10.0, 10.0],
            [10.0, 10.05],
            [10.05, 10.0]
        ]
        res_in = point_inside_polygon(10.01, 10.01, polygon)
        self.assertTrue(res_in["inside"])

        res_out = point_inside_polygon(10.20, 10.20, polygon)
        self.assertFalse(res_out["inside"])

    def test_point_inside_corridor(self):
        # Route from HITEC (17.4400, 78.3800) to Medchal (17.4600, 78.4000)
        route = [
            [17.4400, 78.3800],
            [17.4500, 78.3900],
            [17.4600, 78.4000]
        ]
        # Point right on route centerline
        res_on = point_inside_corridor(17.4450, 78.3850, route, buffer_width_m=500.0)
        self.assertTrue(res_on["inside"])
        self.assertAlmostEqual(res_on["distance_from_center_m"], 0.0, delta=2.0)
        self.assertAlmostEqual(res_on["distance_to_boundary_m"], 500.0, delta=2.0)

        # Point 150m off centerline -> inside 500m buffer
        res_close = point_inside_corridor(17.4460, 78.3850, route, buffer_width_m=500.0)
        self.assertTrue(res_close["inside"])
        self.assertLess(res_close["distance_from_center_m"], 200.0)

        # Point 3km off route -> OUTSIDE corridor
        res_far = point_inside_corridor(17.4800, 78.3800, route, buffer_width_m=500.0)
        self.assertFalse(res_far["inside"])
        self.assertGreater(res_far["distance_from_center_m"], 2000.0)

    def test_generate_corridor_polygon(self):
        route = [
            [17.4400, 78.3800],
            [17.4500, 78.3900],
            [17.4600, 78.4000]
        ]
        poly = generate_corridor_polygon(route, buffer_width_m=500.0)
        self.assertEqual(len(poly), 6)  # 3 left points + 3 right points
        # Verify envelope wraps around route
        self.assertTrue(all(len(pt) == 2 for pt in poly))



class TestGeofenceStateMachine(unittest.TestCase):
    """2. Tests State Machine transitions, debounce confirmations, and GPS noise protection."""

    def test_enter_debounce_confirmations(self):
        tracker = DeviceGeofenceTracker("GW-001", 101)
        self.assertEqual(tracker.current_state, GeofenceState.UNKNOWN)

        # 1st inside sample -> ENTER_CANDIDATE (not yet fully confirmed)
        st1, ev1 = tracker.update(inside_reading=True, distance_to_boundary_m=100.0, accuracy_m=10.0, enter_confirmations=2)
        self.assertEqual(st1, GeofenceState.ENTER_CANDIDATE)
        self.assertIsNone(ev1)

        # 2nd inside sample -> INSIDE + transition_event="ENTER"
        st2, ev2 = tracker.update(inside_reading=True, distance_to_boundary_m=100.0, accuracy_m=10.0, enter_confirmations=2)
        self.assertEqual(st2, GeofenceState.INSIDE)
        self.assertEqual(ev2, "ENTER")

    def test_exit_debounce_confirmations(self):
        tracker = DeviceGeofenceTracker("GW-001", 101)
        # Establish inside state
        tracker.update(True, 100.0, enter_confirmations=1)
        self.assertEqual(tracker.current_state, GeofenceState.INSIDE)

        # 1st outside reading -> EXIT_CANDIDATE
        st1, ev1 = tracker.update(inside_reading=False, distance_to_boundary_m=50.0, exit_confirmations=2)
        self.assertEqual(st1, GeofenceState.EXIT_CANDIDATE)
        self.assertIsNone(ev1)

        # 2nd outside reading -> OUTSIDE + transition_event="EXIT"
        st2, ev2 = tracker.update(inside_reading=False, distance_to_boundary_m=50.0, exit_confirmations=2)
        self.assertEqual(st2, GeofenceState.OUTSIDE)
        self.assertEqual(ev2, "EXIT")

    def test_gps_accuracy_protection(self):
        tracker = DeviceGeofenceTracker("GW-001", 101)
        # Boundary is 20m away, but GPS accuracy uncertainty is 80m!
        state, ev = tracker.update(inside_reading=False, distance_to_boundary_m=20.0, accuracy_m=80.0)
        self.assertEqual(state, GeofenceState.GPS_UNRELIABLE)
        self.assertIsNone(ev)

    def test_dwell_detection(self):
        tracker = DeviceGeofenceTracker("GW-001", 101)
        tracker.update(True, 100.0, enter_confirmations=1)
        self.assertEqual(tracker.current_state, GeofenceState.INSIDE)

        # Mock entered_at to 350 seconds ago
        tracker.entered_at = time.time() - 350
        st, ev = tracker.update(True, 100.0, dwell_seconds=300)
        self.assertEqual(st, GeofenceState.DWELL)
        self.assertEqual(ev, "DWELL")


class TestGeofenceRules(unittest.TestCase):
    """3. Tests Rule Engine (Enter, Exit, Dwell, Speed, and 2-8°C Cold-Chain)."""

    def setUp(self):
        self.evaluator = GeofenceRuleEvaluator(violation_cooldown_seconds=60)
        self.geofence = {
            "id": 12,
            "name": "Hyderabad Cold Storage",
            "device_id": "GW-001",
            "rules": {
                "enter": True,
                "exit": True,
                "dwell": True,
                "dwell_seconds": 300,
                "max_speed_kmh": 20.0,
                "temperature": {
                    "enabled": True,
                    "min_c": 2.0,
                    "max_c": 8.0
                }
            }
        }

    def test_enter_and_exit_events(self):
        tracker = DeviceGeofenceTracker("GW-001", 12)
        tracker.current_state = GeofenceState.INSIDE
        tracker.previous_state = GeofenceState.OUTSIDE

        telemetry = {"device_id": "GW-001", "latitude": 17.4483, "longitude": 78.3915, "temperature": 4.5, "speed": 10.0}
        eval_res = {"inside": True, "distance_to_boundary_m": 400.0}

        events = self.evaluator.evaluate_geofence_rules(self.geofence, telemetry, tracker, "ENTER", eval_res)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["event_type"], "GEOFENCE_ENTER")
        self.assertEqual(events[0]["severity"], "INFO")

    def test_cold_chain_temperature_breach(self):
        tracker = DeviceGeofenceTracker("GW-001", 12)
        tracker.current_state = GeofenceState.INSIDE

        # Temperature = 9.6°C (Exceeds allowed max 8.0°C)
        telemetry = {"device_id": "GW-001", "latitude": 17.4483, "longitude": 78.3915, "temperature": 9.6, "speed": 5.0}
        eval_res = {"inside": True, "distance_to_boundary_m": 400.0}

        events = self.evaluator.evaluate_geofence_rules(self.geofence, telemetry, tracker, None, eval_res)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["event_type"], "TEMPERATURE_VIOLATION")
        self.assertEqual(events[0]["severity"], "CRITICAL")
        self.assertAlmostEqual(events[0]["temperature_c"], 9.6)

    def test_speed_limit_breach(self):
        tracker = DeviceGeofenceTracker("GW-001", 12)
        tracker.current_state = GeofenceState.INSIDE

        # Speed = 37 km/h in 20 km/h depot
        telemetry = {"device_id": "GW-001", "latitude": 17.4483, "longitude": 78.3915, "temperature": 4.0, "speed_kmh": 37.0}
        eval_res = {"inside": True, "distance_to_boundary_m": 400.0}

        events = self.evaluator.evaluate_geofence_rules(self.geofence, telemetry, tracker, None, eval_res)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["event_type"], "SPEED_VIOLATION")
        self.assertEqual(events[0]["severity"], "WARNING")
        self.assertAlmostEqual(events[0]["speed_kmh"], 37.0)

    def test_corridor_entry_and_route_deviation_events(self):
        corridor_gf = {
            "id": 88,
            "name": "Pharma Route Corridor",
            "device_id": "GW-001",
            "geometry": {
                "type": "CORRIDOR",
                "radius_m": 500.0,
                "coordinates": [[17.4400, 78.3800], [17.4500, 78.3900], [17.4600, 78.4000]]
            },
            "rules": {"enter": True, "exit": True}
        }
        tracker = DeviceGeofenceTracker("GW-001", 88)

        # 1. Enter corridor -> CORRIDOR_ENTRY event
        tracker.current_state = GeofenceState.INSIDE
        tracker.previous_state = GeofenceState.OUTSIDE
        telemetry_in = {"device_id": "GW-001", "latitude": 17.4450, "longitude": 78.3850, "temperature": 4.5}
        eval_in = {"inside": True, "distance_to_boundary_m": 450.0}

        events_in = self.evaluator.evaluate_geofence_rules(corridor_gf, telemetry_in, tracker, "ENTER", eval_in)
        self.assertEqual(len(events_in), 1)
        self.assertEqual(events_in[0]["event_type"], "CORRIDOR_ENTRY")
        self.assertEqual(events_in[0]["severity"], "INFO")

        # 2. Deviate outside corridor -> ROUTE_DEVIATION event
        tracker.current_state = GeofenceState.OUTSIDE
        tracker.previous_state = GeofenceState.INSIDE
        telemetry_out = {"device_id": "GW-001", "latitude": 17.4800, "longitude": 78.3800, "temperature": 4.5}
        eval_out = {"inside": False, "distance_to_boundary_m": 2500.0}

        events_out = self.evaluator.evaluate_geofence_rules(corridor_gf, telemetry_out, tracker, "EXIT", eval_out)
        self.assertEqual(len(events_out), 1)
        self.assertEqual(events_out[0]["event_type"], "ROUTE_DEVIATION")
        self.assertEqual(events_out[0]["severity"], "CRITICAL")
        self.assertIn("deviated", events_out[0]["details"]["message"])


class TestGeofenceDatabaseAndService(unittest.TestCase):
    """4. Tests SQLite persistence and GeofenceService operations."""

    @classmethod
    def setUpClass(cls):
        init_database()

    def test_crud_lifecycle(self):
        # Create
        created = GeofenceService.create_geofence({
            "name": "Unit Test Cold Hub",
            "device_id": "GW-TEST",
            "geometry": {
                "type": "CIRCLE",
                "center": {"lat": 17.5000, "lng": 78.4000},
                "radius_m": 600.0
            },
            "rules": {
                "enter": True,
                "exit": True,
                "dwell": True,
                "dwell_seconds": 180,
                "max_speed_kmh": 25.0,
                "temperature": {"enabled": True, "min_c": 2.0, "max_c": 8.0}
            },
            "enabled": True
        })
        gf_id = created["id"]
        self.assertIsNotNone(gf_id)
        self.assertEqual(created["name"], "Unit Test Cold Hub")

        # Read
        fetched = GeofenceService.get_geofence(gf_id)
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["geometry"]["radius_m"], 600.0)

        # Update
        updated = GeofenceService.update_geofence(gf_id, {"name": "Updated Cold Hub", "geometry": {"type": "CIRCLE", "radius_m": 750.0}})
        self.assertEqual(updated["name"], "Updated Cold Hub")
        self.assertEqual(updated["geometry"]["radius_m"], 750.0)

        # Telemetry evaluation against this geofence
        eval_res = GeofenceService.evaluate_telemetry({
            "device_id": "GW-TEST",
            "latitude": 17.5001,
            "longitude": 78.4001,
            "temperature": 5.0,
            "speed_kmh": 10.0
        })
        self.assertGreater(eval_res["evaluated_count"], 0)
        self.assertTrue(eval_res["geofences"][0]["inside"])

        # Delete
        deleted = GeofenceService.delete_geofence(gf_id)
        self.assertTrue(deleted)
        self.assertIsNone(GeofenceService.get_geofence(gf_id))

    def test_corridor_crud_and_evaluation(self):
        # Create Corridor
        route_coords = [
            [17.4400, 78.3800],
            [17.4500, 78.3900],
            [17.4600, 78.4000]
        ]
        created = GeofenceService.create_geofence({
            "name": "NH-44 Express Corridor",
            "device_id": "GW-CORR-1",
            "geometry": {
                "type": "CORRIDOR",
                "radius_m": 500.0,
                "coordinates": route_coords
            },
            "rules": {
                "enter": True,
                "exit": True,
                "max_speed_kmh": 60.0,
                "temperature": {"enabled": True, "min_c": 2.0, "max_c": 8.0}
            },
            "enabled": True
        })
        cid = created["id"]
        self.assertIsNotNone(cid)
        self.assertEqual(created["geometry"]["type"], "CORRIDOR")
        self.assertEqual(len(created["geometry"]["coordinates"]), 3)
        self.assertIsNotNone(created["geometry"]["corridor_envelope"])
        self.assertEqual(len(created["geometry"]["corridor_envelope"]), 6)

        # Read
        fetched = GeofenceService.get_geofence(cid)
        self.assertEqual(fetched["name"], "NH-44 Express Corridor")

        # Telemetry right on corridor
        eval_in = GeofenceService.evaluate_telemetry({
            "device_id": "GW-CORR-1",
            "latitude": 17.4450,
            "longitude": 78.3850,
            "temperature": 4.5,
            "speed_kmh": 40.0
        })
        self.assertGreater(eval_in["evaluated_count"], 0)
        self.assertTrue(eval_in["geofences"][0]["inside"])

        # Clean up
        GeofenceService.delete_geofence(cid)



if __name__ == "__main__":
    unittest.main()
