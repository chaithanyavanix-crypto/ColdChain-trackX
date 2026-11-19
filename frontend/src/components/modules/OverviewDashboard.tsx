import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BrainCircuit,
  Gauge,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  Truck,
  WifiOff,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useColdChain } from '../../context/ColdChainContext';
import { DonutChart, PredictionChart, Temperature24hChart } from '../charts/TelemetryCharts';
import { LeafletMap } from '../shared/LeafletMap';

export const OverviewDashboard: React.FC = () => {
  const {
    vehicles,
    trips,
    alerts,
    kpis,
    selectedGatewayId,
    setSelectedGatewayId,
    openVehicleInTelemetry,
    openTripInModule,
    setActiveModule,
    updateAlertStatus,
    isLiveStreamActive,
    setIsLiveStreamActive,
  } = useColdChain();

  const [mapStyle, setMapStyle] = useState<'dark' | 'satellite'>('dark');

  const focusedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedGatewayId) || vehicles[0],
    [vehicles, selectedGatewayId]
  );

  const healthSegments = useMemo(() => {
    const nominal = vehicles.filter((v) => v.condition === 'Nominal').length;
    const warning = vehicles.filter((v) => v.condition === 'Warning').length;
    const critical = vehicles.filter((v) => v.condition === 'Critical').length;
    return [
      { label: 'Nominal', value: nominal, color: '#10b981' },
      { label: 'Warning', value: warning, color: '#f59e0b' },
      { label: 'Critical', value: critical, color: '#ef4444' },
    ];
  }, [vehicles]);

  const kpiCards = [
    {
      label: 'Total Vehicles',
      value: String(kpis.totalVehicles),
      sub: 'Provisioned gateways',
      icon: Truck,
      borderClass: 'border-sky-500/35',
      valueClass: 'text-slate-100',
      iconClass: 'text-sky-400',
    },
    {
      label: 'In Transit',
      value: String(kpis.inTransit),
      sub: 'Active road corridors',
      icon: Activity,
      borderClass: 'border-cyan-500/35',
      valueClass: 'text-cyan-300',
      iconClass: 'text-cyan-400',
    },
    {
      label: 'At Stop',
      value: String(kpis.atStop),
      sub: 'Dock & relay hubs',
      icon: Radio,
      borderClass: 'border-slate-800',
      valueClass: 'text-slate-100',
      iconClass: 'text-slate-400',
    },
    {
      label: 'Offline',
      value: String(kpis.offline),
      sub: 'Heartbeat timeout',
      icon: WifiOff,
      borderClass: 'border-slate-800',
      valueClass: kpis.offline > 0 ? 'text-amber-400' : 'text-slate-100',
      iconClass: 'text-slate-400',
    },
    {
      label: 'Active Alerts',
      value: String(kpis.activeAlerts),
      sub: 'Unacknowledged incidents',
      icon: AlertTriangle,
      borderClass: kpis.activeAlerts > 0 ? 'border-rose-500/40' : 'border-slate-800',
      valueClass: kpis.activeAlerts > 0 ? 'text-rose-400' : 'text-slate-100',
      iconClass: kpis.activeAlerts > 0 ? 'text-rose-400' : 'text-slate-400',
    },
    {
      label: 'Fleet Health Score',
      value: `${kpis.fleetHealthScore}%`,
      sub: 'Mean node stability',
      icon: Gauge,
      borderClass: 'border-emerald-500/35',
      valueClass: 'text-emerald-400',
      iconClass: 'text-emerald-400',
    },
  ];

  return (
    <section id="moduleOverview" data-module="overview" className="module-page space-y-5">
      {/* Header row with stream control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-100">
            Command Overview
          </h1>
          <p className="text-xs text-slate-400">
            Real-time refrigerated fleet posture, thermal curves, and excursion triage
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsLiveStreamActive(!isLiveStreamActive)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#131a27] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-700 transition-colors whitespace-nowrap"
          >
            {isLiveStreamActive ? (
              <>
                <Pause className="h-3.5 w-3.5 text-sky-400" />
                <span>Pause Telemetry</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 text-emerald-400" />
                <span>Resume Telemetry</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 6 Executive KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`rounded-lg border ${card.borderClass} bg-[#121824] p-4 transition-colors`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{card.label}</span>
                <Icon className={`h-4 w-4 ${card.iconClass}`} />
              </div>
              <div className={`mt-2.5 font-mono text-2xl font-bold tabular-nums ${card.valueClass}`}>
                {card.value}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{card.sub}</div>
            </div>
          );
        })}
      </div>

      {/* 3-Column Command Grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Column 1 (5 cols): Live Fleet Map + Trips Overview mini-table */}
        <div className="space-y-4 xl:col-span-5">
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-100">
                  Live Fleet Status
                </h2>
                <p className="text-[11px] text-slate-400">
                  Click any gateway marker to focus thermal curve
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-[#0d131f] p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setMapStyle('dark')}
                  className={`rounded px-2 py-1 font-medium transition-colors ${
                    mapStyle === 'dark' ? 'bg-slate-800 text-sky-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Map
                </button>
                <button
                  type="button"
                  onClick={() => setMapStyle('satellite')}
                  className={`rounded px-2 py-1 font-medium transition-colors ${
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
              center={[39.2, -95.0]}
              zoom={4}
              heightClass="h-64"
              mapStyle={mapStyle}
              vehicles={vehicles}
              selectedGatewayId={selectedGatewayId}
              onSelectVehicle={(id) => setSelectedGatewayId(id)}
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-100">Trips Overview</h2>
              <button
                type="button"
                onClick={() => setActiveModule('trips')}
                className="flex items-center gap-1 text-xs font-medium text-sky-400 hover:text-sky-300"
              >
                <span>All Trips</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 font-medium">Trip ID</th>
                    <th className="py-2 font-medium">Corridor</th>
                    <th className="py-2 text-right font-medium">GDP</th>
                    <th className="py-2 text-right font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {trips.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => openTripInModule(t.id, 'map')}
                      className="cursor-pointer hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 font-mono font-semibold text-sky-400">{t.id}</td>
                      <td className="py-2.5 text-slate-300">
                        <div className="truncate max-w-[180px]">
                          {t.origin.split(',')[0]} → {t.destination.split(',')[0]}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-200 tabular-nums">
                        {t.gdpCompliancePct.toFixed(1)}%
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

        {/* Column 2 (4 cols): 24h Temperature Chart + AI Insights & Prediction */}
        <div className="space-y-4 xl:col-span-4">
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-100">
                  24h Temperature Trend
                </h2>
                <p className="text-[11px] text-slate-400">
                  Safe band {focusedVehicle.safeMinC}°C to {focusedVehicle.safeMaxC}°C
                </p>
              </div>
              <select
                value={focusedVehicle.id}
                onChange={(e) => setSelectedGatewayId(e.target.value)}
                aria-label="Select gateway for 24h temperature chart"
                className="rounded-md border border-slate-800 bg-[#0d131f] px-2.5 py-1 font-mono text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.id} ({v.currentTempC}°C)
                  </option>
                ))}
              </select>
            </div>

            <Temperature24hChart
              data={focusedVehicle.tempHistory24h}
              safeMin={focusedVehicle.safeMinC}
              safeMax={focusedVehicle.safeMaxC}
              height={195}
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-sky-400" />
                <h2 className="font-display text-sm font-semibold text-slate-100">
                  AI Temperature Prediction
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModule('ai_insights')}
                className="text-xs font-medium text-sky-400 hover:text-sky-300"
              >
                Deep Dive
              </button>
            </div>

            <p className="mb-3 text-xs leading-relaxed text-slate-300">
              {focusedVehicle.aiTriageNote}
            </p>

            <PredictionChart
              currentTemp={focusedVehicle.currentTempC}
              pred15m={focusedVehicle.predictedTemp15m}
              pred30m={focusedVehicle.predictedTemp30m}
              pred1h={focusedVehicle.predictedTemp1h}
              safeMax={focusedVehicle.safeMaxC}
              height={150}
            />

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-800 pt-3 text-center">
              <div>
                <div className="text-[11px] text-slate-400">+15 min</div>
                <div className="font-mono text-sm font-semibold text-slate-100 tabular-nums">
                  {focusedVehicle.predictedTemp15m}°C
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">+30 min</div>
                <div className="font-mono text-sm font-semibold text-slate-100 tabular-nums">
                  {focusedVehicle.predictedTemp30m}°C
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">+1 hour</div>
                <div
                  className={`font-mono text-sm font-semibold tabular-nums ${
                    focusedVehicle.predictedTemp1h > focusedVehicle.safeMaxC
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {focusedVehicle.predictedTemp1h}°C
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3 (3 cols): Fleet Health Donut + Recent Alerts */}
        <div className="space-y-4 xl:col-span-3">
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-100">Fleet Health</h2>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>

            <DonutChart
              segments={healthSegments}
              centerLabel="Health Index"
              centerValue={`${kpis.fleetHealthScore}%`}
              size={128}
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-100">Recent Alerts</h2>
              <button
                type="button"
                onClick={() => setActiveModule('alerts')}
                className="text-xs font-medium text-sky-400 hover:text-sky-300"
              >
                Manage
              </button>
            </div>

            <div className="space-y-2.5">
              {alerts.slice(0, 4).map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-md border border-slate-800/90 bg-[#0d131f] p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-slate-100">{alert.gatewayId}</span>
                    <span
                      className={`font-medium ${
                        alert.severity === 'Critical'
                          ? 'text-rose-400'
                          : alert.severity === 'Major'
                          ? 'text-amber-400'
                          : 'text-sky-400'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <div className="mt-1 text-slate-300">{alert.type}</div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                    Observed: {alert.observedValue}
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-2">
                    <button
                      type="button"
                      onClick={() => openVehicleInTelemetry(alert.gatewayId)}
                      className="font-medium text-sky-400 hover:text-sky-300"
                    >
                      Open Telemetry
                    </button>
                    {alert.status === 'Active' ? (
                      <button
                        type="button"
                        onClick={() => updateAlertStatus(alert.id, 'Acknowledged')}
                        className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-800"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500">{alert.status}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
