import {
  Check,
  Clock,
  Copy,
  Cpu,
  DoorClosed,
  DoorOpen,
  Lock,
  MapPin,
  Network,
  RefreshCw,
  Route,
  Satellite,
  ShieldAlert,
  Signal,
  Thermometer,
  Unlock,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useColdChain } from '../../context/ColdChainContext';
import { LeafletMap } from '../shared/LeafletMap';

export const LiveTelemetryModule: React.FC = () => {
  const { vehicles, selectedGatewayId, setSelectedGatewayId } = useColdChain();
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite'>('dark');
  const [copiedJson, setCopiedJson] = useState(false);

  const gateway = useMemo(
    () => vehicles.find((v) => v.id === selectedGatewayId) || vehicles[0],
    [vehicles, selectedGatewayId]
  );

  const rawPayload = useMemo(
    () => ({
      device_id: gateway.id,
      vehicle_plate: gateway.vehiclePlate,
      cargo_class: gateway.cargoClass,
      transport: 'MQTT / TLS 1.3',
      telemetry: {
        temperature_c: gateway.currentTempC,
        safe_range_c: [gateway.safeMinC, gateway.safeMaxC],
        gps_fix: gateway.gpsFixQuality,
        satellites: gateway.gpsSatellites,
        coordinates: { lat: gateway.lat, lng: gateway.lng },
        speed_kmh: gateway.speedKmh,
        distance_km_filtered_100m: gateway.distanceKm,
        rssi_dbm: gateway.rssiDbm,
        battery_pct: gateway.batteryPct,
        door_state: gateway.doorStatus.toLowerCase(),
        tamper_seal: gateway.tamperStatus.toLowerCase(),
        active_nodes: `${gateway.activeNodes}/${gateway.totalNodes}`,
      },
      ai_triage: {
        risk_score: gateway.aiRiskScore,
        predicted_15m_c: gateway.predictedTemp15m,
        predicted_30m_c: gateway.predictedTemp30m,
        predicted_1h_c: gateway.predictedTemp1h,
      },
      timestamp: gateway.lastUpdateIso,
    }),
    [gateway]
  );

  const handleCopyJson = () => {
    navigator.clipboard?.writeText(JSON.stringify(rawPayload, null, 2));
    setCopiedJson(true);
    window.setTimeout(() => setCopiedJson(false), 1800);
  };

  const formatTimer = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  };

  const rssiBars = gateway.rssiDbm > -70 ? 4 : gateway.rssiDbm > -85 ? 3 : gateway.rssiDbm > -100 ? 2 : 1;
  const tempOut = gateway.currentTempC > gateway.safeMaxC || gateway.currentTempC < gateway.safeMinC;

  return (
    <section id="moduleTelemetry" data-module="telemetry" className="module-page space-y-5">
      {/* Header + Gateway Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-100">
            Live Telemetry
          </h1>
          <p className="text-xs text-slate-400">
            Hardware packet inspection, cellular link diagnostics, and 3-second AI triage
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="telemetryGatewaySelect" className="text-xs text-slate-400">
            Active Gateway
          </label>
          <select
            id="telemetryGatewaySelect"
            value={gateway.id}
            onChange={(e) => setSelectedGatewayId(e.target.value)}
            className="h-9 rounded-lg border border-slate-800 bg-[#121824] px-3 font-mono text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id} · {v.vehiclePlate} ({v.condition})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3 Hero Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Card 1: Gateway Status & IMEI/IMSI */}
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-400">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400">Gateway Details</div>
                <div className="font-mono text-base font-bold text-slate-100">
                  {gateway.id} · {gateway.vehiclePlate}
                </div>
              </div>
            </div>
            <span
              className={`text-xs font-semibold ${
                gateway.connectivity === 'Online'
                  ? 'text-emerald-400'
                  : gateway.connectivity === 'Degraded'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {gateway.connectivity}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-3 text-[11px]">
            <div>
              <div className="text-slate-500">Driver</div>
              <div className="font-medium text-slate-200 truncate">{gateway.driverName}</div>
            </div>
            <div>
              <div className="text-slate-500">Transport</div>
              <div className="font-mono text-slate-200 truncate">MQTT / TLS 1.3</div>
            </div>
            <div>
              <div className="text-slate-500">Cargo</div>
              <div className="font-medium text-slate-200 truncate">{gateway.cargoClass}</div>
            </div>
          </div>
        </div>

        {/* Card 2: Node Status */}
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-500/10 text-cyan-400">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400">Node Status</div>
                <div className="font-mono text-base font-bold text-slate-100 tabular-nums">
                  {gateway.activeNodes} / {gateway.totalNodes} Probes Connected
                </div>
              </div>
            </div>
            <span className="font-mono text-xs text-slate-300 tabular-nums">
              {gateway.batteryPct}% Batt
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-3 text-[11px]">
            <div>
              <div className="text-slate-500">Cargo Class</div>
              <div className="font-medium text-slate-200">{gateway.cargoClass}</div>
            </div>
            <div>
              <div className="text-slate-500">Operational</div>
              <div className="font-medium text-slate-200">{gateway.operationalState}</div>
            </div>
            <div>
              <div className="text-slate-500">Speed</div>
              <div className="font-mono text-slate-200 tabular-nums">{gateway.speedKmh} km/h</div>
            </div>
          </div>
        </div>

        {/* Card 3: AI Device Insight (3-second triage) */}
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-400">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-400">AI Device Insight</div>
                <div className="font-mono text-base font-bold text-slate-100 tabular-nums">
                  Risk Score {gateway.aiRiskScore}/100
                </div>
              </div>
            </div>
            <span
              className={`text-xs font-semibold ${
                gateway.condition === 'Critical'
                  ? 'text-rose-400'
                  : gateway.condition === 'Warning'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {gateway.condition}
            </span>
          </div>

          <p className="mt-3 border-t border-slate-800/80 pt-2.5 text-xs leading-relaxed text-slate-300">
            {gateway.aiTriageNote}
          </p>
        </div>
      </div>

      {/* 9 Live Metric Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* 1. Temperature */}
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Thermometer className="h-3.5 w-3.5 text-sky-400" />
              Temperature
            </span>
            <span className={tempOut ? 'font-semibold text-rose-400' : 'text-emerald-400'}>
              {tempOut ? 'Excursion' : 'In Range'}
            </span>
          </div>
          <div
            className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
              tempOut ? 'text-rose-400' : 'text-slate-100'
            }`}
          >
            {gateway.currentTempC.toFixed(2)} °C
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-500">
            Target: {gateway.safeMinC}°C – {gateway.safeMaxC}°C
          </div>
        </div>

        {/* 2. GPS Status */}
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Satellite className="h-3.5 w-3.5 text-emerald-400" />
              GPS Status
            </span>
            <span className="font-mono text-[11px] text-slate-300 tabular-nums">
              {gateway.gpsSatellites} Sats
            </span>
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-slate-100">
            {gateway.gpsFixQuality}
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
            Heading {gateway.headingDeg}° · {gateway.speedKmh} km/h
          </div>
        </div>

        {/* 3. 3-Tier Location */}
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 xl:col-span-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-sky-400" />
              3-Tier Location
            </span>
            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
              {gateway.lat.toFixed(4)}, {gateway.lng.toFixed(4)}
            </span>
          </div>
          <div className="mt-2 truncate text-base font-semibold text-slate-100">
            {gateway.locationTier.city}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {gateway.locationTier.region} · {gateway.locationTier.country}
          </div>
        </div>

        {/* 4. Distance (100m min filter) */}
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Route className="h-3.5 w-3.5 text-cyan-400" />
              Distance
            </span>
            <span className="text-[11px] text-slate-500">100m filter</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-100 tabular-nums">
            {gateway.distanceKm.toFixed(1)} <span className="text-sm font-normal text-slate-400">km</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Noise-filtered odometer</div>
        </div>

        {/* 5. Tracking Timer */}
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              Tracking Timer
            </span>
          </div>
          <div className="mt-2 font-mono text-xl font-bold text-slate-100 tabular-nums">
            {formatTimer(gateway.trackingMinutes)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Active trip telemetry span</div>
        </div>

        {/* 6. Cellular 4G RSSI */}
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Signal className="h-3.5 w-3.5 text-emerald-400" />
              4G Signal RSSI
            </span>
            <div className="flex items-end gap-0.5">
              {[1, 2, 3, 4].map((bar) => (
                <span
                  key={bar}
                  className={`w-1 rounded-xs ${
                    bar <= rssiBars ? 'bg-emerald-400' : 'bg-slate-700'
                  }`}
                  style={{ height: `${bar * 3 + 3}px` }}
                />
              ))}
            </div>
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-100 tabular-nums">
            {gateway.rssiDbm} <span className="text-sm font-normal text-slate-400">dBm</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">LTE-M Cat-M1 Carrier</div>
        </div>

        {/* 7. Door Status */}
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              {gateway.doorStatus === 'Open' ? (
                <DoorOpen className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <DoorClosed className="h-3.5 w-3.5 text-emerald-400" />
              )}
              Door Status
            </span>
          </div>
          <div
            className={`mt-2 text-xl font-bold ${
              gateway.doorStatus === 'Open' ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {gateway.doorStatus}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Magnetic reed contact</div>
        </div>

        {/* 8. Tamper */}
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              {gateway.tamperStatus === 'Breached' ? (
                <Unlock className="h-3.5 w-3.5 text-rose-400" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
              )}
              Tamper Seal
            </span>
          </div>
          <div
            className={`mt-2 text-xl font-bold ${
              gateway.tamperStatus === 'Breached' ? 'text-rose-400' : 'text-slate-100'
            }`}
          >
            {gateway.tamperStatus}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Enclosure interlock loop</div>
        </div>

        {/* 9. Last Update */}
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
              Last Update
            </span>
          </div>
          <div className="mt-2 font-mono text-lg font-bold text-slate-100 tabular-nums">
            {new Date(gateway.lastUpdateIso).toISOString().slice(11, 19)} UTC
          </div>
          <div className="mt-1 font-mono text-[11px] text-slate-500">
            {gateway.lastUpdateIso.slice(0, 10)}
          </div>
        </div>
      </div>

      {/* Bottom Split: Live Leaflet Map + Raw JSON Payload Viewer */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-100">
                Live Location Map
              </h2>
              <p className="text-[11px] text-slate-400">
                {gateway.locationTier.city} · {gateway.lat.toFixed(4)}, {gateway.lng.toFixed(4)}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-[#0d131f] p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setMapStyle('dark')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  mapStyle === 'dark' ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Map
              </button>
              <button
                type="button"
                onClick={() => setMapStyle('satellite')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  mapStyle === 'satellite'
                    ? 'bg-slate-800 text-sky-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Satellite
              </button>
            </div>
          </div>

          <LeafletMap
            center={[gateway.lat, gateway.lng]}
            zoom={10}
            heightClass="h-80"
            mapStyle={mapStyle}
            vehicles={[gateway]}
            selectedGatewayId={gateway.id}
          />
        </div>

        <div className="flex flex-col rounded-lg border border-slate-800 bg-[#121824] p-4 lg:col-span-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-100">
                Real-time JSON Payload
              </h2>
              <p className="text-[11px] text-slate-400">MQTT / TLS 1.3 telemetry packet schema</p>
            </div>
            <button
              type="button"
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-[#0d131f] px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              {copiedJson ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-slate-400" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>

          <pre className="h-80 overflow-auto rounded-lg border border-slate-800/90 bg-[#0a0f18] p-3.5 font-mono text-[11px] leading-relaxed text-slate-300">
            {JSON.stringify(rawPayload, null, 2)
              .split('\n')
              .map((line, idx) => {
                const keyMatch = line.match(/^(\s*)"([^"]+)":(.*)$/);
                if (!keyMatch) {
                  return (
                    <div key={idx} className="text-slate-400">
                      {line}
                    </div>
                  );
                }
                const [, indent, key, rest] = keyMatch;
                return (
                  <div key={idx}>
                    <span>{indent}</span>
                    <span className="text-sky-400">"{key}"</span>
                    <span className="text-slate-500">:</span>
                    <span
                      className={
                        rest.includes('"')
                          ? 'text-emerald-300'
                          : rest.trim().match(/^[-\d.]/)
                          ? 'text-amber-300'
                          : 'text-slate-300'
                      }
                    >
                      {rest}
                    </span>
                  </div>
                );
              })}
          </pre>
        </div>
      </div>
    </section>
  );
};
