@echo off
title TracX Permanent Ngrok Tunnel
echo ========================================================
echo Starting Permanent Ngrok Tunnel for TracX Backend (Port 8000)...
echo Domain: https://tipper-compost-fantasize.ngrok-free.dev
echo ========================================================
ngrok.exe http 8000 --url https://tipper-compost-fantasize.ngrok-free.dev
pause
