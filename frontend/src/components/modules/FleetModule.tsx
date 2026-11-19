import {
  Activity,
  Check,
  Copy,
  Edit3,
  Loader2,
  Lock,
  MapPin,
  Plus,
  Save,
  Search,
  ShieldAlert,
  Thermometer,
  Unlock,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useColdChain } from '../../context/ColdChainContext';
import { ConditionStatus, ConnectivityStatus, VehicleGateway } from '../../types/coldchain';

export const FleetModule: React.FC = () => {
  const {
    vehicles,
    trips,
    openVehicleInTelemetry,
    openTripInModule,
    setActiveModule,
    setSelectedGatewayId,
    setIsRegisterModalOpen,
    updateDeviceConfig,
  } = useColdChain();

  const [searchTerm, setSearchTerm] = useState('');
  const [conditionFilter, setConditionFilter] = useState<'All' | ConditionStatus>('All');
  const [connectivityFilter, setConnectivityFilter] = useState<'All' | ConnectivityStatus>('All');
  const [drawerVehicle, setDrawerVehicle] = useState<VehicleGateway | null>(null);

  // Edit Modal State
  const [editingVehicle, setEditingVehicle] = useState<VehicleGateway | null>(null);
  const [editPlate, setEditPlate] = useState('');
  const [editDriver, setEditDriver] = useState('');
  const [editCargo, setEditCargo] = useState('');
  const [editCargoClass, setEditCargoClass] = useState<'Frozen' | 'Chilled' | 'Ambient'>('Chilled');
  const [editSafeMin, setEditSafeMin] = useState<number>(2.0);
  const [editSafeMax, setEditSafeMax] = useState<number>(8.0);
  const [editImei, setEditImei] = useState('');
  const [editImsi, setEditImsi] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Clipboard copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const openEditModal = (vehicle: VehicleGateway) => {
    setEditingVehicle(vehicle);
    setEditPlate(vehicle.vehiclePlate);
    setEditDriver(vehicle.driverName || 'Assigned Driver');
    setEditCargo(vehicle.cargoType);
    setEditCargoClass(vehicle.cargoClass || 'Chilled');
    setEditSafeMin(vehicle.safeMinC);
    setEditSafeMax(vehicle.safeMaxC);
    setEditImei(vehicle.imei || '');
    setEditImsi(vehicle.imsi || '');
    setSaveSuccessMsg(null);
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;
    setIsSaving(true);
    try {
      const ok = await updateDeviceConfig({
        id: editingVehicle.id,
        vehiclePlate: editPlate.trim(),
        driverName: editDriver.trim(),
        cargoType: editCargo.trim(),
        cargoClass: editCargoClass,
        safeMinC: Number(editSafeMin),
        safeMaxC: Number(editSafeMax),
        imei: editImei.trim(),
        imsi: editImsi.trim(),
      });

      if (ok) {
        setSaveSuccessMsg('Configuration updated successfully!');
        // Keep drawer in sync if open for this device
        if (drawerVehicle && drawerVehicle.id === editingVehicle.id) {
          setDrawerVehicle((prev) =>
            prev
              ? {
                  ...prev,
                  vehiclePlate: editPlate.trim(),
                  driverName: editDriver.trim(),
                  cargoType: editCargo.trim(),
                  cargoClass: editCargoClass,
                  safeMinC: Number(editSafeMin),
                  safeMaxC: Number(editSafeMax),
                  imei: editImei.trim(),
                  imsi: editImsi.trim(),
                }
              : null
          );
        }
        setTimeout(() => {
          setEditingVehicle(null);
          setIsSaving(false);
          setSaveSuccessMsg(null);
        }, 600);
      } else {
        setIsSaving(false);
      }
    } catch {
      setIsSaving(false);
    }
  };

  const filteredVehicles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return vehicles.filter((v) => {
      const matchesSearch =
        !q ||
        v.id.toLowerCase().includes(q) ||
        v.vehiclePlate.toLowerCase().includes(q) ||
        v.cargoType.toLowerCase().includes(q) ||
        v.driverName.toLowerCase().includes(q);
      const matchesCondition = conditionFilter === 'All' || v.condition === conditionFilter;
      const matchesConn = connectivityFilter === 'All' || v.connectivity === connectivityFilter;
      return matchesSearch && matchesCondition && matchesConn;
    });
  }, [vehicles, searchTerm, conditionFilter, connectivityFilter]);

  const activeTripForDrawer = useMemo(() => {
    if (!drawerVehicle) return null;
    return trips.find((t) => t.gatewayId === drawerVehicle.id) || null;
  }, [drawerVehicle, trips]);

  return (
    <section id="moduleFleet" data-module="fleet" className="module-page space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-slate-100">
            Fleet Inventory
          </h1>
          <p className="text-xs text-slate-400">
            {vehicles.length} registered refrigerated units · Click any row for details, or use Actions to edit / jump to telemetry
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsRegisterModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Register New Device</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#121824] p-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter by Gateway ID, Plate, Cargo, or Driver..."
            className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-slate-800 bg-[#0d131f] p-0.5 text-xs">
            {(['All', 'Nominal', 'Warning', 'Critical'] as const).map((cond) => (
              <button
                key={cond}
                type="button"
                onClick={() => setConditionFilter(cond)}
                className={`rounded px-2.5 py-1 font-medium transition-colors whitespace-nowrap ${
                  conditionFilter === cond
                    ? 'bg-slate-800 text-sky-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cond}
              </button>
            ))}
          </div>

          <select
            value={connectivityFilter}
            onChange={(e) => setConnectivityFilter(e.target.value as 'All' | ConnectivityStatus)}
            aria-label="Filter by connectivity"
            className="h-9 rounded-md border border-slate-800 bg-[#0d131f] px-3 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
          >
            <option value="All">All Connectivity</option>
            <option value="Online">Online</option>
            <option value="Degraded">Degraded</option>
            <option value="Offline">Offline</option>
          </select>
        </div>
      </div>

      {/* Fleet Inventory Table */}
      <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#121824]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-[#0e1420] text-slate-400">
                <th className="px-4 py-3 font-medium">Gateway ID</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 text-right font-medium">Temp</th>
                <th className="px-4 py-3 text-right font-medium">Safe Threshold</th>
                <th className="px-4 py-3 font-medium">Connectivity</th>
                <th className="px-4 py-3 font-medium">Security</th>
                <th className="px-4 py-3 text-right font-medium">Condition</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    No fleet vehicles match your active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => {
                  const tempBreach = v.currentTempC > v.safeMaxC || v.currentTempC < v.safeMinC;
                  return (
                    <tr
                      key={v.id}
                      onClick={() => setDrawerVehicle(v)}
                      className="cursor-pointer hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono font-semibold text-sky-400">{v.id}</div>
                        <div className="text-[11px] text-slate-400">
                          {v.vehiclePlate} · {v.driverName}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">{v.cargoType}</div>
                        <div className="text-[11px] text-slate-400">{v.locationTier.city}</div>
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums ${
                          tempBreach ? 'text-rose-400' : 'text-slate-100'
                        }`}
                      >
                        {v.currentTempC.toFixed(1)}°C
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400 tabular-nums">
                        {v.safeMinC}°C to {v.safeMaxC}°C
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-medium ${
                            v.connectivity === 'Online'
                              ? 'text-emerald-400'
                              : v.connectivity === 'Degraded'
                              ? 'text-amber-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {v.connectivity}
                        </span>
                        <span className="ml-1.5 font-mono text-[11px] text-slate-500 tabular-nums">
                          {v.rssiDbm} dBm
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {v.doorStatus} ·{' '}
                        <span
                          className={
                            v.tamperStatus === 'Breached' ? 'font-semibold text-rose-400' : 'text-slate-400'
                          }
                        >
                          {v.tamperStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-semibold ${
                            v.condition === 'Critical'
                              ? 'text-rose-400'
                              : v.condition === 'Warning'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {v.condition}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="Edit Device Configuration"
                            onClick={() => openEditModal(v)}
                            className="inline-flex items-center gap-1 rounded bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-200 border border-slate-700/60 hover:text-white transition-colors"
                          >
                            <Edit3 className="h-3 w-3 text-sky-400" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            title="Open Live Telemetry"
                            onClick={() => openVehicleInTelemetry(v.id)}
                            className="rounded bg-slate-800/80 hover:bg-sky-500/20 p-1.5 text-slate-400 hover:text-sky-300 transition-colors border border-slate-700/60"
                          >
                            <Activity className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="View Vehicle Trips"
                            onClick={() => {
                              const trip = trips.find((t) => t.gatewayId === v.id);
                              if (trip) openTripInModule(trip.id, 'map');
                              else setActiveModule('trips');
                            }}
                            className="rounded bg-slate-800/80 hover:bg-sky-500/20 p-1.5 text-slate-400 hover:text-sky-300 transition-colors border border-slate-700/60"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-out Drilldown Drawer (#drilldownDrawer) */}
      {drawerVehicle && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px]">
          <div
            id="drilldownDrawer"
            className="flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-[#121824] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div>
                <div className="font-mono text-sm font-bold text-sky-400">{drawerVehicle.id}</div>
                <div className="text-xs text-slate-400">
                  {drawerVehicle.vehiclePlate} · {drawerVehicle.driverName}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(drawerVehicle)}
                  className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-805 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <Edit3 className="h-3 w-3 text-sky-400" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerVehicle(null)}
                  aria-label="Close drilldown drawer"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-800 bg-[#0d131f] p-3">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Thermometer className="h-3.5 w-3.5 text-sky-400" />
                    <span>Cabin Temp</span>
                  </div>
                  <div className="mt-1.5 font-mono text-xl font-bold text-slate-100 tabular-nums">
                    {drawerVehicle.currentTempC.toFixed(2)}°C
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                    Limit: {drawerVehicle.safeMinC}°C to {drawerVehicle.safeMaxC}°C
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-[#0d131f] p-3">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    {drawerVehicle.tamperStatus === 'Sealed' ? (
                      <Lock className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5 text-rose-400" />
                    )}
                    <span>Door & Seal</span>
                  </div>
                  <div className="mt-1.5 text-base font-semibold text-slate-100">
                    {drawerVehicle.doorStatus} / {drawerVehicle.tamperStatus}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {drawerVehicle.activeNodes}/{drawerVehicle.totalNodes} sensor nodes active
                  </div>
                </div>
              </div>

              {/* Hardware & Link Telemetry with unmasked IMEI & IMSI + copy buttons */}
              <div className="space-y-2.5 rounded-lg border border-slate-800 bg-[#0d131f] p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200">Hardware & Link Telemetry</div>
                  <button
                    type="button"
                    onClick={() => openEditModal(drawerVehicle)}
                    className="flex items-center gap-1 text-[11px] font-medium text-sky-400 hover:text-sky-300"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit Config</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-y-2.5 text-[11px]">
                  <span className="text-slate-400">Gateway Hardware ID (IMEI)</span>
                  <div className="flex items-center justify-end gap-1.5 font-mono text-slate-200">
                    <span className="truncate max-w-[160px]" title={drawerVehicle.imei || 'Not Set'}>
                      {drawerVehicle.imei || 'Not Set'}
                    </span>
                    {drawerVehicle.imei && (
                      <button
                        type="button"
                        onClick={() => handleCopy(drawerVehicle.imei, 'drawer-imei')}
                        title="Copy IMEI"
                        className="text-slate-400 hover:text-sky-400 transition-colors p-0.5"
                      >
                        {copiedKey === 'drawer-imei' ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>

                  <span className="text-slate-400">SIM Carrier Token (IMSI)</span>
                  <div className="flex items-center justify-end gap-1.5 font-mono text-slate-200">
                    <span className="truncate max-w-[160px]" title={drawerVehicle.imsi || 'Not Set'}>
                      {drawerVehicle.imsi || 'Not Set'}
                    </span>
                    {drawerVehicle.imsi && (
                      <button
                        type="button"
                        onClick={() => handleCopy(drawerVehicle.imsi, 'drawer-imsi')}
                        title="Copy IMSI"
                        className="text-slate-400 hover:text-sky-400 transition-colors p-0.5"
                      >
                        {copiedKey === 'drawer-imsi' ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>

                  <span className="text-slate-400">Cellular RSSI</span>
                  <span className="text-right font-mono text-slate-200">{drawerVehicle.rssiDbm} dBm</span>
                  <span className="text-slate-400">Battery Reserve</span>
                  <span className="text-right font-mono text-slate-200">{drawerVehicle.batteryPct}%</span>
                  <span className="text-slate-400">GPS Lock</span>
                  <span className="text-right font-mono text-slate-200">
                    {drawerVehicle.gpsFixQuality} ({drawerVehicle.gpsSatellites} sats)
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 rounded-lg border border-slate-800 bg-[#0d131f] p-4">
                <div className="font-semibold text-slate-200">AI Triage Verdict</div>
                <p className="leading-relaxed text-slate-300">{drawerVehicle.aiTriageNote}</p>
              </div>
            </div>

            {/* Deep-links Footer */}
            <div className="space-y-2 border-t border-slate-800 p-4">
              <button
                type="button"
                onClick={() => {
                  const id = drawerVehicle.id;
                  setDrawerVehicle(null);
                  openVehicleInTelemetry(id);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors"
              >
                <Activity className="h-3.5 w-3.5" />
                <span>Open Live Telemetry</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                {activeTripForDrawer ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerVehicle(null);
                      openTripInModule(activeTripForDrawer.id, 'map');
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0d131f] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                  >
                    <MapPin className="h-3.5 w-3.5 text-sky-400" />
                    <span>Trip Replay</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerVehicle(null);
                      setActiveModule('trips');
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0d131f] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                  >
                    <MapPin className="h-3.5 w-3.5 text-sky-400" />
                    <span>Trips</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setSelectedGatewayId(drawerVehicle.id);
                    setDrawerVehicle(null);
                    setActiveModule('ai_insights');
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-[#0d131f] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                  <span>AI Risk Profile</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Vehicle Modal */}
      {editingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-[#121824] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 bg-[#0e1420]">
              <div>
                <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
                  <Edit3 className="h-4 w-4 text-sky-400" />
                  Edit Gateway Configuration
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Device ID: <span className="text-sky-400 font-semibold">{editingVehicle.id}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingVehicle(null)}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              {saveSuccessMsg && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-950/50 border border-emerald-500/30 px-3.5 py-2.5 text-emerald-300">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Vehicle Label / Plate <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editPlate}
                    onChange={(e) => setEditPlate(e.target.value)}
                    placeholder="e.g. TRK-9901"
                    className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Assigned Driver Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editDriver}
                    onChange={(e) => setEditDriver(e.target.value)}
                    placeholder="e.g. Marcus Vance"
                    className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3.5">
                <div className="col-span-2">
                  <label className="block font-medium text-slate-300 mb-1">
                    Cargo Classification <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editCargo}
                    onChange={(e) => setEditCargo(e.target.value)}
                    placeholder="e.g. Live Cold-Chain Telemetry / Biologics"
                    className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Tier Class</label>
                  <select
                    value={editCargoClass}
                    onChange={(e) => setEditCargoClass(e.target.value as 'Frozen' | 'Chilled' | 'Ambient')}
                    className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-2.5 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                  >
                    <option value="Chilled">Chilled (2-8°C)</option>
                    <option value="Frozen">Frozen (-20°C)</option>
                    <option value="Ambient">Ambient (15-25°C)</option>
                  </select>
                </div>
              </div>

              {/* Safe Temperature Envelope */}
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Safe Temperature Envelope (°C) <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[11px]">Min:</span>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={editSafeMin}
                      onChange={(e) => setEditSafeMin(parseFloat(e.target.value) || 0)}
                      className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] pl-11 pr-3 font-mono text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-[11px]">Max:</span>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={editSafeMax}
                      onChange={(e) => setEditSafeMax(parseFloat(e.target.value) || 0)}
                      className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] pl-11 pr-3 font-mono text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Hardware Identifiers: IMEI & IMSI */}
              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Hardware IMEI (15 digits)
                  </label>
                  <input
                    type="text"
                    value={editImei}
                    maxLength={18}
                    onChange={(e) => setEditImei(e.target.value)}
                    placeholder="e.g. 860123456789012"
                    className="h-9 w-full font-mono rounded-md border border-slate-800 bg-[#0d131f] px-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    SIM Carrier IMSI (15 digits)
                  </label>
                  <input
                    type="text"
                    value={editImsi}
                    maxLength={18}
                    onChange={(e) => setEditImsi(e.target.value)}
                    placeholder="e.g. 310410123456789"
                    className="h-9 w-full font-mono rounded-md border border-slate-800 bg-[#0d131f] px-3 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}
                  disabled={isSaving}
                  className="rounded-lg border border-slate-800 px-4 py-2 font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 font-semibold text-slate-950 hover:bg-sky-400 transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
