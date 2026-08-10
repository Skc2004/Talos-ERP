import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Plus, X, Trash2, Download, AlertTriangle, ChevronRight } from 'lucide-react';

const JAVA_API = import.meta.env.VITE_JAVA_API_URL || 'http://localhost:8080/api/v1';
const MAX_HOURS = 160;
const ROLES = ['LEAD_ENGINEER', 'ENGINEER', 'QA_ENGINEER', 'PLANNER', 'MANAGER'];

const InputCls = 'w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors';

function cellColor(h: number) {
  if (h === 0) return '';
  if (h <= 40) return 'bg-emerald-500/15 text-emerald-400';
  if (h <= 80) return 'bg-amber-500/15 text-amber-400';
  return 'bg-red-500/15 text-red-400';
}

function utilColor(pct: number) {
  if (pct < 60) return 'bg-emerald-500';
  if (pct < 90) return 'bg-amber-500';
  return 'bg-red-500';
}

export const ResourceMatrix = () => {
  const [employees, setEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ employeeId: '', projectId: '', role: 'ENGINEER', allocatedHours: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [empRes, projRes] = await Promise.all([
      supabase.from('hr_employees').select('*').eq('is_active', true).order('name'),
      supabase.from('projects').select('id, project_name, status').not('status', 'in', '("SHIPPED","CANCELLED")'),
    ]);
    if (empRes.data) setEmployees(empRes.data);
    if (projRes.data) setProjects(projRes.data);

    try {
      const r = await fetch(`${JAVA_API}/operations/assignments`);
      if (r.ok) setAssignments(await r.json());
    } catch { setAssignments([]); }
  }

  // Get allocated hours for employee × project
  function getAllocated(empName: string, projectId: string) {
    const match = assignments.filter(a => a.employeeName === empName && a.projectId === projectId);
    return { hours: match.reduce((s, a) => s + parseFloat(a.allocatedHours || 0), 0), ids: match.map(a => a.id) };
  }

  function getEmployeeTotal(empName: string) {
    return assignments.filter(a => a.employeeName === empName).reduce((s, a) => s + parseFloat(a.allocatedHours || 0), 0);
  }

  async function handleAssign() {
    if (!form.employeeId || !form.projectId || !form.allocatedHours) return;
    setSaving(true);
    const emp = employees.find(e => e.id === form.employeeId);
    await fetch(`${JAVA_API}/operations/assignments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeName: emp?.name, projectId: form.projectId, role: form.role, allocatedHours: parseFloat(form.allocatedHours) }),
    });
    setShowModal(false); setForm({ employeeId: '', projectId: '', role: 'ENGINEER', allocatedHours: '' });
    setSaving(false); loadAll();
  }

  async function removeAssignment(id: string) {
    if (!window.confirm('Remove this assignment?')) return;
    await fetch(`${JAVA_API}/operations/assignments/${id}`, { method: 'DELETE' });
    loadAll();
  }

  function exportCSV() {
    const rows = [['Employee', ...projects.map(p => p.project_name), 'Total', 'Util%']];
    employees.forEach(emp => {
      const total = getEmployeeTotal(emp.name);
      const util = Math.round((total / MAX_HOURS) * 100);
      rows.push([emp.name, ...projects.map(p => getAllocated(emp.name, p.id).hours.toString()), total.toString(), `${util}%`]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'resource_matrix.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const overallocated = employees.filter(e => getEmployeeTotal(e.name) > MAX_HOURS);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="text-violet-400"/> Resource Allocation Matrix
          </h2>
          <p className="text-sm text-slate-400 mt-1">Employee × project allocation heatmap. Cap: {MAX_HOURS}h/month.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15}/> Export CSV
          </button>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
            <Plus size={16}/> Assign Resource
          </button>
        </div>
      </div>

      {/* Overallocation banner */}
      {overallocated.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-400 shrink-0"/>
          <div>
            <p className="text-sm text-red-300 font-bold">Overallocation Alert</p>
            <p className="text-xs text-red-400">{overallocated.map(e => `${e.name} (${Math.round(getEmployeeTotal(e.name))}h)`).join(', ')} exceed the {MAX_HOURS}h monthly cap.</p>
          </div>
        </div>
      )}

      {/* Matrix */}
      <div className="bg-[#1E293B] border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="sticky left-0 bg-[#1E293B] text-left text-xs font-bold text-slate-400 p-4 min-w-48 z-10">Employee</th>
                {projects.map(p => (
                  <th key={p.id} className="text-center text-xs font-bold text-slate-400 p-3 min-w-32 max-w-40">
                    <div className="truncate">{p.project_name}</div>
                    <div className="text-[9px] text-slate-600 font-normal mt-0.5">{p.status}</div>
                  </th>
                ))}
                <th className="text-center text-xs font-bold text-slate-400 p-3 min-w-20">Total</th>
                <th className="text-center text-xs font-bold text-slate-400 p-3 min-w-28">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => {
                const total = getEmployeeTotal(emp.name);
                const util = Math.round((total / MAX_HOURS) * 100);
                return (
                  <tr key={emp.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                    <td className="sticky left-0 bg-[#1E293B] p-4 z-10">
                      <div className="text-sm font-semibold text-white">{emp.name}</div>
                      <div className="text-[10px] text-slate-500">{emp.department} · {emp.role?.replace(/_/g, ' ')}</div>
                    </td>
                    {projects.map(p => {
                      const { hours, ids } = getAllocated(emp.name, p.id);
                      return (
                        <td key={p.id} className="text-center p-2">
                          {hours > 0 ? (
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${cellColor(hours)}`}>
                              {hours}h
                              <button onClick={() => removeAssignment(ids[0])} className="hover:text-red-400 transition-colors ml-1"><X size={9}/></button>
                            </div>
                          ) : (
                            <span className="text-slate-800 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center p-3">
                      <span className={`text-sm font-bold ${total > MAX_HOURS ? 'text-red-400' : total > MAX_HOURS * 0.8 ? 'text-amber-400' : 'text-slate-300'}`}>{total}h</span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#0F172A] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${utilColor(util)}`} style={{ width: `${Math.min(100, util)}%` }}/>
                        </div>
                        <span className={`text-xs font-bold shrink-0 ${util > 90 ? 'text-red-400' : util > 60 ? 'text-amber-400' : 'text-emerald-400'}`}>{util}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {employees.length === 0 && (
                <tr><td colSpan={projects.length + 3} className="text-center text-slate-600 py-10">No active employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>Legend:</span>
        {[['≤40h', 'text-emerald-400'], ['41–80h', 'text-amber-400'], ['>80h', 'text-red-400']].map(([l, c]) => (
          <span key={l} className={`${c} font-bold`}>{l}</span>
        ))}
      </div>

      {/* Assign Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Plus size={18} className="text-violet-400"/>Assign Resource</h3>
                <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
              <div className="p-5 space-y-3">
                <select value={form.employeeId} onChange={e => setForm(f => ({...f, employeeId: e.target.value}))} className={InputCls}>
                  <option value="">Select employee *</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.department})</option>)}
                </select>
                <select value={form.projectId} onChange={e => setForm(f => ({...f, projectId: e.target.value}))} className={InputCls}>
                  <option value="">Select project *</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                </select>
                <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))} className={InputCls}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
                <input type="number" placeholder="Allocated hours *" min="1" value={form.allocatedHours}
                  onChange={e => setForm(f => ({...f, allocatedHours: e.target.value}))} className={InputCls}/>
                <button onClick={handleAssign} disabled={!form.employeeId || !form.projectId || !form.allocatedHours || saving}
                  className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors">
                  {saving ? 'Assigning...' : 'Create Assignment'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
