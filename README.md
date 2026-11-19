# ❄️ TracX: Enterprise Cold-Chain Telematics & Fleet AI Platform

An end-to-end, production-ready IoT telematics and cold-chain intelligence platform built with **FastAPI**, **PostgreSQL 16**, **WebSockets**, **React 19 / TypeScript / Vite**, **Leaflet Maps**, and a **Dual-Layer Intelligence Architecture** (Deterministic Safety Rules + AI Predictive Thermal Forecasting).

---

## 🏗️ System Architecture

```
   [ Physical Vehicle IoT Tracker ] ──(4G LTE HTTP POST)──┐
   (GNSS GPS + Temp Probe + Door Sensor + SIM)           │
                                                         ▼
                                       ┌───────────────────────────────────┐
                                       │    Permanent Public HTTPS URL     │
                                       │ (tipper-compost-fantasize.ngrok)  │
                                       └─────────────────┬─────────────────┘
                                                         │
                                                         ▼
                                       ┌───────────────────────────────────┐
                                       │     FastAPI Core Engine (:8000)   │
                                       ├───────────────────────────────────┤
                                       │ • Ingestion & Auto-Provisioning   │
                                       │ • IMEI & IMSI Carrier Token Sync  │
                                       │ • Layer 1: Rule Engine (2°C–8°C)  │
                                       │ • Layer 2: AI Predictive Drift    │
                                       │ • Trip Route & Halt State Machine │
                                       └───────┬───────────────────┬───────┘
                                               │                   │
                                               ▼                   ▼
                           ┌───────────────────────────┐   ┌───────────────────────────┐
                           │   PostgreSQL 16 Database  │   │  Real-Time WebSocket WSS  │
                           │  • telemetry_history (GPS)│   │  • wss://.../ws/telemetry │
                           │  • trip_waypoints & halts │   └─────────────┬─────────────┘
                           │  • devices & alerts audit │                 │
                           └───────────────────────────┘                 ▼
                                                           ┌───────────────────────────┐
                                                           │  Vercel Frontend (React)  │
                                                           │  • Live Esri Dark Map     │
                                                           │  • Route Replay & Halts   │
                                                           │  • Telemetry Gauge Dials  │
                                                           │  • Fleet Inventory & Edit │
                                                           └───────────────────────────┘
```

---

## 🚀 How to Run the Platform Locally

### Prerequisites
* **Python**: 3.10+ (installed in `.venv`)
* **Bun** or **Node.js**: (Bun is pre-configured at `~/.bun/bin/bun.exe`)
* **PostgreSQL 16**: (Running on `localhost:5432`, fallback to SQLite is automatic)

---

### Option 1: 1-Click Launchers (Windows)

In the root folder, simply double-click:
1. **`run_backend.bat`** ➔ Starts FastAPI backend on `http://localhost:8000`.
2. **`run_frontend.bat`** ➔ Starts Vite React frontend on `http://localhost:5173`.
3. **`start_ngrok.bat`** ➔ Starts the permanent static tunnel to receive live hardware packets.

*(Or run **`run_all.bat`** to start the full system in one go).*

---

### Option 2: Manual Terminal Commands

#### 1. Start the Backend Server (Terminal 1)
```powershell
# Activate virtual environment
.\.venv\Scripts\Activate.ps1

# Run the FastAPI server
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
* Backend API Docs: **`http://localhost:8000/docs`**
* Health Check: **`http://localhost:8000/api/v1/fleet/overview`**

#### 2. Start the Frontend Dev Server (Terminal 2)
```powershell
cd frontend
bun install
bun run dev
```
* Local Web Dashboard: **`http://localhost:5173`**

#### 3. Start the Permanent Public Tunnel (Terminal 3)
```powershell
.\ngrok.exe http 8000 --url https://tipper-compost-fantasize.ngrok-free.dev
```

---

## 🌐 Deploy Frontend to Vercel

The frontend is fully configured for continuous deployment on Vercel:

1. Push your changes to GitHub:
   ```powershell
   git push origin main
   ```
2. Go to **[vercel.com/new](https://vercel.com/new)** and import **`ColdChain-trackX`**.
3. Configure project settings:
   * **Root Directory**: `frontend`
   * **Framework Preset**: `Vite`
   * **Build Command**: `bun run build` (or `vite build`)
   * **Output Directory**: `dist`
4. Set **Environment Variables**:
   * `VITE_API_BASE` = `https://tipper-compost-fantasize.ngrok-free.dev`
   * `VITE_WS_BASE` = `wss://tipper-compost-fantasize.ngrok-free.dev`
5. Click **Deploy**.

---

## 📡 Hardware / Firmware Ingestion API

Physical hardware trackers (e.g., Quectel EC200U, ESP32, Nordic nRF9160) transmit periodic JSON telemetry packets over cellular LTE to:

* **Production Endpoint**: **`POST https://tipper-compost-fantasize.ngrok-free.dev/api/v1/telemetry`**
* **Localhost Endpoint**: **`POST http://localhost:8000/api/v1/telemetry`**
* **Headers**: `Content-Type: application/json`

### JSON Payload Specification
```json
{
  "device_id": "GW-001",
  "temperature": 4.35,
  "humidity": 58.0,
  "latitude": 17.4435,
  "longitude": 78.3772,
  "speed_kmh": 42.0,
  "door_status": "CLOSED",
  "tamper": false,
  "imei": "860738070471994",
  "imsi": "310410123451042",
  "network_rssi": -68,
  "battery_pct": 95
}
```

### Quick Test via cURL
Test your live ingestion pipeline from any terminal:
```powershell
curl -X POST "https://tipper-compost-fantasize.ngrok-free.dev/api/v1/telemetry" `
  -H "Content-Type: application/json" `
  -d '{"device_id":"GW-001","temperature":4.5,"latitude":17.4485,"longitude":78.3741,"speed_kmh":45.0,"door_status":"CLOSED","tamper":false,"imei":"860738070471994","imsi":"310410123451042","network_rssi":-65,"battery_pct":98}'
```

---

## 🗄️ PostgreSQL Database Schema

Telemetry points and routes are automatically persisted into PostgreSQL (`tracx_fleet`):

| Table | Purpose |
| :--- | :--- |
| **`devices`** | Master registry: `device_id`, `vehicle_name`, `driver_name`, `imei`, `imsi`, `target_min_c`, `target_max_c`. |
| **`telemetry_history`** | Time-series log: `lat`, `lng`, `speed_kmh`, `cargo_temp_c`, `battery_pct`, `heading_deg`, `timestamp`. |
| **`trip_waypoints`** | Consecutive breadcrumbs forming the interactive route polyline on the Leaflet map. |
| **`trips`** | Trip summary: `start_time`, `end_time`, `total_distance_km`, `max_speed_kmh`, `mkt_temp_c`. |
| **`trip_halts`** | Automated stop detection: logs coordinates and dwell duration whenever a vehicle halts $\ge 3$ min. |
| **`alerts_history`** | Temperature excursion audit logs and tamper security events. |

---

## 🛠️ Tech Stack

* **Backend**: FastAPI, Python 3.11, Uvicorn, Psycopg2, SQLite3, Pydantic v2
* **Frontend**: React 19, Vite 8, TypeScript, Tailwind CSS, Leaflet Maps, Lucide Icons
* **Tunneling**: Ngrok (Permanent Static Domain)
* **Hosting**: Vercel (Frontend Edge) + Local / VPS (Backend Core)
* **Intelligence**: Dual-Layer Architecture (Layer-1 Deterministic Rules + Layer-2 AI Thermal Forecasting)

---

## 🔒 Security & Privacy Notice
* Secrets such as database credentials and local `.env` files are strictly excluded via `.gitignore`.
* Use `.env.example` as a template for production deployments.
