import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { CalendarDays, Clock, CheckCircle, Circle, AlertTriangle, TrendingUp, Users, Zap } from 'lucide-react';

const cardAnim = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08 } })
};

export const ProjectOverview = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    const ch = supabase.channel('proj_overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_milestones' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function loadData() {
    const [projRes, msRes, leadRes] = await Promise.all([
      supabase.table('projects').select('*').order('deadline', { ascending: true }),
      supabase.table('project_milestones').select('*'),
      supabase.table('crm_leads').select('*').neq('status', 'LOST')
    ]);
    if (projRes.data) setProjects(projRes.data);
    if (msRes.data) setMilestones(msRes.data);
    if (leadRes.data) setLeads(leadRes.data);
  }

  // Compute project progress from milestones
  function getProgress(projectId: string) {
    const pMs = milestones.filter(m => m.project_id === projectId);
    if (pMs.length === 0) return { pct: 0, done: 0, total: 0 };
    const done = pMs.filter(m => m.is_completed).length;
    return { pct: Math.round((done / pMs.length) * 100), done, total: pMs.length };
  }

  // Compute Business Health KPIs
  const kpis = useMemo(() => {
    const totalPipeline = leads.reduce((s, l) => s + parseFloat(l.potential_value || 0), 0);
    const wonLeads = leads.filter(l => l.status === 'WON');
    const convRate = leads.length > 0 ? ((wonLeads.length / leads.length) * 100) : 0;
    const activeProjects = projects.filter(p => p.status === 'IN_PROGRESS');
    const totalEstHours = projects.reduce((s, p) => s + parseFloat(p.estimated_hours || 0), 0);
    const activeHours = activeProjects.reduce((s, p) => s + parseFloat(p.estimated_hours || 0), 0);
    const utilization = totalEstHours > 0 ? ((activeHours / totalEstHours) * 100) : 0;

    // Pipeline velocity: avg days from lead creation to project conversion
    const convertedLeads = leads.filter(l => l.converted_project_id);
    let velocity = 0;
    if (convertedLeads.length > 0) {
      const totalDays = convertedLeads.reduce((s, l) => {
        const created = new Date(l.created_at).getTime();
        const updated = new Date(l.updated_at).getTime();
        return s + (updated - created) / (86400000);
      }, 0);
      velocity = Math.round(totalDays / convertedLeads.length);
    }

    return { totalPipeline, convRate: convRate.toFixed(1), utilization: utilization.toFixed(0), velocity };
  }, [leads, projects]);

  // Gantt timeline calculations
  const ganttData = useMemo(() => {
    const now = Date.now();
    const allDates = projects.filter(p => p.deadline).map(p => new Date(p.deadline).getTime());
    if (allDates.length === 0) return { items: [], minDate: now, maxDate: now + 30 * 86400000, range: 30 * 86400000 };
    const minDate = Math.min(now, ...allDates) - 2 * 86400000;
    const maxDate = Math.max(...allDates) + 3 * 86400000;
    const range = maxDate - minDate;

    const items = projects.filter(p => p.deadline && p.status !== 'CANCELLED').map(p => {
      const deadline = new Date(p.deadline).getTime();
      const created = new Date(p.created_at).getTime();
      const startPct = Math.max(0, ((created - minDate) / range) * 100);
      const endPct = Math.min(100, ((deadline - minDate) / range) * 100);
      const widthPct = Math.max(2, endPct - startPct);

      const slackMs = deadline - (now + parseFloat(p.estimated_hours || 0) * 3600000);
      const slackHours = slackMs / 3600000;
      const deadlineStatus = slackHours < 0 ? 'OVERDUE' : slackHours < 48 ? 'AT_RISK' : 'ON_TRACK';

      return { ...p, startPct, widthPct, deadlineStatus, slackHours: Math.round(slackHours) };
    });

    return { items, minDate, maxDate, range };
  }, [projects]);

  const nowPct = ganttData.range > 0 ? ((Date.now() - ganttData.minDate) / ganttData.range) * 100 : 0;

  const barColor = (status: string) => {
    if (status === 'OVERDUE') return 'bg-red-500';
    if (status === 'AT_RISK') return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <CalendarDays className="text-indigo-400" /> Project Overview & Timeline
        </h2>
        <p className="text-sm text-slate-400 mt-1">Gantt-style deadline visualization with milestone progress and resource utilization.</p>
      </div>

      {/* Business Health KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div custom={0} variants={cardAnim} initial="hidden" animate="visible">
          <KPI icon={<TrendingUp className="text-emerald-500" size={20} />} label="Pipeline Value" value={`$${(kpis.totalPipeline / 1000).toFixed(0)}K`} />
        </motion.div>
        <motion.div custom={1} variants={cardAnim} initial="hidden" animate="visible">
          <KPI icon={<Users className="text-indigo-500" size={20} />} label="Conversion Rate" value={`${kpis.convRate}%`} />
        </motion.div>
        <motion.div custom={2} variants={cardAnim} initial="hidden" animate="visible">
          <KPI icon={<Zap className="text-amber-500" size={20} />} label="Resource Utilization" value={`${kpis.utilization}%`} />
        </motion.div>
        <motion.div custom={3} variants={cardAnim} initial="hidden" animate="visible">
          <KPI icon={<Clock className="text-purple-500" size={20} />} label="Pipeline Velocity" value={kpis.velocity > 0 ? `${kpis.velocity}d avg` : 'N/A'} />
        </motion.div>
      </div>

      {/* Gantt Timeline */}
      <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-medium text-slate-200 mb-4">Deadline Timeline</h3>
        <div className="relative">
          {/* Now marker */}
          <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-indigo-500/50 z-10"
               style={{ left: `${Math.min(100, Math.max(0, nowPct))}%` }}>
            <div className="absolute -top-1 -left-3 text-[10px] text-indigo-400 font-bold bg-[#1E293B] px-1">NOW</div>
          </div>

          <div className="space-y-3">
            {ganttData.items.map((item, i) => {
              const prog = getProgress(item.id);
              return (
                <motion.div key={item.id} custom={i} variants={cardAnim} initial="hidden" animate="visible"
                  className="flex items-center gap-4"
                >
                  <div className="w-48 shrink-0">
                    <div className="text-sm font-medium text-white truncate">{item.project_name}</div>
                    <div className="text-xs text-slate-500">{item.client_name}</div>
                  </div>

                  {/* Bar */}
                  <div className="flex-1 relative h-8 bg-[#0F172A] rounded-lg overflow-hidden border border-slate-800">
                    <div className={`absolute h-full ${barColor(item.deadlineStatus)} opacity-80 rounded-lg transition-all`}
                         style={{ left: `${item.startPct}%`, width: `${item.widthPct}%` }}>
                      {/* Progress fill */}
                      <div className="h-full bg-white/20 rounded-lg" style={{ width: `${prog.pct}%` }} />
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/70 z-10">
                      {prog.pct}% ({prog.done}/{prog.total})
                    </div>
                  </div>

                  {/* Slack badge */}
                  <div className={`w-24 text-right text-xs font-bold shrink-0 ${
                    item.deadlineStatus === 'OVERDUE' ? 'text-red-400' :
                    item.deadlineStatus === 'AT_RISK' ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {item.deadlineStatus === 'OVERDUE' ? `${Math.abs(item.slackHours)}h over` : `${item.slackHours}h slack`}
                  </div>
                </motion.div>
              );
            })}

            {ganttData.items.length === 0 && (
              <div className="text-center text-slate-600 py-8">No active projects with deadlines.</div>
            )}
          </div>
        </div>
      </div>

      {/* Milestone Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {projects.filter(p => p.status !== 'CANCELLED' && p.status !== 'SHIPPED').map((project, i) => {
          const pMs = milestones.filter(m => m.project_id === project.id).sort((a, b) => a.sort_order - b.sort_order);
          const prog = getProgress(project.id);
          return (
            <motion.div key={project.id} custom={i} variants={cardAnim} initial="hidden" animate="visible"
              className="bg-[#1E293B] border border-slate-800 rounded-xl p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-white">{project.project_name}</h4>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  prog.pct === 100 ? 'bg-emerald-500/20 text-emerald-400' :
                  prog.pct > 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'
                }`}>{prog.pct}%</span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-[#0F172A] rounded-full mb-3 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${prog.pct}%` }} />
              </div>

              <div className="space-y-1.5">
                {pMs.map(ms => (
                  <div key={ms.id} className="flex items-center gap-2 text-xs">
                    {ms.is_completed
                      ? <CheckCircle className="text-emerald-500 shrink-0" size={14} />
                      : <Circle className="text-slate-600 shrink-0" size={14} />
                    }
                    <span className={ms.is_completed ? 'text-slate-500 line-through' : 'text-slate-300'}>{ms.task_name}</span>
                    {ms.due_date && (
                      <span className="ml-auto text-slate-600 font-mono">
                        {new Date(ms.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                ))}
                {pMs.length === 0 && <div className="text-xs text-slate-600">No milestones defined.</div>}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

const KPI = ({ icon, label, value }: any) => (
  <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5 shadow-sm">
    <div className="flex items-center gap-2 mb-3">{icon}<span className="text-sm text-slate-400">{label}</span></div>
    <div className="text-2xl font-bold text-white">{value}</div>
  </div>
);
