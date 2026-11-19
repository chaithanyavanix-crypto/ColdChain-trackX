# ❄️ TracX: AI-Powered Vehicle Tracking & Cold-Chain Monitoring Platform

An end-to-end, production-ready telematics and cold-chain intelligence platform built with **FastAPI**, **WebSockets**, **Leaflet.js**, **Chart.js**, and a **Dual-Layer Decision Architecture** (Layer 1 Deterministic Safety Rules + Layer 2 AI Predictive Models).

---

## 🏗️ Architecture Overview

```
                          ┌──────────────────────────┐
                          │   TRACX HARDWARE DEVICE  │
                          │                          │
                          │  • GNSS (u-blox NEO-M8N) │
                          │  • DS18B20 Temp Probe    │
                          │  • MPU-6050 6-Axis IMU   │
                          │  • Tamper Microswitch    │
                          │  • SPI Flash Buffer      │
                          │  • Quectel 4G Cat-1      │
                          └────────────┬─────────────┘
                                       │ (4G LTE / MQTT / HTTPS)
                                       ▼
                       ┌───────────────────────────────┐
                       │   TRACX FASTAPI CLOUD CORE    │
                       └──────────────┬────────────────┘
                                      │
               ┌──────────────────────┴──────────────────────┐
               ▼                                             ▼
  ┌─────────────────────────┐                   ┌─────────────────────────┐
  │ Layer 1: Rule Engine    │                   │ Layer 2: AI Engine      │
  │ • Temp Thresholds       │                   │ • 15m/30m Temp Forecast │
  │ • Crash Shock (>3.0g)   │                   │ • GPS Kinematic Filter  │
  │ • Enclosure Tamper Open │                   │ • Dead Reckoning Model  │
  │ • Power Disconnect      │                   │ • IMU Driver Classifier │
  │ • Battery Low           │                   │ • Multi-Signal Tamper   │
  └────────────┬────────────┘                   │ • Predictive Battery    │
               │                                └────────────┬────────────┘
               └──────────────────────┬──────────────────────┘
                                      │ (Real-Time WebSocket)
                                      ▼
                        ┌──────────────────────────┐
                        │   WEB & FLEET DASHBOARD  │
                        │  • Live Leaflet GPS Map  │
                        │  • Cold-Chain Temp Curve │
                        │  • AI Prediction Overlay │
                        │  • Interactive Simulator │
                        │  • Real-Time Alert Log   │
                        └──────────────────────────┘
```

---

## 🧠 The 6 Layer-2 AI Intelligence Modules

1. **Predictive Cold-Chain Excursion Engine:**
   - Computes thermal rate of change $\frac{dT}{dt}$ (°C/min) using sliding-window linear regression.
   - Forecasts cargo temperatures **15 and 30 minutes ahead**.
   - Calculates dynamic excursion risk % and provides early warning before the 2°C–8°C threshold is breached.

2. **GPS Kinematic & Spoofing Anomaly Filter:**
   - Checks spatial displacement vs. elapsed time using Haversine formulation.
   - Flags teleportation anomalies and multipath glitches.

3. **Dead Reckoning GPS Loss Recovery:**
   - When entering tunnels or basements (GNSS fix lost), forward-projects position using last known heading, velocity, and IMU data with confidence decay.

4. **IMU Driver Behavior & Crash Classifier:**
   - Extracts 3-axis vector acceleration $G = \sqrt{a_x^2 + a_y^2 + a_z^2}$ and jerk derivative $\frac{dG}{dt}$.
   - Classifies: *Smooth Normal, Harsh Braking, Harsh Acceleration, Aggressive Cornering, Road Bump, or Severe Crash Impact*.

5. **Multi-Signal Bayesian Tamper & Theft Fusion:**
   - Correlates microswitch trigger, vehicle stationary state, ambient temperature surge, and IMU angular tilt.

6. **Predictive Device & Battery Health:**
   - Monitors Li-ion voltage decay under 4G transmission bursts to predict battery replacement needs.

---

## 🚀 How to Run the Platform

### 1. Launch the Server & Dashboard
```bash
source .venv/bin/activate
python tracx_platform/run_tracx.py
```

### 2. Access the Dashboard
Open your browser and navigate to:
👉 **`https://smart-ccms.loca.lt`** *(or `http://localhost:8000` locally)*

---

## 📡 Hardware Telemetry Ingestion Endpoint

Physical Smart CCMS hardware devices (ESP32-S3 / STM32 with Quectel 4G Cat-1) send JSON payloads to:
- Public URL: **`POST https://smart-ccms.loca.lt/api/v1/telemetry`**
- Local URL:  **`POST http://localhost:8000/api/v1/telemetry`**

### Firmware Timestamp & UTC Requirement
> [!IMPORTANT]
> **Firmware Clock Standard:** Firmware must transmit timestamps formatted as **ISO-8601 UTC** with a trailing `Z` (e.g. `"2026-10-10T14:30:00Z"`) or Unix epoch timestamp in seconds.
> Far-off device clocks (e.g. uninitialized RTC `< 2024`, drift `> 10 min` in the future, or `> 24 hours` in the past) are rejected by the backend and replaced with verified server UTC.

### Sample Hardware Payload (Nested Schema)
```json
{
  "device_id": "GW-001",
  "timestamp": "2026-10-10T14:30:00Z",
  "door_status": "SEALED",
  "node_connected": true,
  "gps": {
    "lat": 17.4435,
    "lng": 78.3772,
    "speed_kmh": 45.2,
    "heading_deg": 180.0,
    "altitude_m": 540.0,
    "satellites_count": 10,
    "fix_status": "3D_FIX"
  },
  "temperature": {
    "cargo_temp_c": 4.8,
    "ambient_temp_c": 31.0,
    "target_min_c": 2.0,
    "target_max_c": 8.0,
    "probe_connected": true
  },
  "imu": {
    "accel_x_g": 0.02,
    "accel_y_g": 0.01,
    "accel_z_g": 1.0,
    "gyro_x_dps": 0.0,
    "gyro_y_dps": 0.0,
    "gyro_z_dps": 0.0,
    "shock_detected": false
  },
  "tamper_switch_closed": true,
  "power_network": {
    "battery_pct": 92,
    "battery_voltage_v": 4.05,
    "external_power_connected": true,
    "lte_csq_rssi": 26,
    "network_rat": "4G Cat-1",
    "offline_buffered_packets": 0
  }
}
```

### Sample Quectel EC200U Gateway Payload (Flat Ingestion)
```json
{
  "gateway_id": "GW-001",
  "node_id": "NODE-001",
  "timestamp": "2026-10-10T14:30:00Z",
  "latitude": 17.4435,
  "longitude": 78.3772,
  "temperature": 4.8,
  "node_connected": true,
  "door_status": "SEALED",
  "tamper": false,
  "network_rssi": -72,
  "speed_kmh": 42.0
}
```
