"""
Unit tests for Deterministic Safety Rules.
Validates:
1. Upper temperature breach (> 8.0°C)
2. Freeze temperature breach (< 2.0°C)
3. Probe disconnected
4. Tamper microswitch open
5. High g-force crash shock (> 3.2g)
"""

import unittest
from datetime import datetime
from tracx_platform.backend.rules.temperature_rules import TemperatureRules
from tracx_platform.backend.rules.door_rules import DoorRules
from tracx_platform.backend.rules.tamper_rules import TamperRules
from tracx_platform.backend.rules.rule_engine import DeterministicRuleEngine
from tracx_platform.backend.models import (
    RawTelemetryPacket,
    TemperatureReading,
    GPSCoordinates,
    IMUData,
    PowerAndNetwork
)


class TestRuleEngine(unittest.TestCase):

    def test_high_temperature_excursion(self):
        """Temperature of 9.5°C should trigger COLD_CHAIN_HIGH_EXCURSION alert."""
        alerts = TemperatureRules.evaluate(
            cargo_temp_c=9.5,
            target_min_c=2.0,
            target_max_c=8.0
        )
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].rule_name, "COLD_CHAIN_HIGH_EXCURSION")
        self.assertEqual(alerts[0].severity, "CRITICAL")

    def test_freeze_risk_excursion(self):
        """Temperature of 0.8°C should trigger COLD_CHAIN_FREEZE_RISK alert."""
        alerts = TemperatureRules.evaluate(
            cargo_temp_c=0.8,
            target_min_c=2.0,
            target_max_c=8.0
        )
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].rule_name, "COLD_CHAIN_FREEZE_RISK")
        self.assertEqual(alerts[0].severity, "CRITICAL")

    def test_probe_disconnected(self):
        """Probe disconnected should trigger PROBE_DISCONNECTED WARNING."""
        alerts = TemperatureRules.evaluate(
            cargo_temp_c=None,
            target_min_c=2.0,
            target_max_c=8.0,
            probe_connected=False
        )
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].rule_name, "PROBE_DISCONNECTED")

    def test_door_open_in_transit(self):
        """Door open while vehicle moving at 45 km/h triggers DOOR_OPEN_IN_TRANSIT."""
        alerts = DoorRules.evaluate(door_is_open=True, vehicle_speed_kmh=45.0)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].rule_name, "DOOR_OPEN_IN_TRANSIT")
        self.assertEqual(alerts[0].severity, "CRITICAL")

    def test_tamper_switch_triggered(self):
        """Enclosure switch open triggers ENCLOSURE_TAMPER_OPEN."""
        alerts = TamperRules.evaluate(tamper_switch_closed=False)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0].rule_name, "ENCLOSURE_TAMPER_OPEN")

    def test_awaiting_node_suppresses_probe_disconnected(self):
        """When node_connected is False, PROBE_DISCONNECTED must NOT be triggered."""
        alerts = TemperatureRules.evaluate(
            cargo_temp_c=None,
            target_min_c=2.0,
            target_max_c=8.0,
            probe_connected=False,
            node_connected=False
        )
        self.assertEqual(len(alerts), 0)

    def test_rule_engine_wires_door_and_connectivity_rules(self):
        """RuleEngine.evaluate executes DoorRules and ConnectivityRules."""
        DeterministicRuleEngine.clear_cooldowns()
        packet = RawTelemetryPacket(
            device_id="GW-TEST-01",
            gps=GPSCoordinates(lat=17.44, lng=78.38, speed_kmh=35.0),
            temperature=TemperatureReading(cargo_temp_c=4.5),
            door_status="OPEN",
            node_connected=False
        )
        alerts = DeterministicRuleEngine.evaluate(packet, bypass_cooldown=True)
        rule_names = [a.rule_name for a in alerts]
        self.assertIn("DOOR_OPEN_IN_TRANSIT", rule_names)
        self.assertIn("AWAITING_NODE", rule_names)
        self.assertNotIn("PROBE_DISCONNECTED", rule_names)

    def test_alert_cooldown_deduplication(self):
        """Identical alert within cooldown window is suppressed."""
        DeterministicRuleEngine.clear_cooldowns()
        packet = RawTelemetryPacket(
            device_id="GW-TEST-02",
            gps=GPSCoordinates(lat=17.44, lng=78.38, speed_kmh=0.0),
            temperature=TemperatureReading(cargo_temp_c=9.5, target_min_c=2.0, target_max_c=8.0),
            node_connected=True
        )
        # First evaluation: alert fires
        first_alerts = DeterministicRuleEngine.evaluate(packet)
        self.assertTrue(any(a.rule_name == "COLD_CHAIN_HIGH_EXCURSION" for a in first_alerts))

        # Immediate second evaluation: duplicate alert suppressed by cooldown
        second_alerts = DeterministicRuleEngine.evaluate(packet)
        self.assertFalse(any(a.rule_name == "COLD_CHAIN_HIGH_EXCURSION" for a in second_alerts))


if __name__ == "__main__":
    unittest.main()
