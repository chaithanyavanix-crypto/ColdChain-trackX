"""
AI Model #1: Predictive Cold-Chain Temperature Excursion Forecasting.

Purpose
-------
Uses historical cargo-temperature telemetry to:

1. Calculate temperature velocity (dT/dt).
2. Forecast cargo temperature 15 minutes ahead.
3. Forecast cargo temperature 30 minutes ahead.
4. Estimate time-to-breach.
5. Calculate an explainable excursion risk percentage.
6. Classify the risk level.
7. Provide an AI recommendation.
8. Estimate confidence based on available telemetry history.

Important
---------
The model uses ACTUAL telemetry timestamps.

It does NOT assume that every packet arrives at a fixed interval.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple

import numpy as np

from ..models import RawTelemetryPacket, AIPredictiveTemperature


class TemperaturePredictor:
    """
    Predictive temperature model for cold-chain monitoring.
    """

    # ---------------------------------------------------------
    # Configuration
    # ---------------------------------------------------------

    HISTORY_WINDOW = 20

    DEFAULT_MAX_SAFE_TEMP = 8.0
    DEFAULT_MIN_SAFE_TEMP = 2.0

    # Temperature velocity thresholds °C/min
    MODERATE_RATE = 0.05
    HIGH_RATE = 0.15

    # Maximum model confidence
    MAX_CONFIDENCE = 95.0

    # Minimum number of valid samples required for prediction
    MIN_SAMPLES = 3

    # ---------------------------------------------------------
    # Main prediction method
    # ---------------------------------------------------------

    @classmethod
    def predict(
        cls,
        current: RawTelemetryPacket,
        history: List[RawTelemetryPacket],
    ) -> AIPredictiveTemperature:

        # -----------------------------------------------------
        # 1. Get current temperature
        # -----------------------------------------------------

        current_temp = cls._get_current_temperature(current)

        # -----------------------------------------------------
        # No temperature available
        # -----------------------------------------------------

        if current_temp is None:

            return cls._no_temperature_response()

        # -----------------------------------------------------
        # 2. Get configured safe temperature limits
        # -----------------------------------------------------

        min_safe, max_safe = cls._get_safe_limits(current)

        # -----------------------------------------------------
        # 3. Collect valid temperature history
        # -----------------------------------------------------

        samples = cls._build_temperature_samples(
            current=current,
            history=history,
        )

        # -----------------------------------------------------
        # 4. Not enough data for prediction
        # -----------------------------------------------------

        if len(samples) < cls.MIN_SAMPLES:

            return cls._insufficient_data_response(
                current_temp=current_temp,
                sample_count=len(samples),
            )

        # -----------------------------------------------------
        # 5. Calculate temperature velocity
        # -----------------------------------------------------

        slope, regression_quality = (
            cls._calculate_temperature_slope(samples)
        )

        # -----------------------------------------------------
        # 6. Forecast 15, 30 and 60 minutes (Plateau-Aware)
        # -----------------------------------------------------

        ambient_val = (
            current.temperature.ambient_temp_c
            if current.temperature and current.temperature.ambient_temp_c is not None
            else None
        )

        forecast_15m, forecast_30m, forecast_60m, is_plateauing = (
            cls._calculate_plateau_aware_forecast(
                current_temp=current_temp,
                slope=slope,
                samples=samples,
                min_safe=min_safe,
                max_safe=max_safe,
                ambient_temp=ambient_val,
            )
        )

        # -----------------------------------------------------
        # 7. Calculate risk
        # -----------------------------------------------------

        (
            risk_pct,
            risk_level,
            time_to_breach,
            possible_cause,
            recommendation,
            action_summary,
        ) = cls._calculate_risk(
            current_temp=current_temp,
            forecast_15m=forecast_15m,
            forecast_30m=forecast_30m,
            slope=slope,
            min_safe=min_safe,
            max_safe=max_safe,
            is_plateauing=is_plateauing,
        )

        # -----------------------------------------------------
        # 8. Calculate confidence
        # -----------------------------------------------------

        confidence = cls._calculate_confidence(
            sample_count=len(samples),
            regression_quality=regression_quality,
        )

        # -----------------------------------------------------
        # 9. Return AI result
        # -----------------------------------------------------

        return AIPredictiveTemperature(

            current_temp_c=round(
                current_temp,
                2,
            ),

            rate_of_change_c_per_min=round(
                slope,
                4,
            ),

            predicted_temp_15m_c=forecast_15m,

            predicted_temp_30m_c=forecast_30m,

            predicted_temp_60m_c=forecast_60m,

            excursion_risk_pct=round(
                risk_pct,
                1,
            ),

            risk_level=risk_level,

            estimated_time_to_breach_min=(
                round(
                    time_to_breach,
                    1,
                )
                if time_to_breach is not None
                else None
            ),

            ai_recommendation=recommendation,

            confidence_pct=round(
                confidence,
                1,
            ),

            possible_cause=possible_cause,

            action_summary=action_summary,
        )

    # =========================================================
    # CURRENT TEMPERATURE
    # =========================================================

    @staticmethod
    def _get_current_temperature(
        packet: RawTelemetryPacket,
    ) -> Optional[float]:

        if packet.temperature is None:
            return None

        value = packet.temperature.cargo_temp_c

        if value is None:
            return None

        try:
            return float(value)

        except (
            TypeError,
            ValueError,
        ):
            return None

    # =========================================================
    # SAFE TEMPERATURE LIMITS
    # =========================================================

    @classmethod
    def _get_safe_limits(
        cls,
        packet: RawTelemetryPacket,
    ) -> Tuple[float, float]:

        temperature = packet.temperature

        if temperature is None:

            return (
                cls.DEFAULT_MIN_SAFE_TEMP,
                cls.DEFAULT_MAX_SAFE_TEMP,
            )

        # Do NOT use "or" here because 0 is a valid numeric value.
        min_safe = (
            temperature.target_min_c
            if temperature.target_min_c is not None
            else cls.DEFAULT_MIN_SAFE_TEMP
        )

        max_safe = (
            temperature.target_max_c
            if temperature.target_max_c is not None
            else cls.DEFAULT_MAX_SAFE_TEMP
        )

        return (
            float(min_safe),
            float(max_safe),
        )

    # =========================================================
    # BUILD TEMPERATURE HISTORY
    # =========================================================

    @classmethod
    def _build_temperature_samples(
        cls,
        current: RawTelemetryPacket,
        history: List[RawTelemetryPacket],
    ) -> List[Tuple[datetime, float]]:

        samples: List[
            Tuple[datetime, float]
        ] = []

        # -----------------------------------------------------
        # Historical packets
        # -----------------------------------------------------

        for packet in history:

            if packet.temperature is None:
                continue

            temperature = (
                packet.temperature.cargo_temp_c
            )

            if temperature is None:
                continue

            timestamp = packet.timestamp

            if timestamp is None:
                continue

            try:
                temperature = float(
                    temperature
                )

            except (
                TypeError,
                ValueError,
            ):
                continue

            ts_norm = timestamp if isinstance(timestamp, datetime) else datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
            if ts_norm.tzinfo is None:
                ts_norm = ts_norm.replace(tzinfo=timezone.utc)
            else:
                ts_norm = ts_norm.astimezone(timezone.utc)

            samples.append(
                (
                    ts_norm,
                    temperature,
                )
            )

        # -----------------------------------------------------
        # Current packet
        # -----------------------------------------------------

        current_temp = cls._get_current_temperature(
            current
        )

        if (
            current_temp is not None
            and current.timestamp is not None
        ):

            curr_ts = current.timestamp if isinstance(current.timestamp, datetime) else datetime.fromisoformat(str(current.timestamp).replace("Z", "+00:00"))
            if curr_ts.tzinfo is None:
                curr_ts = curr_ts.replace(tzinfo=timezone.utc)
            else:
                curr_ts = curr_ts.astimezone(timezone.utc)

            samples.append(
                (
                    curr_ts,
                    current_temp,
                )
            )

        # -----------------------------------------------------
        # Sort chronologically
        # -----------------------------------------------------

        samples.sort(
            key=lambda item: item[0]
        )

        # -----------------------------------------------------
        # Remove duplicate timestamps
        #
        # If two packets have the same timestamp,
        # keep the latest temperature value.
        # -----------------------------------------------------

        timestamp_map = {}

        for timestamp, temperature in samples:

            timestamp_map[
                timestamp
            ] = temperature

        samples = sorted(
            timestamp_map.items(),
            key=lambda item: item[0],
        )

        # -----------------------------------------------------
        # Rolling window
        # -----------------------------------------------------

        if len(samples) > cls.HISTORY_WINDOW:

            samples = samples[
                -cls.HISTORY_WINDOW:
            ]

        return samples

    # =========================================================
    # CALCULATE TEMPERATURE SLOPE
    # =========================================================

    @staticmethod
    def _calculate_temperature_slope(
        samples: List[Tuple[datetime, float]],
    ) -> Tuple[float, float]:

        """
        Returns:

            slope:
                Temperature change in °C/min.

            regression_quality:
                R² value between 0 and 1.
        """

        if len(samples) < 2:

            return (
                0.0,
                0.0,
            )

        # -----------------------------------------------------
        # Use first timestamp as time origin.
        #
        # Convert seconds -> minutes.
        # -----------------------------------------------------

        first_timestamp = samples[0][0]

        times = np.array(
            [
                (
                    timestamp
                    - first_timestamp
                ).total_seconds()
                / 60.0
                for timestamp, _ in samples
            ],
            dtype=float,
        )

        temperatures = np.array(
            [
                temperature
                for _, temperature in samples
            ],
            dtype=float,
        )

        # -----------------------------------------------------
        # Duplicate timestamps cannot be used for regression.
        # -----------------------------------------------------

        if len(np.unique(times)) < 2:

            return (
                0.0,
                0.0,
            )

        # -----------------------------------------------------
        # Total time span
        # -----------------------------------------------------

        time_span = (
            times[-1]
            - times[0]
        )

        if time_span <= 0:

            return (
                0.0,
                0.0,
            )

        # -----------------------------------------------------
        # Linear regression
        #
        # temperature = slope * time + intercept
        # -----------------------------------------------------

        coefficients = np.polyfit(
            times,
            temperatures,
            1,
        )

        slope = float(
            coefficients[0]
        )

        intercept = float(
            coefficients[1]
        )

        # -----------------------------------------------------
        # Calculate R²
        # -----------------------------------------------------

        predicted = (
            slope * times
            + intercept
        )

        residual_sum = float(
            np.sum(
                (
                    temperatures
                    - predicted
                ) ** 2
            )
        )

        total_sum = float(
            np.sum(
                (
                    temperatures
                    - np.mean(temperatures)
                ) ** 2
            )
        )

        if total_sum <= 0:

            regression_quality = 1.0

        else:

            regression_quality = (
                1.0
                - (
                    residual_sum
                    / total_sum
                )
            )

            regression_quality = max(
                0.0,
                min(
                    1.0,
                    regression_quality,
                ),
            )

        return (
            slope,
            regression_quality,
        )

    # =========================================================
    # PLATEAU-AWARE FORECASTING
    # =========================================================

    @classmethod
    def _calculate_plateau_aware_forecast(
        cls,
        current_temp: float,
        slope: float,
        samples: List[Tuple[datetime, float]],
        min_safe: float,
        max_safe: float,
        ambient_temp: Optional[float] = None,
    ) -> Tuple[float, float, float, bool]:
        """
        Computes plateau-aware temperature forecasts for 15m, 30m, and 60m ahead.
        Prevents unbounded linear extrapolation by factoring in:
        1. Steady-state plateau when |dT/dt| < 0.005 °C/min.
        2. Curvature deceleration detection across the rolling sample window.
        3. Newton's law of cooling / thermodynamic saturation: Delta T(t) = slope * tau * (1 - e^(-t/tau)).
        4. Physical boundary plateaus (ambient ceiling when warming, refrigeration floor when cooling).
        """
        # Steady-state plateau: very low velocity or variance
        if abs(slope) < 0.005:
            return (round(current_temp, 2), round(current_temp, 2), round(current_temp, 2), True)

        # Detect curvature / deceleration across history
        is_plateauing = False
        tau = 45.0  # Default thermal saturation time constant in minutes

        if len(samples) >= 4:
            mid = len(samples) // 2
            earlier_samples = samples[:mid]
            recent_samples = samples[mid:]
            earlier_slope, _ = cls._calculate_temperature_slope(earlier_samples)
            recent_slope, _ = cls._calculate_temperature_slope(recent_samples)

            # If warming and rate of warming is flattening out
            if slope > 0 and 0 <= recent_slope < 0.75 * earlier_slope and earlier_slope > 0.01:
                is_plateauing = True
                tau = 25.0  # Decelerates to plateau faster
            # If cooling and rate of cooling is flattening out
            elif slope < 0 and earlier_slope < -0.01 and earlier_slope < recent_slope <= 0:
                is_plateauing = True
                tau = 25.0

        # Thermodynamic exponential saturation: Delta T(t) = slope * tau * (1 - exp(-t/tau))
        dt_15 = slope * tau * (1.0 - np.exp(-15.0 / tau))
        dt_30 = slope * tau * (1.0 - np.exp(-30.0 / tau))
        dt_60 = slope * tau * (1.0 - np.exp(-60.0 / tau))

        f_15 = current_temp + dt_15
        f_30 = current_temp + dt_30
        f_60 = current_temp + dt_60

        # Physical boundary plateaus:
        # Warming cannot exceed ambient air temperature
        amb_limit = float(ambient_temp if ambient_temp is not None else 32.0)
        if slope > 0:
            f_15 = min(amb_limit, f_15)
            f_30 = min(amb_limit, f_30)
            f_60 = min(amb_limit, f_60)
        elif slope < 0:
            # When cooling, standard refrigeration doesn't drop below evaporator minimum (~0.0°C)
            floor_limit = min(min_safe - 2.0, 0.0) if current_temp > 0.0 else (current_temp - 10.0)
            f_15 = max(floor_limit, f_15)
            f_30 = max(floor_limit, f_30)
            f_60 = max(floor_limit, f_60)

        return (round(f_15, 2), round(f_30, 2), round(f_60, 2), is_plateauing)

    # =========================================================
    # RISK CALCULATION
    # =========================================================

    @classmethod
    def _calculate_risk(
        cls,
        current_temp: float,
        forecast_15m: float,
        forecast_30m: float,
        slope: float,
        min_safe: float,
        max_safe: float,
        is_plateauing: bool = False,
    ):

        # -----------------------------------------------------
        # Default values
        # -----------------------------------------------------

        risk_pct = 5.0

        risk_level = (
            "LOW_NORMAL"
        )

        time_to_breach = None

        possible_cause = (
            "Normal steady-state refrigeration operation"
            if not is_plateauing
            else "Normal steady-state refrigeration operation (temperature plateaued)"
        )

        recommendation = (
            "Temperature optimal. "
            "Cold-chain refrigeration operating normally."
        )

        action_summary = (
            "Maintain normal route schedule. "
            "No intervention needed."
        )

        # =====================================================
        # CASE 1: CURRENT UPPER BREACH
        # =====================================================

        if current_temp > max_safe:

            return (
                100.0,

                "BREACH_IMMINENT",

                0.0,

                (
                    "Refrigeration compressor failure, "
                    "power loss, or prolonged door breach"
                ),

                (
                    "CRITICAL: Temperature breached "
                    "upper limit. Check reefer unit immediately."
                ),

                (
                    "Stop at the nearest safe location. "
                    "Check refrigeration unit, thermostat, "
                    "power supply and cargo door seal."
                ),
            )

        # =====================================================
        # CASE 2: CURRENT LOWER BREACH
        # =====================================================

        if current_temp < min_safe:

            return (
                100.0,

                "BREACH_IMMINENT",

                0.0,

                (
                    "Thermostat overshoot or "
                    "defrost/control failure"
                ),

                (
                    "CRITICAL: Temperature breached "
                    "lower limit. Inspect reefer thermostat."
                ),

                (
                    "Check thermostat and refrigeration "
                    "control immediately."
                ),
            )

        # =====================================================
        # CASE 3: WARMING
        # =====================================================

        if slope > 0:

            degrees_to_upper = (
                max_safe
                - current_temp
            )

            # -------------------------------------------------
            # Calculate time to upper breach.
            # -------------------------------------------------

            time_to_breach = (
                degrees_to_upper
                / slope
            )

            # -------------------------------------------------
            # Already predicted to breach in 15 min.
            # -------------------------------------------------

            if forecast_15m >= max_safe:

                risk_pct = min(
                    100.0,
                    max(
                        80.0,
                        100.0
                        - (
                            time_to_breach
                            / 15.0
                            * 20.0
                        ),
                    ),
                )

                risk_level = (
                    "HIGH_RISK_EARLY_WARNING"
                )

                possible_cause = (
                    "Cooling efficiency reduction, "
                    "refrigeration issue, or prolonged "
                    "cargo-door opening"
                )

                recommendation = (
                    f"WARNING: Temperature rising at "
                    f"{slope:+.3f}°C/min. "
                    f"Upper limit may be breached in "
                    f"approximately "
                    f"{time_to_breach:.1f} minutes."
                )

                action_summary = (
                    "Verify refrigeration unit and "
                    "confirm cargo door is sealed."
                )

            # -------------------------------------------------
            # Predicted breach within 30 minutes.
            # -------------------------------------------------

            elif forecast_30m >= max_safe:

                risk_pct = 60.0

                risk_level = (
                    "MODERATE_WATCH"
                )

                possible_cause = (
                    "Elevated thermal load or "
                    "reduced refrigeration efficiency"
                )

                recommendation = (
                    f"CAUTION: Temperature is rising "
                    f"at {slope:+.3f}°C/min. "
                    f"Monitor refrigeration performance."
                )

                action_summary = (
                    "Monitor temperature trajectory "
                    "over the next 10 minutes."
                )

            # -------------------------------------------------
            # Slow warming
            # -------------------------------------------------

            elif slope >= cls.HIGH_RATE:

                risk_pct = 45.0

                risk_level = (
                    "MODERATE_WATCH"
                )

                possible_cause = (
                    "Gradual warming trend"
                )

                recommendation = (
                    "Temperature is gradually increasing. "
                    "Continue monitoring."
                )

                action_summary = (
                    "Monitor the reefer unit and "
                    "cargo door status."
                )

            elif slope >= cls.MODERATE_RATE:

                risk_pct = 25.0

                risk_level = (
                    "LOW_NORMAL"
                )

                possible_cause = (
                    "Minor warming trend"
                )

                recommendation = (
                    "Minor temperature increase detected. "
                    "No immediate intervention required."
                )

                action_summary = (
                    "Continue normal monitoring."
                )

        # =====================================================
        # CASE 4: COOLING
        # =====================================================

        elif slope < 0:

            degrees_to_lower = (
                current_temp
                - min_safe
            )

            time_to_breach = (
                degrees_to_lower
                / abs(slope)
            )

            # -------------------------------------------------
            # Predicted freeze breach within 15 min
            # -------------------------------------------------

            if forecast_15m <= min_safe:

                risk_pct = 85.0

                risk_level = (
                    "HIGH_RISK_EARLY_WARNING"
                )

                possible_cause = (
                    "Continuous compressor pull-down "
                    "or thermostat regulation issue"
                )

                recommendation = (
                    f"WARNING: Temperature falling at "
                    f"{slope:+.3f}°C/min. "
                    f"Lower limit may be breached in "
                    f"approximately "
                    f"{time_to_breach:.1f} minutes."
                )

                action_summary = (
                    "Inspect thermostat cutoff sensors "
                    "and refrigeration control."
                )

            # -------------------------------------------------
            # Predicted freeze breach within 30 min
            # -------------------------------------------------

            elif forecast_30m <= min_safe:

                risk_pct = 60.0

                risk_level = (
                    "MODERATE_WATCH"
                )

                possible_cause = (
                    "Extended cooling cycle"
                )

                recommendation = (
                    "Temperature is falling toward "
                    "the configured lower limit."
                )

                action_summary = (
                    "Monitor refrigeration control."
                )

            elif abs(slope) >= cls.HIGH_RATE:

                risk_pct = 40.0

                risk_level = (
                    "MODERATE_WATCH"
                )

                possible_cause = (
                    "Rapid cooling trend"
                )

                recommendation = (
                    "Temperature is falling rapidly."
                )

                action_summary = (
                    "Check thermostat regulation."
                )

            elif abs(slope) >= cls.MODERATE_RATE:

                risk_pct = 20.0

                risk_level = (
                    "LOW_NORMAL"
                )

                possible_cause = (
                    "Normal cooling cycle"
                )

                recommendation = (
                    "Temperature is decreasing "
                    "within the expected range."
                )

                action_summary = (
                    "Continue normal monitoring."
                )

        # =====================================================
        # CASE 5: STABLE
        # =====================================================

        else:

            total_range = (
                max_safe
                - min_safe
            )

            if total_range > 0:

                distance_to_edge = min(
                    abs(
                        current_temp
                        - min_safe
                    ),
                    abs(
                        max_safe
                        - current_temp
                    ),
                )

                midpoint = (
                    total_range
                    / 2.0
                )

                edge_factor = (
                    1.0
                    - (
                        distance_to_edge
                        / midpoint
                    )
                )

                risk_pct = max(
                    5.0,
                    min(
                        30.0,
                        edge_factor
                        * 30.0,
                    ),
                )

        return (
            risk_pct,
            risk_level,
            time_to_breach,
            possible_cause,
            recommendation,
            action_summary,
        )

    # =========================================================
    # CONFIDENCE
    # =========================================================

    @classmethod
    def _calculate_confidence(
        cls,
        sample_count: int,
        regression_quality: float,
    ) -> float:

        """
        Confidence is based on:

        - Number of historical samples.
        - Quality of linear regression.

        This is NOT a statistical probability of correctness.
        It is an AI data-confidence indicator.
        """

        if sample_count < 3:

            base_confidence = 40.0

        elif sample_count < 5:

            base_confidence = 60.0

        elif sample_count < 10:

            base_confidence = 75.0

        elif sample_count < 15:

            base_confidence = 85.0

        else:

            base_confidence = 90.0

        # Regression quality adjustment
        quality_factor = (
            0.70
            + (
                regression_quality
                * 0.30
            )
        )

        confidence = (
            base_confidence
            * quality_factor
        )

        return min(
            cls.MAX_CONFIDENCE,
            max(
                0.0,
                confidence,
            ),
        )

    # =========================================================
    # NO TEMPERATURE RESPONSE
    # =========================================================

    @staticmethod
    def _no_temperature_response():

        return AIPredictiveTemperature(

            current_temp_c=None,

            rate_of_change_c_per_min=0.0,

            predicted_temp_15m_c=None,

            predicted_temp_30m_c=None,

            predicted_temp_60m_c=None,

            excursion_risk_pct=0.0,

            risk_level="LOW_NORMAL",

            estimated_time_to_breach_min=None,

            ai_recommendation=(
                "EC200U Gateway connected. "
                "Awaiting sensor node telemetry."
            ),

            confidence_pct=0.0,

            possible_cause=(
                "Awaiting wireless sensor node reading"
            ),

            action_summary=(
                "Gateway online. "
                "Sensor node awaiting transmission."
            ),
        )

    # =========================================================
    # INSUFFICIENT DATA RESPONSE
    # =========================================================

    @staticmethod
    def _insufficient_data_response(
        current_temp: float,
        sample_count: int,
    ):

        required = 3

        return AIPredictiveTemperature(

            current_temp_c=round(
                current_temp,
                2,
            ),

            rate_of_change_c_per_min=0.0,

            predicted_temp_15m_c=None,

            predicted_temp_30m_c=None,

            predicted_temp_60m_c=None,

            excursion_risk_pct=0.0,

            risk_level="LOW_NORMAL",

            estimated_time_to_breach_min=None,

            ai_recommendation=(
                f"Acquiring thermal baseline "
                f"({sample_count}/{required} packets). "
                f"Awaiting minimum {required} valid "
                f"temperature cycles."
            ),

            confidence_pct=0.0,

            possible_cause=(
                "Insufficient historical telemetry "
                "to calculate reliable dT/dt."
            ),

            action_summary=(
                f"Collecting thermal baseline "
                f"({sample_count}/{required} packets)."
            ),
        )
