import {
  CheckCircle2,
  Download,
  FileCheck2,
  Printer,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useColdChain } from '../../context/ColdChainContext';
import { ReportSubTab } from '../../types/coldchain';
import { DistributionHistogram, DonutChart } from '../charts/TelemetryCharts';

const REPORT_TABS: { id: ReportSubTab; label: string }[] = [
  { id: 'temperature', label: 'Temperature Report' },
  { id: 'trip', label: 'Trip Report' },
  { id: 'compliance', label: 'Compliance Report' },
  { id: 'alert', label: 'Alert Report' },
  { id: 'utilization', label: 'Fleet Utilization' },
];

export const ReportsModule: React.FC = () => {
  const { vehicles, trips, alerts, injectFirmwareTestEvent } = useColdChain();

  const [activeTab, setActiveTab] = useState<ReportSubTab>('temperature');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [fleetGroup, setFleetGroup] = useState<'All' | 'Frozen' | 'Chilled' | 'Ambient'>('All');
  const [simGatewayId, setSimGatewayId] = useState<string>(vehicles[0]?.id || 'GW-001');
  const [simFeedback, setSimFeedback] = useState<string>('');

  const filteredVehicles = useMemo(
    () =>
      fleetGroup === 'All'
        ? vehicles
        : vehicles.filter((v) => v.cargoClass === fleetGroup),
    [vehicles, fleetGroup]
  );

  const complianceMetrics = useMemo(() => {
    const inRange = filteredVehicles.filter(
      (v) => v.currentTempC >= v.safeMinC && v.currentTempC <= v.safeMaxC
    ).length;
    const warning = filteredVehicles.filter((v) => v.condition === 'Warning').length;
    const critical = filteredVehicles.filter((v) => v.condition === 'Critical').length;
    const rate =
      filteredVehicles.length > 0
        ? Math.round((inRange / filteredVehicles.length) * 100)
        : 0;

    return { inRange, warning, critical, rate };
  }, [filteredVehicles]);

  const distributionBuckets = useMemo(() => {
    const frozen = filteredVehicles.filter((v) => v.cargoClass === 'Frozen').length;
    const chilled = filteredVehicles.filter((v) => v.cargoClass === 'Chilled').length;
    const ambient = filteredVehicles.filter((v) => v.cargoClass === 'Ambient').length;
    return [
      { label: 'Cryo (<-60°C)', count: filteredVehicles.filter((v) => v.currentTempC < -30).length, color: '#38bdf8' },
      { label: 'Frozen (-20°C)', count: Math.max(frozen, 1), color: '#0ea5e9' },
      { label: 'Chilled (2–8°C)', count: chilled, color: '#10b981' },
      { label: 'Excursion (>8°C)', count: filteredVehicles.filter((v) => v.currentTempC > 8 && v.cargoClass === 'Chilled').length, color: '#ef4444' },
      { label: 'CRT (15–25°C)', count: ambient, color: '#f59e0b' },
    ];
  }, [filteredVehicles]);

  const handleExportCsv = () => {
    const header = 'GatewayID,Plate,CargoClass,CurrentTempC,SafeMinC,SafeMaxC,Condition,Connectivity\n';
    const rows = filteredVehicles
      .map(
        (v) =>
          `${v.id},${v.vehiclePlate},${v.cargoClass},${v.currentTempC},${v.safeMinC},${v.safeMaxC},${v.condition},${v.connectivity}`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coldchain-${activeTab}-report-${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const triggerFirmwareTest = (scenario: 'door_excursion' | 'signal_drop' | 'restore_nominal') => {
    injectFirmwareTestEvent(simGatewayId, scenario);
    const msg =
      scenario === 'door_excursion'
        ? `Injected thermal excursion + door-open alert on ${simGatewayId}`
        : scenario === 'signal_drop'
        ? `Injected LTE-M signal attenuation (-104 dBm) on ${simGatewayId}`
        : `Restored nominal telemetry state on ${simGatewayId}`;
    setSimFeedback(msg);
    window.setTimeout(() => setSimFeedback(''), 3500);
  };

  return (
    <section id="moduleReports" data-module="reports" className="module-page space-y-5">
      {/* Sub-tabs & Global Report Filters (matching Screenshot 1) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              data-tab={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'text-sky-400' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute right-2 -bottom-[13px] left-2 h-[2px] rounded-full bg-sky-400" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d')}
            aria-label="Report date range"
            className="h-9 rounded-lg border border-slate-800 bg-[#121824] px-3 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>

          <select
            value={fleetGroup}
            onChange={(e) =>
              setFleetGroup(e.target.value as 'All' | 'Frozen' | 'Chilled' | 'Ambient')
            }
            aria-label="Fleet cargo group"
            className="h-9 rounded-lg border border-slate-800 bg-[#121824] px-3 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          >
            <option value="All">All Fleet Groups</option>
            <option value="Chilled">Chilled (2–8°C)</option>
            <option value="Frozen">Frozen / Cryo</option>
            <option value="Ambient">Controlled Ambient</option>
          </select>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-[#121824] px-3 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5 text-sky-400" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-[#121824] px-3 text-xs font-medium text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5 text-slate-400" />
            <span>Print PDF</span>
          </button>
        </div>
      </div>

      {/* TAB 1: TEMPERATURE REPORT */}
      {activeTab === 'temperature' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Total Scheduled Trips</div>
              <div className="mt-2 font-mono text-2xl font-bold text-slate-100 tabular-nums">
                {trips.length}
              </div>
              <div className="mt-1 text-[11px] text-emerald-400">+12% vs prior {dateRange}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Temp Compliance Rate</div>
              <div className="mt-2 font-mono text-2xl font-bold text-sky-400 tabular-nums">
                {complianceMetrics.rate}%
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {complianceMetrics.inRange} of {filteredVehicles.length} units in-band
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Active Alerts</div>
              <div className="mt-2 font-mono text-2xl font-bold text-rose-400 tabular-nums">
                {alerts.filter((a) => a.status === 'Active').length}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Across monitored corridors</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Fleet Utilization</div>
              <div className="mt-2 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                88%
              </div>
              <div className="mt-1 text-[11px] text-slate-400">Active cold-chain capacity</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-5">
              <h2 className="mb-4 font-display text-sm font-semibold text-slate-100">
                Temperature Compliance (2°C–8°C / Assigned Band)
              </h2>
              <DonutChart
                segments={[
                  { label: 'In-Range', value: complianceMetrics.inRange, color: '#38bdf8' },
                  { label: 'Warning', value: complianceMetrics.warning, color: '#f59e0b' },
                  { label: 'Critical', value: complianceMetrics.critical, color: '#ef4444' },
                ]}
                centerLabel="In-Range"
                centerValue={`${complianceMetrics.rate}%`}
                size={168}
              />
            </div>

            <div className="rounded-lg border border-slate-800 bg-[#121824] p-5">
              <h2 className="mb-1 font-display text-sm font-semibold text-slate-100">
                Temperature Distribution
              </h2>
              <p className="text-[11px] text-slate-400">
                Active fleet count grouped across Frozen, Chilled, and Ambient thermal envelopes
              </p>
              <DistributionHistogram buckets={distributionBuckets} />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TRIP REPORT */}
      {activeTab === 'trip' && (
        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 text-xs">
          <h2 className="mb-3 font-display text-sm font-semibold text-slate-100">
            Trip Distance, GDP Compliance & Halt Summary
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 font-medium">Trip ID</th>
                  <th className="py-2.5 font-medium">Route</th>
                  <th className="py-2.5 text-right font-medium">Distance</th>
                  <th className="py-2.5 text-right font-medium">GDP %</th>
                  <th className="py-2.5 text-right font-medium">MKT</th>
                  <th className="py-2.5 text-right font-medium">Halts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {trips.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/30">
                    <td className="py-3 font-mono font-semibold text-sky-400">{t.id}</td>
                    <td className="py-3 text-slate-200">
                      {t.origin} → {t.destination}
                    </td>
                    <td className="py-3 text-right font-mono text-slate-300 tabular-nums">
                      {t.distanceCompletedKm} / {t.distanceTotalKm} km
                    </td>
                    <td className="py-3 text-right font-mono font-semibold text-emerald-400 tabular-nums">
                      {t.gdpCompliancePct.toFixed(1)}%
                    </td>
                    <td className="py-3 text-right font-mono text-slate-200 tabular-nums">
                      {t.mktTempC.toFixed(2)}°C
                    </td>
                    <td className="py-3 text-right font-mono text-slate-300 tabular-nums">
                      {t.halts.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: COMPLIANCE REPORT (FDA 21 CFR Part 11 & WHO GSP) */}
      {activeTab === 'compliance' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 text-xs space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h2 className="font-display text-sm font-semibold text-slate-100">
                FDA 21 CFR Part 11 & WHO GSP Audit Status
              </h2>
            </div>

            <div className="space-y-2.5">
              {[
                {
                  std: 'FDA 21 CFR Part 11 Electronic Records',
                  detail: 'Immutable UTC timestamps & cryptographically signed TLS packets',
                  status: 'Compliant',
                },
                {
                  std: 'WHO Good Storage & Distribution Practices (GSP)',
                  detail: 'NIST-traceable probe calibration ±0.2°C tolerance verified',
                  status: 'Compliant',
                },
                {
                  std: 'EU GDP 2013/C 343/01 Mean Kinetic Temp',
                  detail: 'Fleet mean MKT within 4.82°C chilled envelope',
                  status: 'Verified',
                },
              ].map((row) => (
                <div
                  key={row.std}
                  className="flex items-start justify-between gap-3 rounded-md border border-slate-800 bg-[#0d131f] p-3"
                >
                  <div>
                    <div className="font-semibold text-slate-100">{row.std}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">{row.detail}</div>
                  </div>
                  <span className="flex items-center gap-1 font-semibold text-emerald-400 shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#121824] p-5 text-xs space-y-3">
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-sky-400" />
              <h2 className="font-display text-sm font-semibold text-slate-100">
                Mean Kinetic Temperature (MKT) Ledger
              </h2>
            </div>
            <div className="space-y-2">
              {trips.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-md border border-slate-800 bg-[#0d131f] px-3 py-2.5"
                >
                  <div>
                    <span className="font-mono font-semibold text-sky-400">{t.id}</span>
                    <span className="ml-2 text-slate-400">{t.cargoManifest.split('·')[0]}</span>
                  </div>
                  <span className="font-mono font-semibold text-slate-100 tabular-nums">
                    MKT {t.mktTempC.toFixed(2)}°C
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ALERT REPORT */}
      {activeTab === 'alert' && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
            <div className="text-xs text-slate-400">Total Incidents</div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-100 tabular-nums">
              {alerts.length}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
            <div className="text-xs text-slate-400">Critical Breaches</div>
            <div className="mt-2 font-mono text-2xl font-bold text-rose-400 tabular-nums">
              {alerts.filter((a) => a.severity === 'Critical').length}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
            <div className="text-xs text-slate-400">Avg Acknowledgement Time</div>
            <div className="mt-2 font-mono text-2xl font-bold text-sky-400 tabular-nums">
              4m 18s
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
            <div className="text-xs text-slate-400">Resolution Rate</div>
            <div className="mt-2 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
              {Math.round(
                (alerts.filter((a) => a.status !== 'Active').length / Math.max(1, alerts.length)) *
                  100
              )}
              %
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: FLEET UTILIZATION */}
      {activeTab === 'utilization' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Active Ratio</div>
              <div className="mt-2 font-mono text-2xl font-bold text-sky-400 tabular-nums">
                {Math.round(
                  (vehicles.filter((v) => v.operationalState === 'In Transit').length /
                    Math.max(1, vehicles.length)) *
                    100
                )}
                %
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Total Run Hours</div>
              <div className="mt-2 font-mono text-2xl font-bold text-slate-100 tabular-nums">
                {Math.round(
                  vehicles.reduce((acc, v) => acc + v.trackingMinutes, 0) / 60
                )}
                h
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Idle Dock Time</div>
              <div className="mt-2 font-mono text-2xl font-bold text-amber-400 tabular-nums">
                6.4h
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
              <div className="text-xs text-slate-400">Efficiency Index</div>
              <div className="mt-2 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                94.2
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Firmware Testing Utilities */}
      <div className="rounded-lg border border-slate-800 bg-[#121824] p-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-sky-400" />
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Firmware Testing Utilities
              </h3>
              <p className="text-[11px] text-slate-400">
                Inject synthetic gateway telemetry payloads to verify end-to-end alerting & triage
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={simGatewayId}
              onChange={(e) => setSimGatewayId(e.target.value)}
              aria-label="Target gateway for firmware test"
              className="h-9 rounded-md border border-slate-800 bg-[#0d131f] px-3 font-mono text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.id} ({v.vehiclePlate})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => triggerFirmwareTest('door_excursion')}
              className="h-9 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 font-medium text-rose-300 hover:bg-rose-500/20 whitespace-nowrap"
            >
              Simulate Door Excursion
            </button>
            <button
              type="button"
              onClick={() => triggerFirmwareTest('signal_drop')}
              className="h-9 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 font-medium text-amber-300 hover:bg-amber-500/20 whitespace-nowrap"
            >
              Simulate Signal Drop
            </button>
            <button
              type="button"
              onClick={() => triggerFirmwareTest('restore_nominal')}
              className="h-9 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 font-medium text-emerald-300 hover:bg-emerald-500/20 whitespace-nowrap"
            >
              Restore Nominal
            </button>
          </div>
        </div>

        {simFeedback && (
          <div className="mt-3 rounded border border-sky-500/30 bg-sky-500/10 px-3 py-2 font-mono text-[11px] text-sky-300">
            {simFeedback}
          </div>
        )}
      </div>
    </section>
  );
};
