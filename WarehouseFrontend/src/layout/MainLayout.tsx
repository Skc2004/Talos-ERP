import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, Activity, Cpu, LogOut, ShieldCheck, Users, Kanban, CalendarDays, Upload, Wallet } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { CommandPalette } from '../CommandPalette';
import { HealthHeartbeat } from '../components/HealthHeartbeat';
import { motion } from 'framer-motion';

export const MainLayout = ({ children, session, role }: any) => {
    const location = useLocation();

    return (
        <div className="flex h-screen bg-[#0F172A] text-slate-200 font-sans overflow-hidden">
            <CommandPalette />
            
            {/* Dynamic Sidebar */}
            <motion.aside 
                initial={{ x: -250 }} animate={{ x: 0 }}
                className="w-64 bg-[#1E293B] border-r border-slate-800 flex flex-col shrink-0 shadow-2xl"
            >
                <div className="p-6 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <Cpu className="text-emerald-500" size={28} />
                        <h1 className="text-xl font-bold tracking-tighter text-white">Talos ERP</h1>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4 px-2">Menu</div>
                    
                    <NavLink to="/" icon={<LayoutDashboard size={18} />} label="Global Pulse" active={location.pathname === '/'} />
                    
                    {['SUPER_ADMIN', 'PLANNER'].includes(role) && (
                        <NavLink to="/logic-debugger" icon={<Activity size={18} />} label="Logic Debugger" active={location.pathname === '/logic-debugger'} />
                    )}

                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-8 px-2">CRM & Operations</div>
                    {['SUPER_ADMIN', 'SALES', 'PLANNER'].includes(role) && (
                        <NavLink to="/crm" icon={<Users size={18} />} label="Lead Pipeline" active={location.pathname === '/crm'} />
                    )}
                    {['SUPER_ADMIN', 'WAREHOUSE_OPERATOR', 'PLANNER'].includes(role) && (
                        <NavLink to="/kanban" icon={<Kanban size={18} />} label="Shop Floor" active={location.pathname === '/kanban'} />
                    )}
                    {['SUPER_ADMIN', 'PLANNER', 'SALES'].includes(role) && (
                        <NavLink to="/projects" icon={<CalendarDays size={18} />} label="Project Timeline" active={location.pathname === '/projects'} />
                    )}

                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-8 px-2">Data & Finance</div>
                    {['SUPER_ADMIN', 'WAREHOUSE_OPERATOR', 'PLANNER'].includes(role) && (
                        <NavLink to="/data-ingestion" icon={<Upload size={18} />} label="Sales Data Upload" active={location.pathname === '/data-ingestion'} />
                    )}
                    {['SUPER_ADMIN', 'FINANCE'].includes(role) && (
                        <NavLink to="/finance" icon={<Wallet size={18} />} label="Cashflow & P&L" active={location.pathname === '/finance'} />
                    )}

                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-8 px-2">System</div>
                    {['SUPER_ADMIN', 'PLANNER'].includes(role) && (
                        <NavLink to="/system-health" icon={<ShieldCheck size={18} />} label="System Integrity" active={location.pathname === '/system-health'} />
                    )}
                    <NavLink to="/settings" icon={<Settings size={18} />} label="Profile & RBAC" active={location.pathname === '/settings'} />
                </nav>

                <div className="p-4 border-t border-slate-800 space-y-3">
                    <div className="px-2">
                        <div className="text-xs text-slate-500 truncate">{session?.user?.email || 'User'}</div>
                        <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-500/20 text-emerald-400 tracking-wider">
                            {role}
                        </span>
                    </div>
                    <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 text-slate-400 hover:text-red-400 w-full p-2 transition-colors">
                        <LogOut size={18} />
                        <span className="text-sm font-medium">Sign Out</span>
                    </button>
                </div>
            </motion.aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar with Heartbeat */}
                <div className="flex items-center justify-end px-6 py-2 border-b border-slate-800 bg-[#1E293B]/50 shrink-0">
                    <HealthHeartbeat />
                </div>
                <main className="flex-1 overflow-y-auto p-4 sm:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
};

const NavLink = ({ to, icon, label, active }: any) => (
    <Link to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
    }`}>
        {icon}
        {label}
    </Link>
);
