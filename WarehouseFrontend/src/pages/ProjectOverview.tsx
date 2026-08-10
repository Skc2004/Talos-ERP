import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarDays, Clock, CheckCircle, Circle, AlertTriangle, TrendingUp,
  Users, Zap, DollarSign, Plus, X, Check, Trash2, ChevronDown, ChevronRight,
  ShieldAlert, BarChart3, Activity, Edit2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const JAVA_API = import.meta.env.VITE_JAVA_API_URL || 'http://localhost:8080/api/v1';

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: 'bg-slate-500', PLANNING: 'bg-indigo-500',
  IN_PROGRESS: 'bg-amber-500', QA: 'bg-purple-500', SHIPPED: 'bg-emerald-500',
};
const STATUS_TEXT: Record<string, string> = {
  BACKLOG: 'text-slate-400', PLANNING: 'text-indigo-400',
  IN_PROGRESS: 'text-amber-400', QA: 'text-purple-400', SHIPPED: 'text-emerald-400',
};

const PROBABILITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];
const IMPACT_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

const riskSeverity = (p: string, i: string) => {
  const ps = PROBABILITY_LEVELS.indexOf(p) + 1;
  const is_ = IMPACT_LEVELS.indexOf(i) + 1;
  const score = ps * is_;
  if (score >= 6) return { label: 'CRITICAL', cls: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if (score >= 3) return { label: 'HIGH', cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
  return { label: 'LOW', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
};

const TABS = [
  { id: 'gantt', label: '📅 Timeline', icon: CalendarDays },
  { id: 'cost', label: '💰 Cost', icon: DollarSign },
  { id: 'risks', label: '⚠️ Risks', icon: ShieldAlert },
  { id: 'kpis', label: '📊 KPIs', icon: BarChart3 },
];

const InputCls = 'w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors';

export const ProjectOverview = () => {
  const [tab, setTab] = useState('gantt');
  const [projects, setProjects] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [zoom, setZoom] = useState<'week' | 'month' | 'quarter'>('month');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [risks, setRisks] = useState<Record<string, any[]>>({});
  const [costSummaries, setCostSummaries] = useState<Record<string, any>>({});
  const [showRiskModal, setShowRiskModal] = useState(false);
  const [riskForm, setRiskForm] = useState({ projectId: '', title: '', description: '', probability: 'MEDIUM', impact: 'MEDIUM', mitigation: '', owner: '' });
  const [newMsTitle, setNewMsTitle] = useState('');
  const [newMsDue, setNewMsDue] = useState('');

  useEffect(() => {
    loadAll();
    const ch = supabase.channel('proj_overview_v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_milestones' }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function loadAll() {
    const [projRes, msRes, leadRes] = await Promise.all([
      supabase.from('projects').select('*').order('deadline', { ascending: true }),
      supabase.from('project_milestones').select('*'),
      supabase.from('crm_leads').select('*').neq('status', 'LOST'),
    ]);
    const prjs = projRes.data || [];
    if (projRes.data) setProjects(prjs);
    if (msRes.data) setMilestones(msRes.data);
    if (leadRes.data) setLeads(leadRes.data);

    // Load risks for all projects
    const riskMap: Record<string, any[]> = {};
    for (const p of prjs) {
      try {
        const r = await fetch(`${JAVA_API}/operations/projects/${p.id}/risks`);
        if (r.ok) riskMap[p.id] = await r.json();
      } catch { riskMap[p.id] = []; }
    }
    setRisks(riskMap);

    // Load cost summaries
    const costMap: Record<string, any> = {};
    for (const p of prjs) {
      try {
        const r = await fetch(`${JAVA_API}/operations/projects/${p.id}/cost-summary`);
        if (r.ok) costMap[p.id] = await r.json();
      } catch { costMap[p.id] = null; }
    }
    setCostSummaries(costMap);
  }

  function getProgress(projectId: string) {
    const pMs = milestones.filter(m => m.project_id === projectId);
    if (!pMs.length) return { pct: 0, done: 0, total: 0 };
    const done = pMs.filter(m => m.is_completed).length;
    return { pct: Math.round((done / pMs.length) * 100), done, total: pMs.length };
  }

  function healthScore(p: any) {
    const prog = getProgress(p.id);
    const deadline = p.deadline ? new Date(p.deadline).getTime() : null;
    const onTrack = deadline ? deadline > Date.now() : false;
    const score = (onTrack ? 40 : 0) + Math.round(prog.pct * 0.3) + (p.actual_hours <= p.estimated_hours ? 30 : 0);
    return { score, color: score >= 70 ? '🟢' : score >= 40 ? '🟡' : '🔴' };
  }

  // Gantt calculations
  const ganttData = useMemo(() => {
    const days = zoom === 'week' ? 7 : zoom === 'month' ? 30 : 90;
    const now = Date.now();
    const minDate = now - 2 * 86400000;
    const maxDate = now + days * 86400000;
    const range = maxDate - minDate;
    const items = projects.filter(p => p.status !== 'CANCELLED').map(p => {
      const deadline = p.deadline ? new Date(p.deadline).getTime() : maxDate;
      const created = p.created_at ? new Date(p.created_at).getTime() : minDate;
      const startPct = Math.max(0, ((created - minDate) / range) * 100);
      const endPct = Math.min(100, ((deadline - minDate) / range) * 100);
      const widthPct = Math.max(2, endPct - startPct);
      const slackMs = deadline - (now + parseFloat(p.estimated_hours || 0) * 3600000);
      const slackHours = slackMs / 3600000;
      const pMilestones = milestones.filter(m => m.project_id === p.id).map(m => {
        const mDate = new Date(m.due_date || m.created_at).getTime();
        const mPct = Math.max(0, Math.min(100, ((mDate - minDate) / range) * 100));
        return { ...m, pct: mPct };
      });
      return { ...p, startPct, widthPct, endPct, slackHours: Math.round(slackHours), pMilestones };
    });
    const nowPct = Math.max(0, Math.min(100, ((now - minDate) / range) * 100));
    return { items, minDate, maxDate, range, nowPct };
  }, [projects, milestones, zoom]);

  const kpis = useMemo(() => {
    const total = leads.reduce((s, l) => s + parseFloat(l.potential_value || 0), 0);
    const won = leads.filter(l => l.status === 'WON').length;
    const convRate = leads.length > 0 ? ((won / leads.length) * 100).toFixed(1) : '0';
    const active = projects.filter(p => p.status === 'IN_PROGRESS');
    const totalH = projects.reduce((s, p) => s + parseFloat(p.estimated_hours || 0), 0);
    const activeH = active.reduce((s, p) => s + parseFloat(p.estimated_hours || 0), 0);
    const util = totalH > 0 ? ((activeH / totalH) * 100).toFixed(0) : '0';
    return { total, convRate, util };
  }, [leads, projects]);

  async function toggleMs(id: string, current: boolean) {
    await supabase.from('project_milestones').update({ is_completed: !current }).eq('id', id);
    loadAll();
  }
  async function deleteMs(id: string) {
    await supabase.from('project_milestones').delete().eq('id', id);
    loadAll();
  }
  async function addMs(projectId: string) {
    if (!newMsTitle) return;
    await supabase.from('project_milestones').insert({ project_id: projectId, task_name: newMsTitle, due_date: newMsDue || null, is_completed: false });
    setNewMsTitle(''); setNewMsDue('');
    loadAll();
  }

  async function submitRisk() {
    if (!riskForm.title || !riskForm.projectId) return;
    await fetch(`${JAVA_API}/operations/projects/${riskForm.projectId}/risks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(riskForm),
    });
    setShowRiskModal(false);
    setRiskForm({ projectId: '', title: '', description: '', probability: 'MEDIUM', impact: 'MEDIUM', mitigation: '', owner: '' });
    loadAll();
  }
  async function updateRiskStatus(riskId: string, status: string) {
    await fetch(`${JAVA_API}/operations/risks/${riskId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadAll();
  }
  async function deleteRisk(riskId: string) {
    if (!window.confirm('Delete this risk?')) return;
    await fetch(`${JAVA_API}/operations/risks/${riskId}`, { method: 'DELETE' });
    loadAll();
  }

  // Date ruler ticks
  const ticks = useMemo(() => {
    const days = zoom === 'week' ? 7 : zoom === 'month' ? 30 : 90;
    const step = zoom === 'week' ? 1 : zoom === 'month' ? 5 : 15;
    const result = [];
    for (let d = 0; d <= days; d += step) {
      const date = new Date(ganttData.minDate + d * 86400000);
      const pct = (d / days) * 100;
      result.push({ pct, label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
    }
    return result;
  }, [zoom, ganttData]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarDays className="text-indigo-400" /> Project Operations
          </h2>
          <p className="text-sm text-slate-400 mt-1">Gantt timeline, cost tracking, risk register, and business KPIs.</p>
        </div>
        {tab === 'risks' && (
          <button onClick={() => setShowRiskModal(true)} className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Plus size={16}/> Add Risk
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1E293B] rounded-xl p-1 border border-slate-800">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-colors ${tab === t.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── GANTT TAB ── */}
        {tab === 'gantt' && (
          <motion.div key="gantt" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Zoom control */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Zoom:</span>
              {(['week', 'month', 'quarter'] as const).map(z => (
                <button key={z} onClick={() => setZoom(z)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors capitalize ${zoom === z ? 'bg-indigo-500 text-white' : 'bg-[#1E293B] border border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                  {z}
                </button>
              ))}
            </div>

            <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5">
              {/* Date ruler */}
              <div className="flex mb-3 ml-48 relative h-5">
                {ticks.map((t, i) => (
                  <div key={i} className="absolute text-[9px] text-slate-600" style={{ left: `${t.pct}%` }}>{t.label}</div>
                ))}
              </div>

              <div className="relative space-y-2">
                {/* Today line */}
                <div className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-red-500/50 z-10 pointer-events-none"
                  style={{ left: `calc(192px + ${ganttData.nowPct}% * (100% - 320px) / 100)` }}>
                  <div className="absolute -top-1 -left-3 text-[9px] text-red-400 font-bold bg-[#1E293B] px-0.5">NOW</div>
                </div>

                {ganttData.items.map((item, i) => {
                  const prog = getProgress(item.id);
                  const hs = healthScore(item);
                  const isExpanded = expandedRow === item.id;
                  const rowMs = milestones.filter(m => m.project_id === item.id);
                  return (
                    <div key={item.id}>
                      <motion.div className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => setExpandedRow(isExpanded ? null : item.id)}>
                        <div className="w-44 shrink-0">
                          <div className="text-xs font-semibold text-white truncate">{item.project_name}</div>
                          <div className="text-[10px] text-slate-500 truncate">{item.client_name}</div>
                        </div>
                        <div className="flex-1 relative h-8 bg-[#0F172A] rounded-lg overflow-hidden border border-slate-800">
                          <div className={`absolute h-full ${STATUS_COLORS[item.status] || 'bg-slate-500'} opacity-70 rounded-lg`}
                            style={{ left: `${item.startPct}%`, width: `${item.widthPct}%` }}>
                            <div className="h-full bg-white/20 rounded-lg" style={{ width: `${prog.pct}%` }}/>
                          </div>
                          {/* Milestone diamonds */}
                          {item.pMilestones.map((ms: any) => (
                            <div key={ms.id} title={ms.task_name}
                              className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-xs z-10 ${ms.is_completed ? 'text-emerald-400' : new Date(ms.due_date) < new Date() ? 'text-red-400' : 'text-amber-400'}`}
                              style={{ left: `${ms.pct}%` }}>◆</div>
                          ))}
                          <div className="absolute inset-0 flex items-center justify-center text-[9px] text-white/70 z-10 font-bold">
                            {prog.pct}% · {prog.done}/{prog.total} ms
                          </div>
                        </div>
                        <div className="w-20 shrink-0 flex items-center gap-1">
                          <span className="text-sm">{hs.color}</span>
                          <span className={`text-[10px] font-bold ${item.slackHours < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                            {item.slackHours < 0 ? `${Math.abs(item.slackHours)}h over` : `${item.slackHours}h slack`}
                          </span>
                        </div>
                        <div>{isExpanded ? <ChevronDown size={14} className="text-slate-500"/> : <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400"/>}</div>
                      </motion.div>

                      {/* Expanded milestone CRUD */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="ml-47 pl-48 pb-3 space-y-2 overflow-hidden">
                            <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-3 mt-1 space-y-1.5">
                              {rowMs.map(ms => (
                                <div key={ms.id} className="flex items-center gap-2 text-xs">
                                  <button onClick={() => toggleMs(ms.id, ms.is_completed)}
                                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${ms.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-indigo-500'}`}>
                                    {ms.is_completed && <Check size={9} className="text-white"/>}
                                  </button>
                                  <span className={ms.is_completed ? 'text-slate-600 line-through' : 'text-slate-300'}>{ms.task_name}</span>
                                  {ms.due_date && <span className="ml-auto text-slate-600 font-mono">{new Date(ms.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                                  <button onClick={() => deleteMs(ms.id)} className="text-slate-700 hover:text-red-400 transition-colors"><Trash2 size={11}/></button>
                                </div>
                              ))}
                              <div className="flex gap-2 pt-1.5 border-t border-slate-800">
                                <input placeholder="New milestone..." value={newMsTitle} onChange={e => setNewMsTitle(e.target.value)}
                                  className="flex-1 bg-transparent text-xs text-white placeholder-slate-600 outline-none"/>
                                <input type="date" value={newMsDue} onChange={e => setNewMsDue(e.target.value)}
                                  className="text-xs bg-transparent text-slate-500 outline-none"/>
                                <button onClick={() => addMs(item.id)} disabled={!newMsTitle}
                                  className="text-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded transition-colors disabled:opacity-40">Add</button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
                {ganttData.items.length === 0 && <div className="text-center text-slate-600 py-8">No active projects.</div>}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── COST TAB ── */}
        {tab === 'cost' && (
          <motion.div key="cost" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {projects.map(p => {
              const cs = costSummaries[p.id];
              if (!cs) return null;
              const isOverBudget = cs.budgetStatus === 'OVER_BUDGET';
              const isUnder = cs.budgetStatus === 'UNDER_BUDGET';
              const budgetPct = cs.budget > 0 ? Math.min(200, (cs.laborCost / cs.budget) * 100) : 0;
              return (
                <div key={p.id} className="bg-[#1E293B] border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-bold text-white">{p.project_name}</h4>
                      <span className={`text-[10px] font-bold ${STATUS_TEXT[p.status] || 'text-slate-400'}`}>{p.status}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${isOverBudget ? 'bg-red-500/20 text-red-400 border-red-500/30' : isUnder ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'}`}>
                      {isOverBudget ? '🔴 Over Budget' : isUnder ? '🟢 Under Budget' : '🟡 On Track'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {[['Budget', `$${cs.budget?.toLocaleString() || '—'}`], ['Labor Cost', `$${cs.laborCost?.toFixed(0) || '0'}`], ['Variance', `${cs.variancePct > 0 ? '+' : ''}${cs.variancePct}%`]].map(([l, v]) => (
                      <div key={l} className="text-center">
                        <div className="text-[10px] text-slate-500 mb-1">{l}</div>
                        <div className="text-sm font-bold text-white">{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="h-2 bg-[#0F172A] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-red-500' : isUnder ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${budgetPct}%` }}/>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>$0</span><span>${cs.budget?.toLocaleString() || '—'}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-2">{cs.totalHoursLogged?.toFixed(1) || 0}h logged @ ${cs.hourlyRate}/h</div>
                </div>
              );
            })}
            {projects.every(p => !costSummaries[p.id]) && (
              <div className="text-center text-slate-600 py-12">Cost data loading... (Java API required)</div>
            )}
          </motion.div>
        )}

        {/* ── RISKS TAB ── */}
        {tab === 'risks' && (
          <motion.div key="risks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* 3x3 Risk Matrix */}
            <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><ShieldAlert size={16} className="text-red-400"/>Risk Matrix</h3>
              <div className="flex text-[10px] text-slate-500 mb-1 ml-16">
                {IMPACT_LEVELS.map(l => <div key={l} className="flex-1 text-center font-bold">{l} Impact</div>)}
              </div>
              {[...PROBABILITY_LEVELS].reverse().map(prob => (
                <div key={prob} className="flex gap-1 mb-1">
                  <div className="w-16 text-[10px] text-slate-500 text-right pr-2 flex items-center justify-end font-bold">{prob} Prob</div>
                  {IMPACT_LEVELS.map(imp => {
                    const sv = riskSeverity(prob, imp);
                    const cellRisks = Object.values(risks).flat().filter(r => r.probability === prob && r.impact === imp);
                    return (
                      <div key={imp} className={`flex-1 min-h-16 rounded-lg border p-1 space-y-1 ${sv.cls}`}>
                        {cellRisks.map(r => (
                          <div key={r.id} className="text-[9px] bg-black/30 rounded p-1 truncate" title={r.title}>{r.title}</div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Risk list by project */}
            {projects.map(p => {
              const pRisks = risks[p.id] || [];
              if (pRisks.length === 0) return null;
              return (
                <div key={p.id} className="bg-[#1E293B] border border-slate-800 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-white mb-2">{p.project_name}</h4>
                  <div className="space-y-2">
                    {pRisks.map(r => {
                      const sv = riskSeverity(r.probability, r.impact);
                      return (
                        <div key={r.id} className="bg-[#0F172A] border border-slate-800 rounded-xl p-3 flex gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-white">{r.title}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${sv.cls}`}>{sv.label}</span>
                            </div>
                            {r.description && <p className="text-xs text-slate-400 mb-1">{r.description}</p>}
                            {r.mitigation && <p className="text-[10px] text-slate-500 italic">Mitigation: {r.mitigation}</p>}
                            {r.owner && <p className="text-[10px] text-slate-600 mt-1">Owner: {r.owner}</p>}
                          </div>
                          <div className="flex flex-col gap-1">
                            {['OPEN', 'MITIGATED', 'ACCEPTED', 'CLOSED'].map(s => (
                              <button key={s} onClick={() => updateRiskStatus(r.id, s)}
                                className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${r.status === s ? 'bg-indigo-500 text-white border-indigo-500' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}>{s}</button>
                            ))}
                            <button onClick={() => deleteRisk(r.id)} className="text-[9px] text-red-500/60 hover:text-red-400 mt-1 transition-colors text-center"><Trash2 size={10}/></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {Object.values(risks).every(r => r.length === 0) && (
              <div className="text-center text-slate-600 py-12">No risks registered. Click "Add Risk" to start.</div>
            )}
          </motion.div>
        )}

        {/* ── KPIs TAB ── */}
        {tab === 'kpis' && (
          <motion.div key="kpis" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Pipeline Value', value: `$${(kpis.total / 1000).toFixed(0)}K`, icon: <TrendingUp className="text-emerald-400" size={20}/> },
                { label: 'Conversion Rate', value: `${kpis.convRate}%`, icon: <Users className="text-indigo-400" size={20}/> },
                { label: 'Resource Utilization', value: `${kpis.util}%`, icon: <Zap className="text-amber-400" size={20}/> },
              ].map(k => (
                <div key={k.label} className="bg-[#1E293B] border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2">{k.icon}<span className="text-sm text-slate-400">{k.label}</span></div>
                  <div className="text-2xl font-bold text-white">{k.value}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {projects.filter(p => !['CANCELLED', 'SHIPPED'].includes(p.status)).map(project => {
                const pMs = milestones.filter(m => m.project_id === project.id);
                const prog = getProgress(project.id);
                return (
                  <div key={project.id} className="bg-[#1E293B] border border-slate-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-bold text-white">{project.project_name}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${prog.pct === 100 ? 'bg-emerald-500/20 text-emerald-400' : prog.pct > 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>{prog.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[#0F172A] rounded-full mb-3"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${prog.pct}%` }}/></div>
                    <div className="space-y-1">
                      {pMs.map(ms => (
                        <div key={ms.id} className="flex items-center gap-2 text-xs">
                          {ms.is_completed ? <CheckCircle className="text-emerald-500 shrink-0" size={12}/> : <Circle className="text-slate-600 shrink-0" size={12}/>}
                          <span className={ms.is_completed ? 'text-slate-500 line-through' : 'text-slate-300'}>{ms.task_name}</span>
                          {ms.due_date && <span className="ml-auto text-slate-600 font-mono text-[10px]">{new Date(ms.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                        </div>
                      ))}
                      {pMs.length === 0 && <div className="text-xs text-slate-600">No milestones defined.</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Risk Modal ── */}
      <AnimatePresence>
        {showRiskModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRiskModal(false)}>
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><ShieldAlert size={18} className="text-red-400"/>Add Risk</h3>
                <button onClick={() => setShowRiskModal(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
              <div className="p-5 space-y-3">
                <select value={riskForm.projectId} onChange={e => setRiskForm(f => ({...f, projectId: e.target.value}))} className={InputCls}>
                  <option value="">Select project *</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
                <input placeholder="Risk title *" value={riskForm.title} onChange={e => setRiskForm(f => ({...f, title: e.target.value}))} className={InputCls}/>
                <textarea placeholder="Description" value={riskForm.description} onChange={e => setRiskForm(f => ({...f, description: e.target.value}))} rows={2} className={`${InputCls} resize-none`}/>
                <div className="grid grid-cols-2 gap-3">
                  <select value={riskForm.probability} onChange={e => setRiskForm(f => ({...f, probability: e.target.value}))} className={InputCls}>
                    {PROBABILITY_LEVELS.map(l => <option key={l}>{l}</option>)}
                  </select>
                  <select value={riskForm.impact} onChange={e => setRiskForm(f => ({...f, impact: e.target.value}))} className={InputCls}>
                    {IMPACT_LEVELS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <input placeholder="Mitigation plan" value={riskForm.mitigation} onChange={e => setRiskForm(f => ({...f, mitigation: e.target.value}))} className={InputCls}/>
                <input placeholder="Risk owner" value={riskForm.owner} onChange={e => setRiskForm(f => ({...f, owner: e.target.value}))} className={InputCls}/>
                <button onClick={submitRisk} disabled={!riskForm.title || !riskForm.projectId}
                  className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors">
                  Register Risk
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
