import { Cpu, X } from 'lucide-react';
import React, { useState } from 'react';
import { useColdChain } from '../../context/ColdChainContext';

export const DeviceRegistrationModal: React.FC = () => {
  const { isRegisterModalOpen, setIsRegisterModalOpen, registerDevice } = useColdChain();

  const [gatewayId, setGatewayId] = useState('GW-CC-409');
  const [vehiclePlate, setVehiclePlate] = useState('REF-4410-NY');
  const [driverName, setDriverName] = useState('Jordan Ellis');
  const [cargoType, setCargoType] = useState('Cell Biologics (2–8°C)');
  const [cargoClass, setCargoClass] = useState<'Frozen' | 'Chilled' | 'Ambient'>('Chilled');
  const [safeMinC, setSafeMinC] = useState('2.0');
  const [safeMaxC, setSafeMaxC] = useState('8.0');
  const [initialTempC, setInitialTempC] = useState('4.2');
  const [imei, setImei] = useState('358910094827890');
  const [imsi, setImsi] = useState('310410948271774');
  const [city, setCity] = useState('Albany Cold Corridor');
  const [region, setRegion] = useState('New York');

  if (!isRegisterModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gatewayId.trim() || !vehiclePlate.trim()) return;
    registerDevice({
      id: gatewayId,
      vehiclePlate,
      driverName,
      cargoType,
      cargoClass,
      safeMinC: Number(safeMinC),
      safeMaxC: Number(safeMaxC),
      initialTempC: Number(initialTempC),
      imei,
      imsi,
      city,
      region,
    });
    setIsRegisterModalOpen(false);
    setGatewayId(`GW-CC-${Math.floor(410 + Math.random() * 500)}`);
  };

  return (
    <div
      id="deviceModal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deviceModalTitle"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-700/80 bg-[#121824] shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-sky-400" />
            <h2 id="deviceModalTitle" className="font-display text-sm font-semibold text-slate-100">
              Register ColdChain Gateway Device
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsRegisterModalOpen(false)}
            aria-label="Close registration modal"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-slate-300">Gateway ID</label>
              <input
                type="text"
                required
                value={gatewayId}
                onChange={(e) => setGatewayId(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-300">Vehicle Plate</label>
              <input
                type="text"
                required
                value={vehiclePlate}
                onChange={(e) => setVehiclePlate(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-slate-300">Driver Name</label>
              <input
                type="text"
                required
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-300">Cargo Profile</label>
              <select
                value={cargoClass}
                onChange={(e) => {
                  const cls = e.target.value as 'Frozen' | 'Chilled' | 'Ambient';
                  setCargoClass(cls);
                  if (cls === 'Frozen') {
                    setSafeMinC('-25.0');
                    setSafeMaxC('-15.0');
                    setInitialTempC('-19.0');
                  } else if (cls === 'Chilled') {
                    setSafeMinC('2.0');
                    setSafeMaxC('8.0');
                    setInitialTempC('4.2');
                  } else {
                    setSafeMinC('15.0');
                    setSafeMaxC('25.0');
                    setInitialTempC('19.5');
                  }
                }}
                className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 text-slate-100 focus:border-sky-500 focus:outline-none"
              >
                <option value="Chilled">Chilled (2°C to 8°C)</option>
                <option value="Frozen">Frozen (-25°C to -15°C)</option>
                <option value="Ambient">Controlled Ambient (15°C to 25°C)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium text-slate-300">Cargo Manifest Label</label>
            <input
              type="text"
              required
              value={cargoType}
              onChange={(e) => setCargoType(e.target.value)}
              className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 text-slate-100 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-medium text-slate-300">Safe Min (°C)</label>
              <input
                type="number"
                step="0.1"
                value={safeMinC}
                onChange={(e) => setSafeMinC(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-300">Safe Max (°C)</label>
              <input
                type="number"
                step="0.1"
                value={safeMaxC}
                onChange={(e) => setSafeMaxC(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-300">Initial Temp (°C)</label>
              <input
                type="number"
                step="0.1"
                value={initialTempC}
                onChange={(e) => setInitialTempC(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-slate-300">IMEI</label>
              <input
                type="text"
                required
                value={imei}
                onChange={(e) => setImei(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-300">IMSI</label>
              <input
                type="text"
                required
                value={imsi}
                onChange={(e) => setImsi(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 font-mono text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-slate-300">Current Sector / City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-slate-300">Region / State</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-800 bg-[#0d131f] px-3 text-slate-100 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-400"
            >
              Provision Gateway
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
