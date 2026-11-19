"""
==============================================================================
FILE: stream_user_path.py
PURPOSE:
Simulates live real-time vehicle movement along the user's 108 GPS waypoints.
Transmits telemetry packets to the backend via POST /api/v1/telemetry
every 1-2 seconds, allowing operators to watch the live truck marker drive
down this exact Hyderabad route in real time on the Live Telemetry & Overview maps!
==============================================================================
"""

import time
import requests
import math
from datetime import datetime

API_URL = "http://localhost:8000/api/v1/telemetry"
DEVICE_ID = "TRX-1001"

from import_user_trip import RAW_POINTS, haversine_km, calculate_bearing

def stream_live_route(delay_sec=1.5):
    print(f"🚀 Starting Real-Time GPS simulation along user's 108 waypoints for {DEVICE_ID}...")
    print(f"   Destination: {API_URL}")
    print(f"   Interval: {delay_sec}s per waypoint (Ctrl+C to stop)\n")

    current_temp = 4.30

    for i in range(len(RAW_POINTS)):
        idx, lat, lng = RAW_POINTS[i]

        if i < len(RAW_POINTS) - 1:
            next_idx, next_lat, next_lng = RAW_POINTS[i + 1]
            bearing = calculate_bearing(lat, lng, next_lat, next_lng)
        else:
            prev_idx, prev_lat, prev_lng = RAW_POINTS[i - 1]
            bearing = calculate_bearing(prev_lat, prev_lng, lat, lng)

        # Dynamic speed calculation
        if i < 8:
            speed = 20.0 + (i * 2.5)
        elif 8 <= i < 70:
            speed = 38.0 + 8.0 * math.sin(i * 0.2)
        elif 70 <= i <= 74:
            speed = max(0.0, 30.0 - (i - 70) * 7.5)
        elif i == 74:
            speed = 0.0
        elif 75 <= i < 82:
            speed = 15.0 + (i - 75) * 3.5
        else:
            speed = 40.0 + 6.0 * math.sin(i * 0.25)

        speed = round(speed, 1)

        # Mild temperature variation
        current_temp += 0.015 * math.cos(i * 0.4)
        current_temp = round(max(4.15, min(4.75, current_temp)), 2)

        payload = {
            "device_id": DEVICE_ID,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "gps": {
                "lat": lat,
                "lng": lng,
                "speed_kmh": speed,
                "heading_deg": round(bearing, 1),
                "altitude_m": 540.0,
                "satellites_count": 10,
                "fix_status": "3D_FIX"
            },
            "temperature": {
                "cargo_temp_c": current_temp,
                "ambient_temp_c": 28.5,
                "probe_connected": True
            },
            "tamper_switch_closed": True
        }

        try:
            res = requests.post(API_URL, json=payload, timeout=2.0)
            if res.status_code == 200:
                print(f"[{idx:3d}/108] LAT: {lat:.6f}, LNG: {lng:.6f} | Speed: {speed:4.1f} km/h | Heading: {bearing:5.1f}° | Temp: {current_temp}°C ✅")
            else:
                print(f"[{idx:3d}/108] Error: HTTP {res.status_code}")
        except Exception as e:
            print(f"[{idx:3d}/108] Network error: {e}")

        time.sleep(delay_sec)

    print("\n🏁 Real-time route playback finished successfully!")

if __name__ == "__main__":
    stream_live_route(delay_sec=1.0)
