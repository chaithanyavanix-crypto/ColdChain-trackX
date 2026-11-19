"""
Telemetry Ingestion and Query API Routes.
Serves both the hardware firmware endpoints and dashboard query endpoints.
"""

import json
import logging
import ast
import urllib.parse
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse

logger = logging.getLogger("tracx.telemetry_router")

from ...models import (
    RawTelemetryPacket,
    EnrichedTelemetryResponse,
    TemperatureTelemetryRequest,
    GPSTelemetryRequest,
    TamperTelemetryRequest,
    GPSCoordinates,
    TemperatureReading,
    IMUData,
    PowerAndNetwork
)
from ...storage import store
from ...services.telemetry_service import TelemetryService
from ...services.geocoding_service import GeocodingService

telemetry_router = APIRouter(tags=["Telemetry"])


@telemetry_router.get("/api/v1/telemetry/{device_id}/latest")
async def get_latest_device_telemetry(device_id: str):
    """Retrieves the latest telemetry, exact packet age, online status, and raw Quectel EC200U firmware payload."""
    latest = store.get_latest(device_id)
    raw_payload = store.get_raw_payload(device_id)
    headers = {
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
    }
    if not latest and not raw_payload:
        return JSONResponse(content={
            "device_id": device_id,
            "latest": None,
            "raw_payload": None,
            "is_online": False,
            "packet_age_sec": 999999,
            "server_time": datetime.now(timezone.utc).isoformat()
        }, headers=headers)

    # Determine exact elapsed time since last packet was received by the server
    last_rx = store.get_last_received_time(device_id)
    if last_rx:
        if last_rx.tzinfo is None:
            last_rx = last_rx.replace(tzinfo=timezone.utc)
        diff_sec = max(0, int((datetime.now(timezone.utc) - last_rx).total_seconds()))
    else:
        diff_sec = 999999

    net_rssi = None
    if raw_payload and raw_payload.get("network_rssi") is not None:
        net_rssi = raw_payload.get("network_rssi")
    elif latest and latest.raw_telemetry and latest.raw_telemetry.power_network and latest.raw_telemetry.power_network.lte_csq_rssi is not None:
        net_rssi = latest.raw_telemetry.power_network.lte_csq_rssi * 2 - 113

    # 5-minute online rule (300 seconds): payload received within 5 minutes
    is_online = (diff_sec <= 300)
    if is_online and net_rssi is None:
        net_rssi = -75  # Default nominal cellular 4G signal since packet arrived

    location_ctx = store.get_location_context(device_id)
    if not location_ctx:
        lat_val = latest.raw_telemetry.gps.lat if latest and latest.raw_telemetry and latest.raw_telemetry.gps else (raw_payload.get("latitude") if raw_payload else None)
        lng_val = latest.raw_telemetry.gps.lng if latest and latest.raw_telemetry and latest.raw_telemetry.gps else (raw_payload.get("longitude") if raw_payload else None)
        speed_val = latest.raw_telemetry.gps.speed_kmh if latest and latest.raw_telemetry and latest.raw_telemetry.gps else 0.0
        acc_val = raw_payload.get("location_accuracy") if raw_payload else None
        location_ctx = GeocodingService.resolve_location(
            device_id=device_id,
            lat=lat_val,
            lng=lng_val,
            accuracy_m=acc_val,
            speed_kmh=speed_val
        )

    # Calculate GPS fix state (ON when valid lat/lng in payload, otherwise OFF)
    raw_lat = raw_payload.get("latitude") if raw_payload else None
    raw_lng = raw_payload.get("longitude") if raw_payload else None
    if raw_lat is None and latest and latest.raw_telemetry and latest.raw_telemetry.gps:
        raw_lat = latest.raw_telemetry.gps.lat
    if raw_lng is None and latest and latest.raw_telemetry and latest.raw_telemetry.gps:
        raw_lng = latest.raw_telemetry.gps.lng

    try:
        lat_f = float(raw_lat) if raw_lat is not None else None
        lng_f = float(raw_lng) if raw_lng is not None else None
    except (ValueError, TypeError):
        lat_f, lng_f = None, None

    gps_on = bool(lat_f is not None and lng_f is not None and (lat_f != 0.0 or lng_f != 0.0))

    # Retrieve distance (with minimum 100m condition) and total tracking duration (HH:MM:SS)
    from ...trip_engine import trip_engine
    trip_ctx = trip_engine.active_contexts.get(device_id)
    distance_km = 0.0
    active_sec = 0

    if trip_ctx:
        distance_km = round(trip_ctx.get("total_distance_km", 0.0), 2)
        st = trip_ctx.get("start_time")
        if st:
            if hasattr(st, "tzinfo") and st.tzinfo is None:
                st = st.replace(tzinfo=timezone.utc)
            active_sec = max(0, int((datetime.now(timezone.utc) - st).total_seconds()))
    else:
        try:
            from ...database import get_db_connection
            conn = get_db_connection()
            c = conn.cursor()
            c.execute("SELECT total_distance_km, start_time FROM trips WHERE device_id = ? AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1", (device_id,))
            t_row = c.fetchone()
            if t_row:
                distance_km = round(t_row["total_distance_km"] or 0.0, 2)
                st_val = t_row["start_time"]
                if st_val:
                    st_dt = datetime.fromisoformat(st_val.replace("Z", "+00:00"))
                    active_sec = max(0, int((datetime.now(timezone.utc) - st_dt).total_seconds()))
            conn.close()
        except Exception:
            pass

    hrs = active_sec // 3600
    mins = (active_sec % 3600) // 60
    secs = active_sec % 60
    total_time_str = f"{hrs:02d}:{mins:02d}:{secs:02d}"

    res = latest.model_dump(mode="json") if latest else {"device_id": device_id}
    res["raw_payload"] = raw_payload
    res["location_context"] = location_ctx
    res["is_online"] = is_online
    res["packet_age_sec"] = diff_sec
    res["gps_on"] = gps_on
    res["distance_km"] = distance_km
    res["active_duration_sec"] = active_sec
    res["total_time_str"] = total_time_str
    res["server_time"] = datetime.now(timezone.utc).isoformat()
    return JSONResponse(content=res, headers=headers)


@telemetry_router.get("/api/v1/telemetry/{device_id}/history")
async def get_telemetry_history(device_id: str, limit: int = 100):
    """Retrieves chronological sensor history for temperature curves and breadcrumb path maps."""
    return store.get_history(device_id, limit=limit)


async def extract_telemetry_payload(request: Request) -> Dict[str, Any]:
    """
    Universally extracts telemetry dictionary from ANY client request regardless of:
    - HTTP method (POST, GET, PUT)
    - Content-Type (application/json, text/plain, x-www-form-urlencoded, multipart, or none)
    - Body encoding (pure JSON, double-encoded JSON string, Python dict string, urlencoded form)
    - Query parameters (fallback or override)
    - UTF-8 BOM, extra whitespaces, or escaping
    """
    data: Dict[str, Any] = {}

    # 1. First capture query parameters
    if request.query_params:
        data.update(dict(request.query_params))

    # 2. Try native request.json()
    body_data = None
    try:
        body_data = await request.json()
    except Exception:
        pass

    # If body_data is a double-encoded string (e.g. '"{\"gateway_id\":\"GW-001\"}"')
    if isinstance(body_data, str):
        try:
            body_data = json.loads(body_data)
        except Exception:
            try:
                body_data = ast.literal_eval(body_data)
            except Exception:
                pass

    if isinstance(body_data, dict):
        data.update(body_data)
    else:
        # 3. Read raw body bytes
        try:
            body_bytes = await request.body()
            body_str = body_bytes.decode("utf-8", errors="ignore").strip()
            if body_str.startswith("\ufeff"):
                body_str = body_str[1:].strip()

            if body_str:
                # 3a. Try JSON parse
                parsed = None
                try:
                    parsed = json.loads(body_str)
                    if isinstance(parsed, str):
                        try:
                            parsed = json.loads(parsed)
                        except Exception:
                            pass
                except Exception:
                    pass

                # 3b. Try ast.literal_eval (Python dict format: {'gateway_id': 'GW-001'})
                if not isinstance(parsed, dict):
                    try:
                        ast_res = ast.literal_eval(body_str)
                        if isinstance(ast_res, dict):
                            parsed = ast_res
                    except Exception:
                        pass

                # 3c. Try URL-encoded form data (gateway_id=GW-001&temperature=4.5)
                if not isinstance(parsed, dict) and ("=" in body_str):
                    try:
                        form_dict = urllib.parse.parse_qs(body_str)
                        if form_dict:
                            parsed = {k: v[0] if len(v) == 1 else v for k, v in form_dict.items()}
                    except Exception:
                        pass

                if isinstance(parsed, dict):
                    data.update(parsed)
        except Exception as e:
            logger.warning("Telemetry raw body parse error: %s", e)

    # 4. Clean up string types for numeric and boolean fields from query params / forms
    for num_key in [
        "temperature", "temp", "cargo_temp_c", "temp_c", "temperature_c", "t",
        "ambient_temp_c", "latitude", "lat", "longitude", "lng", "lon", "long",
        "speed_kmh", "speed", "spd", "heading_deg", "heading", "bearing",
        "altitude_m", "altitude", "alt", "battery", "battery_pct", "battery_voltage_v", "voltage",
        "network_rssi", "rssi", "lte_csq", "csq", "satellites", "satellites_count"
    ]:
        if num_key in data and isinstance(data[num_key], str):
            val_str = data[num_key].strip()
            try:
                if "." in val_str:
                    data[num_key] = float(val_str)
                else:
                    data[num_key] = int(val_str)
            except ValueError:
                pass

    for bool_key in ["node_connected", "tamper", "tamper_open", "door_open", "probe_connected", "shock_detected"]:
        if bool_key in data and isinstance(data[bool_key], str):
            val_str = data[bool_key].strip().lower()
            if val_str in ["true", "1", "yes", "on", "connected", "open"]:
                data[bool_key] = True
            elif val_str in ["false", "0", "no", "off", "disconnected", "closed"]:
                data[bool_key] = False

    return data


@telemetry_router.api_route("/api/v1/telemetry", methods=["GET", "POST", "PUT"])
@telemetry_router.api_route("/api/v1/telemetry/", methods=["GET", "POST", "PUT"])
@telemetry_router.api_route("/api/telemetry", methods=["GET", "POST", "PUT"])
@telemetry_router.api_route("/api/telemetry/", methods=["GET", "POST", "PUT"])
@telemetry_router.api_route("/telemetry", methods=["GET", "POST", "PUT"])
@telemetry_router.api_route("/telemetry/", methods=["GET", "POST", "PUT"])
@telemetry_router.api_route("/api/container/data", methods=["GET", "POST", "PUT"])
@telemetry_router.api_route("/api/container/data/", methods=["GET", "POST", "PUT"])
@telemetry_router.api_route("/data", methods=["GET", "POST", "PUT"])
@telemetry_router.api_route("/data/", methods=["GET", "POST", "PUT"])
@telemetry_router.api_route("/", methods=["POST", "PUT"])
async def ingest_hardware_telemetry(request: Request):
    """
    Primary unified ingestion endpoint for TracX / Smart CCMS IoT hardware devices.
    Accepts arbitrary JSON payloads, query parameters, form data, or raw text strings.
    Auto-provisions hardware, executes deterministic rules & AI models, and broadcasts to UI.
    """
    # If it's a GET request with NO telemetry query params (e.g. browser navigation / health probe):
    if request.method == "GET" and not request.query_params:
        return JSONResponse(content={
            "status": "online",
            "endpoint": str(request.url.path),
            "message": "Smart CCMS Telemetry Ingestion API is active and waiting for hardware packets.",
            "supported_methods": ["POST", "GET", "PUT"],
            "supported_formats": ["JSON", "Form-Urlencoded", "Query-Parameters", "Plaintext-JSON"],
            "sample_telemetry": {
                "gateway_id": "GW-001",
                "temperature": 4.5,
                "latitude": 17.445,
                "longitude": 78.375,
                "speed_kmh": 0.0,
                "node_connected": True,
                "door_status": "SEALED",
                "network_rssi": -65
            }
        }, headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        })

    data = await extract_telemetry_payload(request)

    # Fallback to default gateway if data is completely empty
    if not data or not isinstance(data, dict):
        logger.info("Empty or unparseable telemetry payload received; auto-initializing GW-001")
        data = {"gateway_id": "GW-001"}

    # If it is a nested RawTelemetryPacket (device_id + nested temperature dict)
    if "device_id" in data and isinstance(data.get("temperature"), dict):
        try:
            packet = RawTelemetryPacket.model_validate(data)
            return await TelemetryService.process_and_broadcast_packet(packet)
        except Exception as e:
            logger.warning("Nested packet validation fallback to EC200U processor: %s", e)

    # Flat EC200U hardware gateway payload
    return await TelemetryService.process_ec200u_gateway_payload(data)


@telemetry_router.post("/api/v1/telemetry/temperature", response_model=EnrichedTelemetryResponse)
@telemetry_router.post("/api/v1/telemetry/temperature/", response_model=EnrichedTelemetryResponse)
async def ingest_temperature_only(req: TemperatureTelemetryRequest):
    """Dedicated lightweight temperature endpoint for Cargo Node firmware."""
    dev_id = req.device_id
    measured_temp = req.get_temperature()

    latest = store.get_latest(dev_id)
    if latest:
        prev = latest.raw_telemetry
        gps_data = prev.gps
        imu_data = prev.imu
        pwr_data = prev.power_network
        tamper_data = prev.tamper_switch_closed
    else:
        gps_data = GPSCoordinates()
        imu_data = IMUData()
        pwr_data = PowerAndNetwork()
        tamper_data = True

    temp_data = TemperatureReading(
        cargo_temp_c=measured_temp,
        ambient_temp_c=req.ambient_temp_c,
        probe_connected=req.probe_connected if req.probe_connected is not None else True
    )

    packet = RawTelemetryPacket(
        device_id=dev_id,
        timestamp=datetime.now(timezone.utc),
        gps=gps_data,
        temperature=temp_data,
        imu=imu_data,
        tamper_switch_closed=tamper_data,
        power_network=pwr_data
    )
    return await TelemetryService.process_and_broadcast_packet(packet)


@telemetry_router.post("/api/v1/telemetry/gps", response_model=EnrichedTelemetryResponse)
@telemetry_router.post("/api/v1/telemetry/gps/", response_model=EnrichedTelemetryResponse)
async def ingest_gps_only(req: GPSTelemetryRequest):
    """Dedicated lightweight location endpoint for Tracker GPS module."""
    dev_id = req.device_id
    latest = store.get_latest(dev_id)
    now = datetime.now(timezone.utc)

    computed_speed = req.speed_kmh
    computed_heading = req.heading_deg

    if latest:
        prev = latest.raw_telemetry
        temp_data = prev.temperature
        imu_data = prev.imu
        pwr_data = prev.power_network
        tamper_data = prev.tamper_switch_closed
    else:
        temp_data = TemperatureReading(cargo_temp_c=4.5)
        imu_data = IMUData()
        pwr_data = PowerAndNetwork()
        tamper_data = True

    gps_data = GPSCoordinates(
        lat=req.lat,
        lng=req.lng,
        speed_kmh=computed_speed if computed_speed is not None else 0.0,
        heading_deg=computed_heading if computed_heading is not None else 0.0,
        altitude_m=req.altitude_m,
        satellites_count=req.satellites_count or 8,
        fix_status=req.fix_status or "3D_FIX"
    )

    packet = RawTelemetryPacket(
        device_id=dev_id,
        timestamp=now,
        gps=gps_data,
        temperature=temp_data,
        imu=imu_data,
        tamper_switch_closed=tamper_data,
        power_network=pwr_data
    )
    return await TelemetryService.process_and_broadcast_packet(packet)


@telemetry_router.post("/api/v1/telemetry/tamper", response_model=EnrichedTelemetryResponse)
@telemetry_router.post("/api/v1/telemetry/tamper/", response_model=EnrichedTelemetryResponse)
async def ingest_tamper_alert(req: TamperTelemetryRequest):
    """Instant trigger endpoint when enclosure microswitch or door opens."""
    dev_id = req.device_id
    is_closed = req.is_closed()

    latest = store.get_latest(dev_id)
    if latest:
        prev = latest.raw_telemetry
        gps_data = prev.gps
        temp_data = prev.temperature
        imu_data = prev.imu
        pwr_data = prev.power_network
    else:
        gps_data = GPSCoordinates()
        temp_data = TemperatureReading(cargo_temp_c=4.5)
        imu_data = IMUData()
        pwr_data = PowerAndNetwork()

    packet = RawTelemetryPacket(
        device_id=dev_id,
        timestamp=datetime.now(timezone.utc),
        gps=gps_data,
        temperature=temp_data,
        imu=imu_data,
        tamper_switch_closed=is_closed,
        power_network=pwr_data
    )
    from ...rules.rule_engine import DeterministicRuleEngine
    DeterministicRuleEngine._last_alert_times.pop(f"{dev_id}:ENCLOSURE_TAMPER_OPEN", None)
    return await TelemetryService.process_and_broadcast_packet(packet)


# ============================================================================
# EC200U HARDWARE COMPATIBILITY ROUTES
# ============================================================================

@telemetry_router.post("/")
@telemetry_router.post("/api/container/data")
@telemetry_router.post("/api/container/data/")
@telemetry_router.post("/data")
@telemetry_router.post("/data/")
async def ingest_ec200u_gateway_telemetry(request: Request):
    """
    Direct compatibility route for Quectel EC200U Gateway & IoT Trackers.
    Delegates to the unified ingestion handler.
    """
    return await ingest_hardware_telemetry(request)
