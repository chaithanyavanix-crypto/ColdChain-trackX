@echo off
title TracX Public Telemetry Tunnel
echo ====================================================================
echo  Creating Public HTTPS Tunnel for TracX Telemetry (Port 8000)
echo ====================================================================
echo.
echo Make sure your backend is running on http://localhost:8000 first!
echo (You can run 'run_backend.bat' in another terminal window)
echo.
echo Choose your preferred public tunnel provider:
echo  [1] OpenSSH Tunnel (Built-in Windows SSH, No download needed)
echo  [2] Pinggy Tunnel (Built-in Windows SSH, No download needed)
echo  [3] Cloudflare Tunnel (Requires cloudflared)
echo  [4] Localtunnel (via bunx localtunnel)
echo.

set /p choice="Enter choice [1-4] (default 1): "
if "%choice%"=="" set choice=1

if "%choice%"=="1" (
    echo.
    echo Starting OpenSSH Tunnel to localhost.run...
    echo Your public HTTPS URL will appear below (copy the https://... url):
    echo.
    ssh -o StrictHostKeyChecking=no -R 80:localhost:8000 nokey@localhost.run
)

if "%choice%"=="2" (
    echo.
    echo Starting Pinggy Tunnel...
    echo Your public HTTPS URL will appear below:
    echo.
    ssh -o StrictHostKeyChecking=no -p 443 -R0:localhost:8000 a.pinggy.io
)

if "%choice%"=="3" (
    echo.
    where cloudflared >nul 2>nul
    if %errorlevel% neq 0 (
        echo cloudflared not found. Installing via winget...
        winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
    )
    echo Starting Cloudflare Tunnel...
    cloudflared tunnel --url http://localhost:8000
)

if "%choice%"=="4" (
    echo.
    echo Starting Localtunnel on port 8000...
    bunx localtunnel --port 8000 --subdomain smart-ccms
)

pause
