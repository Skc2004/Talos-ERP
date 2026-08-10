import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import {
  BarChart3, PieChart, TrendingUp, Users, Target, Clock, CheckCircle2,
  ArrowUpRight, ArrowDownRight, Activity, Layers, Zap, AlertTriangle, Award
} from 'lucide-react';

const JAVA_API = import.meta.env.VITE_JAVA_API_URL || 'http://localhost:8080/api/v1';

const STAGE_COLORS: Record<string, string> = {
  NEW: '#6366f1', CONTACTED: '#3b82f6', QUOTED: '#f59e0b', NEGOTIATING: '#a855f7',
  WON: '#10b981', LOST: '#ef4444'
};
const STAGE_ORDER = ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'WON', 'LOST'];

const TABS = [
  { key: 'funnel', label: 'CRM Funnel', icon: Layers },
  { key: 'workload', label: 'Workload', icon: Users },
  { key: 'revenue', label: 'Revenue Forecast', icon: TrendingUp },
  { key: 'qa', label: 'QA & Operations', icon: CheckCircle2 },
];

export const ReportsAnalytics = () => {
  const [activeTab, setActiveTab] = useState('funnel');
  const [leads, setLeads] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [slas, setSlas] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [leadsRes, projectsRes] = await Promise.allSettled([
        supabase.from('crm_leads').select('*'),
        supabase.from('projects').select('*'),
      ]);
      if (leadsRes.status === 'fulfilled' && leadsRes.value.data) setLeads(leadsRes.value.data);
      if (projectsRes.status === 'fulfilled' && projectsRes.value.data) setProjects(projectsRes.value.data);

      // SLAs
      try { const r = await fetch(`${JAVA_API}/admin/sla`); if (r.ok) { const d = await r.json(); setSlas(Array.isArray(d) ? d : []); } } catch {}

      // Time entries (aggregate from all projects)
      const entries: any[] = [];
      if (projectsRes.status === 'fulfilled' && projectsRes.value.data) {
        for (const p of projectsRes.value.data.slice(0, 10)) {
          try { const r = await fetch(`${JAVA_API}/operations/projects/${p.id}/time`); if (r.ok) { const d = await r.json(); if (Array.isArray(d)) entries.push(...d.map((e: any) => ({ ...e, projectName: p.project_name }))); } } catch {}
        }
      }
      setTimeEntries(entries);
    } catch (e) { console.error('Reports load:', e); }
  }

  // ── CRM Funnel Metrics ──
  const funnelData = useMemo(() => {
    const stageCounts: Record<string, number> = {};
    const stageValues: Record<string, number> = {};
    STAGE_ORDER.forEach(s => { stageCounts[s] = 0; stageValues[s] = 0; });
    leads.forEach(l => {
      const st = l.status || 'NEW';
      stageCounts[st] = (stageCounts[st] || 0) + 1;
      stageValues[st] = (stageValues[st] || 0) + (parseFloat(l.potential_value) || 0);
    });
    const maxCount = Math.max(...Object.values(stageCounts), 1);
    return STAGE_ORDER.map(s => ({
      stage: s, count: stageCounts[s], value: stageValues[s],
      pct: Math.round((stageCounts[s] / maxCount) * 100)
    }));
  }, [leads]);

  const conversionRate = useMemo(() => {
    const won = leads.filter(l => l.status === 'WON').length;
    const total = leads.length;
    return total > 0 ? ((won / total) * 100).toFixed(1) : '0.0';
  }, [leads]);

  const avgDealSize = useMemo(() => {
    const wonLeads = leads.filter(l => l.status === 'WON');
    if (wonLeads.length === 0) return 0;
    return wonLeads.reduce((s, l) => s + (parseFloat(l.potential_value) || 0), 0) / wonLeads.length;
  }, [leads]);

  const sourceBreakdown = useMemo(() => {
    const sources: Record<string, number> = {};
    leads.forEach(l => { const s = l.source || 'UNKNOWN'; sources[s] = (sources[s] || 0) + 1; });
    return Object.entries(sources).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  // ── Workload Metrics ──
  const projectWorkload = useMemo(() => {
    return projects.map(p => ({
      name: p.project_name,
      client: p.client_name,
      status: p.status,
      estimated: parseFloat(p.estimated_hours) || 0,
      actual: parseFloat(p.actual_hours) || 0,
      utilization: p.estimated_hours ? Math.round((parseFloat(p.actual_hours || 0) / parseFloat(p.estimated_hours)) * 100) : 0,
    }));
  }, [projects]);

  const totalEstimated = projectWorkload.reduce((s, p) => s + p.estimated, 0);
  const totalActual = projectWorkload.reduce((s, p) => s + p.actual, 0);
  const overallUtilization = totalEstimated > 0 ? Math.round((totalActual / totalEstimated) * 100) : 0;

  // ── Revenue Forecast ──
  const STAGE_PROBABILITY: Record<string, number> = { NEW: 10, CONTACTED: 25, QUOTED: 50, NEGOTIATING: 75, WON: 100, LOST: 0 };
  const revenueForecast = useMemo(() => {
    return STAGE_ORDER.filter(s => s !== 'LOST').map(stage => {
      const stageLeads = leads.filter(l => l.status === stage);
      const rawValue = stageLeads.reduce((s, l) => s + (parseFloat(l.potential_value) || 0), 0);
      const probability = STAGE_PROBABILITY[stage];
      return { stage, count: stageLeads.length, rawValue, probability, weightedValue: rawValue * (probability / 100) };
    });
  }, [leads]);

  const totalPipelineValue = revenueForecast.reduce((s, r) => s + r.rawValue, 0);
  const totalWeightedValue = revenueForecast.reduce((s, r) => s + r.weightedValue, 0);

  // ── QA & Ops Metrics ──
  const projectsByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    projects.forEach(p => { map[p.status] = (map[p.status] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [projects]);

  const overdueProjects = projects.filter(p => {
    if (!p.deadline) return false;
    return new Date(p.deadline) < new Date() && p.status !== 'SHIPPED';
  });

  // ── Shared Components ──
  const MetricCard = ({ icon, label, value, subtitle, color = 'indigo' }: any) => (
    <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">{icon}<span className="text-xs text-slate-500 uppercase tracking-wider font-bold">{label}</span></div>
      <div className={`text-2xl font-bold text-${color}-400`}>{value}</div>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 className="text-violet-400" size={28} />
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Reports & Analytics</h2>
          <p className="text-sm text-slate-400 mt-0.5">Real-time business intelligence across CRM, operations, and revenue.</p>
        </div>
      </div>

      {/* Tab Nav */}
      <div className="flex gap-1 bg-[#1E293B] border border-slate-800 rounded-xl p-1.5">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-violet-500/20 text-violet-400 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <Icon size={16} />{tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══ TAB: CRM Funnel ═══ */}
      {activeTab === 'funnel' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-4 gap-4">
            <MetricCard icon={<Users size={16} className="text-indigo-400" />} label="Total Leads" value={leads.length} subtitle="All-time pipeline" color="indigo" />
            <MetricCard icon={<Target size={16} className="text-emerald-400" />} label="Conversion Rate" value={`${conversionRate}%`} subtitle="Leads → Won" color="emerald" />
            <MetricCard icon={<TrendingUp size={16} className="text-violet-400" />} label="Avg Deal Size" value={`₹${avgDealSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} subtitle="Won deals average" color="violet" />
            <MetricCard icon={<Activity size={16} className="text-amber-400" />} label="Active Pipeline" value={leads.filter(l => !['WON', 'LOST'].includes(l.status)).length} subtitle="In progress" color="amber" />
          </div>

          {/* Visual Funnel */}
          <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">Pipeline Funnel</h3>
            <div className="space-y-3">
              {funnelData.map((f, i) => (
                <div key={f.stage} className="flex items-center gap-4">
                  <span className="text-xs font-bold text-slate-400 w-28 text-right">{f.stage}</span>
                  <div className="flex-1 relative">
                    <div className="h-10 bg-slate-800/50 rounded-lg overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${Math.max(f.pct, 3)}%` }}
                        transition={{ delay: i * 0.1, duration: 0.6, ease: 'easeOut' }}
                        className="h-full rounded-lg flex items-center px-3"
                        style={{ background: `${STAGE_COLORS[f.stage]}40`, borderLeft: `3px solid ${STAGE_COLORS[f.stage]}` }}
                      >
                        <span className="text-xs font-bold text-white">{f.count} leads</span>
                      </motion.div>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-500 w-24 text-right">₹{(f.value / 1000).toFixed(0)}K</span>
                </div>
              ))}
            </div>
          </div>

          {/* Source Breakdown */}
          <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Lead Source Distribution</h3>
            <div className="grid grid-cols-3 gap-3">
              {sourceBreakdown.map(([source, count]) => {
                const pct = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                return (
                  <div key={source} className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-300">{source}</span>
                      <span className="text-xs text-violet-400 font-bold">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.3, duration: 0.5 }} className="h-full bg-violet-500 rounded-full" />
                    </div>
                    <span className="text-lg font-bold text-white mt-2 block">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══ TAB: Workload ═══ */}
      {activeTab === 'workload' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <MetricCard icon={<Activity size={16} className="text-blue-400" />} label="Total Projects" value={projects.length} color="blue" />
            <MetricCard icon={<Clock size={16} className="text-amber-400" />} label="Hours Estimated" value={`${totalEstimated.toFixed(0)}h`} color="amber" />
            <MetricCard icon={<Zap size={16} className="text-emerald-400" />} label="Hours Logged" value={`${totalActual.toFixed(1)}h`} color="emerald" />
            <MetricCard icon={<Target size={16} className="text-violet-400" />} label="Utilization" value={`${overallUtilization}%`} subtitle={overallUtilization > 100 ? 'Over budget!' : 'Within budget'} color={overallUtilization > 100 ? 'red' : 'violet'} />
          </div>

          {/* Project Workload Table */}
          <div className="bg-[#1E293B] border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800"><h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Project Workload Heatmap</h3></div>
            <table className="w-full text-sm">
              <thead className="bg-[#0F172A]"><tr className="text-slate-500 text-xs uppercase tracking-wider"><th className="p-3 text-left">Project</th><th className="p-3 text-left">Client</th><th className="p-3 text-left">Status</th><th className="p-3 text-center">Estimated</th><th className="p-3 text-center">Actual</th><th className="p-3">Utilization</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {projectWorkload.map(p => (
                  <tr key={p.name} className="hover:bg-[#0F172A]/50 transition-colors">
                    <td className="p-3 text-white font-medium">{p.name}</td>
                    <td className="p-3 text-slate-400">{p.client}</td>
                    <td className="p-3"><span className={`text-[10px] font-bold px-2 py-1 rounded ${p.status === 'SHIPPED' ? 'bg-emerald-500/10 text-emerald-400' : p.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>{p.status}</span></td>
                    <td className="p-3 text-center text-slate-300 font-mono">{p.estimated}h</td>
                    <td className="p-3 text-center text-slate-300 font-mono">{p.actual}h</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${p.utilization > 100 ? 'bg-red-500' : p.utilization > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(p.utilization, 100)}%` }} />
                        </div>
                        <span className={`text-xs font-bold w-10 text-right ${p.utilization > 100 ? 'text-red-400' : p.utilization > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>{p.utilization}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {projectWorkload.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No projects found.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Time Log Summary */}
          {timeEntries.length > 0 && (
            <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Recent Time Entries</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {timeEntries.slice(0, 15).map((e, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#0F172A] border border-slate-800 rounded-lg px-3 py-2">
                    <div><span className="text-amber-400 font-bold text-sm">{parseFloat(e.hours).toFixed(1)}h</span><span className="text-slate-400 text-xs ml-2">{e.description}</span></div>
                    <span className="text-[10px] text-slate-600">{e.projectName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══ TAB: Revenue Forecast ═══ */}
      {activeTab === 'revenue' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <MetricCard icon={<TrendingUp size={16} className="text-blue-400" />} label="Total Pipeline" value={`₹${(totalPipelineValue / 1000).toFixed(0)}K`} subtitle="All open deals" color="blue" />
            <MetricCard icon={<Target size={16} className="text-emerald-400" />} label="Weighted Forecast" value={`₹${(totalWeightedValue / 1000).toFixed(0)}K`} subtitle="Probability-adjusted" color="emerald" />
            <MetricCard icon={<Award size={16} className="text-violet-400" />} label="Won Revenue" value={`₹${(leads.filter(l => l.status === 'WON').reduce((s, l) => s + (parseFloat(l.potential_value) || 0), 0) / 1000).toFixed(0)}K`} subtitle="Closed deals" color="violet" />
          </div>

          {/* Revenue Waterfall */}
          <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">Revenue Waterfall by Stage</h3>
            <div className="space-y-4">
              {revenueForecast.map((r, i) => (
                <div key={r.stage} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-white">{r.stage}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-bold">{r.count} deals</span>
                      <span className="text-[10px] text-violet-400 font-bold">{r.probability}% probability</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-white">₹{(r.rawValue / 1000).toFixed(0)}K</span>
                      <span className="text-xs text-emerald-400 ml-2">→ ₹{(r.weightedValue / 1000).toFixed(0)}K</span>
                    </div>
                  </div>
                  <div className="flex gap-1 h-3">
                    <div className="bg-slate-800 rounded-full overflow-hidden flex-1">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${totalPipelineValue > 0 ? (r.rawValue / totalPipelineValue) * 100 : 0}%` }}
                        transition={{ delay: i * 0.1, duration: 0.6 }}
                        className="h-full rounded-full"
                        style={{ background: `${STAGE_COLORS[r.stage]}60` }}
                      />
                    </div>
                    <div className="bg-slate-800 rounded-full overflow-hidden flex-1">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${totalPipelineValue > 0 ? (r.weightedValue / totalPipelineValue) * 100 : 0}%` }}
                        transition={{ delay: i * 0.1 + 0.2, duration: 0.6 }}
                        className="h-full rounded-full"
                        style={{ background: STAGE_COLORS[r.stage] }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-600/60" /><span className="text-[10px] text-slate-500">Raw Value</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-500" /><span className="text-[10px] text-slate-500">Weighted Forecast</span></div>
            </div>
          </div>

          {/* SLA Compliance */}
          {slas.length > 0 && (
            <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Active SLA Targets</h3>
              <div className="grid grid-cols-3 gap-3">
                {slas.map(sla => (
                  <div key={sla.id} className="bg-[#0F172A] border border-slate-800 rounded-xl p-4">
                    <div className="text-sm font-bold text-white mb-1">{sla.name}</div>
                    <div className="flex items-center gap-3 mt-2">
                      <div><span className="text-[10px] text-slate-500 block">Response</span><span className="text-blue-400 font-bold text-sm">{sla.responseHours || sla.response_hours}h</span></div>
                      <div className="w-px h-6 bg-slate-800" />
                      <div><span className="text-[10px] text-slate-500 block">Escalation</span><span className="text-amber-400 font-bold text-sm">{sla.escalationHours || sla.escalation_hours}h</span></div>
                      <div className="w-px h-6 bg-slate-800" />
                      <div><span className="text-[10px] text-slate-500 block">Priority</span><span className={`font-bold text-sm ${sla.priority === 'HIGH' ? 'text-red-400' : sla.priority === 'MEDIUM' ? 'text-amber-400' : 'text-slate-400'}`}>{sla.priority}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══ TAB: QA & Operations ═══ */}
      {activeTab === 'qa' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <MetricCard icon={<Activity size={16} className="text-blue-400" />} label="Total Projects" value={projects.length} color="blue" />
            <MetricCard icon={<CheckCircle2 size={16} className="text-emerald-400" />} label="Shipped" value={projects.filter(p => p.status === 'SHIPPED').length} color="emerald" />
            <MetricCard icon={<AlertTriangle size={16} className="text-red-400" />} label="Overdue" value={overdueProjects.length} subtitle={overdueProjects.length > 0 ? 'Needs attention!' : 'All on track'} color="red" />
            <MetricCard icon={<Clock size={16} className="text-amber-400" />} label="In QA" value={projects.filter(p => p.status === 'QA').length} color="amber" />
          </div>

          {/* Project Status Distribution */}
          <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-5">Project Status Distribution</h3>
            <div className="grid grid-cols-5 gap-3">
              {['BACKLOG', 'PLANNING', 'IN_PROGRESS', 'QA', 'SHIPPED'].map(status => {
                const count = projects.filter(p => p.status === status).length;
                const pct = projects.length > 0 ? Math.round((count / projects.length) * 100) : 0;
                const colors: Record<string, string> = { BACKLOG: 'slate', PLANNING: 'indigo', IN_PROGRESS: 'amber', QA: 'purple', SHIPPED: 'emerald' };
                const c = colors[status] || 'slate';
                return (
                  <div key={status} className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 text-center">
                    <div className={`text-3xl font-bold text-${c}-400 mb-1`}>{count}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase">{status.replace('_', ' ')}</div>
                    <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full bg-${c}-500 rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-600 mt-1 block">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overdue Projects Alert */}
          {overdueProjects.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
              <h3 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-3"><AlertTriangle size={16} />Overdue Projects</h3>
              <div className="space-y-2">
                {overdueProjects.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-[#0F172A] border border-red-500/20 rounded-lg px-4 py-3">
                    <div><span className="text-sm font-medium text-white">{p.project_name}</span><span className="text-xs text-slate-400 ml-2">{p.client_name}</span></div>
                    <div className="text-right">
                      <span className="text-xs text-red-400 font-bold">Due: {new Date(p.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      <span className="text-[10px] text-slate-600 ml-2">{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Budget Health */}
          <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Budget Health by Project</h3>
            <div className="space-y-3">
              {projectWorkload.filter(p => p.estimated > 0).map(p => {
                const health = p.utilization <= 80 ? 'healthy' : p.utilization <= 100 ? 'warning' : 'critical';
                return (
                  <div key={p.name} className="flex items-center gap-4">
                    <span className="text-sm text-white w-48 truncate">{p.name}</span>
                    <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden relative">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(p.utilization, 100)}%` }} transition={{ duration: 0.5 }}
                        className={`h-full rounded-full ${health === 'critical' ? 'bg-red-500' : health === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      />
                      {p.estimated > 0 && <div className="absolute right-0 top-0 bottom-0 w-px bg-white/30" style={{ right: '20%' }} />}
                    </div>
                    <div className="flex items-center gap-1 w-24 justify-end">
                      {health === 'critical' ? <ArrowUpRight size={12} className="text-red-400" /> : <ArrowDownRight size={12} className="text-emerald-400" />}
                      <span className={`text-xs font-bold ${health === 'critical' ? 'text-red-400' : health === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>{p.actual}/{p.estimated}h</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
