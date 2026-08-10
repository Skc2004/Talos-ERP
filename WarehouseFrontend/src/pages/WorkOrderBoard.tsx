import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, Factory, AlertTriangle, CheckCircle, Clock, Plus, X, Radio, Zap } from 'lucide-react';

const PRIORITY_ORDER: Record<string,number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const PRIORITY_COLORS: Record<string,string> = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/30',
  HIGH: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  MEDIUM: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  LOW: 'bg-slate-500/20 text-slate-400 border-slate-600/30',
};
const WO_STATUS_COLORS: Record<string,string> = {
  PLANNED: 'bg-slate-500/20 text-slate-400',
  IN_PROGRESS: 'bg-amber-500/20 text-amber-400',
  COMPLETED: 'bg-emerald-500/20 text-emerald-400',
  CANCELLED: 'bg-red-500/20 text-red-400',
};

const InputCls = 'w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors';

export const WorkOrderBoard = () => {
  const [tab, setTab] = useState<'wo' | 'maint'>('wo');
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [maintenanceOrders, setMaintenanceOrders] = useState<any[]>([]);
  const [iotData, setIotData] = useState<any[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintForm, setMaintForm] = useState({ machine_id: '', description: '', priority: 'HIGH', scheduled_date: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [woRes, moRes, iotRes] = await Promise.all([
      supabase.from('work_orders').select('*').order('planned_start', { ascending: true }),
      supabase.from('maintenance_orders').select('*').order('scheduled_date', { ascending: true }),
      supabase.from('iot_telemetry').select('*').order('recorded_at', { ascending: false }).limit(50),
    ]);
    if (woRes.data) setWorkOrders(woRes.data);
    if (moRes.data) {
      const sorted = (moRes.data || []).sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99));
      setMaintenanceOrders(sorted);
      if (sorted.length && !selectedMachineId) setSelectedMachineId(sorted[0].machine_id);
    }
    if (iotRes.data) setIotData(iotRes.data);
  }

  async function raiseMaintOrder() {
    if (!maintForm.machine_id || !maintForm.description) return;
    setSaving(true);
    await supabase.from('maintenance_orders').insert({ ...maintForm, status: 'PENDING' });
    setShowMaintModal(false);
    setMaintForm({ machine_id: '', description: '', priority: 'HIGH', scheduled_date: '' });
    setSaving(false); loadAll();
  }

  async function updateWOStatus(id: string, status: string) {
    await supabase.from('work_orders').update({ status }).eq('id', id);
    loadAll();
  }
  async function updateMOStatus(id: string, status: string) {
    await supabase.from('maintenance_orders').update({ status }).eq('id', id);
    loadAll();
  }

  const filteredWOs = filterStatus === 'ALL' ? workOrders : workOrders.filter(w => w.status === filterStatus);
  const now = new Date();

  const woKpis = {
    open: workOrders.filter(w => !['COMPLETED', 'CANCELLED'].includes(w.status)).length,
    inProgress: workOrders.filter(w => w.status === 'IN_PROGRESS').length,
    overdue: workOrders.filter(w => w.planned_end && new Date(w.planned_end) < now && w.status !== 'COMPLETED').length,
    completedThisMonth: workOrders.filter(w => w.status === 'COMPLETED' && w.planned_end && new Date(w.planned_end).getMonth() === now.getMonth()).length,
  };

  const machineIot = iotData.filter(d => d.machine_id === selectedMachineId).slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Factory className="text-cyan-400"/> Work Orders & Maintenance
          </h2>
          <p className="text-sm text-slate-400 mt-1">Track manufacturing work orders and machine maintenance schedules.</p>
        </div>
        {tab === 'maint' && (
          <button onClick={() => setShowMaintModal(true)} className="flex items-center gap-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Plus size={16}/> Raise Order
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1E293B] rounded-xl p-1 border border-slate-800">
        <button onClick={() => setTab('wo')} className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-colors ${tab === 'wo' ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
          🏭 Work Orders
        </button>
        <button onClick={() => setTab('maint')} className={`flex-1 text-sm font-semibold py-2 rounded-lg transition-colors ${tab === 'maint' ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
          🔧 Maintenance
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* WORK ORDERS */}
        {tab === 'wo' && (
          <motion.div key="wo" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Open Orders', value: woKpis.open, color: 'text-cyan-400' },
                { label: 'In Progress', value: woKpis.inProgress, color: 'text-amber-400' },
                { label: 'Overdue', value: woKpis.overdue, color: 'text-red-400' },
                { label: 'Done This Month', value: woKpis.completedThisMonth, color: 'text-emerald-400' },
              ].map(k => (
                <div key={k.label} className="bg-[#1E293B] border border-slate-800 rounded-xl p-4 text-center">
                  <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{k.label}</div>
                </div>
              ))}
            </div>

            {/* Filter */}
            <div className="flex gap-1">
              {['ALL', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${filterStatus === s ? 'bg-cyan-500 text-white' : 'bg-[#1E293B] border border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                  {s}
                </button>
              ))}
            </div>

            {/* WO Cards */}
            <div className="grid grid-cols-3 gap-3">
              {filteredWOs.map(wo => {
                const isOverdue = wo.planned_end && new Date(wo.planned_end) < now && wo.status !== 'COMPLETED';
                return (
                  <div key={wo.id} className={`bg-[#1E293B] border rounded-xl p-4 space-y-2 ${isOverdue ? 'border-red-500/30' : 'border-slate-800'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500">{wo.wo_number || wo.id?.slice(0, 8)}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg ${WO_STATUS_COLORS[wo.status] || 'bg-slate-700 text-slate-400'}`}>{wo.status}</span>
                    </div>
                    <div className="text-sm font-semibold text-white truncate">{wo.product_name || wo.product_code || 'Work Order'}</div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                      <span>Qty: <span className="text-white">{wo.quantity || '—'}</span></span>
                      <span>Machine: <span className="text-cyan-400">{wo.machine_id || '—'}</span></span>
                    </div>
                    {wo.planned_end && (
                      <div className={`text-[10px] flex items-center gap-1 ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
                        <Clock size={9}/>
                        {isOverdue ? '⚠️ Overdue' : 'Due:'} {new Date(wo.planned_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    )}
                    <div className="flex gap-1 pt-1">
                      {['PLANNED', 'IN_PROGRESS', 'COMPLETED'].filter(s => s !== wo.status).map(s => (
                        <button key={s} onClick={() => updateWOStatus(wo.id, s)}
                          className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-2 py-0.5 rounded transition-colors">
                          → {s.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredWOs.length === 0 && (
                <div className="col-span-3 text-center text-slate-600 py-10">No work orders found.</div>
              )}
            </div>
          </motion.div>
        )}

        {/* MAINTENANCE */}
        {tab === 'maint' && (
          <motion.div key="maint" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Maintenance list */}
              <div className="lg:col-span-2 space-y-2">
                {maintenanceOrders.map(mo => {
                  const isOverdue = mo.scheduled_date && new Date(mo.scheduled_date) < now && mo.status !== 'COMPLETED';
                  return (
                    <div key={mo.id}
                      onClick={() => setSelectedMachineId(mo.machine_id)}
                      className={`bg-[#1E293B] border rounded-xl p-4 cursor-pointer transition-colors ${selectedMachineId === mo.machine_id ? 'border-cyan-500/50' : isOverdue ? 'border-red-500/20 hover:border-red-500/40' : 'border-slate-800 hover:border-slate-600'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${PRIORITY_COLORS[mo.priority] || 'bg-slate-700 text-slate-400 border-slate-600'}`}>{mo.priority}</span>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-white">{mo.description || mo.order_type}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span className="text-cyan-400 font-mono">{mo.machine_id}</span>
                            {mo.scheduled_date && <span>{isOverdue ? '⚠️' : '📅'} {new Date(mo.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          {['PENDING', 'IN_PROGRESS', 'COMPLETED'].filter(s => s !== mo.status).map(s => (
                            <button key={s} onClick={e => { e.stopPropagation(); updateMOStatus(mo.id, s); }}
                              className="text-[9px] bg-slate-800 hover:bg-cyan-500/20 hover:text-cyan-400 text-slate-400 px-2 py-0.5 rounded transition-colors whitespace-nowrap">
                              → {s.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ml-1 ${mo.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : mo.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'}`}>{mo.status}</span>
                      </div>
                    </div>
                  );
                })}
                {maintenanceOrders.length === 0 && <div className="text-center text-slate-600 py-10">No maintenance orders found.</div>}
              </div>

              {/* IoT panel */}
              <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Radio size={16} className="text-cyan-400 animate-pulse"/>
                  <h3 className="text-sm font-bold text-white">IoT Telemetry</h3>
                  {selectedMachineId && <span className="text-[10px] text-cyan-400 font-mono ml-auto">{selectedMachineId}</span>}
                </div>
                {machineIot.length > 0 ? (
                  <div className="space-y-2">
                    {machineIot.map(d => (
                      <div key={d.id} className="flex items-center justify-between bg-[#0F172A] rounded-lg px-3 py-2">
                        <div>
                          <div className="text-xs font-semibold text-cyan-400">{d.reading_type}</div>
                          <div className="text-[10px] text-slate-600">{new Date(d.recorded_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <span className="text-sm font-bold text-white">{parseFloat(d.value || 0).toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-600 py-8">
                    <Zap size={24} className="mx-auto mb-2 opacity-30"/>
                    <p className="text-xs">No telemetry data</p>
                    {selectedMachineId && <p className="text-[10px] mt-1 text-slate-700">{selectedMachineId}</p>}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Maintenance modal */}
      <AnimatePresence>
        {showMaintModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowMaintModal(false)}>
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Wrench size={18} className="text-cyan-400"/>Raise Maintenance Order</h3>
                <button onClick={() => setShowMaintModal(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
              <div className="p-5 space-y-3">
                <input placeholder="Machine ID (e.g. CNC-01) *" value={maintForm.machine_id}
                  onChange={e => setMaintForm(f => ({...f, machine_id: e.target.value}))} className={InputCls}/>
                <textarea placeholder="Description *" value={maintForm.description}
                  onChange={e => setMaintForm(f => ({...f, description: e.target.value}))} rows={3} className={`${InputCls} resize-none`}/>
                <select value={maintForm.priority} onChange={e => setMaintForm(f => ({...f, priority: e.target.value}))} className={InputCls}>
                  <option value="CRITICAL">🔴 Critical</option>
                  <option value="HIGH">🟠 High</option>
                  <option value="MEDIUM">🟡 Medium</option>
                  <option value="LOW">🟢 Low</option>
                </select>
                <input type="date" value={maintForm.scheduled_date}
                  onChange={e => setMaintForm(f => ({...f, scheduled_date: e.target.value}))} className={InputCls}/>
                <button onClick={raiseMaintOrder} disabled={!maintForm.machine_id || !maintForm.description || saving}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors">
                  {saving ? 'Raising...' : 'Raise Order'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
