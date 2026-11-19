from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from ...database import db_get_vehicle_trips, db_get_trip_details
from ...trip_engine import trip_engine

trips_router = APIRouter(tags=["Trips"])




from ...database import db_get_vehicle_trips, db_get_trip_details, get_db_connection


@trips_router.get("/api/v1/trips")
async def get_all_trips(device_id: Optional[str] = None, limit: int = 50):
    """Lists all active and historical trips across the fleet or filtered by device."""
    if device_id:
        return db_get_vehicle_trips(device_id, limit=limit)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM trips ORDER BY start_time DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        return []


@trips_router.get("/api/v1/trips/details/{trip_id}")
async def get_trip_details_direct(trip_id: str):
    """Retrieves full trip record, stoppage halts, and waypoints for route replay."""
    details = db_get_trip_details(trip_id)
    if not details:
        raise HTTPException(status_code=404, detail=f"Trip '{trip_id}' not found.")
    return details


@trips_router.get("/api/v1/trips/{device_id}")
async def get_device_trips(device_id: str, limit: int = 30):
    """Lists active and historical trips segmented by inactivity rules."""
    trips = db_get_vehicle_trips(device_id, limit=limit)
    return trips


@trips_router.get("/api/v1/trips/{device_id}/{trip_id}")
async def get_trip_details(device_id: str, trip_id: str):
    """Retrieves full trip record, stoppage halts, and waypoints for route replay."""
    details = db_get_trip_details(trip_id)
    if not details:
        raise HTTPException(status_code=404, detail=f"Trip '{trip_id}' not found.")
    return details


@trips_router.get("/api/v1/trips/{device_id}/{trip_id}/export")
async def export_gdp_report(device_id: str, trip_id: str):
    """Generates an official Good Distribution Practice (GDP) Cold-Chain Audit Certificate."""
    report = trip_engine.generate_gdp_inspection_report(trip_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Trip '{trip_id}' not found.")
    return report
