import { BrainCircuit, Check, Cpu, MapPin, ShieldAlert, Thermometer, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useColdChain } from '../../context/ColdChainContext';
import { PredictionChart } from '../charts/TelemetryCharts';
import { LeafletMap } from '../shared/LeafletMap';

const RadialGauge: React.FC<{
  value: number;
  label: string;
  color: string;
  subtitle: string;
}> = ({ value, label, color, subtitle }) => {
  const r = 42;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75; // 270 deg gauge
  const filled = (Math.min(100, Math.max(0, value)) / 100) * arc;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-28 w-28">
        <svg viewBox="0 0 110 110" className="h-full w-full rotate-[135deg]">
          <circle
            cx="55"
            cy="55"
            r={r}
            fill="none"
            stroke="rgba(148,163,184,0.14)"
            strokeWidth="9"
            strokeDasharray={`${arc} ${c}`}
            strokeLinecap="round"
          />
          <circle
            cx="55"
            cy="55"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeDasharray={`${filled} ${c}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-bold text-slate-100 tabular-nums">{value}%</span>
          <span className="text-[10px] text-slate-400">{label}</span>
        </div>
      </div>
      <div className="mt-1 text-center text-[11px] text-slate-400">{subtitle}</div>
    </div>
  );
};

export const AiInsightsModule: React.FC = () => {
  const {
    vehicles,
    recommendations,
    selectedGatewayId,
    setSelectedGatewayId,
    updateRecommendationStatus,
    openVehicleInTelemetry,
  } = useColdChain();

  const [timeWindow, setTimeWindow] = useState<'24h' | '7d' | '30d'>('7d');
  const [recFilter, setRecFilter] = useState<'All' | 'Pending' | 'Applied'>('All');

  const focused = useMemo(
    () => vehicles.find((v) => v.id === selectedGatewayId) || vehicles[0],
    [vehicles, selectedGatewayId]
  );

  const fleetAverages = useMemo(() => {
    const avgRisk = Math.round(
      vehicles.reduce((acc, v) => acc + v.aiRiskScore, 0) / Math.max(1, vehicles.length)
    );
    const avgHealth = Math.round(
      vehicles.reduce((acc, v) => acc + v.deviceHealthScore, 0) / Math.max(1, vehicles.length)
    );
    return { avgRisk, avgHealth };
  }, [vehicles]);

  const riskBreakdown = useMemo(() => {
    const criticalSpoilage = Math.min(
      100,
      Math.round(
        (vehicles.filter((v) => v.condition === 'Critical').length / Math.max(1, vehicles.length)) * 100 +
          18
      )
    );
    const disconnection = Math.min(
      100,
      Math.round(
        (vehicles.filter((v) => v.connectivity !== 'Online').length / Math.max(1, vehicles.length)) *
          100 +
          12
      )
    );
    return [
      { label: 'Critical Spoilage Risk', pct: criticalSpoilage, color: '#ef4444' },
      { label: 'Device Disconnection', pct: disconnection, color: '#f59e0b' },
      { label: 'Routing Delays', pct: 28, color: '#38bdf8' },
      { label: 'Geofence Exits', pct: 16, color: '#22d3ee' },
    ];
  }, [vehicles]);

  const healthTrend = [96, 95, 94, 92, 90, 91, fleetAverages.avgHealth];
  const filteredRecs = useMemo(
    () =>
      recFilter === 'All'
        ? recommendations
        : recommendations.filter((r) => r.status === recFilter),
    [recommendations, recFilter]
  );

  return (
    <section id="moduleAiInsights" data-module="ai_insights" className="module-page space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-100">
            AI Insights & Thermal Prediction
          </h1>
          <p className="text-xs text-slate-400">
            Predictive thermal drift modeling, GPS anomaly intelligence, and preventive recommendations
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={focused.id}
            onChange={(e) => setSelectedGatewayId(e.target.value)}
            aria-label="Select gateway for AI analysis"
            className="h-9 rounded-lg border border-slate-800 bg-[#121824] px-3 font-mono text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id} · Risk {v.aiRiskScore}
              </option>
            ))}
          </select>

          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(e.target.value as '24h' | '7d' | '30d')}
            aria-label="Select AI insights time window"
            className="h-9 rounded-lg border border-slate-800 bg-[#121824] px-3 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* 4 Top Gauges / Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-300">
            <span>Overall AI Risk</span>
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          </div>
          <RadialGauge
            value={fleetAverages.avgRisk}
            label="Fleet Risk"
            color={fleetAverages.avgRisk > 50 ? '#ef4444' : '#f59e0b'}
            subtitle={`Focused ${focused.id}: ${focused.aiRiskScore}/100`}
          />
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-300">
            <span>Device Health</span>
            <Cpu className="h-4 w-4 text-emerald-400" />
          </div>
          <RadialGauge
            value={fleetAverages.avgHealth}
            label="Node Health"
            color="#10b981"
            subtitle={`Focused ${focused.id}: ${focused.deviceHealthScore}%`}
          />
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-300">
            <span>Temperature Prediction</span>
            <Thermometer className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-[11px] text-slate-400">
            Horizon forecast for <span className="font-mono text-sky-400">{focused.id}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-slate-800 bg-[#0d131f] p-2.5">
              <div className="text-[10px] text-slate-400">+15m</div>
              <div className="mt-1 font-mono text-sm font-bold text-slate-100 tabular-nums">
                {focused.predictedTemp15m}°C
              </div>
            </div>
            <div className="rounded-md border border-slate-800 bg-[#0d131f] p-2.5">
              <div className="text-[10px] text-slate-400">+30m</div>
              <div className="mt-1 font-mono text-sm font-bold text-slate-100 tabular-nums">
                {focused.predictedTemp30m}°C
              </div>
            </div>
            <div className="rounded-md border border-slate-800 bg-[#0d131f] p-2.5">
              <div className="text-[10px] text-slate-400">+1h</div>
              <div
                className={`mt-1 font-mono text-sm font-bold tabular-nums ${
                  focused.predictedTemp1h > focused.safeMaxC ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {focused.predictedTemp1h}°C
              </div>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-slate-400">
            Threshold ceiling: <span className="font-mono text-slate-200">{focused.safeMaxC}°C</span>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-300">
            <span>GPS Intelligence</span>
            <MapPin className="h-4 w-4 text-sky-400" />
          </div>
          <LeafletMap
            center={[focused.lat, focused.lng]}
            zoom={7}
            heightClass="h-32"
            vehicles={vehicles}
            selectedGatewayId={focused.id}
            onSelectVehicle={(id) => setSelectedGatewayId(id)}
          />
        </div>
      </div>

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 lg:col-span-4">
          <h2 className="mb-3 font-display text-sm font-semibold text-slate-100">
            Risk Breakdown ({timeWindow})
          </h2>
          <div className="space-y-3.5 text-xs">
            {riskBreakdown.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="font-mono font-semibold text-slate-100 tabular-nums">
                    {item.pct}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 lg:col-span-4">
          <h2 className="mb-1 font-display text-sm font-semibold text-slate-100">
            Temperature Trend & Prediction
          </h2>
          <p className="mb-2 text-[11px] text-slate-400">
            {focused.id} actual vs. 60-minute drift trajectory
          </p>
          <PredictionChart
            currentTemp={focused.currentTempC}
            pred15m={focused.predictedTemp15m}
            pred30m={focused.predictedTemp30m}
            pred1h={focused.predictedTemp1h}
            safeMax={focused.safeMaxC}
            height={170}
          />
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 lg:col-span-4">
          <h2 className="mb-1 font-display text-sm font-semibold text-slate-100">
            Device Health Trend
          </h2>
          <p className="mb-3 text-[11px] text-slate-400">
            7-day cellular RSSI & battery stability index
          </p>
          <div className="flex h-36 items-end justify-between gap-2 pt-4">
            {healthTrend.map((val, idx) => (
              <div key={idx} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="font-mono text-[10px] text-slate-300 tabular-nums">{val}%</span>
                <div className="flex h-24 w-full items-end rounded-t bg-slate-900/70 px-1">
                  <div
                    className="w-full rounded-t bg-emerald-500/80"
                    style={{ height: `${val}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-slate-500">D-{6 - idx}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actionable Feed & Latest AI Analysis Table */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 lg:col-span-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-sky-400" />
              <h2 className="font-display text-sm font-semibold text-slate-100">
                AI Recommendations
              </h2>
            </div>

            <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-[#0d131f] p-0.5 text-xs">
              {(['All', 'Pending', 'Applied'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setRecFilter(st)}
                  className={`rounded px-2.5 py-1 font-medium ${
                    recFilter === st ? 'bg-slate-800 text-sky-400' : 'text-slate-400'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            {filteredRecs.map((rec) => (
              <div
                key={rec.id}
                className="rounded-md border border-slate-800 bg-[#0d131f] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100">{rec.title}</span>
                  <span
                    className={`shrink-0 font-mono text-[11px] font-semibold ${
                      rec.priority === 'High'
                        ? 'text-rose-400'
                        : rec.priority === 'Medium'
                        ? 'text-amber-400'
                        : 'text-sky-400'
                    }`}
                  >
                    {rec.priority}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {rec.gatewayId} · {rec.category}
                </div>
                <p className="mt-1.5 leading-relaxed text-slate-300">{rec.rationale}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-2">
                  <span className="text-[11px] text-emerald-400">{rec.projectedImpact}</span>
                  {rec.status === 'Pending' ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateRecommendationStatus(rec.id, 'Applied')}
                        className="flex items-center gap-1 rounded bg-sky-500/20 px-2 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-500/30"
                      >
                        <Check className="h-3 w-3" /> Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => updateRecommendationStatus(rec.id, 'Dismissed')}
                        className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200"
                      >
                        <X className="h-3 w-3" /> Dismiss
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400">{rec.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 lg:col-span-6">
          <h2 className="mb-3 font-display text-sm font-semibold text-slate-100">
            Latest AI Fleet Analysis
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2 font-medium">Gateway</th>
                  <th className="py-2 text-right font-medium">Risk</th>
                  <th className="py-2 text-right font-medium">+1h Forecast</th>
                  <th className="py-2 pl-3 font-medium">Triage Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {vehicles.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => openVehicleInTelemetry(v.id)}
                    className="cursor-pointer hover:bg-slate-800/40"
                  >
                    <td className="py-2.5 font-mono font-semibold text-sky-400">{v.id}</td>
                    <td
                      className={`py-2.5 text-right font-mono font-semibold tabular-nums ${
                        v.aiRiskScore > 65
                          ? 'text-rose-400'
                          : v.aiRiskScore > 35
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {v.aiRiskScore}
                    </td>
                    <td className="py-2.5 text-right font-mono text-slate-200 tabular-nums">
                      {v.predictedTemp1h}°C
                    </td>
                    <td className="py-2.5 pl-3 text-slate-300">{v.aiTriageNote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
};
