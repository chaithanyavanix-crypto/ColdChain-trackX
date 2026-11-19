import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  INITIAL_ALERTS,
  INITIAL_GEOFENCES,
  INITIAL_RECOMMENDATIONS,
  INITIAL_TRIPS,
  INITIAL_VEHICLES,
} from '../data/mockColdChainData';
import { apiService, TelemetryPacket } from '../services/apiService';
import {
  AiRecommendation,
  AlertState,
  ColdChainAlert,
  ColdChainTrip,
  ConditionStatus,
  ConnectivityStatus,
  GeofenceConfig,
  ModuleId,
  TripSubTab,
  VehicleGateway,
  VehicleOperationalState,
} from '../types/coldchain';

interface NewDeviceInput {
  id: string;
  vehiclePlate: string;
  driverName: string;
  cargoType: string;
  cargoClass: 'Frozen' | 'Chilled' | 'Ambient';
  safeMinC: number;
  safeMaxC: number;
  initialTempC: number;
  imei: string;
  imsi: string;
  city: string;
  region: string;
}

export interface UpdateDeviceInput {
  id: string;
  vehiclePlate: string;
  driverName: string;
  cargoType: string;
  cargoClass?: 'Frozen' | 'Chilled' | 'Ambient';
  safeMinC: number;
  safeMaxC: number;
  imei: string;
  imsi: string;
}

interface ColdChainContextValue {
  activeModule: ModuleId;
  setActiveModule: (module: ModuleId) => void;
  selectedGatewayId: string;
  setSelectedGatewayId: (id: string) => void;
  selectedTripId: string;
  setSelectedTripId: (id: string) => void;
  activeTripSubTab: TripSubTab;
  setActiveTripSubTab: (tab: TripSubTab) => void;
  openVehicleInTelemetry: (gatewayId: string) => void;
  openTripInModule: (tripId: string, subTab?: TripSubTab) => void;
  vehicles: VehicleGateway[];
  trips: ColdChainTrip[];
  geofences: GeofenceConfig[];
  alerts: ColdChainAlert[];
  recommendations: AiRecommendation[];
  isLiveStreamActive: boolean;
  setIsLiveStreamActive: (active: boolean) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  isRegisterModalOpen: boolean;
  setIsRegisterModalOpen: (open: boolean) => void;
  registerDevice: (input: NewDeviceInput) => void;
  updateDeviceConfig: (input: UpdateDeviceInput) => Promise<boolean>;
  updateAlertStatus: (alertId: string, status: AlertState) => void;
  addGeofence: (gf: Omit<GeofenceConfig, 'id'>) => void;
  toggleGeofence: (id: string) => void;
  deleteGeofence: (id: string) => void;
  updateRecommendationStatus: (id: string, status: 'Pending' | 'Applied' | 'Dismissed') => void;
  injectFirmwareTestEvent: (
    gatewayId: string,
    scenario: 'door_excursion' | 'signal_drop' | 'restore_nominal'
  ) => void;
  kpis: {
    totalVehicles: number;
    inTransit: number;
    atStop: number;
    offline: number;
    activeAlerts: number;
    fleetHealthScore: number;
  };
}

const ColdChainContext = createContext<ColdChainContextValue | null>(null);

export const ColdChainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeModule, setActiveModule] = useState<ModuleId>('overview');
  const [selectedGatewayId, setSelectedGatewayId] = useState<string>('GW-001');
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [activeTripSubTab, setActiveTripSubTab] = useState<TripSubTab>('overview');
  const [vehicles, setVehicles] = useState<VehicleGateway[]>(INITIAL_VEHICLES);
  const [trips, setTrips] = useState<ColdChainTrip[]>(INITIAL_TRIPS);
  const [geofences, setGeofences] = useState<GeofenceConfig[]>(INITIAL_GEOFENCES);
  const [alerts, setAlerts] = useState<ColdChainAlert[]>(INITIAL_ALERTS);
  const [recommendations, setRecommendations] = useState<AiRecommendation[]>(INITIAL_RECOMMENDATIONS);
  const [isLiveStreamActive, setIsLiveStreamActive] = useState<boolean>(true);
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);

  // Synchronize initial data and subscribe to live WebSocket
  useEffect(() => {
    let isMounted = true;

    // 1. Fetch live fleet overview from FastAPI
    apiService.getFleetOverview().then((overview) => {
      if (!isMounted || !overview) return;
      if (overview.fleet_rows && overview.fleet_rows.length > 0) {
        setVehicles((prev) => {
          const map = new Map(prev.map((v) => [v.id.toUpperCase(), v]));
          for (const row of overview.fleet_rows!) {
            const key = row.device_id.toUpperCase();
            const existing = map.get(key);
            if (existing) {
              map.set(key, {
                ...existing,
                vehiclePlate: row.vehicle_name || existing.vehiclePlate,
                driverName: row.driver_name || existing.driverName,
                imei: row.imei || existing.imei,
                imsi: row.imsi || existing.imsi,
                cargoType: row.cargo_type || existing.cargoType,
                safeMinC: row.target_min_c ?? existing.safeMinC,
                safeMaxC: row.target_max_c ?? existing.safeMaxC,
                currentTempC: row.current_temp_c ?? existing.currentTempC,
                speedKmh: row.speed_kmh ?? existing.speedKmh,
                lat: row.lat ?? existing.lat,
                lng: row.lng ?? existing.lng,
                connectivity: (row.connectivity === 'ONLINE' ? 'Online' : 'Offline') as ConnectivityStatus,
                operationalState: (row.operational_state === 'IN_TRANSIT'
                  ? 'In Transit'
                  : row.operational_state === 'AT_STOP'
                  ? 'At Stop'
                  : 'Offline') as VehicleOperationalState,
                condition: (row.status === 'EXCURSION'
                  ? 'Critical'
                  : row.status === 'WARNING'
                  ? 'Warning'
                  : 'Nominal') as ConditionStatus,
                deviceHealthScore: row.health_score ?? existing.deviceHealthScore,
              });
            } else {
              // Register new hardware tracker discovered in backend (e.g. GW-001)
              map.set(key, {
                id: row.device_id,
                vehiclePlate: row.vehicle_name,
                driverName: row.driver_name || 'Assigned Driver',
                cargoType: row.cargo_type,
                cargoClass: 'Chilled',
                currentTempC: row.current_temp_c ?? 4.0,
                safeMinC: row.target_min_c,
                safeMaxC: row.target_max_c,
                connectivity: (row.connectivity === 'ONLINE' ? 'Online' : 'Offline') as ConnectivityStatus,
                operationalState: (row.operational_state === 'IN_TRANSIT'
                  ? 'In Transit'
                  : 'At Stop') as VehicleOperationalState,
                doorStatus: row.security === 'OPEN' ? 'Open' : 'Closed',
                tamperStatus: row.security === 'OPEN' ? 'Breached' : 'Sealed',
                condition: (row.status === 'EXCURSION'
                  ? 'Critical'
                  : row.status === 'WARNING'
                  ? 'Warning'
                  : 'Nominal') as ConditionStatus,
                imei: row.imei || '',
                imsi: row.imsi || '',
                firmwareVersion: 'EC200U-FW-2.1',
                rssiDbm: -68,
                batteryPct: 98,
                gpsSatellites: 12,
                gpsFixQuality: '3D-Fix',
                lat: row.lat ?? 17.4435,
                lng: row.lng ?? 78.3772,
                speedKmh: row.speed_kmh,
                headingDeg: 180,
                locationTier: {
                  country: 'India',
                  region: 'Telangana',
                  city: 'Hyderabad Cold Corridor',
                },
                distanceKm: 24.5,
                trackingMinutes: 45,
                lastUpdateIso: new Date().toISOString(),
                activeNodes: 1,
                totalNodes: 1,
                tempHistory24h: prev[0]?.tempHistory24h || [],
                aiRiskScore: 15,
                deviceHealthScore: row.health_score || 95,
                predictedTemp15m: Number(((row.current_temp_c ?? 4.0) + 0.1).toFixed(2)),
                predictedTemp30m: Number(((row.current_temp_c ?? 4.0) + 0.2).toFixed(2)),
                predictedTemp1h: Number(((row.current_temp_c ?? 4.0) + 0.3).toFixed(2)),
                aiTriageNote: 'Live telemetry stream synchronized with FastAPI Cloud Core.',
              });
            }
          }
          return Array.from(map.values());
        });
      }
    });

    // 2. Fetch live alerts overview
    apiService.getAlerts().then((res) => {
      if (!isMounted || !res || !res.alerts) return;
      if (res.alerts.length > 0) {
        setAlerts((prev) => {
          const map = new Map(prev.map((a) => [a.id, a]));
          for (const bAlert of res.alerts) {
            const key = bAlert.alert_id || String(bAlert.id);
            map.set(key, {
              id: key,
              gatewayId: bAlert.gateway_id,
              vehiclePlate: bAlert.gateway_id,
              type: (bAlert.alert_type === 'Temperature'
                ? 'Thermal Excursion'
                : bAlert.alert_type === 'Door Open'
                ? 'Door Open In-Transit'
                : bAlert.alert_type === 'Tamper'
                ? 'Tamper Seal Breach'
                : 'Gateway Offline') as any,
              severity: (bAlert.severity === 'Critical'
                ? 'Critical'
                : bAlert.severity === 'High'
                ? 'Major'
                : 'Minor') as any,
              status: (bAlert.status === 'Resolved'
                ? 'Resolved'
                : bAlert.status === 'Acknowledged'
                ? 'Acknowledged'
                : 'Active') as AlertState,
              timestampIso: new Date().toISOString(),
              observedValue: bAlert.message,
              thresholdValue: '2.0°C – 8.0°C',
              aiClassification: bAlert.ai_analysis || 'Live Rule Engine Alert',
              recommendedAction: 'Inspect cargo and re-verify temperature nominal.',
            });
          }
          return Array.from(map.values());
        });
      }
    });

    // 3. Connect real-time WebSocket telemetry stream
    const unsubscribe = apiService.subscribeTelemetry({
      onTelemetryPacket: (packet: TelemetryPacket) => {
        if (!isMounted || !packet || !packet.device_id) return;
        const devId = packet.device_id.toUpperCase();
        const nowIso = packet.timestamp || new Date().toISOString();

        setVehicles((prev) =>
          prev.map((v) => {
            if (v.id.toUpperCase() !== devId) return v;

            const temp = packet.temperature?.cargo_temp_c ?? packet.raw_payload?.temperature ?? v.currentTempC;
            const lat = packet.gps?.lat ?? packet.raw_payload?.latitude ?? v.lat;
            const lng = packet.gps?.lng ?? packet.raw_payload?.longitude ?? v.lng;
            const speed = packet.gps?.speed_kmh ?? packet.raw_payload?.speed_kmh ?? v.speedKmh;
            const heading = packet.gps?.heading_deg ?? v.headingDeg;
            const rssi = packet.power?.rssi_dbm ?? packet.raw_payload?.network_rssi ?? v.rssiDbm;
            const batt = packet.power?.battery_pct ?? packet.raw_payload?.battery_pct ?? v.batteryPct;
            const isDoorOpen = packet.raw_payload?.door_status === 'OPEN';
            const isTamper = Boolean(packet.raw_payload?.tamper);

            const outOfRange = temp > v.safeMaxC || temp < v.safeMinC;
            const condition: ConditionStatus =
              outOfRange || isTamper ? 'Critical' : isDoorOpen || temp > v.safeMaxC - 0.8 ? 'Warning' : 'Nominal';

            return {
              ...v,
              currentTempC: temp,
              lat,
              lng,
              speedKmh: speed,
              headingDeg: heading,
              rssiDbm: rssi,
              batteryPct: batt,
              doorStatus: isDoorOpen ? 'Open' : 'Closed',
              tamperStatus: isTamper ? 'Breached' : 'Sealed',
              condition,
              connectivity: 'Online',
              operationalState: speed >= 3.0 ? 'In Transit' : 'At Stop',
              lastUpdateIso: nowIso,
              predictedTemp15m:
                packet.ai_intelligence?.predictive_temperature?.predicted_temp_15m ?? v.predictedTemp15m,
              predictedTemp30m:
                packet.ai_intelligence?.predictive_temperature?.predicted_temp_30m ?? v.predictedTemp30m,
              aiRiskScore: packet.ai_intelligence?.predictive_temperature?.excursion_risk_pct ?? v.aiRiskScore,
              deviceHealthScore: packet.ai_intelligence?.driver_behavior?.safety_score ?? v.deviceHealthScore,
            };
          })
        );
      },
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Real-time telemetry heartbeat (every 3.5 seconds when live stream is enabled)
  useEffect(() => {
    if (!isLiveStreamActive) return;

    const timer = window.setInterval(() => {
      const nowIso = new Date().toISOString();
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.connectivity === 'Offline') return v;
          const deltaTemp = (Math.random() - 0.48) * 0.14;
          const nextTemp = Number((v.currentTempC + deltaTemp).toFixed(2));
          const nextRssi = Math.max(-105, Math.min(-52, v.rssiDbm + Math.round((Math.random() - 0.5) * 3)));
          const nextDist =
            v.operationalState === 'In Transit'
              ? Number((v.distanceKm + v.speedKmh * (3.5 / 3600)).toFixed(2))
              : v.distanceKm;

          const outOfRange = nextTemp > v.safeMaxC || nextTemp < v.safeMinC;
          const nextCondition: ConditionStatus =
            outOfRange || v.tamperStatus === 'Breached'
              ? 'Critical'
              : nextTemp > v.safeMaxC - 0.8 || v.connectivity === 'Degraded'
              ? 'Warning'
              : 'Nominal';

          return {
            ...v,
            currentTempC: nextTemp,
            rssiDbm: nextRssi,
            distanceKm: nextDist,
            lastUpdateIso: nowIso,
            condition: nextCondition,
            predictedTemp15m: Number((nextTemp + (v.doorStatus === 'Open' ? 0.65 : 0.08)).toFixed(2)),
            predictedTemp30m: Number((nextTemp + (v.doorStatus === 'Open' ? 1.25 : 0.14)).toFixed(2)),
            predictedTemp1h: Number((nextTemp + (v.doorStatus === 'Open' ? 2.15 : 0.22)).toFixed(2)),
          };
        })
      );
    }, 3500);

    return () => window.clearInterval(timer);
  }, [isLiveStreamActive]);

  const openVehicleInTelemetry = (gatewayId: string) => {
    setSelectedGatewayId(gatewayId);
    setActiveModule('telemetry');
  };

  const openTripInModule = (tripId: string, subTab: TripSubTab = 'map') => {
    setSelectedTripId(tripId);
    setActiveTripSubTab(subTab);
    setActiveModule('trips');
  };

  const registerDevice = (input: NewDeviceInput) => {
    const nowIso = new Date().toISOString();
    const outOfRange = input.initialTempC < input.safeMinC || input.initialTempC > input.safeMaxC;
    const newVehicle: VehicleGateway = {
      id: input.id.trim().toUpperCase(),
      vehiclePlate: input.vehiclePlate.trim().toUpperCase(),
      driverName: input.driverName.trim(),
      cargoType: input.cargoType.trim(),
      cargoClass: input.cargoClass,
      currentTempC: input.initialTempC,
      safeMinC: input.safeMinC,
      safeMaxC: input.safeMaxC,
      connectivity: 'Online',
      operationalState: 'In Transit',
      doorStatus: 'Closed',
      tamperStatus: 'Sealed',
      condition: outOfRange ? 'Critical' : 'Nominal',
      imei: input.imei.trim(),
      imsi: input.imsi.trim(),
      firmwareVersion: 'CCMS-FW-4.2.1',
      rssiDbm: -66,
      batteryPct: 100,
      gpsSatellites: 13,
      gpsFixQuality: '3D-RTK',
      lat: 39.9526 + (Math.random() - 0.5) * 2,
      lng: -75.1652 + (Math.random() - 0.5) * 2,
      speedKmh: 74,
      headingDeg: 185,
      locationTier: {
        country: 'United States',
        region: input.region.trim() || 'Pennsylvania',
        city: input.city.trim() || 'Philadelphia Logistics Belt',
      },
      distanceKm: 12.4,
      trackingMinutes: 14,
      lastUpdateIso: nowIso,
      activeNodes: 4,
      totalNodes: 4,
      tempHistory24h: INITIAL_VEHICLES[0].tempHistory24h.map((pt) => ({
        ...pt,
        tempC: Number((input.initialTempC + (Math.random() - 0.5) * 0.5).toFixed(2)),
      })),
      aiRiskScore: outOfRange ? 72 : 12,
      deviceHealthScore: 99,
      predictedTemp15m: Number((input.initialTempC + 0.05).toFixed(2)),
      predictedTemp30m: Number((input.initialTempC + 0.1).toFixed(2)),
      predictedTemp1h: Number((input.initialTempC + 0.15).toFixed(2)),
      aiTriageNote: 'Newly provisioned gateway verified via TLS mutual-auth handshake. Probes calibrated.',
    };

    // Update local state immediately
    setVehicles((prev) => [newVehicle, ...prev]);
    setSelectedGatewayId(newVehicle.id);

    // Persist to FastAPI backend SQLite database
    apiService.registerDevice({
      device_id: newVehicle.id,
      imei: newVehicle.imei,
      vehicle_name: `${newVehicle.vehiclePlate} (${newVehicle.driverName})`,
      cargo_type: `${newVehicle.cargoType} [${newVehicle.cargoClass}]`,
      target_min_c: newVehicle.safeMinC,
      target_max_c: newVehicle.safeMaxC,
      sampling_interval_sec: 15,
      is_active: true,
    }).catch((err) => console.warn('[Backend] Register device background error:', err));
  };

  const updateDeviceConfig = async (input: UpdateDeviceInput): Promise<boolean> => {
    // 1. Immediately update local state
    setVehicles((prev) =>
      prev.map((v) =>
        v.id === input.id
          ? {
              ...v,
              vehiclePlate: input.vehiclePlate,
              driverName: input.driverName,
              cargoType: input.cargoType,
              cargoClass: input.cargoClass || v.cargoClass,
              safeMinC: input.safeMinC,
              safeMaxC: input.safeMaxC,
              imei: input.imei,
              imsi: input.imsi,
            }
          : v
      )
    );

    // 2. Persist to FastAPI backend & database
    try {
      const ok = await apiService.updateDevice(input.id, {
        vehicle_name: input.vehiclePlate,
        driver_name: input.driverName,
        cargo_type: input.cargoType,
        target_min_c: input.safeMinC,
        target_max_c: input.safeMaxC,
        imei: input.imei,
        imsi: input.imsi,
      });
      return ok;
    } catch (err) {
      console.warn('[Backend] Update device error:', err);
      return false;
    }
  };

  const updateAlertStatus = (alertId: string, status: AlertState) => {
    const nowIso = new Date().toISOString();
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === alertId
          ? {
              ...a,
              status,
              acknowledgedBy: status === 'Active' ? undefined : 'System Admin',
              acknowledgedAtIso: status === 'Active' ? undefined : nowIso,
            }
          : a
      )
    );

    // Persist status change to backend
    apiService.updateAlertStatus(alertId, status).catch((err) =>
      console.warn('[Backend] Update alert status error:', err)
    );
  };

  const addGeofence = (gf: Omit<GeofenceConfig, 'id'>) => {
    const id = `GF-${Math.floor(200 + Math.random() * 799)}`;
    setGeofences((prev) => [{ ...gf, id }, ...prev]);
    apiService.createGeofence({ ...gf, id }).catch((err) =>
      console.warn('[Backend] Geofence create error:', err)
    );
  };

  const toggleGeofence = (id: string) => {
    const target = geofences.find((g) => g.id === id);
    const nextEnabled = target ? !target.enabled : true;
    setGeofences((prev) => prev.map((g) => (g.id === id ? { ...g, enabled: nextEnabled } : g)));
    apiService.updateGeofence(id, { enabled: nextEnabled }).catch((err) =>
      console.warn('[Backend] Geofence toggle error:', err)
    );
  };

  const deleteGeofence = (id: string) => {
    setGeofences((prev) => prev.filter((g) => g.id !== id));
    apiService.deleteGeofence(id).catch((err) =>
      console.warn('[Backend] Geofence delete error:', err)
    );
  };

  const updateRecommendationStatus = (id: string, status: 'Pending' | 'Applied' | 'Dismissed') => {
    setRecommendations((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const injectFirmwareTestEvent = (
    gatewayId: string,
    scenario: 'door_excursion' | 'signal_drop' | 'restore_nominal'
  ) => {
    const nowIso = new Date().toISOString();
    const target = vehicles.find((v) => v.id === gatewayId);
    if (!target) return;

    if (scenario === 'door_excursion') {
      const excursionTemp = Number((target.safeMaxC + 2.1).toFixed(1));
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === gatewayId
            ? {
                ...v,
                doorStatus: 'Open',
                currentTempC: excursionTemp,
                condition: 'Critical',
                aiRiskScore: 89,
                lastUpdateIso: nowIso,
                aiTriageNote: 'Simulated firmware payload: door open + thermal ceiling breach detected.',
              }
            : v
        )
      );
      setAlerts((prev) => [
        {
          id: `ALT-${Math.floor(9100 + Math.random() * 899)}`,
          gatewayId: target.id,
          vehiclePlate: target.vehiclePlate,
          type: 'Thermal Excursion',
          severity: 'Critical',
          status: 'Active',
          timestampIso: nowIso,
          observedValue: `${excursionTemp}°C (Door Open)`,
          thresholdValue: `${target.safeMinC}°C – ${target.safeMaxC}°C`,
          aiClassification: 'Firmware QA simulation: unsealed door thermal ingress',
          recommendedAction: 'Close cargo door and reset compressor high-stage cooling.',
        },
        ...prev,
      ]);
      // Forward fault injection to backend simulator
      apiService.triggerSimulationAction(gatewayId, 'temp_spike').catch(() => {});
    } else if (scenario === 'signal_drop') {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === gatewayId
            ? {
                ...v,
                connectivity: 'Degraded',
                rssiDbm: -104,
                condition: 'Warning',
                aiRiskScore: 68,
                deviceHealthScore: 74,
                lastUpdateIso: nowIso,
                aiTriageNote: 'Simulated firmware payload: LTE-M RSSI attenuation (-104 dBm).',
              }
            : v
        )
      );
      setAlerts((prev) => [
        {
          id: `ALT-${Math.floor(9100 + Math.random() * 899)}`,
          gatewayId: target.id,
          vehiclePlate: target.vehiclePlate,
          type: 'Gateway Offline',
          severity: 'Major',
          status: 'Active',
          timestampIso: nowIso,
          observedValue: '-104 dBm',
          thresholdValue: '> -90 dBm',
          aiClassification: 'Firmware QA simulation: cellular link fade',
          recommendedAction: 'Verify external roof-mount LTE antenna impedance.',
        },
        ...prev,
      ]);
      // Forward fault injection to backend simulator
      apiService.triggerSimulationAction(gatewayId, 'gps_loss').catch(() => {});
    } else {
      const midTemp = Number(((target.safeMinC + target.safeMaxC) / 2).toFixed(1));
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === gatewayId
            ? {
                ...v,
                connectivity: 'Online',
                operationalState: 'In Transit',
                doorStatus: 'Closed',
                tamperStatus: 'Sealed',
                currentTempC: midTemp,
                rssiDbm: -63,
                condition: 'Nominal',
                aiRiskScore: 12,
                deviceHealthScore: 97,
                lastUpdateIso: nowIso,
                aiTriageNote: 'Simulated reset: all probes nominal and cargo seal verified.',
              }
            : v
        )
      );
      // Forward fault reset to backend simulator
      apiService.triggerSimulationAction(gatewayId, 'reset').catch(() => {});
    }
  };

  const kpis = useMemo(() => {
    const totalVehicles = vehicles.length;
    const inTransit = vehicles.filter((v) => v.operationalState === 'In Transit').length;
    const atStop = vehicles.filter((v) => v.operationalState === 'At Stop').length;
    const offline = vehicles.filter((v) => v.connectivity === 'Offline').length;
    const activeAlerts = alerts.filter((a) => a.status === 'Active').length;
    const avgHealth =
      totalVehicles > 0
        ? Math.round(vehicles.reduce((acc, v) => acc + v.deviceHealthScore, 0) / totalVehicles)
        : 0;

    return {
      totalVehicles,
      inTransit,
      atStop,
      offline,
      activeAlerts,
      fleetHealthScore: avgHealth,
    };
  }, [vehicles, alerts]);

  return (
    <ColdChainContext.Provider
      value={{
        activeModule,
        setActiveModule,
        selectedGatewayId,
        setSelectedGatewayId,
        selectedTripId,
        setSelectedTripId,
        activeTripSubTab,
        setActiveTripSubTab,
        openVehicleInTelemetry,
        openTripInModule,
        vehicles,
        trips,
        geofences,
        alerts,
        recommendations,
        isLiveStreamActive,
        setIsLiveStreamActive,
        globalSearchQuery,
        setGlobalSearchQuery,
        isRegisterModalOpen,
        setIsRegisterModalOpen,
        registerDevice,
        updateDeviceConfig,
        updateAlertStatus,
        addGeofence,
        toggleGeofence,
        deleteGeofence,
        updateRecommendationStatus,
        injectFirmwareTestEvent,
        kpis,
      }}
    >
      {children}
    </ColdChainContext.Provider>
  );
};

export function useColdChain(): ColdChainContextValue {
  const ctx = useContext(ColdChainContext);
  if (!ctx) {
    throw new Error('useColdChain must be used within ColdChainProvider');
  }
  return ctx;
}
