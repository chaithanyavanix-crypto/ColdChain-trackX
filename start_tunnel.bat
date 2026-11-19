@echo off
title TracX Public Cloudflare Tunnel
echo =======================================================
echo Starting Cloudflare Tunnel for TracX Local Backend...
echo Local Backend Port: 8000
echo =======================================================
cloudflared.exe tunnel --url http://127.0.0.1:8000
pause
