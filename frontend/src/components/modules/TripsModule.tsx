import {
  Check,
  Download,
  FastForward,
  Layers,
  Map as MapIcon,
  Navigation,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Shield,
  SkipBack,
  SkipForward,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useColdChain } from '../../context/ColdChainContext';
import { ColdChainTrip, GeofenceShape, TripSubTab } from '../../types/coldchain';
import { DualAxisTripChart } from '../charts/TelemetryCharts';
import { LeafletMap } from '../shared/LeafletMap';

const SUB_TABS: { id: TripSubTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'map', label: 'Map' },
  { id: 'geofence', label: 'Geofence' },
  { id: 'events', label: 'Events' },
  { id: 'analytics', label: 'Analytics' },
];

const DEFAULT_STANDBY_TRIP: ColdChainTrip = {
  id: 'TRP-STANDBY',
  gatewayId: 'GW-001',
  vehiclePlate: 'GW-001 (Live Hardware)',
  driverName: 'Assigned Driver',
  cargoManifest: 'Awaiting Active Delivery Manifest',
  origin: 'Dispatch Hub',
  destination: 'Destination Hub',
  startTimeIso: new Date().toISOString(),
  etaIso: new Date().toISOString(),
  distanceCompletedKm: 0,
  distanceTotalKm: 0,
  gdpCompliancePct: 100,
  mktTempC: 4.5,
  avgTempC: 4.5,
  minTempC: 4.0,
  maxTempC: 5.0,
  status: 'Active',
  halts: [],
  events: [],
  waypoints: [
    { timestamp: '00:00', lat: 17.4450, lng: 78.3750, tempC: 4.5, velocityKmh: 0, doorOpen: false },
  ],
};

export const TripsModule: React.FC = () => {
  const {
    trips,
    geofences,
    selectedTripId,
    setSelectedTripId,
    activeTripSubTab,
    setActiveTripSubTab,
    addGeofence,
    toggleGeofence,
    deleteGeofence,
  } = useColdChain();

  const trip = useMemo(
    () => trips.find((t) => t.id === selectedTripId) || trips[0] || DEFAULT_STANDBY_TRIP,
    [trips, selectedTripId]
  );

  // Route Replay state
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMult, setSpeedMult] = useState<1 | 2 | 5>(1);
  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite'>('dark');

  // Event filter
  const [eventFilter, setEventFilter] = useState<string>('All');

  // New Geofence form state
  const [gfName, setGfName] = useState('');
  const [gfShape, setGfShape] = useState<GeofenceShape>('circle');
  const [gfRadius, setGfRadius] = useState(2000);
  const [gfCorridorWidth, setGfCorridorWidth] = useState(1500);
  const [gfBreachAction, setGfBreachAction] = useState<'Alert & Log' | 'Critical Escalation' | 'Silent Audit'>(
    'Alert & Log'
  );
  const [exportNotice, setExportNotice] = useState(false);

  // Reset replay index when switching trips
  useEffect(() => {
    if (trip && trip.waypoints && trip.waypoints.length > 0) {
      setReplayIndex(Math.min(2, trip.waypoints.length - 1));
    } else {
      setReplayIndex(0);
    }
    setIsPlaying(false);
  }, [trip?.id]);

  // Replay timer
  useEffect(() => {
    if (!isPlaying || !trip?.waypoints?.length) return;
    const intervalMs = Math.round(1400 / speedMult);
    const id = window.setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= trip.waypoints.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [isPlaying, speedMult, trip?.waypoints?.length]);

  const currentWaypoint = trip?.waypoints?.[replayIndex] || trip?.waypoints?.[0] || { timestamp: '00:00', lat: 17.4450, lng: 78.3750, tempC: 4.5, velocityKmh: 0, doorOpen: false };
  const tripCoords: [number, number][] = useMemo(
    () => (trip?.waypoints || []).map((w) => [w.lat, w.lng]),
    [trip]
  );
  const tripGeofences = useMemo(
    () => geofences.filter((g) => g.tripId === trip.id),
    [geofences, trip.id]
  );

  const filteredEvents = useMemo(
    () =>
      eventFilter === 'All'
        ? (trip?.events || [])
        : (trip?.events || []).filter((e) => e.type === eventFilter),
    [trip?.events, eventFilter]
  );

  const handleExportTripCsv = () => {
    const header = 'timestamp,lat,lng,temp_c,velocity_kmh,door_open\n';
    const rows = trip.waypoints
      .map((w) => `${w.timestamp},${w.lat},${w.lng},${w.tempC},${w.velocityKmh},${w.doorOpen}`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trip.id}-route-telemetry.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice(true);
    window.setTimeout(() => setExportNotice(false), 2000);
  };

  const handleCreateGeofence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gfName.trim()) return;
    const mid = trip.waypoints[Math.floor(trip.waypoints.length / 2)] || trip.waypoints[0];
    addGeofence({
      name: gfName.trim(),
      tripId: trip.id,
      shape: gfShape,
      enabled: true,
      centerLat: mid.lat,
      centerLng: mid.lng,
      radiusMeters: gfShape === 'circle' ? gfRadius : undefined,
      polygonCoords:
        gfShape === 'polygon'
          ? [
              [mid.lat + 0.08, mid.lng - 0.1],
              [mid.lat + 0.08, mid.lng + 0.1],
              [mid.lat - 0.08, mid.lng + 0.1],
              [mid.lat - 0.08, mid.lng - 0.1],
            ]
          : undefined,
      corridorWidthMeters: gfShape === 'corridor' ? gfCorridorWidth : undefined,
      breachAction: gfBreachAction,
      currentlyInside: true,
    });
    setGfName('');
  };

  return (
    <section id="moduleTrips" data-module="trips" className="module-page space-y-4">
      {/* Sub-tabs & Trip Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-subtab={tab.id}
              onClick={() => setActiveTripSubTab(tab.id)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTripSubTab === tab.id
                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={trip.id}
            onChange={(e) => setSelectedTripId(e.target.value)}
            aria-label="Select cold-chain trip"
            className="h-9 rounded-lg border border-slate-800 bg-[#121824] px-3 font-mono text-xs text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} · {t.origin.split(',')[0]} → {t.destination.split(',')[0]}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportTripCsv}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-[#121824] px-3 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            {exportNotice ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Exported</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5 text-sky-400" />
                <span>Export CSV</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Trip Header Strip (matching reference screenshot) */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-sky-500/30 bg-[#121824] px-4 py-3 text-xs sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <span className="text-slate-400">Trip ID: </span>
          <span className="font-mono font-semibold text-sky-400">{trip.id}</span>
        </div>
        <div>
          <span className="text-slate-400">Vehicle: </span>
          <span className="font-mono font-medium text-slate-100">{trip.vehiclePlate}</span>
        </div>
        <div>
          <span className="text-slate-400">Driver: </span>
          <span className="font-medium text-slate-100">{trip.driverName}</span>
        </div>
        <div className="truncate">
          <span className="text-slate-400">Origin: </span>
          <span className="text-slate-200">{trip.origin}</span>
        </div>
        <div className="truncate">
          <span className="text-slate-400">Destination: </span>
          <span className="text-slate-200">{trip.destination}</span>
        </div>
        <div className="lg:text-right">
          <span className="text-slate-400">Status: </span>
          <span
            className={`font-semibold ${
              trip.status === 'Delayed' ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {trip.status}
          </span>
        </div>
      </div>

      {/* SUBTAB 1: OVERVIEW */}
      {activeTripSubTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Distance Progress</div>
              <div className="mt-1.5 font-mono text-xl font-bold text-slate-100 tabular-nums">
                {trip.distanceCompletedKm} / {trip.distanceTotalKm} km
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {Math.round((trip.distanceCompletedKm / trip.distanceTotalKm) * 100)}% corridor completed
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">GDP Compliance</div>
              <div className="mt-1.5 font-mono text-xl font-bold text-emerald-400 tabular-nums">
                {trip.gdpCompliancePct.toFixed(1)}%
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Time within safe thermal corridor</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Mean Kinetic Temp</div>
              <div className="mt-1.5 font-mono text-xl font-bold text-sky-400 tabular-nums">
                {trip.mktTempC.toFixed(2)}°C
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Range: {trip.minTempC}°C to {trip.maxTempC}°C
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Logged Halts</div>
              <div className="mt-1.5 font-mono text-xl font-bold text-slate-100 tabular-nums">
                {trip.halts.length}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {trip.events.length} auditable route events
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 text-xs space-y-3">
              <h2 className="font-display text-sm font-semibold text-slate-100">
                Origin vs. Destination Manifest
              </h2>
              <div className="grid grid-cols-2 gap-4 rounded-md border border-slate-800 bg-[#0d131f] p-3">
                <div>
                  <div className="text-[11px] text-slate-400">Origin Dispatch</div>
                  <div className="mt-1 font-semibold text-slate-100">{trip.origin}</div>
                  <div className="mt-1 font-mono text-[11px] text-slate-400">
                    Departed: {trip.startTimeIso.slice(11, 16)} UTC
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-400">Destination Hub</div>
                  <div className="mt-1 font-semibold text-slate-100">{trip.destination}</div>
                  <div className="mt-1 font-mono text-[11px] text-sky-400">
                    ETA: {trip.etaIso.slice(11, 16)} UTC
                  </div>
                </div>
              </div>
              <div className="text-slate-300">
                <span className="text-slate-400">Cargo Manifest: </span>
                {trip.cargoManifest}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 text-xs">
              <h2 className="mb-3 font-display text-sm font-semibold text-slate-100">
                Available Fleet Trips
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 font-medium">Trip</th>
                      <th className="py-2 font-medium">Gateway</th>
                      <th className="py-2 text-right font-medium">MKT</th>
                      <th className="py-2 text-right font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {trips.map((t) => (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTripId(t.id)}
                        className={`cursor-pointer hover:bg-slate-800/40 ${
                          t.id === trip.id ? 'bg-sky-500/10' : ''
                        }`}
                      >
                        <td className="py-2.5 font-mono font-semibold text-sky-400">{t.id}</td>
                        <td className="py-2.5 font-mono text-slate-300">{t.gatewayId}</td>
                        <td className="py-2.5 text-right font-mono text-slate-200 tabular-nums">
                          {t.mktTempC.toFixed(1)}°C
                        </td>
                        <td
                          className={`py-2.5 text-right font-medium ${
                            t.status === 'Delayed' ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {t.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: ROUTE REPLAY MAP */}
      {activeTripSubTab === 'map' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Left overlay stack: Trip Details + Stops/Events */}
            <div className="space-y-3 lg:col-span-4">
              <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 text-xs">
                <h2 className="mb-2.5 font-display text-sm font-semibold text-slate-100">
                  Trip Replay Telemetry
                </h2>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded border border-slate-800 bg-[#0d131f] p-2.5">
                    <div className="text-[11px] text-slate-400">Waypoint Time</div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-slate-100 tabular-nums">
                      {currentWaypoint.timestamp}
                    </div>
                  </div>
                  <div className="rounded border border-slate-800 bg-[#0d131f] p-2.5">
                    <div className="text-[11px] text-slate-400">Cargo Temp</div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-sky-400 tabular-nums">
                      {currentWaypoint.tempC.toFixed(1)}°C
                    </div>
                  </div>
                  <div className="rounded border border-slate-800 bg-[#0d131f] p-2.5">
                    <div className="text-[11px] text-slate-400">Velocity</div>
                    <div className="mt-0.5 font-mono text-sm font-semibold text-slate-100 tabular-nums">
                      {currentWaypoint.velocityKmh} km/h
                    </div>
                  </div>
                  <div className="rounded border border-slate-800 bg-[#0d131f] p-2.5">
                    <div className="text-[11px] text-slate-400">Door Seal</div>
                    <div
                      className={`mt-0.5 text-sm font-semibold ${
                        currentWaypoint.doorOpen ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {currentWaypoint.doorOpen ? 'Open' : 'Closed'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 text-xs">
                <h3 className="mb-2 font-display text-sm font-semibold text-slate-100">
                  Stops & Halt Pins ({trip.halts.length})
                </h3>
                {trip.halts.length === 0 ? (
                  <p className="py-3 text-slate-400">No halts logged along this corridor.</p>
                ) : (
                  <div className="space-y-2">
                    {trip.halts.map((h) => (
                      <div key={h.id} className="rounded border border-slate-800 bg-[#0d131f] p-2.5">
                        <div className="flex items-center justify-between font-medium text-amber-400">
                          <span>{h.locationName}</span>
                          <span className="font-mono">{h.durationMin}m</span>
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          {h.reason} · Start {h.startTime} · Temp {h.tempAtHaltC}°C
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Map viewport */}
            <div className="space-y-2 lg:col-span-8">
              <div className="flex items-center justify-end gap-2">
                <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-[#121824] p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setMapStyle('dark')}
                    className={`rounded px-2.5 py-1 font-medium ${
                      mapStyle === 'dark' ? 'bg-slate-800 text-sky-400' : 'text-slate-400'
                    }`}
                  >
                    Map
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapStyle('satellite')}
                    className={`rounded px-2.5 py-1 font-medium ${
                      mapStyle === 'satellite' ? 'bg-slate-800 text-sky-400' : 'text-slate-400'
                    }`}
                  >
                    Satellite
                  </button>
                </div>
              </div>

              <LeafletMap
                heightClass="h-[360px]"
                mapStyle={mapStyle}
                polyline={{ coords: tripCoords, color: '#38bdf8', weight: 3.5 }}
                fitBoundsCoords={tripCoords}
                halts={trip.halts}
                geofences={tripGeofences}
                replayMarker={{
                  lat: currentWaypoint.lat,
                  lng: currentWaypoint.lng,
                  label: `${trip.id} · ${currentWaypoint.timestamp}`,
                  tempC: currentWaypoint.tempC,
                }}
              />
            </div>
          </div>

          {/* Route Replay HUD Scrubber Bar (matching reference screenshot) */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-sky-500/30 bg-[#121824] px-4 py-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                aria-label={isPlaying ? 'Pause route replay' : 'Play route replay'}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-500 text-slate-950 hover:bg-sky-400"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setReplayIndex((i) => Math.max(0, i - 1))}
                aria-label="Previous waypoint"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 text-slate-300 hover:bg-slate-800"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setReplayIndex(0);
                }}
                aria-label="Reset replay"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 text-slate-300 hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setReplayIndex((i) => Math.min(trip.waypoints.length - 1, i + 1))}
                aria-label="Next waypoint"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 text-slate-300 hover:bg-slate-800"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSpeedMult((s) => (s === 1 ? 2 : s === 2 ? 5 : 1))}
                className="flex h-8 items-center gap-1 rounded-md border border-slate-800 px-2.5 font-mono text-xs font-semibold text-sky-400 hover:bg-slate-800"
              >
                <FastForward className="h-3 w-3" />
                <span>{speedMult}x</span>
              </button>
            </div>

            <div className="flex flex-1 items-center gap-3 min-w-[200px]">
              <input
                type="range"
                min={0}
                max={trip.waypoints.length - 1}
                value={replayIndex}
                onChange={(e) => {
                  setIsPlaying(false);
                  setReplayIndex(Number(e.target.value));
                }}
                aria-label="Route replay timeline"
                className="h-1.5 flex-1 cursor-pointer accent-sky-400"
              />
              <span className="font-mono text-xs text-slate-300 tabular-nums whitespace-nowrap">
                Waypoint {replayIndex + 1} / {trip.waypoints.length} · {currentWaypoint.timestamp}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: GEOFENCE */}
      {activeTripSubTab === 'geofence' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <form
              onSubmit={handleCreateGeofence}
              className="rounded-lg border border-slate-800 bg-[#121824] p-4 text-xs space-y-3"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-sky-400" />
                <h2 className="font-display text-sm font-semibold text-slate-100">
                  Configure Geofence Boundary
                </h2>
              </div>

              <div>
                <label className="mb-1 block text-slate-400">Zone Name</label>
                <input
                  type="text"
                  required
                  value={gfName}
                  onChange={(e) => setGfName(e.target.value)}
                  placeholder="e.g. Newark Bio-Receiving Perimeter"
                  className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 text-slate-100 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(['circle', 'polygon', 'corridor'] as const).map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => setGfShape(shape)}
                    className={`flex items-center justify-center gap-1.5 rounded-md border py-2 capitalize font-medium transition-colors ${
                      gfShape === shape
                        ? 'border-sky-500/50 bg-sky-500/15 text-sky-400'
                        : 'border-slate-800 bg-[#0d131f] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {shape === 'circle' && <Navigation className="h-3 w-3" />}
                    {shape === 'polygon' && <Layers className="h-3 w-3" />}
                    {shape === 'corridor' && <MapIcon className="h-3 w-3" />}
                    <span>{shape}</span>
                  </button>
                ))}
              </div>

              {gfShape === 'circle' && (
                <div>
                  <div className="mb-1 flex justify-between text-slate-400">
                    <span>Perimeter Radius</span>
                    <span className="font-mono text-slate-200">{gfRadius} m</span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={10000}
                    step={250}
                    value={gfRadius}
                    onChange={(e) => setGfRadius(Number(e.target.value))}
                    className="w-full accent-sky-400"
                  />
                </div>
              )}

              {gfShape === 'corridor' && (
                <div>
                  <div className="mb-1 flex justify-between text-slate-400">
                    <span>Corridor Buffer Width</span>
                    <span className="font-mono text-slate-200">{gfCorridorWidth} m</span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={5000}
                    step={250}
                    value={gfCorridorWidth}
                    onChange={(e) => setGfCorridorWidth(Number(e.target.value))}
                    className="w-full accent-sky-400"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-slate-400">Breach Policy</label>
                <select
                  value={gfBreachAction}
                  onChange={(e) =>
                    setGfBreachAction(
                      e.target.value as 'Alert & Log' | 'Critical Escalation' | 'Silent Audit'
                    )
                  }
                  className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 text-slate-100 focus:border-sky-500 focus:outline-none"
                >
                  <option value="Alert & Log">Alert & Log</option>
                  <option value="Critical Escalation">Critical Escalation</option>
                  <option value="Silent Audit">Silent Audit</option>
                </select>
              </div>

              <button
                type="submit"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 font-semibold text-slate-950 hover:bg-sky-400"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Geofence to Trip</span>
              </button>
            </form>

            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 text-xs space-y-2.5">
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Active Boundaries ({tripGeofences.length})
              </h3>
              {tripGeofences.length === 0 ? (
                <p className="py-4 text-center text-slate-400">
                  No geofences attached to {trip.id} yet.
                </p>
              ) : (
                tripGeofences.map((gf) => (
                  <div
                    key={gf.id}
                    className="flex items-center justify-between rounded-md border border-slate-800 bg-[#0d131f] p-3"
                  >
                    <div>
                      <div className="font-semibold text-slate-100">{gf.name}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400 capitalize">
                        {gf.shape} · {gf.breachAction} ·{' '}
                        <span className={gf.currentlyInside ? 'text-emerald-400' : 'text-amber-400'}>
                          {gf.currentlyInside ? 'Inside Zone' : 'Outside Zone'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleGeofence(gf.id)}
                        className={`rounded border px-2 py-1 text-[11px] font-medium ${
                          gf.enabled
                            ? 'border-sky-500/40 text-sky-400'
                            : 'border-slate-700 text-slate-500'
                        }`}
                      >
                        {gf.enabled ? 'Enabled' : 'Paused'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteGeofence(gf.id)}
                        aria-label={`Delete ${gf.name}`}
                        className="rounded p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 lg:col-span-7">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-100">
                Live Geofence Spatial Preview
              </h2>
              <span className="font-mono text-xs text-slate-400">{trip.id}</span>
            </div>
            <LeafletMap
              heightClass="h-[460px]"
              polyline={{ coords: tripCoords, color: '#38bdf8', weight: 3 }}
              fitBoundsCoords={tripCoords}
              geofences={tripGeofences}
              replayMarker={{
                lat: currentWaypoint.lat,
                lng: currentWaypoint.lng,
                label: trip.vehiclePlate,
                tempC: currentWaypoint.tempC,
              }}
            />
          </div>
        </div>
      )}

      {/* SUBTAB 4: EVENTS */}
      {activeTripSubTab === 'events' && (
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 text-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-100">
                Chronological Trip Audit Log
              </h2>
              <p className="text-[11px] text-slate-400">
                Immutable sequence of departures, geofence crossings, halts, and excursions
              </p>
            </div>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              aria-label="Filter trip events"
              className="h-9 rounded-md border border-slate-800 bg-[#0d131f] px-3 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              <option value="All">All Event Types</option>
              <option value="Departure">Departure</option>
              <option value="Geofence Entry">Geofence Entry</option>
              <option value="Geofence Exit">Geofence Exit</option>
              <option value="Halt Started">Halt Started</option>
              <option value="Halt Ended">Halt Ended</option>
              <option value="Door Opened">Door Opened</option>
              <option value="Temp Excursion">Temp Excursion</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 font-medium">Timestamp (UTC)</th>
                  <th className="py-2.5 font-medium">Event Type</th>
                  <th className="py-2.5 font-medium">Location</th>
                  <th className="py-2.5 font-medium">Audit Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-800/30">
                    <td className="py-3 font-mono text-slate-300 tabular-nums">{ev.timestamp}</td>
                    <td
                      className={`py-3 font-semibold ${
                        ev.severity === 'critical'
                          ? 'text-rose-400'
                          : ev.severity === 'warning'
                          ? 'text-amber-400'
                          : 'text-sky-400'
                      }`}
                    >
                      {ev.type}
                    </td>
                    <td className="py-3 text-slate-300">{ev.location}</td>
                    <td className="py-3 text-slate-300">{ev.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 5: ANALYTICS */}
      {activeTripSubTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Mean Kinetic Temp (MKT)</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-sky-400 tabular-nums">
                {trip.mktTempC.toFixed(2)}°C
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Arrhenius thermal load</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Minimum Cargo Temp</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-slate-100 tabular-nums">
                {trip.minTempC.toFixed(1)}°C
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Observed floor</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Maximum Cargo Temp</div>
              <div
                className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
                  trip.maxTempC > 8 ? 'text-rose-400' : 'text-slate-100'
                }`}
              >
                {trip.maxTempC.toFixed(1)}°C
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Observed ceiling</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Average Trip Temp</div>
              <div className="mt-1.5 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                {trip.avgTempC.toFixed(1)}°C
              </div>
              <div className="mt-1 text-[11px] text-slate-500">GDP Compliance {trip.gdpCompliancePct}%</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-100">
                  Cargo Temperature vs. Velocity Profile
                </h2>
                <p className="text-[11px] text-slate-400">
                  Correlation between vehicle stops/velocity drops and cabin thermal drift
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-sky-400">
                  <span className="h-0.5 w-4 bg-sky-400" /> Cargo Temp (°C)
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="h-0.5 w-4 border-t-2 border-dashed border-emerald-400" /> Velocity (km/h)
                </span>
              </div>
            </div>

            <DualAxisTripChart points={trip.waypoints} />
          </div>
        </div>
      )}
    </section>
  );
};
