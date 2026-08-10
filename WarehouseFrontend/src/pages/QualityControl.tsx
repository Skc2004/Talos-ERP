import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from 'recharts';
import { 
  CheckCircle2, XCircle, AlertCircle, Search, Plus, X, ChevronDown, ChevronRight, Activity, Filter
} from 'lucide-react';

const InputCls = 'w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-teal-500 transition-colors';
const SelectCls = 'w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500 transition-colors';

export const QualityControl = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inspections' | 'defects'>('dashboard');
  
  // Data State
  const [inspections, setInspections] = useState<any[]>([]);
  const [defectCodes, setDefectCodes] = useState<any[]>([]);
  const [inspectionDefects, setInspectionDefects] = useState<any[]>([]);
  const [skus, setSkus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterResult, setFilterResult] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Modals
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [showDefectModal, setShowDefectModal] = useState(false);

  // Form State - Inspection
  const [newInspection, setNewInspection] = useState({
    inspection_number: '',
    sku_id: '',
    batch_number: '',
    inspection_type: 'FINAL',
    quantity_inspected: '',
    quantity_passed: '',
    quantity_failed: '',
    result: 'PASS',
    notes: ''
  });

  // Form State - Defect
  const [newDefect, setNewDefect] = useState({
    defect_code: '',
    description: '',
    severity: 'MINOR',
    category: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: inspectionsData },
        { data: defectCodesData },
        { data: defectsData },
        { data: skusData }
      ] = await Promise.all([
        supabase.from('quality_inspections').select(`*, sku_master(sku_code, description)`).order('inspection_date', { ascending: false }),
        supabase.from('defect_codes').select('*').order('defect_code', { ascending: true }),
        supabase.from('inspection_defects').select(`*, defect_codes(defect_code, description)`),
        supabase.from('sku_master').select('*')
      ]);

      setInspections(inspectionsData || []);
      setDefectCodes(defectCodesData || []);
      setInspectionDefects(defectsData || []);
      setSkus(skusData || []);
    } catch (error) {
      console.error("Error fetching QC data", error);
    } finally {
      setLoading(false);
    }
  };

  const saveInspection = async () => {
    try {
      const { data, error } = await supabase.from('quality_inspections').insert([{
        ...newInspection,
        quantity_inspected: parseFloat(newInspection.quantity_inspected) || 0,
        quantity_passed: parseFloat(newInspection.quantity_passed) || 0,
        quantity_failed: parseFloat(newInspection.quantity_failed) || 0,
        inspection_date: new Date().toISOString()
      }]);
      
      if (!error) {
        setShowInspectionModal(false);
        fetchData();
        setNewInspection({
          inspection_number: '',
          sku_id: '',
          batch_number: '',
          inspection_type: 'FINAL',
          quantity_inspected: '',
          quantity_passed: '',
          quantity_failed: '',
          result: 'PASS',
          notes: ''
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const saveDefectCode = async () => {
    try {
      const { data, error } = await supabase.from('defect_codes').insert([{
        ...newDefect,
        is_active: true
      }]);
      
      if (!error) {
        setShowDefectModal(false);
        fetchData();
        setNewDefect({
          defect_code: '',
          description: '',
          severity: 'MINOR',
          category: ''
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // KPIs
  const totalInspections = inspections.length;
  const passCount = inspections.filter(i => i.result === 'PASS').length;
  const passRate = totalInspections ? ((passCount / totalInspections) * 100).toFixed(1) : '0.0';
  const failCount = inspections.filter(i => i.result === 'FAIL').length;
  const pendingCount = inspections.filter(i => !i.result).length;

  // Chart Data
  const recentInspectionsChart = [...inspections].slice(0, 7).reverse().map(i => ({
    name: i.inspection_number,
    Passed: i.quantity_passed,
    Failed: i.quantity_failed
  }));

  const defectCounts: Record<string, number> = {};
  inspectionDefects.forEach(d => {
    const code = d.defect_codes?.defect_code || 'Unknown';
    defectCounts[code] = (defectCounts[code] || 0) + (d.defect_count || 0);
  });
  
  const paretoData = Object.entries(defectCounts)
    .map(([code, count]) => ({ name: code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const getResultBadge = (result: string) => {
    switch (result) {
      case 'PASS': return <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium border border-emerald-500/30 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> PASS</span>;
      case 'FAIL': return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium border border-red-500/30 flex items-center gap-1"><XCircle className="w-3 h-3"/> FAIL</span>;
      case 'CONDITIONAL_PASS': return <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium border border-amber-500/30 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> CONDITIONAL</span>;
      default: return <span className="px-2 py-1 bg-slate-500/20 text-slate-400 rounded-full text-xs font-medium border border-slate-500/30">PENDING</span>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">CRITICAL</span>;
      case 'MAJOR': return <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full text-xs font-medium">MAJOR</span>;
      case 'MINOR': return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">MINOR</span>;
      default: return null;
    }
  };

  const filteredInspections = inspections.filter(i => {
    if (filterResult !== 'ALL' && i.result !== filterResult) return false;
    if (filterType !== 'ALL' && i.inspection_type !== filterType) return false;
    return true;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 h-full flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-teal-400" />
            Quality Control Centre
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage inspections, defects, and quality standards.</p>
        </div>
        
        <div className="flex bg-[#1E293B] p-1 rounded-lg border border-slate-800">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'inspections', label: 'Inspections' },
            { id: 'defects', label: 'Defect Library' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id 
                  ? 'bg-teal-500/20 text-teal-400' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#0F172A]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5">
              <div className="text-slate-400 text-sm font-medium mb-1">Total Inspections</div>
              <div className="text-3xl font-bold text-white">{totalInspections}</div>
            </div>
            <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5">
              <div className="text-slate-400 text-sm font-medium mb-1">Pass Rate</div>
              <div className="text-3xl font-bold text-emerald-400">{passRate}%</div>
            </div>
            <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5">
              <div className="text-slate-400 text-sm font-medium mb-1">Failed Inspections</div>
              <div className="text-3xl font-bold text-red-400">{failCount}</div>
            </div>
            <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5">
              <div className="text-slate-400 text-sm font-medium mb-1">Pending Results</div>
              <div className="text-3xl font-bold text-slate-300">{pendingCount}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5 h-80">
              <h3 className="text-white font-medium mb-4">Recent Inspection Results (Qty)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={recentInspectionsChart} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#fff' }}
                    itemStyle={{ color: '#cbd5e1' }}
                  />
                  <Bar dataKey="Passed" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5 h-80">
              <h3 className="text-white font-medium mb-4">Top Defect Codes</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={paretoData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} width={80} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#fff' }}
                    cursor={{fill: '#334155', opacity: 0.4}}
                  />
                  <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5 overflow-hidden">
            <h3 className="text-white font-medium mb-4">Recent Inspections</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-400 uppercase bg-[#0F172A]/50 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Inspection No</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Result</th>
                    <th className="px-4 py-3">Yield</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections.slice(0, 5).map(i => (
                    <tr key={i.id} className="border-b border-slate-800/50">
                      <td className="px-4 py-3 font-medium text-white">{i.inspection_number}</td>
                      <td className="px-4 py-3 text-slate-300">{i.batch_number}</td>
                      <td className="px-4 py-3">{getResultBadge(i.result)}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {i.quantity_inspected ? Math.round((i.quantity_passed / i.quantity_inspected) * 100) : 0}%
                        <span className="text-xs text-slate-500 ml-2">({i.quantity_passed}/{i.quantity_inspected})</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{new Date(i.inspection_date).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {inspections.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No recent inspections</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inspections' && (
        <div className="flex flex-col gap-4 bg-[#1E293B] border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center mb-2">
            <div className="flex gap-3">
              <div className="flex items-center gap-2 bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                <Filter className="w-4 h-4 text-slate-400" />
                <select 
                  className="bg-transparent outline-none text-slate-200"
                  value={filterResult}
                  onChange={(e) => setFilterResult(e.target.value)}
                >
                  <option value="ALL">All Results</option>
                  <option value="PASS">Pass</option>
                  <option value="FAIL">Fail</option>
                  <option value="CONDITIONAL_PASS">Conditional</option>
                </select>
              </div>
              <div className="flex items-center gap-2 bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                <select 
                  className="bg-transparent outline-none text-slate-200"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="ALL">All Types</option>
                  <option value="INCOMING">Incoming</option>
                  <option value="IN_PROCESS">In-Process</option>
                  <option value="FINAL">Final</option>
                </select>
              </div>
            </div>
            <button 
              onClick={() => setShowInspectionModal(true)}
              className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> New Inspection
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-[#0F172A]">
                <tr>
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-4 py-3">Inspection No</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Qty (Pass/Fail)</th>
                  <th className="px-4 py-3">Yield %</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredInspections.map(i => {
                  const isExpanded = expandedRow === i.id;
                  const defects = inspectionDefects.filter(d => d.inspection_id === i.id);
                  const yieldPct = i.quantity_inspected ? Math.round((i.quantity_passed / i.quantity_inspected) * 100) : 0;
                  
                  return (
                    <React.Fragment key={i.id}>
                      <tr className="border-b border-slate-800/50 hover:bg-[#0F172A]/50 transition-colors cursor-pointer" onClick={() => setExpandedRow(isExpanded ? null : i.id)}>
                        <td className="px-4 py-3 text-slate-500">
                          {defects.length > 0 ? (isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />) : null}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">{i.inspection_number}</td>
                        <td className="px-4 py-3 text-slate-300">{i.batch_number}</td>
                        <td className="px-4 py-3 text-slate-300">{i.sku_master?.sku_code || '-'}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{i.inspection_type}</td>
                        <td className="px-4 py-3 text-slate-300">
                          {i.quantity_inspected} <span className="text-slate-500 text-xs">({i.quantity_passed}/{i.quantity_failed})</span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{yieldPct}%</td>
                        <td className="px-4 py-3">{getResultBadge(i.result)}</td>
                        <td className="px-4 py-3 text-slate-400">{new Date(i.inspection_date).toLocaleDateString()}</td>
                      </tr>
                      {isExpanded && defects.length > 0 && (
                        <tr className="bg-[#0F172A]/80 border-b border-slate-800/50">
                          <td colSpan={9} className="px-8 py-4">
                            <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Detected Defects</h4>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-slate-500 border-b border-slate-800">
                                  <th className="text-left font-medium py-1">Defect Code</th>
                                  <th className="text-left font-medium py-1">Count</th>
                                  <th className="text-left font-medium py-1">Severity</th>
                                  <th className="text-left font-medium py-1">Root Cause</th>
                                  <th className="text-left font-medium py-1">Corrective Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {defects.map(d => (
                                  <tr key={d.id}>
                                    <td className="py-2 text-white">{d.defect_codes?.defect_code || 'Unknown'}</td>
                                    <td className="py-2 text-slate-300">{d.defect_count}</td>
                                    <td className="py-2">{getSeverityBadge(d.severity)}</td>
                                    <td className="py-2 text-slate-400">{d.root_cause || '-'}</td>
                                    <td className="py-2 text-slate-400">{d.corrective_action || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {filteredInspections.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">No inspections found matching criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'defects' && (
        <div className="flex flex-col gap-4 bg-[#1E293B] border border-slate-800 rounded-xl p-5">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-medium text-white">Defect Codes Directory</h2>
            <button 
              onClick={() => setShowDefectModal(true)}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Defect Code
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-400 uppercase bg-[#0F172A]">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {defectCodes.map(d => (
                  <tr key={d.id} className="border-b border-slate-800/50 hover:bg-[#0F172A]/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{d.defect_code}</td>
                    <td className="px-4 py-3 text-slate-300">{d.description}</td>
                    <td className="px-4 py-3">{getSeverityBadge(d.severity)}</td>
                    <td className="px-4 py-3 text-slate-400">{d.category || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${d.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>
                        {d.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
                {defectCodes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No defect codes found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showInspectionModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1E293B] border border-slate-700 rounded-xl w-full max-w-2xl overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center p-5 border-b border-slate-800">
                <h3 className="text-lg font-medium text-white">Record New Inspection</h3>
                <button onClick={() => setShowInspectionModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Inspection Number</label>
                    <input type="text" className={InputCls} value={newInspection.inspection_number} onChange={e => setNewInspection({...newInspection, inspection_number: e.target.value})} placeholder="QC-001" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
                    <select className={SelectCls} value={newInspection.inspection_type} onChange={e => setNewInspection({...newInspection, inspection_type: e.target.value})}>
                      <option value="INCOMING">INCOMING</option>
                      <option value="IN_PROCESS">IN_PROCESS</option>
                      <option value="FINAL">FINAL</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">SKU</label>
                    <select className={SelectCls} value={newInspection.sku_id} onChange={e => setNewInspection({...newInspection, sku_id: e.target.value})}>
                      <option value="">Select SKU...</option>
                      {skus.map(s => <option key={s.id} value={s.id}>{s.sku_code} - {s.description}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Batch Number</label>
                    <input type="text" className={InputCls} value={newInspection.batch_number} onChange={e => setNewInspection({...newInspection, batch_number: e.target.value})} placeholder="BATCH-XYZ" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 p-4 bg-[#0F172A]/50 rounded-lg border border-slate-800 mt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Qty Inspected</label>
                    <input type="number" className={InputCls} value={newInspection.quantity_inspected} onChange={e => setNewInspection({...newInspection, quantity_inspected: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-emerald-400 mb-1">Qty Passed</label>
                    <input type="number" className={`${InputCls} !border-emerald-500/30 focus:!border-emerald-500`} value={newInspection.quantity_passed} onChange={e => setNewInspection({...newInspection, quantity_passed: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-red-400 mb-1">Qty Failed</label>
                    <input type="number" className={`${InputCls} !border-red-500/30 focus:!border-red-500`} value={newInspection.quantity_failed} onChange={e => setNewInspection({...newInspection, quantity_failed: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Overall Result</label>
                    <select className={SelectCls} value={newInspection.result} onChange={e => setNewInspection({...newInspection, result: e.target.value})}>
                      <option value="PASS">PASS</option>
                      <option value="FAIL">FAIL</option>
                      <option value="CONDITIONAL_PASS">CONDITIONAL_PASS</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Notes</label>
                  <textarea rows={3} className={InputCls} value={newInspection.notes} onChange={e => setNewInspection({...newInspection, notes: e.target.value})} placeholder="Inspection notes..." />
                </div>
              </div>
              <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-[#0F172A]">
                <button onClick={() => setShowInspectionModal(false)} className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">Cancel</button>
                <button onClick={saveInspection} className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors">Save Inspection</button>
              </div>
            </motion.div>
          </div>
        )}

        {showDefectModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1E293B] border border-slate-700 rounded-xl w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center p-5 border-b border-slate-800">
                <h3 className="text-lg font-medium text-white">Add Defect Code</h3>
                <button onClick={() => setShowDefectModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Defect Code</label>
                  <input type="text" className={InputCls} value={newDefect.defect_code} onChange={e => setNewDefect({...newDefect, defect_code: e.target.value})} placeholder="DEF-001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                  <input type="text" className={InputCls} value={newDefect.description} onChange={e => setNewDefect({...newDefect, description: e.target.value})} placeholder="Scratch on surface" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Severity</label>
                    <select className={SelectCls} value={newDefect.severity} onChange={e => setNewDefect({...newDefect, severity: e.target.value})}>
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="MAJOR">MAJOR</option>
                      <option value="MINOR">MINOR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                    <input type="text" className={InputCls} value={newDefect.category} onChange={e => setNewDefect({...newDefect, category: e.target.value})} placeholder="Cosmetic" />
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-800 flex justify-end gap-3 bg-[#0F172A]">
                <button onClick={() => setShowDefectModal(false)} className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">Cancel</button>
                <button onClick={saveDefectCode} className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors">Save Code</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
