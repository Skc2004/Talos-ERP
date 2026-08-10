import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, ChevronRight, ChevronDown, Plus, Trash2, X, Edit2, Package, CheckCircle, AlertTriangle } from 'lucide-react';

const InputCls = 'w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500 transition-colors';
const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  DRAFT:  'bg-amber-500/20  text-amber-400  border-amber-500/30',
  OBSOLETE:'bg-slate-500/20 text-slate-400  border-slate-600/30',
};

export const BillOfMaterials = () => {
  const [boms, setBoms]           = useState<any[]>([]);
  const [skus, setSkus]           = useState<any[]>([]);
  const [selectedBom, setSelectedBom] = useState<any | null>(null);
  const [items, setItems]         = useState<any[]>([]);
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({});
  const [showCreateBom, setShowCreateBom] = useState(false);
  const [showAddItem,   setShowAddItem]   = useState(false);
  const [bomForm, setBomForm]     = useState({ bom_code: '', description: '', status: 'ACTIVE', total_scrap_factor: '0.02' });
  const [itemForm, setItemForm]   = useState({ child_sku_id: '', quantity_per_assembly: '', unit_of_measure: 'PCS', scrap_factor: '0', is_optional: false });
  const [saving, setSaving]       = useState(false);

  useEffect(() => { loadBoms(); loadSkus(); }, []);
  useEffect(() => { if (selectedBom) loadItems(selectedBom.id); }, [selectedBom]);

  async function loadBoms() {
    const { data } = await supabase
      .from('bom_header')
      .select('*, parent_sku:sku_master(sku_code, description)')
      .order('created_at', { ascending: false });
    if (data) { setBoms(data); if (!selectedBom && data.length) setSelectedBom(data[0]); }
  }

  async function loadSkus() {
    const { data } = await supabase.from('sku_master').select('*').order('sku_code');
    if (data) setSkus(data);
  }

  async function loadItems(bomId: string) {
    const { data } = await supabase
      .from('bom_item')
      .select('*, child_sku:sku_master(sku_code, description, unit_of_measure)')
      .eq('bom_id', bomId)
      .order('sort_order');
    if (data) setItems(data);
  }

  async function createBom() {
    if (!bomForm.bom_code || !bomForm.description) return;
    setSaving(true);
    await supabase.from('bom_header').insert({
      ...bomForm,
      total_scrap_factor: parseFloat(bomForm.total_scrap_factor),
      version: 1,
      effective_from: new Date().toISOString().split('T')[0],
    });
    setShowCreateBom(false);
    setBomForm({ bom_code: '', description: '', status: 'ACTIVE', total_scrap_factor: '0.02' });
    setSaving(false);
    loadBoms();
  }

  async function addItem() {
    if (!selectedBom || !itemForm.child_sku_id || !itemForm.quantity_per_assembly) return;
    setSaving(true);
    await supabase.from('bom_item').insert({
      bom_id: selectedBom.id,
      child_sku_id: itemForm.child_sku_id,
      quantity_per_assembly: parseFloat(itemForm.quantity_per_assembly),
      unit_of_measure: itemForm.unit_of_measure,
      scrap_factor: parseFloat(itemForm.scrap_factor),
      is_optional: itemForm.is_optional,
      sort_order: items.length + 1,
    });
    setShowAddItem(false);
    setItemForm({ child_sku_id: '', quantity_per_assembly: '', unit_of_measure: 'PCS', scrap_factor: '0', is_optional: false });
    setSaving(false);
    loadItems(selectedBom.id);
  }

  async function deleteItem(id: string) {
    if (!window.confirm('Remove this component?')) return;
    await supabase.from('bom_item').delete().eq('id', id);
    loadItems(selectedBom.id);
  }

  async function deleteBom(id: string) {
    if (!window.confirm('Delete this BOM and all its items?')) return;
    await supabase.from('bom_item').delete().eq('bom_id', id);
    await supabase.from('bom_header').delete().eq('id', id);
    setSelectedBom(null);
    loadBoms();
  }

  async function toggleStatus(bom: any) {
    const next = bom.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE';
    await supabase.from('bom_header').update({ status: next }).eq('id', bom.id);
    loadBoms();
  }

  // Explosion cost calculation (qty × children cascade)
  const totalScrap = items.reduce((s, i) => s + (parseFloat(i.scrap_factor) || 0), 0);
  const totalQty   = items.reduce((s, i) => s + (parseFloat(i.quantity_per_assembly) || 0), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="text-violet-400" /> Bill of Materials
          </h2>
          <p className="text-sm text-slate-400 mt-1">Manage product structures, components, and assembly trees.</p>
        </div>
        <button onClick={() => setShowCreateBom(true)}
          className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-violet-500/20 transition-colors">
          <Plus size={16} /> New BOM
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* BOM list sidebar */}
        <div className="col-span-4 space-y-2">
          {boms.map(bom => (
            <button key={bom.id} onClick={() => setSelectedBom(bom)}
              className={`w-full text-left bg-[#1E293B] border rounded-xl p-4 transition-colors ${selectedBom?.id === bom.id ? 'border-violet-500/60 bg-violet-500/5' : 'border-slate-800 hover:border-slate-600'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-violet-400">{bom.bom_code}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_COLORS[bom.status] || ''}`}>{bom.status}</span>
              </div>
              <div className="text-sm font-semibold text-white truncate">{bom.description}</div>
              <div className="text-[10px] text-slate-500 mt-1">
                SKU: {bom.parent_sku?.sku_code || '—'} · v{bom.version} · Scrap {((bom.total_scrap_factor || 0) * 100).toFixed(0)}%
              </div>
            </button>
          ))}
          {boms.length === 0 && (
            <div className="text-center text-slate-600 py-10 bg-[#1E293B] border border-slate-800 rounded-xl">
              <Layers size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No BOMs yet</p>
            </div>
          )}
        </div>

        {/* BOM detail */}
        <div className="col-span-8">
          {selectedBom ? (
            <div className="bg-[#1E293B] border border-slate-800 rounded-xl overflow-hidden">
              {/* BOM header */}
              <div className="p-5 border-b border-slate-800 bg-[#0F172A]">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">{selectedBom.description}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${STATUS_COLORS[selectedBom.status] || ''}`}>{selectedBom.status}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                      <span className="text-violet-400 font-mono">{selectedBom.bom_code}</span>
                      <span>Version {selectedBom.version}</span>
                      <span>Scrap factor: {((selectedBom.total_scrap_factor || 0) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggleStatus(selectedBom)}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                      Toggle Status
                    </button>
                    <button onClick={() => setShowAddItem(true)}
                      className="text-xs bg-violet-500 hover:bg-violet-600 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                      <Plus size={12} /> Add Component
                    </button>
                    <button onClick={() => deleteBom(selectedBom.id)}
                      className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { label: 'Components', value: items.length },
                    { label: 'Total Qty/Unit', value: totalQty.toFixed(1) },
                    { label: 'Avg Scrap %', value: `${items.length ? ((totalScrap / items.length) * 100).toFixed(1) : 0}%` },
                  ].map(s => (
                    <div key={s.label} className="bg-[#1E293B] rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-violet-400">{s.value}</div>
                      <div className="text-[10px] text-slate-500">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Component tree */}
              <div className="p-4">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Component Tree</div>
                {items.length === 0 ? (
                  <div className="text-center text-slate-600 py-8">
                    <Package size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No components yet — click "Add Component"</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Column headers */}
                    <div className="grid grid-cols-12 text-[10px] font-bold text-slate-500 uppercase px-3 pb-1 border-b border-slate-800">
                      <span className="col-span-4">Component</span>
                      <span className="col-span-2 text-center">Qty/Unit</span>
                      <span className="col-span-2 text-center">UOM</span>
                      <span className="col-span-2 text-center">Scrap %</span>
                      <span className="col-span-1 text-center">Optional</span>
                      <span className="col-span-1"></span>
                    </div>
                    {items.map((item, idx) => (
                      <motion.div key={item.id}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="grid grid-cols-12 items-center bg-[#0F172A] rounded-lg px-3 py-2.5 hover:bg-slate-900 transition-colors group">
                        <div className="col-span-4 flex items-center gap-2">
                          <ChevronRight size={12} className="text-violet-400 shrink-0" />
                          <div>
                            <div className="text-sm font-semibold text-white">{item.child_sku?.sku_code || '—'}</div>
                            <div className="text-[10px] text-slate-500 truncate">{item.child_sku?.description || ''}</div>
                          </div>
                        </div>
                        <div className="col-span-2 text-center text-sm font-bold text-violet-300">{item.quantity_per_assembly}</div>
                        <div className="col-span-2 text-center text-xs text-slate-400">{item.unit_of_measure}</div>
                        <div className="col-span-2 text-center text-xs text-slate-400">{((item.scrap_factor || 0) * 100).toFixed(1)}%</div>
                        <div className="col-span-1 text-center">
                          {item.is_optional
                            ? <span className="text-[9px] text-amber-400 font-bold">OPT</span>
                            : <CheckCircle size={12} className="text-emerald-400 mx-auto" />}
                        </div>
                        <div className="col-span-1 text-center">
                          <button onClick={() => deleteItem(item.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#1E293B] border border-slate-800 rounded-xl flex items-center justify-center h-64 text-slate-600">
              <div className="text-center">
                <Layers size={32} className="mx-auto mb-2 opacity-30" />
                <p>Select a BOM to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create BOM modal */}
      <AnimatePresence>
        {showCreateBom && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateBom(false)}>
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Layers size={18} className="text-violet-400" />Create BOM</h3>
                <button onClick={() => setShowCreateBom(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-5 space-y-3">
                <input placeholder="BOM Code (e.g. BOM-2025-004) *" value={bomForm.bom_code}
                  onChange={e => setBomForm(f => ({ ...f, bom_code: e.target.value }))} className={InputCls} />
                <textarea placeholder="Description *" value={bomForm.description} rows={2}
                  onChange={e => setBomForm(f => ({ ...f, description: e.target.value }))} className={`${InputCls} resize-none`} />
                <div className="grid grid-cols-2 gap-3">
                  <select value={bomForm.status} onChange={e => setBomForm(f => ({ ...f, status: e.target.value }))} className={InputCls}>
                    <option>ACTIVE</option><option>DRAFT</option><option>OBSOLETE</option>
                  </select>
                  <input type="number" step="0.01" placeholder="Scrap factor (0.02)" value={bomForm.total_scrap_factor}
                    onChange={e => setBomForm(f => ({ ...f, total_scrap_factor: e.target.value }))} className={InputCls} />
                </div>
                <button onClick={createBom} disabled={!bomForm.bom_code || !bomForm.description || saving}
                  className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors">
                  {saving ? 'Creating...' : 'Create BOM'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add item modal */}
      <AnimatePresence>
        {showAddItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddItem(false)}>
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Package size={18} className="text-violet-400" />Add Component</h3>
                <button onClick={() => setShowAddItem(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-5 space-y-3">
                <select value={itemForm.child_sku_id} onChange={e => setItemForm(f => ({ ...f, child_sku_id: e.target.value }))} className={InputCls}>
                  <option value="">Select SKU / Component *</option>
                  {skus.map(s => <option key={s.id} value={s.id}>{s.sku_code} — {s.description}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" step="0.01" placeholder="Qty per assembly *" value={itemForm.quantity_per_assembly}
                    onChange={e => setItemForm(f => ({ ...f, quantity_per_assembly: e.target.value }))} className={InputCls} />
                  <select value={itemForm.unit_of_measure} onChange={e => setItemForm(f => ({ ...f, unit_of_measure: e.target.value }))} className={InputCls}>
                    {['PCS', 'KG', 'EACH', 'MTR', 'LTR', 'BOX'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" step="0.001" placeholder="Scrap factor (0.02)" value={itemForm.scrap_factor}
                    onChange={e => setItemForm(f => ({ ...f, scrap_factor: e.target.value }))} className={InputCls} />
                  <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5">
                    <input type="checkbox" checked={itemForm.is_optional}
                      onChange={e => setItemForm(f => ({ ...f, is_optional: e.target.checked }))} className="accent-violet-500" />
                    Optional part
                  </label>
                </div>
                <button onClick={addItem} disabled={!itemForm.child_sku_id || !itemForm.quantity_per_assembly || saving}
                  className="w-full bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors">
                  {saving ? 'Adding...' : 'Add Component'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
