"""
Deterministic Rule Engine Orchestrator.
Dispatches evaluations across temperature, door, tamper, and connectivity rules.
"""

import uuid
from typing import List, Dict, Optional
from datetime import datetime, timezone

from ..models import RawTelemetryPacket, RuleAlert
from .temperature_rules import TemperatureRules
from .door_rules import DoorRules
from .tamper_rules import TamperRules
from .connectivity_rules import ConnectivityRules


class DeterministicRuleEngine:
    """
    Evaluates raw IoT telemetry packets against standard cold-chain, vehicle safety,
    and device integrity rules with alert deduplication / cooldown.
    """

    # Cooldown tracker: f"{device_id}:{rule_name}" -> timestamp epoch
    _last_alert_times: Dict[str, float] = {}
    cooldown_seconds: int = 120  # 2-minute cooldown per device rule

    @classmethod
    def clear_cooldowns(cls):
        """Clears all cooldown tracking (useful for unit testing)."""
        cls._last_alert_times.clear()

    @classmethod
    def evaluate(cls, packet: RawTelemetryPacket, bypass_cooldown: bool = False) -> List[RuleAlert]:
        """
        Takes a single raw sensor packet from the vehicle and evaluates all hard limit rules.
        Returns a list of triggered RuleAlert objects subject to cooldown.
        """
        alerts: List[RuleAlert] = []
        now = packet.timestamp or datetime.now(timezone.utc)
        dev_id = getattr(packet, "device_id", "UNKNOWN")

        # 1. Temperature Rules (plateau & node-connected aware)
        node_conn = getattr(packet, "node_connected", True)
        temp_alerts = TemperatureRules.evaluate(
            cargo_temp_c=packet.temperature.cargo_temp_c,
            target_min_c=packet.temperature.target_min_c,
            target_max_c=packet.temperature.target_max_c,
            probe_connected=packet.temperature.probe_connected,
            node_connected=node_conn,
            timestamp=now
        )
        alerts.extend(temp_alerts)

        # 2. Door Rules (Wired in: Door open in transit or opened during stops)
        door_str = (getattr(packet, "door_status", None) or "").upper()
        door_is_open = (door_str in ["OPEN", "BREACHED", "UNLOCKED"])
        speed = packet.gps.speed_kmh if (packet.gps and packet.gps.speed_kmh is not None) else 0.0
        door_alerts = DoorRules.evaluate(
            door_is_open=door_is_open,
            vehicle_speed_kmh=speed,
            timestamp=now
        )
        alerts.extend(door_alerts)

        # 3. Connectivity Rules (Wired in: Wireless Node pairing & Gateway health)
        conn_alerts = ConnectivityRules.evaluate(
            node_connected=node_conn,
            elapsed_since_last_packet_sec=0.0,
            timestamp=now
        )
        alerts.extend(conn_alerts)

        # 4. Tamper Rules
        tamper_alerts = TamperRules.evaluate(
            tamper_switch_closed=packet.tamper_switch_closed,
            timestamp=now
        )
        alerts.extend(tamper_alerts)

        # 5. Crash / IMU Shock
        if (
            packet.imu
            and getattr(packet.imu, "available", False)
            and packet.imu.accel_x_g is not None
            and packet.imu.accel_y_g is not None
            and packet.imu.accel_z_g is not None
        ):
            total_g = (
                packet.imu.accel_x_g**2 + 
                packet.imu.accel_y_g**2 + 
                packet.imu.accel_z_g**2
            )**0.5

            if total_g > 3.2 or getattr(packet.imu, "shock_detected", False):
                alerts.append(RuleAlert(
                    alert_id=str(uuid.uuid4())[:8],
                    severity="CRITICAL",
                    rule_name="CRASH_IMPACT_DETECTED",
                    message=f"Severe vehicle impact detected: {total_g:.2f}g peak acceleration!",
                    timestamp=now
                ))
        elif packet.imu and getattr(packet.imu, "shock_detected", False):
            alerts.append(RuleAlert(
                alert_id=str(uuid.uuid4())[:8],
                severity="CRITICAL",
                rule_name="CRASH_IMPACT_DETECTED",
                message="Severe vehicle impact detected: Shock sensor triggered!",
                timestamp=now
            ))

        # 6. Power & Battery Rules
        if packet.power_network:
            if packet.power_network.external_power_connected is False:
                alerts.append(RuleAlert(
                    alert_id=str(uuid.uuid4())[:8],
                    severity="WARNING",
                    rule_name="VEHICLE_POWER_DISCONNECTED",
                    message="Main vehicle 12V/24V power disconnected. Switched to internal Li-ion battery.",
                    timestamp=now
                ))

            if packet.power_network.battery_pct is not None and packet.power_network.battery_pct <= 15:
                alerts.append(RuleAlert(
                    alert_id=str(uuid.uuid4())[:8],
                    severity="WARNING",
                    rule_name="LOW_BATTERY_WARNING",
                    message=(
                        f"Device backup battery critically low ({packet.power_network.battery_pct}%). "
                        "Shutdown imminent."
                    ),
                    timestamp=now
                ))

        # Apply alert cooldown deduplication
        if bypass_cooldown:
            return alerts

        filtered_alerts: List[RuleAlert] = []
        current_epoch = now.timestamp()
        for alert in alerts:
            key = f"{dev_id}:{alert.rule_name}"
            last_fired = cls._last_alert_times.get(key, 0.0)
            if (current_epoch - last_fired) >= cls.cooldown_seconds:
                cls._last_alert_times[key] = current_epoch
                filtered_alerts.append(alert)

        return filtered_alerts
