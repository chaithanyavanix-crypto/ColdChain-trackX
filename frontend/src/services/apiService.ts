/**
 * TracX Cold-Chain Platform - Backend API & WebSocket Service
 * Provides robust communication with FastAPI backend (http://localhost:8000)
 * with automatic fallback, reconnect logic, and full type safety.
 */

import { AlertState, ConditionStatus, ConnectivityStatus, VehicleGateway } from '../types/coldchain';

const envApiBase = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
const API_BASE = envApiBase ? envApiBase.replace(/\/+$/, '') : '';

// Generic safe fetch with timeout
async function safeFetch<T>(url: string, options?: RequestInit, timeoutMs = 5000): Promise<T | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(options?.headers || {}),
      },
    });
    clearTimeout(id);
    if (!res.ok) {
      console.warn(`[API] ${options?.method || 'GET'} ${url} returned status ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    clearTimeout(id);
    // Silent fail to allow graceful fallback to offline/mock data
    return null;
  }
}

export interface BackendFleetOverview {
  kpis?: {
    total_vehicles: number;
    in_transit: number;
    at_stop: number;
    offline: number;
    active_alerts: number;
    critical_alerts: number;
    fleet_health_score: number;
    fleet_health_rating: string;
    healthy_count: number;
  };
  fleet_rows?: Array<{
    device_id: string;
    vehicle_name: string;
    driver_name?: string;
    imei?: string;
    imsi?: string;
    cargo_type: string;
    target_min_c: number;
    target_max_c: number;
    current_temp_c: number | null;
    connectivity: string;
    operational_state: string;
    security: string;
    status: string;
    health_score: number;
    health_rating: string;
    last_seen_sec: number | null;
    last_seen_str: string;
    speed_kmh: number;
    lat: number | null;
    lng: number | null;
  }>;
  recent_alerts?: Array<{
    time: string;
    gateway: string;
    alert_type: string;
    message: string;
    severity: string;
  }>;
}

export interface BackendAlertItem {
  id: number | string;
  alert_id: string;
  time: string;
  gateway_id: string;
  alert_type: string;
  message: string;
  severity: string;
  ai_analysis?: string;
  status: string;
}

export interface BackendAlertsResponse {
  success: boolean;
  counts: {
    critical: number;
    major: number;
    minor: number;
    acknowledged: number;
  };
  alerts: BackendAlertItem[];
}

export interface TelemetryPacket {
  packet_id?: string;
  device_id: string;
  timestamp?: string;
  temperature?: {
    cargo_temp_c?: number;
    ambient_temp_c?: number;
    probe_status?: string;
  };
  gps?: {
    lat?: number;
    lng?: number;
    speed_kmh?: number;
    heading_deg?: number;
    fix_quality?: string;
    satellites?: number;
  };
  imu?: {
    shock_g?: number;
    is_crash_risk?: boolean;
  };
  power?: {
    battery_pct?: number;
    rssi_dbm?: number;
  };
  safety_status?: {
    is_safe?: boolean;
    active_rules_triggered?: string[];
  };
  ai_intelligence?: {
    predictive_temperature?: {
      predicted_temp_15m?: number;
      predicted_temp_30m?: number;
      excursion_risk_pct?: number;
    };
    driver_behavior?: {
      safety_score?: number;
    };
  };
  raw_payload?: {
    temperature?: number;
    latitude?: number;
    longitude?: number;
    speed_kmh?: number;
    door_status?: string;
    tamper?: boolean;
    network_rssi?: number;
    battery_pct?: number;
  };
}

export const apiService = {
  // Fleet & Devices
  async getFleetOverview(): Promise<BackendFleetOverview | null> {
    return safeFetch<BackendFleetOverview>(`${API_BASE}/api/v1/fleet/overview`);
  },

  async getDevices(): Promise<any[] | null> {
    return safeFetch<any[]>(`${API_BASE}/api/v1/devices`);
  },

  async registerDevice(data: {
    device_id: string;
    vehicle_name: string;
    driver_name?: string;
    imei?: string;
    imsi?: string;
    cargo_type: string;
    target_min_c: number;
    target_max_c: number;
    sampling_interval_sec?: number;
    imei?: string;
    is_active?: boolean;
  }): Promise<boolean> {
    const res = await safeFetch<any>(`${API_BASE}/api/v1/devices`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res !== null;
  },

  // Alerts
  async getAlerts(gatewayId?: string, alertType?: string): Promise<BackendAlertsResponse | null> {
    const params = new URLSearchParams();
    if (gatewayId && gatewayId !== 'All') params.set('gateway_id', gatewayId);
    if (alertType && alertType !== 'All') params.set('alert_type', alertType);
    return safeFetch<BackendAlertsResponse>(`${API_BASE}/api/v1/alerts/overview?${params.toString()}`);
  },

  async updateAlertStatus(alertId: string, status: AlertState): Promise<boolean> {
    const res = await safeFetch<any>(`${API_BASE}/api/v1/alerts/${encodeURIComponent(alertId)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    return res !== null;
  },

  // Trips
  async getTrips(deviceId?: string): Promise<any[] | null> {
    const url = deviceId ? `${API_BASE}/api/v1/trips/${encodeURIComponent(deviceId)}` : `${API_BASE}/api/v1/trips`;
    return safeFetch<any[]>(url);
  },

  async getTripDetails(tripId: string): Promise<any | null> {
    return safeFetch<any>(`${API_BASE}/api/v1/trips/details/${encodeURIComponent(tripId)}`);
  },

  // Geofences
  async getGeofences(): Promise<any[] | null> {
    return safeFetch<any[]>(`${API_BASE}/api/v1/geofences`);
  },

  async createGeofence(data: any): Promise<any | null> {
    return safeFetch<any>(`${API_BASE}/api/v1/geofences`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateGeofence(id: string | number, data: any): Promise<any | null> {
    return safeFetch<any>(`${API_BASE}/api/v1/geofences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteGeofence(id: string | number): Promise<boolean> {
    const res = await safeFetch<any>(`${API_BASE}/api/v1/geofences/${id}`, {
      method: 'DELETE',
    });
    return res !== null;
  },

  // Device Configuration Updates (Vehicle Plate, Driver, Cargo, Thresholds, IMEI, IMSI)
  async updateDevice(
    deviceId: string,
    updates: {
      vehicle_name?: string;
      driver_name?: string;
      cargo_type?: string;
      target_min_c?: number;
      target_max_c?: number;
      sampling_interval_sec?: number;
      imei?: string;
      imsi?: string;
    }
  ): Promise<boolean> {
    const res = await safeFetch<any>(`${API_BASE}/api/v1/devices/${encodeURIComponent(deviceId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return res !== null;
  },

  // Hardware Simulation / Fault Injection
  async triggerSimulationAction(
    deviceId: string,
    action: 'temp_spike' | 'tamper' | 'harsh_brake' | 'crash' | 'gps_loss' | 'gps_jump' | 'power_loss' | 'reset'
  ): Promise<boolean> {
    const res = await safeFetch<any>(`${API_BASE}/api/v1/simulate/action`, {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId, action }),
    });
    return res !== null;
  },

  // Real-time WebSocket Subscription
  subscribeTelemetry(callbacks: {
    onTelemetryPacket: (packet: TelemetryPacket) => void;
    onStatusChange?: (connected: boolean) => void;
  }): () => void {
    let ws: WebSocket | null = null;
    let shouldReconnect = true;
    let reconnectTimeout: any = null;

    const connect = () => {
      try {
        let wsUrl: string;
        const envWsBase = (import.meta.env.VITE_WS_BASE as string | undefined)?.trim();
        if (envWsBase) {
          wsUrl = `${envWsBase.replace(/\/+$/, '')}/ws/telemetry`;
        } else if (envApiBase) {
          const wsProto = envApiBase.startsWith('https') ? 'wss:' : 'ws:';
          const cleanHost = envApiBase.replace(/^https?:\/\//, '').replace(/\/+$/, '');
          wsUrl = `${wsProto}//${cleanHost}/ws/telemetry`;
        } else {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const host = window.location.host;
          wsUrl = `${protocol}//${host}/ws/telemetry`;
        }

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          callbacks.onStatusChange?.(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'INITIAL_FLEET_STATE' && Array.isArray(data.data)) {
              data.data.forEach((pkt: any) => callbacks.onTelemetryPacket(pkt));
            } else if (data.device_id) {
              callbacks.onTelemetryPacket(data as TelemetryPacket);
            }
          } catch (e) {
            // Ignore non-json packets
          }
        };

        ws.onclose = () => {
          callbacks.onStatusChange?.(false);
          if (shouldReconnect) {
            reconnectTimeout = setTimeout(connect, 4000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch (err) {
        if (shouldReconnect) {
          reconnectTimeout = setTimeout(connect, 4000);
        }
      }
    };

    connect();

    return () => {
      shouldReconnect = false;
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  },
};
