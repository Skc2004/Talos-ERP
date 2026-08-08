import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Kanban, Clock, AlertTriangle, CheckCircle, Truck, Archive, XCircle, Timer, X, Plus, ClipboardCheck, Check } from 'lucide-react';

const QA_TEMPLATES = [
  { name: 'CNC Machining QA', items: ['Dimensional accuracy within ±0.05mm','Surface finish Ra < 1.6μm','No burrs or sharp edges','Material certification verified','Thread gauge check passed','Visual inspection clean'] },
  { name: 'Assembly QA', items: ['All components present per BOM','Torque specs met on fasteners','Electrical continuity verified','Alignment within spec','Lubrication applied','Final functional test passed'] },
  { name: 'General Manufacturing', items: ['Raw material inspection','In-process dimensional check','Surface treatment verified','Packaging integrity','Documentation complete','Customer spec compliance'] },
];

const COLUMNS = [
  { key: 'BACKLOG', label: 'Backlog', icon: Archive, color: 'slate' },
  { key: 'PLANNING', label: 'Planning', icon: Clock, color: 'indigo' },
  { key: 'IN_PROGRESS', label: 'In Progress', icon: Kanban, color: 'amber' },
  { key: 'QA', label: 'Quality Assurance', icon: CheckCircle, color: 'purple' },
  { key: 'SHIPPED', label: 'Shipped', icon: Truck, color: 'emerald' },
];

const JAVA_API = import.meta.env.VITE_JAVA_API_URL || 'http://localhost:8080/api/v1';

export const ShopFloorKanban = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [timeLogProject, setTimeLogProject] = useState<any>(null);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [newHours, setNewHours] = useState('');
  const [newTimeDesc, setNewTimeDesc] = useState('');

  // Phase 2: QA Checklist
  const [qaProject, setQaProject] = useState<any>(null);
  const [qaChecked, setQaChecked] = useState<boolean[]>([]);
  const [qaTemplate, setQaTemplate] = useState(0);
  const [qaSaving, setQaSaving] = useState(false);

  useEffect(() => {
    loadProjects();
    const channel = supabase.channel('projects_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => loadProjects())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadProjects() {
    try {
      const { data } = await supabase.from('projects').select('*').order('priority', { ascending: true });
      if (data) setProjects(data);
      const { data: healthData } = await supabase.from('project_deadline_health').select('*');
      const { data: conflictData } = await supabase.from('resource_conflicts').select('*');
      if (conflictData) setConflicts(conflictData);
    } catch (e) {
      console.error('Kanban load failed:', e);
    }
  }

  async function moveProject(projectId: string, newStatus: string) {
    try {
      await supabase.from('projects').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', projectId);
      loadProjects();
    } catch (e) { console.error('Move failed:', e); }
  }

  async function openTimeLog(project: any) {
    setTimeLogProject(project);
    try { const r = await fetch(`${JAVA_API}/operations/projects/${project.id}/time`); const d = await r.json(); setTimeEntries(Array.isArray(d)?d:[]); } catch { setTimeEntries([]); }
  }
  async function handleLogTime() {
    if (!timeLogProject || !newHours) return;
    try {
      await fetch(`${JAVA_API}/operations/projects/${timeLogProject.id}/time`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ hours: parseFloat(newHours), description: newTimeDesc || 'Work logged' })
      });
      setNewHours(''); setNewTimeDesc('');
      openTimeLog(timeLogProject);
      loadProjects();
    } catch(e) { console.error(e); }
  }

  // ── Phase 2: QA Handlers ──
  function openQaChecklist(project: any) {
    setQaProject(project); setQaTemplate(0);
    setQaChecked(QA_TEMPLATES[0].items.map(()=>false));
  }
  function changeQaTemplate(idx: number) {
    setQaTemplate(idx); setQaChecked(QA_TEMPLATES[idx].items.map(()=>false));
  }
  function toggleQaItem(i: number) { const n = [...qaChecked]; n[i] = !n[i]; setQaChecked(n); }
  async function handleSaveQa() {
    if (!qaProject) return; setQaSaving(true);
    try {
      const items = QA_TEMPLATES[qaTemplate].items.map((item,i)=>({item, checked: qaChecked[i]}));
      await fetch(`${JAVA_API}/operations/projects/${qaProject.id}/qa`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ items: JSON.stringify(items), completedAt: qaChecked.every(Boolean) ? new Date().toISOString() : null })
      });
      setQaProject(null);
    } catch(e) { console.error(e); }
    setQaSaving(false);
  }
  const qaProgress = qaChecked.length > 0 ? Math.round(qaChecked.filter(Boolean).length / qaChecked.length * 100) : 0;

  function computeSlack(project: any): { hours: number; status: string } | null {
    if (!project.deadline || !project.estimated_hours) return null;
    const deadline = new Date(project.deadline).getTime();
    const estimatedMs = parseFloat(project.estimated_hours) * 3600 * 1000;
    const completion = Date.now() + estimatedMs;
    const slackMs = deadline - completion;
    const slackHours = slackMs / (3600 * 1000);
    return { hours: Math.round(slackHours * 10) / 10, status: slackHours < 0 ? 'OVERDUE' : slackHours < 48 ? 'AT_RISK' : 'ON_TRACK' };
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2"><Kanban className="text-amber-400" /> Shop Floor Kanban</h2>
          <p className="text-sm text-slate-400 mt-1">Drag projects through the pipeline. Status changes trigger inventory locks in real-time.</p>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="text-red-400" size={18} /><h3 className="text-sm font-bold text-red-400">Resource Conflicts Detected</h3></div>
          {conflicts.map((c, i) => (<p key={i} className="text-sm text-red-300 ml-6"><strong>{c.machine_id}:</strong> "{c.project_a_name}" and "{c.project_b_name}" are scheduled within {c.days_between || '0'} days of each other.</p>))}
        </div>
      )}

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
                    <motion.div key={project.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} className="bg-[#0F172A] border border-slate-800 rounded-lg p-3 cursor-pointer hover:border-indigo-500/40 transition-colors group">
                      <div className="text-sm font-medium text-white truncate">{project.project_name}</div>
                      <div className="text-xs text-slate-500 mt-1">{project.client_name}</div>

                      {slack && (
                        <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${slack.status === 'OVERDUE' ? 'text-red-400' : slack.status === 'AT_RISK' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          <Clock size={12} />{slack.status === 'OVERDUE' ? `${Math.abs(slack.hours)}h overdue` : `${slack.hours}h slack`}
                        </div>
                      )}

                      {project.machine_id && (<div className="text-[10px] text-slate-600 mt-1 font-mono">{project.machine_id}</div>)}

                      {project.estimated_hours && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${parseFloat(project.actual_hours||0) > parseFloat(project.estimated_hours) ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width:`${Math.min(100, (parseFloat(project.actual_hours||0)/parseFloat(project.estimated_hours))*100)}%`}} />
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono shrink-0">{parseFloat(project.actual_hours||0).toFixed(1)}/{parseFloat(project.estimated_hours).toFixed(0)}h</span>
                        </div>
                      )}

                      {/* Move, Time & QA buttons */}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={()=>openTimeLog(project)} className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 px-2 py-0.5 rounded transition-colors flex items-center gap-1"><Timer size={10}/>Log Time</button>
                        {col.key === 'QA' && <button onClick={()=>openQaChecklist(project)} className="text-[10px] bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-2 py-0.5 rounded transition-colors flex items-center gap-1"><ClipboardCheck size={10}/>QA Check</button>}
                        {COLUMNS.filter(c => c.key !== col.key).slice(0, 2).map(target => (
                          <button key={target.key} onClick={() => moveProject(project.id, target.key)} className="text-[10px] bg-slate-800 hover:bg-indigo-500/30 text-slate-400 hover:text-white px-2 py-0.5 rounded transition-colors">→ {target.label}</button>
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

      {/* Time Log Modal */}
      <AnimatePresence>
        {timeLogProject && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={()=>setTimeLogProject(null)}>
            <motion.div initial={{scale:0.95}} animate={{scale:1}} className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e=>e.stopPropagation()}>
              <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-[#0F172A]">
                <div><h3 className="text-white font-bold flex items-center gap-2"><Timer size={18} className="text-amber-400"/>Time Log</h3><p className="text-xs text-slate-400">{timeLogProject.project_name}</p></div>
                <button onClick={()=>setTimeLogProject(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex gap-2">
                  <input type="number" step="0.5" min="0.5" placeholder="Hours" value={newHours} onChange={e=>setNewHours(e.target.value)} className="w-24 bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500"/>
                  <input type="text" placeholder="What did you work on?" value={newTimeDesc} onChange={e=>setNewTimeDesc(e.target.value)} className="flex-1 bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500"/>
                  <button onClick={handleLogTime} disabled={!newHours} className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold px-4 rounded-lg text-sm">Log</button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {timeEntries.length===0?<p className="text-sm text-slate-500 text-center py-4">No time logged yet.</p>:timeEntries.map((t:any)=>(
                    <div key={t.id} className="flex items-center justify-between bg-[#0F172A] border border-slate-800 rounded-lg px-3 py-2">
                      <div><span className="text-amber-400 font-bold text-sm">{parseFloat(t.hours).toFixed(1)}h</span><span className="text-slate-400 text-xs ml-2">{t.description}</span></div>
                      <span className="text-[10px] text-slate-600">{new Date(t.loggedAt||t.logged_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QA Checklist Modal */}
      <AnimatePresence>
        {qaProject && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={()=>setQaProject(null)}>
            <motion.div initial={{scale:0.9,y:20}} animate={{scale:1,y:0}} className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e=>e.stopPropagation()}>
              <div className="p-5 border-b border-slate-700 bg-[#0F172A] flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><ClipboardCheck size={20} className="text-purple-400"/>QA Checklist</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{qaProject.project_name} — {qaProject.client_name}</p>
                </div>
                <button onClick={()=>setQaProject(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
              <div className="p-4 border-b border-slate-800">
                <div className="flex gap-2">
                  {QA_TEMPLATES.map((t,i) => (
                    <button key={i} onClick={()=>changeQaTemplate(i)} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${qaTemplate===i?'bg-purple-500 text-white':'bg-[#0F172A] text-slate-400 border border-slate-700 hover:border-slate-500'}`}>{t.name}</button>
                  ))}
                </div>
              </div>
              <div className="p-4 space-y-1.5 max-h-[40vh] overflow-y-auto">
                {QA_TEMPLATES[qaTemplate].items.map((item, i) => (
                  <button key={i} onClick={()=>toggleQaItem(i)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm text-left transition-colors ${qaChecked[i]?'bg-emerald-500/10 border border-emerald-500/30':'bg-[#0F172A] border border-slate-800 hover:border-slate-600'}`}>
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${qaChecked[i]?'bg-emerald-500 text-white':'border border-slate-600'}`}>{qaChecked[i] && <Check size={12}/>}</div>
                    <span className={qaChecked[i]?'text-emerald-300 line-through':'text-slate-300'}>{item}</span>
                  </button>
                ))}
              </div>
              <div className="p-4 border-t border-slate-700 bg-[#0F172A]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full transition-all" style={{width:`${qaProgress}%`}}/></div>
                  <span className="text-xs text-purple-400 font-bold">{qaProgress}%</span>
                </div>
                <button onClick={handleSaveQa} disabled={qaSaving} className="w-full bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors">{qaSaving ? 'Saving...' : qaChecked.every(Boolean) ? '✅ Mark as Passed' : 'Save Progress'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
