"""
Resilient Tunnel Watchdog for Smart CCMS (https://smart-ccms.loca.lt).
Continuously maintains the localtunnel connection to port 8000.
Ensures ONLY https://smart-ccms.loca.lt is used. If loca.lt assigns a random domain
or drops the connection, it retries until https://smart-ccms.loca.lt is active.
"""
import subprocess
import time
import urllib.request
import sys
import os

PORT = 8000
SUBDOMAIN = "smart-ccms"
TARGET_URL = f"https://{SUBDOMAIN}.loca.lt"
HEALTH_URL = f"{TARGET_URL}/api/v1/telemetry"

def check_health() -> bool:
    try:
        req = urllib.request.Request(
            HEALTH_URL,
            headers={
                "User-Agent": "TunnelHealthCheck/1.0",
                "Bypass-Tunnel-Reminder": "true"
            }
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status == 200
    except Exception:
        return False

def run_tunnel():
    print(f"🚀 Launching persistent tunnel supervisor on port {PORT} for '{SUBDOMAIN}'...", flush=True)
    consecutive_failures = 0
    while True:
        cmd = ["npx", "-y", "localtunnel", "--port", str(PORT), "--subdomain", SUBDOMAIN, "--print-requests"]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        print(f"✅ Tunnel client launched (PID {proc.pid})", flush=True)
        
        last_check = time.time()
        tunnel_assigned_correctly = False
        
        while proc.poll() is None:
            line = proc.stdout.readline()
            if line:
                line_str = line.strip()
                print(f"[tunnel] {line_str}", flush=True)
                
                if "your url is:" in line_str:
                    if SUBDOMAIN in line_str:
                        print(f"🎯 Successfully bound designated subdomain: {TARGET_URL}", flush=True)
                        tunnel_assigned_correctly = True
                        consecutive_failures = 0
                    else:
                        print(f"❌ Received incorrect subdomain ({line_str}). Re-attempting '{SUBDOMAIN}' in 3s...", flush=True)
                        proc.terminate()
                        try:
                            proc.wait(timeout=5)
                        except subprocess.TimeoutExpired:
                            proc.kill()
                        time.sleep(3)
                        break

            # If properly assigned, health check every 30 seconds
            if tunnel_assigned_correctly and (time.time() - last_check > 30):
                last_check = time.time()
                if check_health():
                    consecutive_failures = 0
                else:
                    consecutive_failures += 1
                    print(f"⚠️ Tunnel check missed ({consecutive_failures}/3)...", flush=True)
                    if consecutive_failures >= 3:
                        print("🔄 Subdomain unresponsive. Cycling localtunnel...", flush=True)
                        proc.terminate()
                        try:
                            proc.wait(timeout=5)
                        except subprocess.TimeoutExpired:
                            proc.kill()
                        time.sleep(3)
                        break
            time.sleep(0.5)

        time.sleep(2)

if __name__ == "__main__":
    run_tunnel()
