import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Kanban, Clock, AlertTriangle, CheckCircle, Truck, Archive, XCircle,
  Timer, X, ClipboardCheck, Check, Plus, Edit2, Trash2, ChevronRight,
  Flag, Filter, Search, GripVertical
} from 'lucide-react';

const JAVA_API = import.meta.env.VITE_JAVA_API_URL || 'http://localhost:8080/api/v1';

const COLUMNS = [
  { key: 'BACKLOG',     label: 'Backlog',          icon: Archive,       color: 'slate',   border: 'border-slate-500' },
  { key: 'PLANNING',   label: 'Planning',           icon: Clock,         color: 'indigo',  border: 'border-indigo-500' },
  { key: 'IN_PROGRESS',label: 'In Progress',        icon: Kanban,        color: 'amber',   border: 'border-amber-500' },
  { key: 'QA',         label: 'Quality Assurance',  icon: CheckCircle,   color: 'purple',  border: 'border-purple-500' },
  { key: 'SHIPPED',    label: 'Shipped',            icon: Truck,         color: 'emerald', border: 'border-emerald-500' },
];

const PRIORITY_COLORS: Record<string,string> = {
  HIGH: 'bg-red-500/20 text-red-400 border-red-500/30',
  MEDIUM: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  LOW: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const STATUS_COLORS: Record<string,string> = {
  BACKLOG: 'bg-slate-500', PLANNING: 'bg-indigo-500',
  IN_PROGRESS: 'bg-amber-500', QA: 'bg-purple-500', SHIPPED: 'bg-emerald-500'
};

const QA_FALLBACK = [
  { name: 'CNC Machining QA', items: ['Dimensional accuracy ±0.05mm','Surface finish Ra < 1.6μm','No burrs or sharp edges','Material certification verified','Thread gauge check passed','Visual inspection clean'] },
  { name: 'Assembly QA', items: ['All components per BOM','Torque specs met','Electrical continuity verified','Alignment within spec','Lubrication applied','Functional test passed'] },
  { name: 'General Manufacturing', items: ['Raw material inspection','In-process dimensional check','Surface treatment verified','Packaging integrity','Documentation complete','Customer spec compliance'] },
];

const InputCls = 'w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors';

export const ShopFloorKanban = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [qaTemplates, setQaTemplates] = useState<any[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [searchClient, setSearchClient] = useState('');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<any>(null);
  const [milestoneProject, setMilestoneProject] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [newMsTitle, setNewMsTitle] = useState('');
  const [newMsDue, setNewMsDue] = useState('');
  const [timeLogProject, setTimeLogProject] = useState<any>(null);
  const [timeEntries, setTimeEntries] = useState<any[]>([]);
  const [newHours, setNewHours] = useState('');
  const [newTimeDesc, setNewTimeDesc] = useState('');
  const [qaProject, setQaProject] = useState<any>(null);
  const [qaTemplate, setQaTemplate] = useState(0);
  const [qaChecked, setQaChecked] = useState<boolean[]>([]);
  const [qaSaving, setQaSaving] = useState(false);

  const emptyForm = { project_name: '', client_name: '', deadline: '', estimated_hours: '', priority: 'MEDIUM', description: '' };
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProjects();
    loadQaTemplates();
    const channel = supabase.channel('kanban_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, loadProjects)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_milestones' }, () => {
        if (milestoneProject) loadMilestones(milestoneProject.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadProjects() {
    const { data } = await supabase.from('projects').select('*').order('priority', { ascending: true });
    if (data) setProjects(data);
  }

  async function loadQaTemplates() {
    const { data } = await supabase.from('qa_templates').select('*');
    if (data && data.length > 0) setQaTemplates(data);
    else setQaTemplates(QA_FALLBACK);
  }

  async function loadMilestones(projectId: string) {
    const { data } = await supabase.from('project_milestones').select('*').eq('project_id', projectId).order('due_date');
    setMilestones(data || []);
  }

  // ─── Drag and Drop ───
  function handleDragStart(e: React.DragEvent, projectId: string) {
    setDraggedId(projectId);
    e.dataTransfer.effectAllowed = 'move';
  }
  function handleDragOver(e: React.DragEvent, colKey: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colKey);
  }
  function handleDragLeave() { setDragOverCol(null); }
  async function handleDrop(e: React.DragEvent, colKey: string) {
    e.preventDefault();
    setDragOverCol(null);
    if (!draggedId) return;
    const project = projects.find(p => p.id === draggedId);
    if (!project || project.status === colKey) { setDraggedId(null); return; }
    // Optimistic update
    setProjects(prev => prev.map(p => p.id === draggedId ? { ...p, status: colKey } : p));
    await supabase.from('projects').update({ status: colKey, updated_at: new Date().toISOString() }).eq('id', draggedId);
    setDraggedId(null);
  }

  // ─── Project CRUD ───
  async function handleCreate() {
    setSaving(true);
    await supabase.from('projects').insert({
      project_name: form.project_name,
      client_name: form.client_name,
      deadline: form.deadline || null,
      estimated_hours: parseFloat(form.estimated_hours) || null,
      priority: parseInt(form.priority === 'HIGH' ? '1' : form.priority === 'MEDIUM' ? '5' : '10'),
      description: form.description,
      status: 'BACKLOG',
      actual_hours: 0,
    });
    setForm({ ...emptyForm }); setShowCreate(false); setSaving(false);
  }

  async function handleEdit() {
    if (!editProject) return;
    setSaving(true);
    await supabase.from('projects').update({
      project_name: form.project_name,
      client_name: form.client_name,
      deadline: form.deadline || null,
      estimated_hours: parseFloat(form.estimated_hours) || null,
      description: form.description,
    }).eq('id', editProject.id);
    setEditProject(null); setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this project and all its milestones?')) return;
    await supabase.from('projects').delete().eq('id', id);
  }

  function openEdit(p: any) {
    setEditProject(p);
    setForm({ project_name: p.project_name || '', client_name: p.client_name || '', deadline: p.deadline ? p.deadline.split('T')[0] : '', estimated_hours: p.estimated_hours || '', priority: 'MEDIUM', description: p.description || '' });
  }

  // ─── Milestones ───
  async function openMilestones(p: any) {
    setMilestoneProject(p);
    await loadMilestones(p.id);
  }
  async function addMilestone() {
    if (!newMsTitle || !milestoneProject) return;
    await supabase.from('project_milestones').insert({ project_id: milestoneProject.id, task_name: newMsTitle, due_date: newMsDue || null, is_completed: false });
    setNewMsTitle(''); setNewMsDue('');
    loadMilestones(milestoneProject.id);
  }
  async function toggleMilestone(id: string, current: boolean) {
    await supabase.from('project_milestones').update({ is_completed: !current }).eq('id', id);
    if (milestoneProject) loadMilestones(milestoneProject.id);
  }
  async function deleteMilestone(id: string) {
    await supabase.from('project_milestones').delete().eq('id', id);
    if (milestoneProject) loadMilestones(milestoneProject.id);
  }

  // ─── Time Log ───
  async function openTimeLog(p: any) {
    setTimeLogProject(p);
    try { const r = await fetch(`${JAVA_API}/operations/projects/${p.id}/time`); setTimeEntries(await r.json()); } catch { setTimeEntries([]); }
  }
  async function handleLogTime() {
    if (!timeLogProject || !newHours) return;
    await fetch(`${JAVA_API}/operations/projects/${timeLogProject.id}/time`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours: parseFloat(newHours), description: newTimeDesc || 'Work logged' })
    });
    setNewHours(''); setNewTimeDesc(''); openTimeLog(timeLogProject); loadProjects();
  }

  // ─── QA ───
  function openQa(p: any) {
    setQaProject(p); setQaTemplate(0);
    const items = Array.isArray(qaTemplates[0]?.items) ? qaTemplates[0].items : QA_FALLBACK[0].items;
    setQaChecked(items.map(() => false));
  }
  function changeQaTemplate(i: number) {
    setQaTemplate(i);
    const items = Array.isArray(qaTemplates[i]?.items) ? qaTemplates[i].items : QA_FALLBACK[i]?.items || [];
    setQaChecked(items.map(() => false));
  }
  function toggleQaItem(i: number) { const n = [...qaChecked]; n[i] = !n[i]; setQaChecked(n); }
  async function saveQa() {
    if (!qaProject) return; setQaSaving(true);
    const tmpl = qaTemplates[qaTemplate] || QA_FALLBACK[qaTemplate];
    const items = (Array.isArray(tmpl?.items) ? tmpl.items : []).map((item: string, i: number) => ({ item, checked: qaChecked[i] }));
    await fetch(`${JAVA_API}/operations/projects/${qaProject.id}/qa`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: JSON.stringify(items), completedAt: qaChecked.every(Boolean) ? new Date().toISOString() : null })
    });
    setQaProject(null); setQaSaving(false);
  }

  function computeSlack(p: any) {
    if (!p.deadline || !p.estimated_hours) return null;
    const slackMs = new Date(p.deadline).getTime() - (Date.now() + parseFloat(p.estimated_hours) * 3600000);
    const slackHours = slackMs / 3600000;
    return { hours: Math.round(Math.abs(slackHours)), status: slackHours < 0 ? 'OVERDUE' : slackHours < 48 ? 'AT_RISK' : 'ON_TRACK' };
  }

  const qaProgress = qaChecked.length > 0 ? Math.round(qaChecked.filter(Boolean).length / qaChecked.length * 100) : 0;

  // Filtered projects
  const filtered = projects.filter(p => {
    const priorityNum = parseInt(p.priority);
    const priorityStr = priorityNum <= 3 ? 'HIGH' : priorityNum <= 7 ? 'MEDIUM' : 'LOW';
    if (filterPriority !== 'ALL' && priorityStr !== filterPriority) return false;
    if (searchClient && !p.client_name?.toLowerCase().includes(searchClient.toLowerCase())) return false;
    return true;
  });

  const Modal = ({ children, onClose }: any) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {children}
      </motion.div>
    </motion.div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Kanban className="text-amber-400" /> Shop Floor Kanban
          </h2>
          <p className="text-sm text-slate-400 mt-1">Drag cards between columns to update project status in real-time.</p>
        </div>
        <button onClick={() => { setForm({ ...emptyForm }); setShowCreate(true); }}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-amber-500/20">
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={searchClient} onChange={e => setSearchClient(e.target.value)}
            placeholder="Filter by client..." className="bg-[#1E293B] border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500 w-48" />
        </div>
        <div className="flex items-center gap-1">
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(p => (
            <button key={p} onClick={() => setFilterPriority(p)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${filterPriority === p ? 'bg-amber-500 text-white' : 'bg-[#1E293B] border border-slate-700 text-slate-400 hover:border-slate-500'}`}>
              {p}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 ml-2">{filtered.length} projects</span>
      </div>

      {/* WIP warning */}
      {projects.filter(p => p.status === 'IN_PROGRESS').length > 3 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-400" />
          <span className="text-sm text-amber-300 font-medium">WIP limit exceeded — {projects.filter(p => p.status === 'IN_PROGRESS').length} projects in progress (limit: 3)</span>
        </div>
      )}

      {/* Kanban Columns */}
      <div className="grid grid-cols-5 gap-3 min-h-[520px]">
        {COLUMNS.map(col => {
          const colProjects = filtered.filter(p => p.status === col.key);
          const totalHours = colProjects.reduce((s, p) => s + parseFloat(p.estimated_hours || 0), 0);
          const Icon = col.icon;
          const isOver = dragOverCol === col.key;
          return (
            <div key={col.key}
              onDragOver={e => handleDragOver(e, col.key)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, col.key)}
              className={`rounded-xl p-3 flex flex-col transition-all border-2 ${isOver ? `bg-${col.color}-500/10 ${col.border} shadow-lg` : 'bg-[#1E293B]/50 border-slate-800'}`}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800">
                <Icon className={`text-${col.color}-400`} size={15} />
                <span className="text-xs font-bold text-slate-300">{col.label}</span>
                <span className="ml-auto text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{colProjects.length}</span>
              </div>
              {totalHours > 0 && <div className="text-[10px] text-slate-600 mb-2">{totalHours}h total</div>}
              <div className="flex-1 space-y-2 overflow-y-auto">
                {colProjects.map((p, i) => {
                  const slack = computeSlack(p);
                  const priorityNum = parseInt(p.priority);
                  const priorityStr = priorityNum <= 3 ? 'HIGH' : priorityNum <= 7 ? 'MEDIUM' : 'LOW';
                  const isDragging = draggedId === p.id;
                  return (
                    <motion.div key={p.id} layout
                      draggable
                      onDragStart={e => handleDragStart(e, p.id)}
                      onDragEnd={() => setDraggedId(null)}
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: isDragging ? 0.4 : 1, scale: isDragging ? 0.97 : 1, rotate: isDragging ? 1 : 0 }}
                      className="bg-[#0F172A] border border-slate-800 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-indigo-500/40 transition-colors group select-none">
                      {/* Priority badge */}
                      <div className="flex items-center gap-1 mb-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[priorityStr]}`}>{priorityStr}</span>
                        <GripVertical size={10} className="text-slate-700 ml-auto" />
                      </div>
                      <div className="text-sm font-semibold text-white truncate leading-tight">{p.project_name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{p.client_name}</div>
                      {p.deadline && (
                        <div className="text-[10px] text-slate-600 mt-1 font-mono">
                          📅 {new Date(p.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                        </div>
                      )}
                      {slack && (
                        <div className={`flex items-center gap-1 mt-1.5 text-xs font-bold ${slack.status === 'OVERDUE' ? 'text-red-400' : slack.status === 'AT_RISK' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          <Clock size={10} />
                          {slack.status === 'OVERDUE' ? `${slack.hours}h overdue` : slack.status === 'AT_RISK' ? `${slack.hours}h slack ⚠️` : `${slack.hours}h slack`}
                        </div>
                      )}
                      {p.estimated_hours && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${parseFloat(p.actual_hours || 0) > parseFloat(p.estimated_hours) ? 'bg-red-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(100, (parseFloat(p.actual_hours || 0) / parseFloat(p.estimated_hours)) * 100)}%` }} />
                          </div>
                          <span className="text-[10px] text-slate-600 shrink-0">{parseFloat(p.actual_hours || 0).toFixed(0)}/{parseFloat(p.estimated_hours).toFixed(0)}h</span>
                        </div>
                      )}
                      {/* Action buttons */}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
                        <button onClick={() => openMilestones(p)} title="Milestones" className="text-[10px] bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 px-2 py-0.5 rounded transition-colors flex items-center gap-0.5"><Check size={10}/> Tasks</button>
                        <button onClick={() => openTimeLog(p)} title="Log time" className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 px-2 py-0.5 rounded transition-colors flex items-center gap-0.5"><Timer size={10}/> Time</button>
                        {col.key === 'QA' && <button onClick={() => openQa(p)} className="text-[10px] bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 px-2 py-0.5 rounded transition-colors flex items-center gap-0.5"><ClipboardCheck size={10}/> QA</button>}
                        <button onClick={() => openEdit(p)} className="ml-auto p-0.5 hover:bg-slate-700 text-slate-500 hover:text-white rounded transition-colors"><Edit2 size={11}/></button>
                        <button onClick={() => handleDelete(p.id)} className="p-0.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-colors"><Trash2 size={11}/></button>
                      </div>
                    </motion.div>
                  );
                })}
                {isOver && <div className={`border-2 border-dashed ${col.border} rounded-lg h-16 flex items-center justify-center text-xs text-slate-500`}>Drop here</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Create Project Modal ── */}
      <AnimatePresence>
        {showCreate && (
          <Modal onClose={() => setShowCreate(false)}>
            <div className="p-5 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Plus size={18} className="text-amber-400"/>New Project</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-3">
              <input placeholder="Project Name *" value={form.project_name} onChange={e => setForm(f => ({...f, project_name: e.target.value}))} className={InputCls}/>
              <input placeholder="Client / Company" value={form.client_name} onChange={e => setForm(f => ({...f, client_name: e.target.value}))} className={InputCls}/>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" placeholder="Deadline" value={form.deadline} onChange={e => setForm(f => ({...f, deadline: e.target.value}))} className={InputCls}/>
                <input type="number" placeholder="Est. Hours" value={form.estimated_hours} onChange={e => setForm(f => ({...f, estimated_hours: e.target.value}))} className={InputCls}/>
              </div>
              <select value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))} className={InputCls}>
                <option value="HIGH">🔴 High Priority</option>
                <option value="MEDIUM">🟡 Medium Priority</option>
                <option value="LOW">🔵 Low Priority</option>
              </select>
              <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} className={`${InputCls} resize-none`}/>
              <button onClick={handleCreate} disabled={!form.project_name || saving} className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors">
                {saving ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Edit Project Modal ── */}
      <AnimatePresence>
        {editProject && (
          <Modal onClose={() => setEditProject(null)}>
            <div className="p-5 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Edit2 size={18} className="text-indigo-400"/>Edit Project</h3>
              <button onClick={() => setEditProject(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-5 space-y-3">
              <input placeholder="Project Name *" value={form.project_name} onChange={e => setForm(f => ({...f, project_name: e.target.value}))} className={InputCls}/>
              <input placeholder="Client / Company" value={form.client_name} onChange={e => setForm(f => ({...f, client_name: e.target.value}))} className={InputCls}/>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={form.deadline} onChange={e => setForm(f => ({...f, deadline: e.target.value}))} className={InputCls}/>
                <input type="number" placeholder="Est. Hours" value={form.estimated_hours} onChange={e => setForm(f => ({...f, estimated_hours: e.target.value}))} className={InputCls}/>
              </div>
              <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} className={`${InputCls} resize-none`}/>
              <button onClick={handleEdit} disabled={!form.project_name || saving} className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── Milestone Sidebar ── */}
      <AnimatePresence>
        {milestoneProject && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50" onClick={() => setMilestoneProject(null)}>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute right-0 top-0 h-full w-96 bg-[#1E293B] border-l border-slate-700 shadow-2xl flex flex-col"
              onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-700 flex items-center justify-between bg-[#0F172A]">
                <div><h3 className="text-white font-bold flex items-center gap-2"><Check size={18} className="text-indigo-400"/>Milestones</h3>
                <p className="text-xs text-slate-500 mt-0.5">{milestoneProject.project_name}</p></div>
                <button onClick={() => setMilestoneProject(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {milestones.length === 0 && <p className="text-sm text-slate-600 text-center py-8">No milestones yet. Add one below.</p>}
                {milestones.map(ms => (
                  <div key={ms.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${ms.is_completed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-[#0F172A] border-slate-800'}`}>
                    <button onClick={() => toggleMilestone(ms.id, ms.is_completed)}
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${ms.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-indigo-500'}`}>
                      {ms.is_completed && <Check size={11} className="text-white"/>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${ms.is_completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{ms.task_name}</div>
                      {ms.due_date && <div className="text-[10px] text-slate-600 font-mono mt-0.5">{new Date(ms.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>}
                    </div>
                    <button onClick={() => deleteMilestone(ms.id)} className="text-slate-600 hover:text-red-400 shrink-0 transition-colors"><Trash2 size={13}/></button>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-slate-700 space-y-2">
                <input placeholder="Milestone title *" value={newMsTitle} onChange={e => setNewMsTitle(e.target.value)} className={InputCls}/>
                <div className="flex gap-2">
                  <input type="date" value={newMsDue} onChange={e => setNewMsDue(e.target.value)} className={`${InputCls} flex-1`}/>
                  <button onClick={addMilestone} disabled={!newMsTitle} className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-bold px-4 rounded-xl transition-colors"><Plus size={16}/></button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Time Log Modal ── */}
      <AnimatePresence>
        {timeLogProject && (
          <Modal onClose={() => setTimeLogProject(null)}>
            <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-[#0F172A] rounded-t-2xl">
              <div><h3 className="text-white font-bold flex items-center gap-2"><Timer size={18} className="text-amber-400"/>Time Log</h3>
              <p className="text-xs text-slate-400">{timeLogProject.project_name}</p></div>
              <button onClick={() => setTimeLogProject(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <input type="number" step="0.5" min="0.5" placeholder="Hours" value={newHours} onChange={e => setNewHours(e.target.value)} className="w-24 bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500"/>
                <input placeholder="Description" value={newTimeDesc} onChange={e => setNewTimeDesc(e.target.value)} className="flex-1 bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500"/>
                <button onClick={handleLogTime} disabled={!newHours} className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold px-4 rounded-lg text-sm">Log</button>
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1.5">
                {timeEntries.length === 0 ? <p className="text-sm text-slate-500 text-center py-4">No time logged yet.</p>
                  : timeEntries.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between bg-[#0F172A] border border-slate-800 rounded-lg px-3 py-2">
                      <div><span className="text-amber-400 font-bold text-sm">{parseFloat(t.hours).toFixed(1)}h</span><span className="text-slate-400 text-xs ml-2">{t.description}</span></div>
                      <span className="text-[10px] text-slate-600">{new Date(t.loggedAt || t.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* ── QA Checklist Modal ── */}
      <AnimatePresence>
        {qaProject && (
          <Modal onClose={() => setQaProject(null)}>
            <div className="p-5 border-b border-slate-700 flex items-center justify-between bg-[#0F172A] rounded-t-2xl">
              <div><h3 className="text-lg font-bold text-white flex items-center gap-2"><ClipboardCheck size={20} className="text-purple-400"/>QA Checklist</h3>
              <p className="text-xs text-slate-400">{qaProject.project_name}</p></div>
              <button onClick={() => setQaProject(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
            </div>
            <div className="p-4 border-b border-slate-800 flex gap-2">
              {(qaTemplates.length > 0 ? qaTemplates : QA_FALLBACK).map((t: any, i: number) => (
                <button key={i} onClick={() => changeQaTemplate(i)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${qaTemplate === i ? 'bg-purple-500 text-white' : 'bg-[#0F172A] text-slate-400 border border-slate-700 hover:border-slate-500'}`}>
                  {t.name}
                </button>
              ))}
            </div>
            <div className="p-4 space-y-1.5 max-h-60 overflow-y-auto">
              {((qaTemplates[qaTemplate] || QA_FALLBACK[qaTemplate])?.items || []).map((item: string, i: number) => (
                <button key={i} onClick={() => toggleQaItem(i)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm text-left transition-colors ${qaChecked[i] ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-[#0F172A] border border-slate-800 hover:border-slate-600'}`}>
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${qaChecked[i] ? 'bg-emerald-500' : 'border border-slate-600'}`}>
                    {qaChecked[i] && <Check size={12} className="text-white"/>}
                  </div>
                  <span className={qaChecked[i] ? 'text-emerald-300 line-through' : 'text-slate-300'}>{item}</span>
                </button>
              ))}
            </div>
            <div className="p-4 border-t border-slate-700 bg-[#0F172A] rounded-b-2xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${qaProgress}%` }}/></div>
                <span className="text-xs text-purple-400 font-bold">{qaProgress}%</span>
              </div>
              <button onClick={saveQa} disabled={qaSaving} className="w-full bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors">
                {qaSaving ? 'Saving...' : qaChecked.every(Boolean) ? '✅ Mark as Passed' : 'Save Progress'}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
