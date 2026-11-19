"""
Alert Management and Notification Channels API Routes.
"""

from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from ...storage import store
from ...notifications import notifications

alerts_router = APIRouter(tags=["Alerts & Notifications"])


class ChannelConfigRequest(BaseModel):
    webhook_url: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    whatsapp_api_url: Optional[str] = None
    whatsapp_token: Optional[str] = None
    alert_min_severity: Optional[str] = None


class ChannelTestRequest(BaseModel):
    channel: str  # 'telegram', 'webhook', 'whatsapp'
    device_id: Optional[str] = "TRX-1001"
    webhook_url: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    whatsapp_api_url: Optional[str] = None
    whatsapp_token: Optional[str] = None


# In-memory tracking of alert statuses (e.g., Acknowledged, Resolved, Active)
alert_statuses: dict = {}

# Canonical baseline alerts (empty by default; populated purely from live telemetry)
BENCHMARK_ALERTS = []


@alerts_router.get("/api/v1/alerts")
async def get_alerts(limit: int = 50):
    """Retrieves the recent stream of Layer-1 safety alerts and tamper warnings."""
    return store.get_recent_alerts(limit=limit)


@alerts_router.get("/api/v1/alerts/overview")
async def get_alerts_overview(
    gateway_id: Optional[str] = None,
    alert_type: Optional[str] = None,
    date_range: Optional[str] = "today"
):
    """
    Returns AI-classified alert overview with KPI metrics (Critical, Major, Minor, Acknowledged)
    and detailed incident table data.
    """
    items = []
    
    # 1. Start with benchmark alerts
    for b in BENCHMARK_ALERTS:
        item = dict(b)
        # Apply any overrides from status updates
        if item["alert_id"] in alert_statuses:
            item["status"] = alert_statuses[item["alert_id"]]
        items.append(item)

    # 2. Add any live alerts from store
    live_store_alerts = store.get_recent_alerts(limit=20)
    for idx, alt in enumerate(live_store_alerts):
        sev_label = "Critical" if alt.severity == "CRITICAL" else ("High" if alt.severity == "WARNING" else "Medium")
        alt_status = alert_statuses.get(alt.alert_id, "Active")
        items.insert(0, {
            "id": idx + 10,
            "alert_id": alt.alert_id,
            "time": alt.timestamp.strftime("%H:%M") if hasattr(alt.timestamp, "strftime") else "Live",
            "gateway_id": getattr(alt, "device_id", "GW-001"),
            "alert_type": "Tamper" if "TAMPER" in alt.rule_name else ("Temperature" if "TEMP" in alt.rule_name else alt.rule_name),
            "message": alt.message,
            "severity": sev_label,
            "ai_analysis": "Live telemetry rule breach",
            "status": alt_status
        })

    # 3. Apply filters
    filtered = items
    if gateway_id and gateway_id != "ALL":
        filtered = [a for a in filtered if a["gateway_id"].upper() == gateway_id.upper()]
    if alert_type and alert_type != "ALL":
        filtered = [a for a in filtered if alert_type.lower() in a["alert_type"].lower()]

    # 4. Compute KPI counts from actual active and recorded alerts
    crit_count = sum(1 for a in items if a.get("severity") in ["Critical", "CRITICAL"] and a.get("status") == "Active")
    major_count = sum(1 for a in items if a.get("severity") in ["High", "Major", "WARNING"] and a.get("status") == "Active")
    minor_count = sum(1 for a in items if a.get("severity") in ["Medium", "Minor", "INFO"] and a.get("status") == "Active")
    ack_count = sum(1 for a in items if a.get("status") in ["Acknowledged", "Resolved"])

    return {
        "success": True,
        "counts": {
            "critical": crit_count,
            "major": major_count,
            "minor": minor_count,
            "acknowledged": ack_count
        },
        "alerts": filtered
    }


class AlertStatusUpdate(BaseModel):
    status: str  # 'Active', 'Acknowledged', 'Resolved'


@alerts_router.post("/api/v1/alerts/{alert_id}/status")
async def update_alert_status(alert_id: str, req: AlertStatusUpdate):
    """Updates status for an alert item (e.g. Acknowledged, Resolved, Active)."""
    alert_statuses[alert_id] = req.status
    return {"status": "ok", "alert_id": alert_id, "new_status": req.status}


@alerts_router.post("/api/v1/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    """Acknowledges an active incident."""
    alert_statuses[alert_id] = "Acknowledged"
    return {"status": "ok", "alert_id": alert_id, "acknowledged": True, "new_status": "Acknowledged"}


@alerts_router.get("/api/v1/channels/config")
async def get_notification_channels():
    """Retrieves current multi-channel alert setup (tokens masked for security)."""
    return notifications.get_config()


@alerts_router.post("/api/v1/channels/config")
async def save_notification_channels(req: ChannelConfigRequest):
    """Saves persistent credentials for Telegram Bot, Webhooks, and WhatsApp in SQLite DB."""
    notifications.update_config(req.model_dump(exclude_unset=True))
    return {
        "status": "ok",
        "message": "Notification channels updated and persisted successfully.",
        "config": notifications.get_config()
    }


@alerts_router.post("/api/v1/channels/test")
async def test_notification_channel(req: ChannelTestRequest):
    """Triggers an instant live test alert across a specified channel to verify connectivity."""
    params = req.model_dump(exclude_unset=True)
    res = await notifications.test_channel(req.channel, params)
    return res
