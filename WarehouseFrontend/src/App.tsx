import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { MainLayout } from './layout/MainLayout';
import Dashboard from './Dashboard';
import { SettingsProfile } from './pages/SettingsProfile';
import { LogicDebugger } from './pages/LogicDebugger';
import { SystemIntegrity } from './pages/SystemIntegrity';
import { CrmDashboard } from './pages/CrmDashboard';
import { ShopFloorKanban } from './pages/ShopFloorKanban';
import { ProjectOverview } from './pages/ProjectOverview';
import { DataIngestion } from './pages/DataIngestion';
import { FinancialDashboard } from './pages/FinancialDashboard';
import { CommandPalette } from './CommandPalette';

const App = () => {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState('VIEWER');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      extractRole(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      extractRole(session);
    });
  }, []);

  const extractRole = (currentSession: any) => {
    if (currentSession?.user?.app_metadata?.user_role) {
      setUserRole(currentSession.user.app_metadata.user_role);
    }
  };

  if (!session) {
    // For demo purposes, forcefully bypass auth since GitHub provider isn't enabled in this Supabase instance
    return (
      <BrowserRouter>
        <MainLayout session={{ user: { id: 'demo' } }} role="SUPER_ADMIN">
          <Routes>
            <Route path="/" element={<Dashboard role="SUPER_ADMIN" />} />
            <Route path="/logic-debugger" element={<LogicDebugger />} />
            <Route path="/system-health" element={<SystemIntegrity />} />
            <Route path="/crm" element={<CrmDashboard />} />
            <Route path="/kanban" element={<ShopFloorKanban />} />
            <Route path="/projects" element={<ProjectOverview />} />
            <Route path="/data-ingestion" element={<DataIngestion />} />
            <Route path="/finance" element={<FinancialDashboard />} />
            <Route path="/settings" element={<SettingsProfile session={{}} role="SUPER_ADMIN" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <MainLayout session={session} role={userRole}>
        <Routes>
          <Route path="/" element={<Dashboard role={userRole} />} />
          <Route path="/logic-debugger" element={userRole === 'SUPER_ADMIN' || userRole === 'PLANNER' ? <LogicDebugger /> : <Navigate to="/" />} />
          <Route path="/system-health" element={userRole === 'SUPER_ADMIN' || userRole === 'PLANNER' ? <SystemIntegrity /> : <Navigate to="/" />} />
          <Route path="/crm" element={<CrmDashboard />} />
          <Route path="/kanban" element={<ShopFloorKanban />} />
          <Route path="/projects" element={<ProjectOverview />} />
          <Route path="/data-ingestion" element={<DataIngestion />} />
          <Route path="/finance" element={<FinancialDashboard />} />
          <Route path="/settings" element={<SettingsProfile session={session} role={userRole} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
};

export default App;
