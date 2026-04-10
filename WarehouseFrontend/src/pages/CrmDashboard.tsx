import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, DollarSign, TrendingUp, Target, Plus, Trash2, UserCheck, X } from 'lucide-react';

const JAVA_API = import.meta.env.VITE_JAVA_API_URL || 'http://localhost:8080/api/v1';

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-500', CONTACTED: 'bg-indigo-500', QUOTED: 'bg-amber-500',
  NEGOTIATING: 'bg-purple-500', WON: 'bg-emerald-500', LOST: 'bg-red-500',
};

export const CrmDashboard = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [pipeline, setPipeline] = useState<any>({});
  const [showNewLead, setShowNewLead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLead, setNewLead] = useState({ contact_name: '', contact_email: '', company_name: '', potential_value: '', source: 'WEBSITE', notes: '' });

  useEffect(() => {
    loadData();
    loadEmployees();
    const channel = supabase.channel('crm_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crm_leads' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadData() {
    try {
      const res = await fetch(`${JAVA_API}/crm/leads`);
      if (!res.ok) throw new Error('API Error');
      const responseBody = await res.json();
      const data = responseBody.content || responseBody; // Handle Pageable
      setLeads(data);
      const funnel: Record<string, number> = {};
      let totalValue = 0;
      data.forEach((l: any) => {
        funnel[l.status] = (funnel[l.status] || 0) + 1;
        totalValue += parseFloat(l.potentialValue || 0);
      });
      const wonCount = funnel['WON'] || 0;
      setPipeline({ totalLeads: data.length, totalPipelineValue: totalValue,
        conversionRate: data.length > 0 ? ((wonCount / data.length) * 100).toFixed(1) : '0', funnel });
    } catch {
      setError('Data service disconnected. Failed to load leads.');
    }
  }

  async function loadEmployees() {
    try {
      const res = await fetch(`${JAVA_API}/finance/team`);
      setEmployees(await res.json());
    } catch { setEmployees([]); }
  }

  async function handleCreateLead() {
    try {
      await fetch(`${JAVA_API}/crm/leads`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: newLead.contact_name, contactEmail: newLead.contact_email,
          companyName: newLead.company_name, potentialValue: parseFloat(newLead.potential_value) || 0,
          source: newLead.source, notes: newLead.notes
        })
      });
      setShowNewLead(false);
      setNewLead({ contact_name: '', contact_email: '', company_name: '', potential_value: '', source: 'WEBSITE', notes: '' });
      loadData();
    } catch (e) { console.error(e); }
  }

  async function handleDeleteLead(id: string) {
    if (!confirm('Delete this lead permanently?')) return;
    try {
      await fetch(`${JAVA_API}/crm/leads/${id}`, { method: 'DELETE' });
      loadData();
    } catch (e) { console.error(e); }
  }

  async function handleReassign(leadId: string, employeeId: string) {
    try {
      await fetch(`${JAVA_API}/crm/leads/${leadId}/assign?employeeId=${employeeId}`, { method: 'PATCH' });
      loadData();
    } catch (e) { console.error(e); }
  }

  const KPICard = ({ icon, label, value }: any) => (
    <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">{icon}<span className="text-sm text-slate-400">{label}</span></div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="text-indigo-400" /> CRM & Pipeline
          </h2>
          <p className="text-sm text-slate-400 mt-1">Lead-to-Ledger intelligence for small-scale manufacturers.</p>
        </div>
        <button onClick={() => setShowNewLead(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg">
          <Plus size={16} /> New Lead
        </button>
      </div>

      {/* Pipeline KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={<Users className="text-indigo-500" size={20} />} label="Total Leads" value={String(pipeline.totalLeads || 0)} />
        <KPICard icon={<DollarSign className="text-emerald-500" size={20} />} label="Pipeline Value" value={`₹${((pipeline.totalPipelineValue || 0) / 1000).toFixed(0)}K`} />
        <KPICard icon={<TrendingUp className="text-amber-500" size={20} />} label="Conversion Rate" value={`${pipeline.conversionRate || 0}%`} />
        <KPICard icon={<Target className="text-purple-500" size={20} />} label="Active Negotiations" value={String(pipeline.funnel?.NEGOTIATING || 0)} />
      </div>

      {/* Lead Funnel */}
      {pipeline.funnel && (
        <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Sales Funnel</h3>
          <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
            {Object.entries(pipeline.funnel).map(([status, count]: any) => {
              const width = pipeline.totalLeads > 0 ? (count / pipeline.totalLeads) * 100 : 0;
              return <div key={status} className={`${STATUS_COLORS[status] || 'bg-slate-600'} transition-all`}
                style={{ width: `${width}%` }} title={`${status}: ${count}`} />;
            })}
          </div>
          <div className="flex gap-4 mt-3 flex-wrap">
            {Object.entries(pipeline.funnel).map(([status, count]: any) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status] || 'bg-slate-600'}`} />
                <span className="text-xs text-slate-400">{status} ({count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leads Table with CRUD */}
      <div className="bg-[#1E293B] border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h3 className="text-lg font-medium text-slate-200">All Leads</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0F172A]">
              <tr className="text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-3 text-left">AI Score</th>
                <th className="p-3 text-left">Contact</th>
                <th className="p-3 text-left">Company</th>
                <th className="p-3 text-left">Value</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Assigned To</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {leads.map((lead: any) => (
                <tr key={lead.id} className="hover:bg-[#0F172A]/50 transition-colors">
                  <td className="p-3">
                    <span className="text-indigo-400 font-bold">{(lead.aiScore || lead.ai_score)?.toFixed?.(0) || '—'}</span>
                  </td>
                  <td className="p-3">
                    <div className="text-white font-medium">{lead.contactName || lead.contact_name}</div>
                    <div className="text-xs text-slate-500">{lead.contactEmail || lead.contact_email}</div>
                  </td>
                  <td className="p-3 text-slate-300">{lead.companyName || lead.company_name}</td>
                  <td className="p-3 text-emerald-400 font-semibold">₹{parseFloat(lead.potentialValue || lead.potential_value || 0).toLocaleString()}</td>
                  <td className="p-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${STATUS_COLORS[lead.status] || 'bg-slate-600'}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <select value={lead.assignedTo || lead.assigned_to || ''}
                      onChange={(e) => handleReassign(lead.id, e.target.value)}
                      className="bg-slate-800 text-xs text-white border border-slate-700 rounded px-2 py-1 outline-none w-full">
                      <option value="">Unassigned</option>
                      {employees.map((emp: any) => (
                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <button onClick={() => handleDeleteLead(lead.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors" title="Delete Lead">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Lead Modal */}
      <AnimatePresence>
        {showNewLead && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowNewLead(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1E293B] border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white">Add New Lead</h3>
                <button onClick={() => setShowNewLead(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
              </div>
              <div className="space-y-3">
                <input placeholder="Contact Name *" value={newLead.contact_name} onChange={e => setNewLead({ ...newLead, contact_name: e.target.value })}
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                <input placeholder="Email" value={newLead.contact_email} onChange={e => setNewLead({ ...newLead, contact_email: e.target.value })}
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                <input placeholder="Company" value={newLead.company_name} onChange={e => setNewLead({ ...newLead, company_name: e.target.value })}
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                <input placeholder="Potential Value (₹)" type="number" value={newLead.potential_value} onChange={e => setNewLead({ ...newLead, potential_value: e.target.value })}
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                <select value={newLead.source} onChange={e => setNewLead({ ...newLead, source: e.target.value })}
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500">
                  <option value="WEBSITE">Website</option><option value="REFERRAL">Referral</option>
                  <option value="COLD_CALL">Cold Call</option><option value="TRADE_SHOW">Trade Show</option>
                </select>
                <textarea placeholder="Notes" value={newLead.notes} onChange={e => setNewLead({ ...newLead, notes: e.target.value })} rows={3}
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 resize-none" />
                <button onClick={handleCreateLead} disabled={!newLead.contact_name}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors">
                  Create Lead
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
