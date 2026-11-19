import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useColdChain } from '../../context/ColdChainContext';
import { AlertState } from '../../types/coldchain';

export const AlertsModule: React.FC = () => {
  const { alerts, vehicles, updateAlertStatus, openVehicleInTelemetry } = useColdChain();

  const [gatewayFilter, setGatewayFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | AlertState>('All');
  const [dateRange, setDateRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const critical = alerts.filter((a) => a.severity === 'Critical').length;
    const major = alerts.filter((a) => a.severity === 'Major').length;
    const minor = alerts.filter((a) => a.severity === 'Minor').length;
    const acknowledged = alerts.filter((a) => a.status === 'Acknowledged' || a.status === 'Resolved').length;
    return { critical, major, minor, acknowledged };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alerts.filter((a) => {
      const mGw = gatewayFilter === 'All' || a.gatewayId === gatewayFilter;
      const mType = typeFilter === 'All' || a.type === typeFilter;
      const mStatus = statusFilter === 'All' || a.status === statusFilter;
      const mQuery =
        !q ||
        a.id.toLowerCase().includes(q) ||
        a.gatewayId.toLowerCase().includes(q) ||
        a.aiClassification.toLowerCase().includes(q);
      return mGw && mType && mStatus && mQuery;
    });
  }, [alerts, gatewayFilter, typeFilter, statusFilter, query]);

  const alertTypes = [
    'Thermal Excursion',
    'Door Open In-Transit',
    'Tamper Seal Breach',
    'Geofence Deviation',
    'Gateway Offline',
    'Compressor Drift',
  ];

  return (
    <section id="moduleAlerts" data-module="alerts" className="module-page space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-100">
            Alerts & Incident Triage
          </h1>
          <p className="text-xs text-slate-400">
            AI-classified excursion incidents with interactive acknowledgement and resolution workflow
          </p>
        </div>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as '24h' | '7d' | '30d')}
          aria-label="Alert date range"
          className="h-9 rounded-lg border border-slate-800 bg-[#121824] px-3 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
        >
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
      </div>

      {/* 4 Severity KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-rose-500/35 bg-[#121824] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Critical</span>
            <AlertOctagon className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-rose-400 tabular-nums">
            {counts.critical}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Immediate cargo risk</div>
        </div>

        <div className="rounded-lg border border-amber-500/35 bg-[#121824] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Major</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-amber-400 tabular-nums">
            {counts.major}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Drift & door threshold</div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-[#121824] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Minor</span>
            <Info className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-sky-400 tabular-nums">
            {counts.minor}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Signal & route notices</div>
        </div>

        <div className="rounded-lg border border-emerald-500/30 bg-[#121824] p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Acknowledged / Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
            {counts.acknowledged}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Handled by ops desk</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-[#121824] p-3 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search alert ID, gateway, or AI diagnosis..."
            className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] pl-9 pr-3 text-slate-200 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </div>

        <select
          value={gatewayFilter}
          onChange={(e) => setGatewayFilter(e.target.value)}
          aria-label="Filter by Gateway ID"
          className="h-9 rounded-md border border-slate-800 bg-[#0d131f] px-3 font-mono text-slate-200 focus:border-sky-500 focus:outline-none"
        >
          <option value="All">All Gateways</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.id}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by Alert Type"
          className="h-9 rounded-md border border-slate-800 bg-[#0d131f] px-3 text-slate-200 focus:border-sky-500 focus:outline-none"
        >
          <option value="All">All Alert Types</option>
          {alertTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-[#0d131f] p-0.5">
          {(['All', 'Active', 'Acknowledged', 'Resolved'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-slate-800 text-sky-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Incident Table */}
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#121824]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0e1420] text-slate-400">
                <th className="px-4 py-3 font-medium">Incident</th>
                <th className="px-4 py-3 font-medium">Gateway</th>
                <th className="px-4 py-3 font-medium">Severity & Type</th>
                <th className="px-4 py-3 font-medium">Observed / Limit</th>
                <th className="px-4 py-3 font-medium">AI Classification</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredAlerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No incidents match the selected filters ({dateRange}).
                  </td>
                </tr>
              ) : (
                filteredAlerts.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-slate-200">{a.id}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {a.timestampIso.slice(11, 19)} UTC
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openVehicleInTelemetry(a.gatewayId)}
                        className="font-mono font-semibold text-sky-400 hover:text-sky-300"
                      >
                        {a.gatewayId}
                      </button>
                      <div className="text-[11px] text-slate-400">{a.vehiclePlate}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className={`font-semibold ${
                          a.severity === 'Critical'
                            ? 'text-rose-400'
                            : a.severity === 'Major'
                            ? 'text-amber-400'
                            : 'text-sky-400'
                        }`}
                      >
                        {a.severity} · {a.type}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono font-medium text-slate-100">{a.observedValue}</div>
                      <div className="font-mono text-[11px] text-slate-500">Limit: {a.thresholdValue}</div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="text-slate-200">{a.aiClassification}</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">{a.recommendedAction}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          a.status === 'Active'
                            ? 'text-rose-400'
                            : a.status === 'Acknowledged'
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {a.status}
                      </span>
                      {a.acknowledgedBy && (
                        <div className="text-[11px] text-slate-500">{a.acknowledgedBy}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <select
                        value={a.status}
                        onChange={(e) => updateAlertStatus(a.id, e.target.value as AlertState)}
                        aria-label={`Change status for ${a.id}`}
                        className="h-8 rounded-md border border-slate-700 bg-[#0d131f] px-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                      >
                        <option value="Active">Active</option>
                        <option value="Acknowledged">Acknowledged</option>
                        <option value="Resolved">Resolved</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
