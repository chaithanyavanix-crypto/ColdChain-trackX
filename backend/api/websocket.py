"""
WebSocket Connection Manager and real-time streaming endpoint.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging

from ..storage import store

logger = logging.getLogger("tracx.websocket")
websocket_router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    """Tracks and broadcasts telemetry to all active connected browser clients."""
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        """Pushes serialized telemetry JSON to every connected browser client."""
        stale_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Error broadcasting to WebSocket client: {e}")
                stale_connections.append(connection)

        # Clean up dropped sockets
        for dead_socket in stale_connections:
            self.disconnect(dead_socket)


# Global connection manager instance
manager = ConnectionManager()


@websocket_router.websocket("/ws/telemetry")
async def websocket_telemetry_stream(websocket: WebSocket):
    """
    Real-time streaming channel for browsers to receive live telemetry and AI predictions.
    """
    await manager.connect(websocket)
    try:
        initial_states = []
        for s in store.get_all_latest():
            item_dict = s.model_dump(mode="json")
            item_dict["raw_payload"] = store.get_raw_payload(s.device_id)
            initial_states.append(item_dict)
        await websocket.send_json({"type": "INITIAL_FLEET_STATE", "data": initial_states})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
