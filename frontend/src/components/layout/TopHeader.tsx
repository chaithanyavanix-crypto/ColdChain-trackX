import {
  Activity,
  Bell,
  BrainCircuit,
  FileBarChart2,
  LayoutDashboard,
  MapPin,
  Search,
  ShieldAlert,
  Snowflake,
  Truck,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useColdChain } from '../../context/ColdChainContext';
import { ModuleId } from '../../types/coldchain';

const NAV_ITEMS: { id: ModuleId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'fleet', label: 'Fleet', icon: Truck },
  { id: 'telemetry', label: 'Live Telemetry', icon: Activity },
  { id: 'trips', label: 'Trips', icon: MapPin },
  { id: 'alerts', label: 'Alerts', icon: ShieldAlert },
  { id: 'ai_insights', label: 'AI Insights', icon: BrainCircuit },
  { id: 'reports', label: 'Reports', icon: FileBarChart2 },
];

export const TopHeader: React.FC = () => {
  const {
    activeModule,
    setActiveModule,
    vehicles,
    trips,
    alerts,
    openVehicleInTelemetry,
    openTripInModule,
    updateAlertStatus,
    globalSearchQuery,
    setGlobalSearchQuery,
  } = useColdChain();

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const activeAlertsList = useMemo(
    () => alerts.filter((a) => a.status === 'Active'),
    [alerts]
  );

  const searchResults = useMemo(() => {
    const q = globalSearchQuery.trim().toLowerCase();
    if (!q) return { vehicles: [], trips: [] };
    return {
      vehicles: vehicles
        .filter(
          (v) =>
            v.id.toLowerCase().includes(q) ||
            v.vehiclePlate.toLowerCase().includes(q) ||
            v.cargoType.toLowerCase().includes(q) ||
            v.driverName.toLowerCase().includes(q)
        )
        .slice(0, 4),
      trips: trips
        .filter(
          (t) =>
            t.id.toLowerCase().includes(q) ||
            t.origin.toLowerCase().includes(q) ||
            t.destination.toLowerCase().includes(q)
        )
        .slice(0, 3),
    };
  }, [globalSearchQuery, vehicles, trips]);

  return (
    <header className="ccms-top-header sticky top-0 z-40 border-b border-slate-800/80 bg-[#0d121c]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
        {/* Brand Zone */}
        <button
          type="button"
          onClick={() => setActiveModule('overview')}
          className="flex shrink-0 items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-md"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 border border-sky-400/25">
            <Snowflake className="h-4.5 w-4.5" />
          </span>
          <span className="font-display text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
            ColdChain CMS
          </span>
        </button>

        {/* Primary Module Navigation — Exact 7-module order */}
        <nav
          aria-label="Primary modules"
          className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-module={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 text-xs sm:text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-md ${
                  isActive
                    ? 'text-sky-400'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
                {item.id === 'alerts' && activeAlertsList.length > 0 && (
                  <span className="ml-0.5 font-mono text-[11px] font-semibold text-rose-400 tabular-nums">
                    ({activeAlertsList.length})
                  </span>
                )}
                {isActive && (
                  <span className="absolute right-2 -bottom-[13px] left-2 h-[2px] rounded-full bg-sky-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Controls: Global Search, Alerts Popover, Register Device */}
        <div className="flex shrink-0 items-center gap-2.5">
          {/* Global Search */}
          <div className="relative hidden xl:block">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setIsSearchFocused(false), 180)}
              placeholder="Search gateway, plate, trip..."
              aria-label="Search fleet or trips"
              className="h-9 w-56 rounded-lg border border-slate-800 bg-[#131a27] pl-8 pr-7 text-xs text-slate-200 placeholder:text-slate-500 focus:border-sky-500/60 focus:outline-none"
            />
            {globalSearchQuery && (
              <button
                type="button"
                onClick={() => setGlobalSearchQuery('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {isSearchFocused && globalSearchQuery.trim().length > 0 && (
              <div className="absolute right-0 mt-2 w-80 rounded-lg border border-slate-700/80 bg-[#131a27] p-2 shadow-2xl">
                {searchResults.vehicles.length === 0 && searchResults.trips.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-slate-400">
                    No matching gateways or trips.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {searchResults.vehicles.length > 0 && (
                      <div>
                        <p className="px-2 py-1 text-[11px] font-semibold text-slate-400">Gateways</p>
                        {searchResults.vehicles.map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onMouseDown={() => {
                              openVehicleInTelemetry(v.id);
                              setGlobalSearchQuery('');
                            }}
                            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-800/80"
                          >
                            <span>
                              <span className="font-mono font-semibold text-slate-100">{v.id}</span>
                              <span className="ml-2 text-slate-400">{v.vehiclePlate}</span>
                            </span>
                            <span className="font-mono text-sky-400 tabular-nums">{v.currentTempC}°C</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.trips.length > 0 && (
                      <div>
                        <p className="px-2 py-1 text-[11px] font-semibold text-slate-400">Trips</p>
                        {searchResults.trips.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onMouseDown={() => {
                              openTripInModule(t.id, 'map');
                              setGlobalSearchQuery('');
                            }}
                            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-slate-800/80"
                          >
                            <span className="font-mono font-semibold text-slate-100">{t.id}</span>
                            <span className="truncate pl-2 text-slate-400">{t.destination}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Alerts Popover Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsNotifOpen((prev) => !prev)}
              aria-label="Active alerts menu"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-[#131a27] text-slate-300 hover:border-slate-700 hover:text-white transition-colors"
            >
              <Bell className="h-4 w-4" />
              {activeAlertsList.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 font-mono text-[10px] font-bold text-white tabular-nums">
                  {activeAlertsList.length}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-lg border border-slate-700/80 bg-[#131a27] p-3 shadow-2xl">
                <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-semibold text-slate-100">
                    Active Alerts ({activeAlertsList.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotifOpen(false);
                      setActiveModule('alerts');
                    }}
                    className="text-xs font-medium text-sky-400 hover:text-sky-300"
                  >
                    View all
                  </button>
                </div>
                {activeAlertsList.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">
                    All fleet alerts acknowledged.
                  </p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {activeAlertsList.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-md border border-slate-800 bg-[#0e1420] p-2.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-slate-100">{a.gatewayId}</span>
                          <span
                            className={`font-medium ${
                              a.severity === 'Critical' ? 'text-rose-400' : 'text-amber-400'
                            }`}
                          >
                            {a.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-300">{a.type} · {a.observedValue}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateAlertStatus(a.id, 'Acknowledged')}
                            className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                          >
                            Acknowledge
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsNotifOpen(false);
                              openVehicleInTelemetry(a.gatewayId);
                            }}
                            className="text-[11px] font-medium text-sky-400 hover:text-sky-300"
                          >
                            Inspect
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
