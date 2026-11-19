@echo off
title TracX Full-Stack Platform Launcher
echo ==============================================================
echo 🚀 Launching TracX Dual-Layer Cold-Chain Platform
echo ==============================================================
echo Starting FastAPI Backend on http://localhost:8000 ...
start "TracX Backend (FastAPI)" cmd /k "call .venv\Scripts\activate.bat && python run_tracx.py"

timeout /t 2 /nobreak >nul

echo Starting React TypeScript Frontend on http://localhost:3000 ...
start "TracX Frontend (Vite)" cmd /k "cd frontend && bun run dev"

echo ==============================================================
echo ✅ Both services launched!
echo • Dashboard UI: http://localhost:3000
echo • Backend API:  http://localhost:8000
echo • Swagger Docs: http://localhost:8000/docs
echo ==============================================================
