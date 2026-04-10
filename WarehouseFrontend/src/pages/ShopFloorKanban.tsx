import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { Kanban, Clock, AlertTriangle, CheckCircle, Truck, Archive, XCircle } from 'lucide-react';

const COLUMNS = [
  { key: 'BACKLOG', label: 'Backlog', icon: Archive, color: 'slate' },
  { key: 'PLANNING', label: 'Planning', icon: Clock, color: 'indigo' },
  { key: 'IN_PROGRESS', label: 'In Progress', icon: Kanban, color: 'amber' },
  { key: 'QA', label: 'Quality Assurance', icon: CheckCircle, color: 'purple' },
  { key: 'SHIPPED', label: 'Shipped', icon: Truck, color: 'emerald' },
];

export const ShopFloorKanban = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);

  useEffect(() => {
    loadProjects();

    const channel = supabase.channel('projects_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => loadProjects())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadProjects() {
    try {
      const { data } = await supabase.table('projects').select('*').order('priority', { ascending: true });
      if (data) setProjects(data);

      // Load deadline health view
      const { data: healthData } = await supabase.from('project_deadline_health').select('*');
      // Load resource conflicts
      const { data: conflictData } = await supabase.from('resource_conflicts').select('*');
      if (conflictData) setConflicts(conflictData);
    } catch (e) {
      console.error('Kanban load failed:', e);
    }
  }

  async function moveProject(projectId: string, newStatus: string) {
    try {
      await supabase.table('projects').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', projectId);
      loadProjects();
    } catch (e) {
      console.error('Move failed:', e);
    }
  }

  function computeSlack(project: any): { hours: number; status: string } | null {
    if (!project.deadline || !project.estimated_hours) return null;
    const deadline = new Date(project.deadline).getTime();
    const estimatedMs = parseFloat(project.estimated_hours) * 3600 * 1000;
    const completion = Date.now() + estimatedMs;
    const slackMs = deadline - completion;
    const slackHours = slackMs / (3600 * 1000);
    return {
      hours: Math.round(slackHours * 10) / 10,
      status: slackHours < 0 ? 'OVERDUE' : slackHours < 48 ? 'AT_RISK' : 'ON_TRACK'
    };
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Kanban className="text-amber-400" /> Shop Floor Kanban
          </h2>
          <p className="text-sm text-slate-400 mt-1">Drag projects through the pipeline. Status changes trigger inventory locks in real-time.</p>
        </div>
      </div>

      {/* Resource Conflict Alerts */}
      {conflicts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-red-400" size={18} />
            <h3 className="text-sm font-bold text-red-400">Resource Conflicts Detected</h3>
          </div>
          {conflicts.map((c, i) => (
            <p key={i} className="text-sm text-red-300 ml-6">
              <strong>{c.machine_id}:</strong> "{c.project_a_name}" and "{c.project_b_name}" are scheduled within {c.days_between || '0'} days of each other.
            </p>
          ))}
        </div>
      )}

      {/* Kanban Columns */}
      <div className="grid grid-cols-5 gap-3 min-h-[500px]">
        {COLUMNS.map(col => {
          const colProjects = projects.filter(p => p.status === col.key);
          const Icon = col.icon;
          return (
            <div key={col.key} className="bg-[#1E293B]/50 border border-slate-800 rounded-xl p-3 flex flex-col">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
                <Icon className={`text-${col.color}-400`} size={16} />
                <span className="text-sm font-bold text-slate-300">{col.label}</span>
                <span className="ml-auto text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{colProjects.length}</span>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto">
                {colProjects.map((project, i) => {
                  const slack = computeSlack(project);
                  return (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-[#0F172A] border border-slate-800 rounded-lg p-3 cursor-pointer hover:border-indigo-500/40 transition-colors group"
                    >
                      <div className="text-sm font-medium text-white truncate">{project.project_name}</div>
                      <div className="text-xs text-slate-500 mt-1">{project.client_name}</div>

                      {slack && (
                        <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${
                          slack.status === 'OVERDUE' ? 'text-red-400' :
                          slack.status === 'AT_RISK' ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          <Clock size={12} />
                          {slack.status === 'OVERDUE'
                            ? `${Math.abs(slack.hours)}h overdue`
                            : `${slack.hours}h slack`
                          }
                        </div>
                      )}

                      {project.machine_id && (
                        <div className="text-[10px] text-slate-600 mt-1 font-mono">{project.machine_id}</div>
                      )}

                      {/* Move buttons */}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {COLUMNS.filter(c => c.key !== col.key).slice(0, 2).map(target => (
                          <button
                            key={target.key}
                            onClick={() => moveProject(project.id, target.key)}
                            className="text-[10px] bg-slate-800 hover:bg-indigo-500/30 text-slate-400 hover:text-white px-2 py-0.5 rounded transition-colors"
                          >
                            → {target.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
