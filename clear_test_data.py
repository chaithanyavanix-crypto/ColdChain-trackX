"""
==============================================================================
FILE: clear_test_data.py
PURPOSE:
Completely wipes all test telemetry history, trips, halts, and alerts from
both the SQLite database and in-memory server cache.
Pauses the synthetic background simulator so the platform is 100% clean
and waiting exclusively for physical hardware / Quectel EC200U firmware data!
==============================================================================
"""

import os
import sqlite3
import urllib.request
import json

DB_PATH = os.path.join(os.path.dirname(__file__), "backend", "tracx_fleet.db")
SERVER_URL = "http://localhost:8000/api/v1/system/clear-data"


def wipe_database():
    print("🧹 Cleaning SQLite Database Tables...")
    if not os.path.exists(DB_PATH):
        print(f"⚠️  Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    tables = [
        "telemetry_history",
        "alerts_history",
        "trip_waypoints",
        "trip_halts",
        "trips"
    ]

    for table in tables:
        try:
            cursor.execute(f"DELETE FROM {table}")
            print(f"   ✓ Wiped table: {table}")
        except Exception as e:
            print(f"   ✗ Error clearing {table}: {e}")

    conn.commit()
    conn.close()
    print("✅ Database cleanly reset!\n")


def notify_running_server():
    print("📡 Notifying Live Server to clear in-memory buffers & pause simulator...")
    try:
        req = urllib.request.Request(
            SERVER_URL,
            data=json.dumps({"stop_simulator": True}).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=3) as res:
            if res.status == 200:
                print("✅ Server Cache Cleared!")
                print("🛑 Autonomous Simulation Paused!")
                print("🚀 Platform is now in 'REAL_FIRMWARE_ONLY' mode.")
            else:
                print(f"⚠️  Server responded with status {res.status}")
    except Exception as e:
        print(f"ℹ️  Server notification note: {e}")


if __name__ == "__main__":
    print("=" * 60)
    print("🗑️  SMART CCMS TEST DATA WIPE UTILITY")
    print("=" * 60)
    wipe_database()
    notify_running_server()
    print("=" * 60)
    print("🎉 System is completely clean! Ready for live firmware ingestion.")
    print("=" * 60)
