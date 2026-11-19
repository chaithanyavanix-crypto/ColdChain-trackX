"""
Unit tests for AI Models.
Validates:
1. Temperature forecasting & dT/dt regression
2. Telematics & Device Health Scoring (from real hardware signals)
3. Operator Recommendations generation (context-aware prescriptive guidance)
"""

import unittest
from datetime import datetime
from tracx_platform.backend.ai.temperature_prediction import TemperaturePredictor
from tracx_platform.backend.ai.health_score import HealthScoreModel
from tracx_platform.backend.ai.recommendations import OperatorRecommendations
from tracx_platform.backend.models import (
    RawTelemetryPacket,
    TemperatureReading,
    GPSCoordinates,
    IMUData,
    PowerAndNetwork
)


class TestAIModels(unittest.TestCase):

    def test_temperature_prediction_warming_trend(self):
        """Rising temperatures should produce positive dT/dt and predict threshold breach."""
        history = [
            RawTelemetryPacket(
                device_id="GW-001",
                timestamp=datetime(2026, 10, 7, 12, 0, 0),
                gps=GPSCoordinates(),
                temperature=TemperatureReading(cargo_temp_c=4.0, target_min_c=2.0, target_max_c=8.0),
                imu=IMUData()
            ),
            RawTelemetryPacket(
                device_id="GW-001",
                timestamp=datetime(2026, 10, 7, 12, 0, 30),
                gps=GPSCoordinates(),
                temperature=TemperatureReading(cargo_temp_c=4.5, target_min_c=2.0, target_max_c=8.0),
                imu=IMUData()
            )
        ]
        current = RawTelemetryPacket(
            device_id="GW-001",
            timestamp=datetime(2026, 10, 7, 12, 1, 0),
            gps=GPSCoordinates(),
            temperature=TemperatureReading(cargo_temp_c=5.1, target_min_c=2.0, target_max_c=8.0),
            imu=IMUData()
        )
        prediction = TemperaturePredictor.predict(current, history)
        self.assertGreater(prediction.rate_of_change_c_per_min, 0.0)
        self.assertIsNotNone(prediction.predicted_temp_15m_c)
        self.assertGreater(prediction.predicted_temp_15m_c, 5.1)

    def test_temperature_prediction_plateau_aware(self):
        """Steady-state temperature history produces a plateaued forecast equal to current temp."""
        history = [
            RawTelemetryPacket(
                device_id="GW-001",
                timestamp=datetime(2026, 10, 7, 12, 0, 0),
                gps=GPSCoordinates(),
                temperature=TemperatureReading(cargo_temp_c=4.50, target_min_c=2.0, target_max_c=8.0),
                imu=IMUData()
            ),
            RawTelemetryPacket(
                device_id="GW-001",
                timestamp=datetime(2026, 10, 7, 12, 1, 0),
                gps=GPSCoordinates(),
                temperature=TemperatureReading(cargo_temp_c=4.50, target_min_c=2.0, target_max_c=8.0),
                imu=IMUData()
            )
        ]
        current = RawTelemetryPacket(
            device_id="GW-001",
            timestamp=datetime(2026, 10, 7, 12, 2, 0),
            gps=GPSCoordinates(),
            temperature=TemperatureReading(cargo_temp_c=4.50, target_min_c=2.0, target_max_c=8.0),
            imu=IMUData()
        )
        prediction = TemperaturePredictor.predict(current, history)
        self.assertAlmostEqual(prediction.rate_of_change_c_per_min, 0.0, places=3)
        self.assertEqual(prediction.predicted_temp_15m_c, 4.50)
        self.assertEqual(prediction.predicted_temp_30m_c, 4.50)
        self.assertEqual(prediction.predicted_temp_60m_c, 4.50)
        self.assertEqual(prediction.risk_level, "LOW_NORMAL")

    def test_device_health_score_grounded_in_telemetry(self):
        """Packet with missing temperature node should receive health score penalty."""
        current = RawTelemetryPacket(
            device_id="GW-001",
            timestamp=datetime.utcnow(),
            gps=GPSCoordinates(lat=17.44, lng=78.38),
            temperature=TemperatureReading(cargo_temp_c=None, probe_connected=False),
            power_network=PowerAndNetwork(lte_csq_rssi=22)
        )
        health = HealthScoreModel.predict_device_health(current, [])
        self.assertLess(health.overall_health_score_pct, 100)
        self.assertIn("Node Offline", health.node_health)

    def test_operator_recommendations_node_offline(self):
        """When sensor node is not reporting, AI recommendation advises checking NODE-001."""
        current = RawTelemetryPacket(
            device_id="GW-001",
            timestamp=datetime.utcnow(),
            gps=GPSCoordinates(lat=17.44, lng=78.38),
            temperature=TemperatureReading(cargo_temp_c=None, probe_connected=False)
        )
        recs = OperatorRecommendations.generate_recommendations(current)
        self.assertTrue(any("NODE-001" in r for r in recs))


    def test_risk_fusion_calculation(self):
        """AIRiskFusion correctly fuses multiple independent risks into priority and score."""
        from tracx_platform.backend.ai.risk_fusion import AIRiskFusion
        from tracx_platform.backend.schemas.ai import AIPredictiveTemperature, AITamperFusion, AIGpsIntelligence

        temp_ai = AIPredictiveTemperature(excursion_risk_pct=85.0, risk_level="HIGH_RISK_EARLY_WARNING")
        tamper_ai = AITamperFusion(tamper_score=60.0, threat_level="HIGH_TAMPER_RISK")
        gps_ai = AIGpsIntelligence(is_valid_kinematic=True, kinematic_anomaly_detected=False, tracking_mode="GNSS_LOCKED", position_confidence_pct=95.0)

        result = AIRiskFusion.calculate(
            temperature_ai=temp_ai,
            gps_ai=gps_ai,
            tamper_ai=tamper_ai,
            health_ai=None,
        )
        self.assertEqual(result["primary_risk"], "TEMPERATURE_EXCURSION")
        self.assertGreaterEqual(result["overall_risk_score"], 85.0)
        self.assertEqual(result["risk_level"], "CRITICAL")
        self.assertIn("Inspect refrigeration", result["recommended_action"])


    def test_ai_recommendations_generation(self):
        """AIRecommendations generates structured, prioritized action items across all modules."""
        from tracx_platform.backend.ai.recommendations import AIRecommendations
        from tracx_platform.backend.schemas.ai import AIPredictiveTemperature, AITamperFusion, AIGpsIntelligence, AIPredictiveDeviceHealth

        temp_ai = AIPredictiveTemperature(excursion_risk_pct=85.0, risk_level="HIGH_RISK_EARLY_WARNING", predicted_temp_15m_c=9.5)
        tamper_ai = AITamperFusion(tamper_risk_score=85.0, threat_level="CRITICAL_THEFT_BREACH")
        health_ai = AIPredictiveDeviceHealth(health_score_100=35.0, health_status="CRITICAL")

        recs = AIRecommendations.generate(
            temperature_ai=temp_ai,
            tamper_ai=tamper_ai,
            health_ai=health_ai,
        )
        self.assertGreater(len(recs), 0)
        types = [r["type"] for r in recs]
        self.assertIn("TEMPERATURE", types)
        self.assertIn("TAMPER", types)
        self.assertIn("DEVICE_HEALTH", types)
        self.assertEqual(recs[0]["priority"], "CRITICAL")

    def test_ai_status_completed_and_tamper_detection(self):
        """Validates that AIEngine completes without crash and ai_status is 'COMPLETED'."""
        from tracx_platform.backend.ai.ai_engine import AIEngine
        from tracx_platform.backend.ai.risk_analysis import TamperRiskModel

        packet = RawTelemetryPacket(
            device_id="GW-001",
            timestamp=datetime.utcnow(),
            gps=GPSCoordinates(lat=17.44, lng=78.38, speed_kmh=15.0),
            temperature=TemperatureReading(cargo_temp_c=4.5, target_min_c=2.0, target_max_c=8.0),
            imu=IMUData(available=True, accel_z_g=1.0),
            tamper_switch_closed=False,
            power_network=PowerAndNetwork(lte_csq_rssi=22, battery_pct=90)
        )

        # 1. TamperRiskModel directly
        tamper_ai = TamperRiskModel.detect(current=packet)
        self.assertTrue(tamper_ai.is_tampered)
        self.assertGreater(tamper_ai.tamper_score, 0)

        # 2. Complete AIEngine evaluation
        ai_result = AIEngine.evaluate(packet)
        self.assertEqual(ai_result["ai_status"], "COMPLETED")
        self.assertNotIn("errors", ai_result)
        self.assertIsNotNone(ai_result["tamper_analysis"])
        self.assertTrue(ai_result["tamper_analysis"]["is_tampered"])


if __name__ == "__main__":
    unittest.main()


