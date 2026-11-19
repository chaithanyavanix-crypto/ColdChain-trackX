"""
AI Simulation and System Test Management API Routes.
"""

import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ...simulator import simulator
from ...storage import store
from ...database import db_clear_all_telemetry_and_trips
from ...trip_engine import trip_engine
from ..websocket import manager
from ...ai.ai_engine import AIEngine
from ...schemas.telemetry import RawTelemetryPacket

ai_router = APIRouter(tags=["AI & System Control"])
router = ai_router



class SimulationActionRequest(BaseModel):
    device_id: str
    action: str  # 'temp_spike', 'tamper', 'harsh_brake', 'crash', 'gps_loss', 'gps_jump', 'power_loss', 'reset'


@ai_router.post("/api/v1/simulate/action")
async def trigger_simulation_action(req: SimulationActionRequest):
    """Allows operators to inject real-world faults on demand to test AI models live."""
    dev_id = req.device_id
    act = req.action

    if act == "temp_spike":
        simulator.trigger_door_open_temp_spike(dev_id)
        msg = f"Injected Rapid Temperature Warming (Reefer Failure / Cargo Door Open) on {dev_id}"
    elif act == "tamper":
        simulator.trigger_tamper(dev_id)
        msg = f"Injected Physical Enclosure Tamper Breach on {dev_id}"
    elif act == "harsh_brake":
        simulator.trigger_harsh_event(dev_id, "HARSH_BRAKE")
        msg = f"Injected Harsh Braking Event (-0.65g) on {dev_id}"
    elif act == "aggressive_corner":
        simulator.trigger_harsh_event(dev_id, "AGGRESSIVE_CORNER")
        msg = f"Injected Aggressive High-Speed Cornering on {dev_id}"
    elif act == "crash":
        simulator.trigger_harsh_event(dev_id, "CRASH_IMPACT")
        msg = f"Injected Severe Crash Shock (>3.0g) on {dev_id}"
    elif act == "gps_loss":
        simulator.trigger_gps_tunnel_loss(dev_id, enabled=True)
        msg = f"Injected GNSS Signal Loss (Tunnel / Basement) -> Dead Reckoning Active on {dev_id}"
    elif act == "gps_jump":
        simulator.trigger_gps_spoof_jump(dev_id, enabled=True)
        msg = f"Injected Kinematic GPS Teleport Anomaly on {dev_id}"
    elif act == "power_loss":
        simulator.trigger_power_loss(dev_id)
        msg = f"Injected Main Vehicle Power Disconnect on {dev_id}"
    elif act == "reset":
        simulator.reset_vehicle(dev_id)
        msg = f"Reset all sensors and parameters to normal for {dev_id}"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {act}")

    await simulator.step_and_broadcast()
    return {"status": "ok", "message": msg}


@ai_router.post("/api/v1/system/clear-data")
async def clear_all_test_data(stop_simulator: bool = True):
    """
    Wipes all test telemetry, trips, and alerts from both database and memory.
    Pauses synthetic simulator so only real incoming firmware data is captured.
    """
    if stop_simulator:
        simulator.pause()

    db_clear_all_telemetry_and_trips()
    store.clear_all()
    trip_engine.active_contexts.clear()

    await manager.broadcast({
        "type": "SYSTEM_DATA_CLEARED",
        "message": "All test telemetry wiped. Ready for real firmware data.",
        "simulator_running": simulator.is_running
    })

    return {
        "status": "ok",
        "message": "All test telemetry, trips, and alerts cleared successfully.",
        "simulator_running": simulator.is_running,
        "mode": "REAL_FIRMWARE_ONLY"
    }


@ai_router.post("/api/v1/system/simulator-toggle")
async def toggle_simulator_mode(enable: bool = True):
    """Toggles the synthetic simulator on or off."""
    if enable:
        if not simulator.is_running:
            simulator.resume()
            asyncio.create_task(simulator.run_loop())
    else:
        simulator.pause()

    return {
        "status": "ok",
        "simulator_running": simulator.is_running,
        "mode": "SYNTHETIC_SIMULATION" if simulator.is_running else "REAL_FIRMWARE_ONLY"
    }


# ============================================================================
# AI ENGINE REST API ENDPOINTS
# ============================================================================

@ai_router.post("/api/v1/ai/evaluate")
@ai_router.post("/evaluate")
def evaluate_ai(packet: RawTelemetryPacket):
    """
    Run the complete TracX AI pipeline for a telemetry packet.
    """
    try:
        result = AIEngine.evaluate(packet)
        return {
            "success": True,
            "data": result,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AI evaluation failed: {str(exc)}",
        )


@ai_router.get("/api/v1/ai/{device_id}/latest")
@ai_router.get("/{device_id}/latest")
def get_latest_ai(device_id: str):
    """
    Return the latest AI evaluation for a device.
    """
    latest = store.get_latest(device_id)
    if latest:
        packet = latest.raw_telemetry
    else:
        history = store.get_history(device_id, limit=1)
        if not history:
            raise HTTPException(
                status_code=404,
                detail="No telemetry found for device",
            )
        packet = history[-1].raw_telemetry
    try:
        result = AIEngine.evaluate(packet)
        return {
            "success": True,
            "data": result,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AI evaluation failed: {str(exc)}",
        )


@ai_router.get("/api/v1/ai/{device_id}/recommendations")
@ai_router.get("/{device_id}/recommendations")
def get_ai_recommendations(device_id: str):
    """
    Return AI recommendations for the latest telemetry.
    """
    latest = store.get_latest(device_id)
    if latest:
        packet = latest.raw_telemetry
    else:
        history = store.get_history(device_id, limit=1)
        if not history:
            raise HTTPException(
                status_code=404,
                detail="No telemetry found for device",
            )
        packet = history[-1].raw_telemetry
    try:
        result = AIEngine.evaluate(packet)
        return {
            "success": True,
            "device_id": device_id,
            "recommendations": result.get(
                "recommendations",
                []
            ),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to generate recommendations: {str(exc)}",
        )


@ai_router.get("/api/v1/ai/{device_id}/risk")
@ai_router.get("/{device_id}/risk")
def get_ai_risk(device_id: str):
    """
    Return the overall AI risk assessment.
    """
    latest = store.get_latest(device_id)
    if latest:
        packet = latest.raw_telemetry
    else:
        history = store.get_history(device_id, limit=1)
        if not history:
            raise HTTPException(
                status_code=404,
                detail="No telemetry found for device",
            )
        packet = history[-1].raw_telemetry
    try:
        result = AIEngine.evaluate(packet)
        return {
            "success": True,
            "device_id": device_id,
            "risk": result.get(
                "risk_fusion",
                {}
            ),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to calculate AI risk: {str(exc)}",
        )


@ai_router.get("/api/v1/ai/{device_id}/health")
@ai_router.get("/{device_id}/health")
def get_ai_health(device_id: str):
    """
    Return predictive device health.
    """
    latest = store.get_latest(device_id)
    if latest:
        packet = latest.raw_telemetry
    else:
        history = store.get_history(device_id, limit=20)
        if not history:
            raise HTTPException(
                status_code=404,
                detail="No telemetry found for device",
            )
        packet = history[-1].raw_telemetry
    try:
        result = AIEngine.evaluate(packet)
        return {
            "success": True,
            "device_id": device_id,
            "health": result.get(
                "device_health",
                {}
            ),
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to calculate device health: {str(exc)}",
        )

