/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TopHeader } from './components/layout/TopHeader';
import { AiInsightsModule } from './components/modules/AiInsightsModule';
import { AlertsModule } from './components/modules/AlertsModule';
import { FleetModule } from './components/modules/FleetModule';
import { LiveTelemetryModule } from './components/modules/LiveTelemetryModule';
import { OverviewDashboard } from './components/modules/OverviewDashboard';
import { ReportsModule } from './components/modules/ReportsModule';
import { TripsModule } from './components/modules/TripsModule';
import { DeviceRegistrationModal } from './components/shared/DeviceRegistrationModal';
import { ColdChainProvider, useColdChain } from './context/ColdChainContext';

const ColdChainRouterView: React.FC = () => {
  const { activeModule } = useColdChain();

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100">
      <TopHeader />
      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        {activeModule === 'overview' && <OverviewDashboard />}
        {activeModule === 'fleet' && <FleetModule />}
        {activeModule === 'telemetry' && <LiveTelemetryModule />}
        {activeModule === 'trips' && <TripsModule />}
        {activeModule === 'alerts' && <AlertsModule />}
        {activeModule === 'ai_insights' && <AiInsightsModule />}
        {activeModule === 'reports' && <ReportsModule />}
      </main>
      <DeviceRegistrationModal />
    </div>
  );
};

export default function App() {
  return (
    <ColdChainProvider>
      <ColdChainRouterView />
    </ColdChainProvider>
  );
}
