"""
==============================================================================
FILE: backend/api/routes/geofences.py
PURPOSE:
FastAPI Route Handlers for the Geofencing Subsystem.
Exposes CRUD APIs for boundary configuration and queries for geofence event audits.
==============================================================================
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, status

from ...schemas.geofence import GeofenceCreate, GeofenceUpdate, CreateCorridorFromTripRequest
from ...services.geofence_service import GeofenceService
from ...database.database import db_get_trip_details

geofences_router = APIRouter(tags=["Geofencing"])


@geofences_router.get("/api/v1/geofences")
async def list_geofences(
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    enabled_only: bool = Query(False, description="Filter only enabled geofences")
):
    """Lists all configured geofences in the system."""
    return GeofenceService.get_geofences(device_id=device_id, enabled_only=enabled_only)


@geofences_router.post("/api/v1/geofences", status_code=status.HTTP_201_CREATED)
async def create_geofence(payload: GeofenceCreate):
    """Creates a new Circle or Polygon Geofence boundary with rule configurations."""
    try:
        created = GeofenceService.create_geofence(payload.model_dump(mode="json"))
        return created
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create geofence: {str(e)}")


@geofences_router.get("/api/v1/geofences/{geofence_id}")
async def get_geofence_by_id(geofence_id: int):
    """Retrieves a single geofence definition by ID."""
    gf = GeofenceService.get_geofence(geofence_id)
    if not gf:
        raise HTTPException(status_code=404, detail=f"Geofence ID {geofence_id} not found.")
    return gf


@geofences_router.put("/api/v1/geofences/{geofence_id}")
async def update_geofence(geofence_id: int, payload: GeofenceUpdate):
    """Updates an existing geofence boundary or rule configuration."""
    update_data = payload.model_dump(exclude_unset=True, mode="json")
    updated = GeofenceService.update_geofence(geofence_id, update_data)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Geofence ID {geofence_id} not found.")
    return updated


@geofences_router.delete("/api/v1/geofences/{geofence_id}")
async def delete_geofence(geofence_id: int):
    """Deletes a geofence and its associated event log history."""
    success = GeofenceService.delete_geofence(geofence_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Geofence ID {geofence_id} not found.")
    return {"success": True, "message": f"Geofence {geofence_id} deleted successfully."}


@geofences_router.get("/api/v1/geofences/{geofence_id}/events")
async def get_geofence_events(
    geofence_id: int,
    limit: int = Query(50, ge=1, le=500)
):
    """Queries audit events (ENTER, EXIT, DWELL, SPEED, TEMP) recorded for a geofence."""
    return GeofenceService.get_events(geofence_id=geofence_id, limit=limit)


@geofences_router.get("/api/v1/devices/{device_id}/geofence-events")
async def get_device_geofence_events(
    device_id: str,
    limit: int = Query(50, ge=1, le=500)
):
    """Queries geofence audit events recorded for a specific device."""
    return GeofenceService.get_events(device_id=device_id, limit=limit)


@geofences_router.get("/api/v1/devices/{device_id}/geofence-status")
async def get_device_geofence_status(device_id: str):
    """Returns the latest evaluated state, inside/outside status, and boundary distances."""
    return {
        "device_id": device_id,
        "geofences": GeofenceService.get_latest_status(device_id)
    }


@geofences_router.get("/api/v1/trips/{device_id}/{trip_id}/geofences")
async def get_trip_geofences(device_id: str, trip_id: str):
    """Returns geofences associated with a specific vehicle and trip."""
    return GeofenceService.get_geofences(device_id=device_id, enabled_only=False)


@geofences_router.get("/api/v1/trips/{device_id}/{trip_id}/geofence-events")
async def get_trip_geofence_events(
    device_id: str,
    trip_id: str,
    limit: int = Query(50, ge=1, le=500)
):
    """Returns all geofence breaches and transition events captured during a trip session."""
    return GeofenceService.get_events(device_id=device_id, trip_id=trip_id, limit=limit)


@geofences_router.post("/api/v1/geofences/from-trip/{trip_id}", status_code=status.HTTP_201_CREATED)
async def create_corridor_from_trip(
    trip_id: str,
    payload: Optional[CreateCorridorFromTripRequest] = None
):
    """
    Creates a dynamic Route Corridor Geofence from a trip's actual GPS breadcrumbs/waypoints.
    Automatically generates centerline waypoints and a buffered route envelope.
    """
    details = db_get_trip_details(trip_id)
    if not details:
        raise HTTPException(status_code=404, detail=f"Trip '{trip_id}' not found.")

    raw_wps = details.get("waypoints") or []
    coords: List[List[float]] = []

    if len(raw_wps) >= 2:
        coords = [[float(w["lat"]), float(w["lng"])] for w in raw_wps]
    else:
        start_lat = details.get("start_lat")
        start_lng = details.get("start_lng")
        end_lat = details.get("end_lat")
        end_lng = details.get("end_lng")
        if start_lat and start_lng and end_lat and end_lng:
            coords = [[float(start_lat), float(start_lng)], [float(end_lat), float(end_lng)]]
        else:
            raise HTTPException(
                status_code=400,
                detail="Trip has insufficient GPS waypoints to generate a route corridor."
            )

    # Downsample if waypoints count is very high (> 100) while keeping endpoints
    if len(coords) > 100:
        step = max(1, len(coords) // 80)
        coords = [coords[0]] + coords[1:-1:step] + [coords[-1]]

    req = payload or CreateCorridorFromTripRequest()
    buffer_m = float(req.buffer_width_m or 500.0)
    name = req.name or f"Corridor - {details.get('trip_id')}"
    device_id = req.device_id or details.get("device_id") or "GW-001"

    gf_data = {
        "name": name,
        "device_id": device_id,
        "geometry": {
            "type": "CORRIDOR",
            "radius_m": buffer_m,
            "corridor_buffer_m": buffer_m,
            "coordinates": coords
        },
        "rules": {
            "enter": True,
            "exit": True,
            "dwell": False,
            "dwell_seconds": 300,
            "max_speed_kmh": req.max_speed_kmh,
            "temperature": {
                "enabled": (req.temp_min_c is not None or req.temp_max_c is not None),
                "min_c": req.temp_min_c,
                "max_c": req.temp_max_c
            }
        },
        "enabled": True
    }

    try:
        created = GeofenceService.create_geofence(gf_data)
        return created
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create corridor geofence: {str(e)}")

