"""
==============================================================================
FILE: main.py
PURPOSE:
Modular FastAPI Application Server for TracX / Smart CCMS.

KEY RESPONSIBILITIES:
1. App initialization and Lifespan hooks (startup & shutdown).
2. Registers modular API routers (telemetry, devices, trips, alerts, ai, websocket).
3. CORS and Anti-Cache middlewares.
4. Mounts frontend static web dashboard.
==============================================================================
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from .database import init_database
from .storage import store
from .simulator import simulator
from .api.websocket import websocket_router, manager
from .api.routes.telemetry import telemetry_router
from .api.routes.devices import devices_router
from .api.routes.trips import trips_router
from .api.routes.alerts import alerts_router
from .api.routes.ai import ai_router
from .api.routes.reports import reports_router
from .api.routes.geofences import geofences_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown hooks."""
    # 1. Initialize DB tables
    init_database()
    # 2. Restore persisted device states from SQLite into in-memory store
    store.restore_from_db()
    # 3. Register broadcast callback for simulator
    simulator.register_callback(manager.broadcast)
    # Simulator remains paused by default to prioritize real hardware telemetry
    simulator.is_running = False
    yield
    # Shutdown cleanup
    simulator.is_running = False


# Instantiate FastAPI Application
app = FastAPI(
    title="Smart CCMS Vehicle & Cold-Chain AI Platform",
    description="Modular IoT Telemetry, Deterministic Rule Engine, and AI Intelligence Suite",
    version="2.1.0",
    lifespan=lifespan
)

# Cross-Origin Resource Sharing (CORS) Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def normalize_api_trailing_slashes(request: Request, call_next):
    """
    Normalizes paths with trailing slashes so that IoT device telemetry POSTs
    (e.g., /api/v1/telemetry/, /api/telemetry/, /data/) correctly match API routes
    instead of falling through to the root StaticFiles mount (which yields 405 Method Not Allowed).
    """
    raw_path = request.scope.get("path", "")
    if len(raw_path) > 1 and raw_path.endswith("/"):
        request.scope["path"] = raw_path.rstrip("/")
    return await call_next(request)


@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    """Enforces no-cache headers for instant real-time telemetry updates."""
    response = await call_next(request)
    if request.url.path.endswith((".js", ".css", ".html")) or request.url.path == "/" or "/api/" in request.url.path:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


# ============================================================================
# REGISTER MODULAR ROUTERS
# ============================================================================
app.include_router(telemetry_router)
app.include_router(devices_router)
app.include_router(trips_router)
app.include_router(geofences_router)
app.include_router(alerts_router)
app.include_router(ai_router)
app.include_router(reports_router)
app.include_router(websocket_router)


# ============================================================================
# MOUNT FRONTEND (Production Build or Developer Fallback)
# ============================================================================
dist_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(dist_dir) and os.path.isdir(dist_dir):
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="frontend")
else:
    @app.get("/")
    async def index_root():
        """Root API status and developer routing guide."""
        return {
            "platform": "Smart CCMS Dual-Layer Fleet & Cold-Chain AI Platform",
            "version": "2.1.0",
            "status": "ONLINE",
            "docs": "/docs",
            "websocket": "/ws/telemetry",
            "frontend_dev_server": "http://localhost:3000",
            "message": "FastAPI backend active. In development mode, start the React TypeScript frontend with 'npm run dev' inside 'frontend' folder."
        }
