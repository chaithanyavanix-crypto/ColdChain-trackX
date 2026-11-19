"""
==============================================================================
FILE: run_tracx.py
PURPOSE:
Master launcher script for the TracX Platform.
Boots the FastAPI ASGI server using Uvicorn on port 8000.
==============================================================================
"""

import uvicorn
import os
import sys

# Ensure the parent directory is in Python's module search path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

if __name__ == "__main__":
    print("=" * 65)
    print("🚀 Starting Smart CCMS Dual-Layer AI Fleet & Cold-Chain Platform")
    print("📡 Ingestion Endpoints (Universal POST & GET support):")
    print("   • Primary API:    https://smart-ccms.loca.lt/api/v1/telemetry")
    print("   • Alias Route:    https://smart-ccms.loca.lt/api/telemetry")
    print("   • Data Route:     https://smart-ccms.loca.lt/data")
    print("   • Local Endpoint: http://localhost:8000/api/v1/telemetry")
    print("🌐 Frontend App:     http://localhost:3000/ (React TypeScript Dev Server)")
    print("🌐 Backend API:      http://localhost:8000/ (FastAPI & WebSocket Core)")
    print("=" * 65)
    
    # Run Uvicorn ASGI server with reload=True for auto-detecting code updates
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
