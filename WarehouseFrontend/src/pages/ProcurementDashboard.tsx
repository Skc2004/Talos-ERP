import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, CheckCircle, XCircle, AlertTriangle, Clock, Plus, X, ChevronRight, RefreshCw } from 'lucide-react';

const InputCls = 'w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-orange-500 transition-colors';

const STATUS_CFG: Record<string, { cls: string; label: string; icon: any }> = {
  DRAFT:             { cls: 'bg-slate-500/20 text-slate-400 border-slate-600/30', label: 'Draft', icon: Clock },
  PENDING_APPROVAL:  { cls: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Pending', icon: AlertTriangle },
  APPROVED:          { cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Approved', icon: CheckCircle },
  ORDERED:           { cls: 'bg-violet-500/20 text-violet-400 border-violet-500/30', label: 'Ordered', icon: ChevronRight },
  RECEIVED:          { cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', label: 'Received', icon: CheckCircle },
  CANCELLED:         { cls: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Cancelled', icon: XCircle },
};

const VENDORS = ['Steel World Ltd', 'Precision Parts Co', 'Global Raw Materials', 'ElectroSupply Inc', 'FastPack Solutions', 'Allied Metals Corp', 'NextGen Components'];

export const ProcurementDashboard = () => {
  const [pos, setPos]         = useState<any[]>([]);
  const [skus, setSkus]       = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showCreate, setShowCreate]     = useState(false);
  const [form, setForm]       = useState({ po_number: '', vendor_name: '', status: 'DRAFT', total_amount: '', notes: '' });
  const [saving, setSaving]   = useState(false);
  const [selectedPo, setSelectedPo]     = useState<any | null>(null);

  useEffect(() => { loadPos(); loadSkus(); }, []);

  async function loadPos() {
    const { data } = await supabase.from('purchase_orders').select('*').order('created_at', { ascending: false });
    if (data) setPos(data);
  }

  async function loadSkus() {
    const { data } = await supabase.from('sku_master').select('*').order('sku_code');
    if (data) setSkus(data);
  }

  async function createPo() {
    if (!form.po_number || !form.vendor_name) return;
    setSaving(true);
    const { data } = await supabase.from('purchase_orders').insert({
      po_number: form.po_number,
      vendor_name: form.vendor_name,
      status: form.status,
      total_amount: parseFloat(form.total_amount) || 0,
    }).select().single();
    setShowCreate(false);
    setForm({ po_number: '', vendor_name: '', status: 'DRAFT', total_amount: '', notes: '' });
    setSaving(false);
    loadPos();
    if (data) setSelectedPo(data);
  }

  async function advanceStatus(po: any) {
    const flow = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ORDERED', 'RECEIVED'];
    const idx = flow.indexOf(po.status);
    if (idx < 0 || idx >= flow.length - 1) return;
    const next = flow[idx + 1];
    await supabase.from('purchase_orders').update({ status: next }).eq('id', po.id);
    loadPos();
    setSelectedPo((prev: any) => prev?.id === po.id ? { ...prev, status: next } : prev);
  }

  async function cancelPo(id: string) {
    if (!window.confirm('Cancel this PO?')) return;
    await supabase.from('purchase_orders').update({ status: 'CANCELLED' }).eq('id', id);
    loadPos();
  }

  const filtered = filterStatus === 'ALL' ? pos : pos.filter(p => p.status === filterStatus);

  const kpis = {
    total: pos.length,
    pending: pos.filter(p => p.status === 'PENDING_APPROVAL').length,
    approved: pos.filter(p => ['APPROVED', 'ORDERED'].includes(p.status)).length,
    totalValue: pos.filter(p => !['CANCELLED'].includes(p.status)).reduce((s, p) => s + parseFloat(p.total_amount || 0), 0),
  };

  function nextAction(status: string) {
    const map: Record<string, string> = {
      DRAFT: 'Submit for Approval',
      PENDING_APPROVAL: 'Approve',
      APPROVED: 'Mark Ordered',
      ORDERED: 'Mark Received',
    };
    return map[status] || null;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ClipboardList className="text-orange-400" /> Procurement
          </h2>
          <p className="text-sm text-slate-400 mt-1">Purchase order lifecycle — create, approve, track deliveries.</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-orange-500/20 transition-colors">
          <Plus size={16} /> Create PO
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total POs',      value: kpis.total,   color: 'text-slate-300' },
          { label: 'Pending Approval', value: kpis.pending, color: 'text-amber-400' },
          { label: 'Active Orders',  value: kpis.approved, color: 'text-blue-400' },
          { label: 'Total Value',    value: `₹${(kpis.totalValue / 1000).toFixed(0)}K`, color: 'text-orange-400' },
        ].map(k => (
          <div key={k.label} className="bg-[#1E293B] border border-slate-800 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-500 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Pipeline view (status columns) */}
      <div className="grid grid-cols-5 gap-3">
        {['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ORDERED', 'RECEIVED'].map(status => {
          const group = pos.filter(p => p.status === status);
          const cfg = STATUS_CFG[status];
          const Icon = cfg.icon;
          return (
            <div key={status} className="bg-[#1E293B] border border-slate-800 rounded-xl overflow-hidden">
              <div className={`px-3 py-2 border-b border-slate-800 flex items-center justify-between`}>
                <div className="flex items-center gap-1.5">
                  <Icon size={13} className={cfg.cls.split(' ')[1]} />
                  <span className="text-xs font-bold text-slate-300">{cfg.label}</span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cfg.cls}`}>{group.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-32 max-h-80 overflow-y-auto">
                {group.map(po => (
                  <div key={po.id}
                    onClick={() => setSelectedPo(selectedPo?.id === po.id ? null : po)}
                    className={`bg-[#0F172A] rounded-lg p-2.5 cursor-pointer border transition-colors ${selectedPo?.id === po.id ? 'border-orange-500/50' : 'border-transparent hover:border-slate-700'}`}>
                    <div className="text-[10px] font-mono text-orange-400">{po.po_number}</div>
                    <div className="text-xs font-semibold text-white mt-0.5 truncate">{po.vendor_name || '—'}</div>
                    {po.total_amount > 0 && (
                      <div className="text-[10px] text-slate-500 mt-1">₹{Number(po.total_amount).toLocaleString('en-IN')}</div>
                    )}
                  </div>
                ))}
                {group.length === 0 && (
                  <p className="text-center text-slate-700 text-xs py-4">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected PO detail */}
      <AnimatePresence>
        {selectedPo && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-[#1E293B] border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#0F172A]">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-white">{selectedPo.po_number}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_CFG[selectedPo.status]?.cls}`}>
                    {STATUS_CFG[selectedPo.status]?.label}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-0.5">{selectedPo.vendor_name} · ₹{Number(selectedPo.total_amount || 0).toLocaleString('en-IN')}</p>
              </div>
              <div className="flex items-center gap-2">
                {nextAction(selectedPo.status) && (
                  <button onClick={() => advanceStatus(selectedPo)}
                    className="flex items-center gap-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl transition-colors">
                    <ChevronRight size={14} /> {nextAction(selectedPo.status)}
                  </button>
                )}
                {!['RECEIVED', 'CANCELLED'].includes(selectedPo.status) && (
                  <button onClick={() => cancelPo(selectedPo.id)}
                    className="text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-xl transition-colors">
                    Cancel PO
                  </button>
                )}
                <button onClick={() => setSelectedPo(null)} className="text-slate-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-5 grid grid-cols-3 gap-4 text-sm">
              {[
                ['PO Number',    selectedPo.po_number],
                ['Vendor',       selectedPo.vendor_name || '—'],
                ['Status',       STATUS_CFG[selectedPo.status]?.label],
                ['Total Amount', `₹${Number(selectedPo.total_amount || 0).toLocaleString('en-IN')}`],
                ['Created At',   selectedPo.created_at ? new Date(selectedPo.created_at).toLocaleDateString('en-IN') : '—'],
                ['Updated At',   selectedPo.updated_at ? new Date(selectedPo.updated_at).toLocaleDateString('en-IN') : '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] text-slate-500 mb-0.5 uppercase tracking-wider">{k}</div>
                  <div className="text-white font-medium">{v}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create PO Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreate(false)}>
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><ClipboardList size={18} className="text-orange-400" />Create Purchase Order</h3>
                <button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-5 space-y-3">
                <input placeholder="PO Number (e.g. PO-2025-011) *" value={form.po_number}
                  onChange={e => setForm(f => ({ ...f, po_number: e.target.value }))} className={InputCls} />
                <select value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} className={InputCls}>
                  <option value="">Select Vendor *</option>
                  {VENDORS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={InputCls}>
                    <option>DRAFT</option><option>PENDING_APPROVAL</option>
                  </select>
                  <input type="number" placeholder="Total amount (₹)" value={form.total_amount}
                    onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} className={InputCls} />
                </div>
                <button onClick={createPo} disabled={!form.po_number || !form.vendor_name || saving}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors">
                  {saving ? 'Creating...' : 'Create Purchase Order'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
