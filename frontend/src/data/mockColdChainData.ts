import {
  AiRecommendation,
  ColdChainAlert,
  ColdChainTrip,
  GeofenceConfig,
  TempReadingPoint,
  VehicleGateway,
} from '../types/coldchain';

/**
 * Baseline Production Data
 * Dummy/mock fleet data has been removed so the platform records only real,
 * incoming live telemetry from hardware gateways for training and analytics.
 */

export const INITIAL_VEHICLES: VehicleGateway[] = [
  {
    id: 'GW-001',
    vehiclePlate: 'GW-001 (Live Hardware)',
    driverName: 'Assigned Driver',
    cargoType: 'Live Cold-Chain Telemetry',
    cargoClass: 'Chilled',
    currentTempC: 4.5,
    safeMinC: 2.0,
    safeMaxC: 8.0,
    connectivity: 'Offline',
    operationalState: 'Offline',
    doorStatus: 'Closed',
    tamperStatus: 'Sealed',
    condition: 'Nominal',
    imei: '860738070471994',
    imsi: '310410948271042',
    firmwareVersion: 'EC200U-FW-2.1',
    rssiDbm: 0,
    batteryPct: 100,
    gpsSatellites: 0,
    gpsFixQuality: 'No Fix',
    lat: 17.4450,
    lng: 78.3750,
    speedKmh: 0,
    headingDeg: 0,
    locationTier: {
      country: 'Live Hardware',
      region: 'Standby',
      city: 'Awaiting Ingestion',
    },
    distanceKm: 0,
    trackingMinutes: 0,
    lastUpdateIso: new Date().toISOString(),
    activeNodes: 1,
    totalNodes: 1,
    tempHistory24h: [],
    aiRiskScore: 0,
    deviceHealthScore: 100,
    predictedTemp15m: 4.5,
    predictedTemp30m: 4.5,
    predictedTemp1h: 4.5,
    aiTriageNote: 'Hardware gateway provisioned. Ready to capture live metrics from firmware.',
  },
];

export const INITIAL_TRIPS: ColdChainTrip[] = [];

export const INITIAL_GEOFENCES: GeofenceConfig[] = [];

export const INITIAL_ALERTS: ColdChainAlert[] = [];

export const INITIAL_RECOMMENDATIONS: AiRecommendation[] = [];
