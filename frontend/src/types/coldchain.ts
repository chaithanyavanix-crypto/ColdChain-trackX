export type ModuleId =
  | 'overview'
  | 'fleet'
  | 'telemetry'
  | 'trips'
  | 'alerts'
  | 'ai_insights'
  | 'reports';

export type TripSubTab = 'overview' | 'map' | 'geofence' | 'events' | 'analytics';
export type ReportSubTab = 'temperature' | 'trip' | 'compliance' | 'alert' | 'utilization';

export type ConnectivityStatus = 'Online' | 'Degraded' | 'Offline';
export type VehicleOperationalState = 'In Transit' | 'At Stop' | 'Offline';
export type ConditionStatus = 'Nominal' | 'Warning' | 'Critical';
export type DoorState = 'Closed' | 'Open';
export type TamperState = 'Sealed' | 'Breached';
export type CargoClass = 'Frozen' | 'Chilled' | 'Ambient';

export type AlertSeverity = 'Critical' | 'Major' | 'Minor';
export type AlertState = 'Active' | 'Acknowledged' | 'Resolved';

export type GeofenceShape = 'circle' | 'polygon' | 'corridor';

export interface TempReadingPoint {
  timestamp: string;
  label: string;
  tempC: number;
  ambientC: number;
  velocityKmh: number;
}

export interface VehicleGateway {
  id: string; // e.g., GW-001
  vehiclePlate: string;
  driverName: string;
  cargoType: string;
  cargoClass: CargoClass;
  currentTempC: number;
  safeMinC: number;
  safeMaxC: number;
  connectivity: ConnectivityStatus;
  operationalState: VehicleOperationalState;
  doorStatus: DoorState;
  tamperStatus: TamperState;
  condition: ConditionStatus;
  imei: string;
  imsi: string;
  firmwareVersion: string;
  rssiDbm: number;
  batteryPct: number;
  gpsSatellites: number;
  gpsFixQuality: '3D-RTK' | '3D-Fix' | 'No Fix';
  lat: number;
  lng: number;
  speedKmh: number;
  headingDeg: number;
  locationTier: {
    country: string;
    region: string;
    city: string;
  };
  distanceKm: number;
  trackingMinutes: number;
  lastUpdateIso: string;
  activeNodes: number;
  totalNodes: number;
  tempHistory24h: TempReadingPoint[];
  aiRiskScore: number; // 0-100
  deviceHealthScore: number; // 0-100
  predictedTemp15m: number;
  predictedTemp30m: number;
  predictedTemp1h: number;
  aiTriageNote: string;
}

export interface RouteWaypoint {
  lat: number;
  lng: number;
  timestamp: string;
  tempC: number;
  velocityKmh: number;
  doorOpen: boolean;
}

export interface TripHalt {
  id: string;
  locationName: string;
  lat: number;
  lng: number;
  startTime: string;
  durationMin: number;
  reason: 'Scheduled Hub Check' | 'Fuel & Reefer Check' | 'Traffic Hold' | 'Unscheduled Door Open';
  tempAtHaltC: number;
}

export interface TripEvent {
  id: string;
  tripId: string;
  timestamp: string;
  type: 'Departure' | 'Geofence Entry' | 'Geofence Exit' | 'Halt Started' | 'Halt Ended' | 'Door Opened' | 'Temp Excursion';
  description: string;
  location: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface GeofenceConfig {
  id: string;
  name: string;
  tripId: string;
  shape: GeofenceShape;
  enabled: boolean;
  centerLat?: number;
  centerLng?: number;
  radiusMeters?: number;
  polygonCoords?: [number, number][];
  corridorWidthMeters?: number;
  breachAction: 'Alert & Log' | 'Critical Escalation' | 'Silent Audit';
  currentlyInside: boolean;
}

export interface ColdChainTrip {
  id: string;
  gatewayId: string;
  vehiclePlate: string;
  driverName: string;
  cargoManifest: string;
  origin: string;
  destination: string;
  status: 'Active' | 'Completed' | 'Delayed';
  startTimeIso: string;
  etaIso: string;
  distanceTotalKm: number;
  distanceCompletedKm: number;
  gdpCompliancePct: number;
  mktTempC: number;
  minTempC: number;
  maxTempC: number;
  avgTempC: number;
  waypoints: RouteWaypoint[];
  halts: TripHalt[];
  events: TripEvent[];
}

export interface ColdChainAlert {
  id: string;
  gatewayId: string;
  vehiclePlate: string;
  type:
    | 'Thermal Excursion'
    | 'Door Open In-Transit'
    | 'Tamper Seal Breach'
    | 'Geofence Deviation'
    | 'Gateway Offline'
    | 'Compressor Drift';
  severity: AlertSeverity;
  status: AlertState;
  timestampIso: string;
  observedValue: string;
  thresholdValue: string;
  aiClassification: string;
  recommendedAction: string;
  acknowledgedBy?: string;
  acknowledgedAtIso?: string;
}

export interface AiRecommendation {
  id: string;
  gatewayId: string;
  category: 'Thermal Prevention' | 'Route Optimization' | 'Hardware Maintenance' | 'Compliance';
  priority: 'High' | 'Medium' | 'Low';
  title: string;
  rationale: string;
  projectedImpact: string;
  status: 'Pending' | 'Applied' | 'Dismissed';
  timestampIso: string;
}
