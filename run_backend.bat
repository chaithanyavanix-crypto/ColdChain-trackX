@echo off
title TracX FastAPI Backend
echo Starting TracX FastAPI Backend on http://localhost:8000 ...
call .venv\Scripts\activate.bat
python run_tracx.py
pause
