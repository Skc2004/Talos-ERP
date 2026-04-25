import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { MainLayout } from './layout/MainLayout';
import Dashboard from './Dashboard';
import { LoginPage } from './pages/LoginPage';
import { Settings } from './pages/Settings';
import { LogicDebugger } from './pages/LogicDebugger';
import { SystemIntegrity } from './pages/SystemIntegrity';
import { CrmDashboard } from './pages/CrmDashboard';
import { ShopFloorKanban } from './pages/ShopFloorKanban';
import { ProjectOverview } from './pages/ProjectOverview';
import { DataIngestion } from './pages/DataIngestion';
import { FinancialDashboard } from './pages/FinancialDashboard';
import { WarehouseMapPage } from './pages/WarehouseMapPage';
import { CommandPalette } from './CommandPalette';

// Role-based route access map
const ROLE_ACCESS: Record<string, string[]> = {
  '/':               ['SUPER_ADMIN', 'FINANCE', 'WAREHOUSE_OPERATOR', 'SALES', 'PLANNER', 'VIEWER'],
  '/logic-debugger': ['SUPER_ADMIN', 'PLANNER'],
  '/system-health':  ['SUPER_ADMIN', 'PLANNER'],
  '/crm':            ['SUPER_ADMIN', 'SALES', 'PLANNER'],
  '/kanban':         ['SUPER_ADMIN', 'WAREHOUSE_OPERATOR', 'PLANNER'],
  '/projects':       ['SUPER_ADMIN', 'PLANNER', 'SALES'],
  '/data-ingestion': ['SUPER_ADMIN', 'WAREHOUSE_OPERATOR', 'PLANNER'],
  '/finance':        ['SUPER_ADMIN', 'FINANCE'],
  '/settings':       ['SUPER_ADMIN', 'FINANCE', 'WAREHOUSE_OPERATOR', 'SALES', 'PLANNER', 'VIEWER'],
};

const RoleGate = ({ role, path, children }: { role: string; path: string; children: React.ReactNode }) => {
  const allowed = ROLE_ACCESS[path] || [];
  if (allowed.includes(role)) return <>{children}</>;
  const defaultRoute = ROLE_DEFAULT_ROUTE[role] || '/';
  return <Navigate to={defaultRoute} replace />;
};

// Per-role default home page
const ROLE_DEFAULT_ROUTE: Record<string, string> = {
  'WAREHOUSE_OPERATOR': '/kanban',
  'FINANCE':            '/finance',
  'SALES':              '/crm',
  'PLANNER':            '/',
  'SUPER_ADMIN':        '/',
  'VIEWER':             '/',
};

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState('VIEWER');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      extractRole(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      extractRole(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const extractRole = (currentSession: any) => {
    if (currentSession?.user?.app_metadata?.user_role) {
      setUserRole(currentSession.user.app_metadata.user_role);
    } else if (currentSession?.user?.user_metadata?.role) {
      setUserRole(currentSession.user.user_metadata.role);
    } else {
      setUserRole('VIEWER');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    // For local testing and demo, bypass the auth wall since Supabase GitHub isn't configured
    return (
      <BrowserRouter>
        <MainLayout session={{ user: { email: 'demo@taloserp.com' } }} role="SUPER_ADMIN">
          <Routes>
            <Route path="/" element={<Dashboard role="SUPER_ADMIN" />} />
            <Route path="/inventory-engine" element={<RoleGate role="SUPER_ADMIN" path="/logic-debugger"><LogicDebugger /></RoleGate>} />
            <Route path="/system-health" element={<RoleGate role="SUPER_ADMIN" path="/system-health"><SystemIntegrity /></RoleGate>} />
            <Route path="/crm" element={<RoleGate role="SUPER_ADMIN" path="/crm"><CrmDashboard /></RoleGate>} />
            <Route path="/kanban" element={<RoleGate role="SUPER_ADMIN" path="/kanban"><ShopFloorKanban /></RoleGate>} />
            <Route path="/warehouse-map" element={<WarehouseMapPage />} />
            <Route path="/projects" element={<RoleGate role="SUPER_ADMIN" path="/projects"><ProjectOverview /></RoleGate>} />
            <Route path="/data-ingestion" element={<RoleGate role="SUPER_ADMIN" path="/data-ingestion"><DataIngestion /></RoleGate>} />
            <Route path="/finance" element={<RoleGate role="SUPER_ADMIN" path="/finance"><FinancialDashboard /></RoleGate>} />
            <Route path="/settings" element={<RoleGate role="SUPER_ADMIN" path="/settings"><Settings /></RoleGate>} />
            <Route path="/logic-debugger" element={<Navigate to="/inventory-engine" replace />} />
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
          <Route path="/inventory-engine" element={<RoleGate role={userRole} path="/logic-debugger"><LogicDebugger /></RoleGate>} />
          <Route path="/system-health" element={<RoleGate role={userRole} path="/system-health"><SystemIntegrity /></RoleGate>} />
          <Route path="/crm" element={<RoleGate role={userRole} path="/crm"><CrmDashboard /></RoleGate>} />
          <Route path="/kanban" element={<RoleGate role={userRole} path="/kanban"><ShopFloorKanban /></RoleGate>} />
          <Route path="/warehouse-map" element={<WarehouseMapPage />} />
          <Route path="/projects" element={<RoleGate role={userRole} path="/projects"><ProjectOverview /></RoleGate>} />
          <Route path="/data-ingestion" element={<RoleGate role={userRole} path="/data-ingestion"><DataIngestion /></RoleGate>} />
          <Route path="/finance" element={<RoleGate role={userRole} path="/finance"><FinancialDashboard /></RoleGate>} />
          <Route path="/settings" element={<RoleGate role={userRole} path="/settings"><Settings /></RoleGate>} />
          <Route path="/logic-debugger" element={<Navigate to="/inventory-engine" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
};

export default App;
