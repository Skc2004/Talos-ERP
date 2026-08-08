import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, DollarSign, TrendingUp, Target, Plus, Trash2, UserCheck, X, LayoutDashboard, List, Zap, Mail, Rocket, CheckCircle2, Copy, Search, Filter, Clock, Phone, MessageSquare, CalendarCheck, StickyNote, ChevronRight, CheckSquare, Square, FileText } from 'lucide-react';

const JAVA_API = import.meta.env.VITE_JAVA_API_URL || 'http://localhost:8080/api/v1';
const PYTHON_API = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8000';

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-500', CONTACTED: 'bg-indigo-500', QUOTED: 'bg-amber-500',
  NEGOTIATING: 'bg-purple-500', WON: 'bg-emerald-500', LOST: 'bg-red-500',
};

const FUNNEL_STAGES = ['NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'WON', 'LOST'];

const ACTIVITY_ICONS: Record<string,any> = { CALL: Phone, EMAIL: Mail, MEETING: CalendarCheck, NOTE: StickyNote, TASK: CheckSquare };
const SOURCES = ['WEBSITE','REFERRAL','COLD_CALL','TRADE_SHOW'];

export const CrmDashboard = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [pipeline, setPipeline] = useState<any>({});
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [showNewLead, setShowNewLead] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Email Drafter States
  const [draftEmailLead, setDraftEmailLead] = useState<any>(null);
  const [draftedEmailText, setDraftedEmailText] = useState<string>('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  // Scoring State
  const [isScoring, setIsScoring] = useState(false);

  // Phase 1: Search, Filter, Bulk, Activity
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string|null>(null);
  const [sortBy, setSortBy] = useState<'value'|'score'|'date'>('score');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activityLead, setActivityLead] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [newActivity, setNewActivity] = useState({ activityType: 'NOTE', description: '', followUpDate: '' });

  // Phase 2: Quotation Builder
  const [quoteLead, setQuoteLead] = useState<any>(null);
  const [quoteItems, setQuoteItems] = useState<{desc:string,qty:number,price:number}[]>([{desc:'',qty:1,price:0}]);
  const [quoteTaxRate, setQuoteTaxRate] = useState(18);
  const [quoteSaving, setQuoteSaving] = useState(false);

  const [newLead, setNewLead] = useState({ contact_name: '', contact_email: '', company_name: '', potential_value: '', source: 'WEBSITE', notes: '' });

  // Filtered + sorted leads
  const filteredLeads = useMemo(() => {
    let result = leads;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => (l.contactName||l.contact_name||'').toLowerCase().includes(q) || (l.companyName||l.company_name||'').toLowerCase().includes(q) || (l.contactEmail||l.contact_email||'').toLowerCase().includes(q));
    }
    if (sourceFilter) result = result.filter(l => l.source === sourceFilter);
    result = [...result].sort((a,b) => {
      if (sortBy==='value') return parseFloat(b.potentialValue||b.potential_value||0) - parseFloat(a.potentialValue||a.potential_value||0);
      if (sortBy==='score') return parseFloat(b.aiScore||b.ai_score||0) - parseFloat(a.aiScore||a.ai_score||0);
      return new Date(b.createdAt||b.created_at||0).getTime() - new Date(a.createdAt||a.created_at||0).getTime();
    });
    return result;
  }, [leads, searchQuery, sourceFilter, sortBy]);

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
      const data = responseBody.content || responseBody;
      setLeads(data);
      const funnel: Record<string, number> = {};
      let totalValue = 0;
      data.forEach((l: any) => {
        funnel[l.status] = (funnel[l.status] || 0) + 1;
        totalValue += parseFloat(l.potentialValue || l.potential_value || 0);
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

  async function handleUpdateStatus(leadId: string, newStatus: string) {
    try {
      await fetch(`${JAVA_API}/crm/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      loadData();
    } catch (e) { console.error(e); }
  }

  async function handleConvertProject(lead: any) {
    const estimatedHours = prompt("Enter estimated hours for this new project:", "80");
    if (estimatedHours === null) return;
    try {
      await fetch(`${JAVA_API}/crm/leads/${lead.id}/convert?projectName=${encodeURIComponent(lead.companyName || lead.company_name)} Implementation&estimatedHours=${estimatedHours}`, {
        method: 'POST'
      });
      alert('Lead successfully converted to Project!');
      loadData();
    } catch (e) { alert('Failed to convert to project.'); }
  }

  async function handleAIScorePipeline() {
    setIsScoring(true);
    try {
      await fetch(`${PYTHON_API}/crm/score-leads`, { method: 'POST' });
      setTimeout(() => {
        setIsScoring(false);
        loadData();
      }, 2500);
    } catch (e) {
      setIsScoring(false);
      console.error(e);
    }
  }

  async function handleDraftEmail(lead: any) {
    setDraftEmailLead(lead);
    setIsDrafting(true);
    setDraftedEmailText('');
    setEmailCopied(false);
    
    try {
      const res = await fetch(`${PYTHON_API}/agent/draft-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: lead.contactName || lead.contact_name,
          companyName: lead.companyName || lead.company_name,
          status: lead.status,
          notes: lead.notes || 'No specific notes.',
          potentialValue: parseFloat(lead.potentialValue || lead.potential_value || 0)
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setDraftedEmailText(data.email_body);
      } else {
        setDraftedEmailText("Failed to draft email: " + data.message);
      }
    } catch (e) {
      setDraftedEmailText("Network error reaching Python AI Gateway.");
    } finally {
      setIsDrafting(false);
    }
  }

  const copyEmailToClipboard = () => {
    navigator.clipboard.writeText(draftedEmailText);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  // ── Phase 1: Activity & Bulk Handlers ──
  async function openActivityDrawer(lead: any) {
    setActivityLead(lead);
    try {
      const res = await fetch(`${JAVA_API}/crm/leads/${lead.id}/activities`);
      setActivities(Array.isArray(await res.json().then(d => { setActivities(d); return d; })) ? activities : []);
    } catch { setActivities([]); }
  }
  async function loadActivitiesFor(leadId: string) {
    try { const r = await fetch(`${JAVA_API}/crm/leads/${leadId}/activities`); const d = await r.json(); setActivities(Array.isArray(d)?d:[]); } catch { setActivities([]); }
  }
  async function handleLogActivity() {
    if (!activityLead || !newActivity.description) return;
    try {
      await fetch(`${JAVA_API}/crm/leads/${activityLead.id}/activities`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ activityType: newActivity.activityType, description: newActivity.description, followUpDate: newActivity.followUpDate || null })
      });
      setNewActivity({ activityType: 'NOTE', description: '', followUpDate: '' });
      setShowLogActivity(false);
      loadActivitiesFor(activityLead.id);
    } catch(e) { console.error(e); }
  }
  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  }
  function selectAll() { setSelectedIds(new Set(filteredLeads.map(l=>l.id))); }
  function deselectAll() { setSelectedIds(new Set()); }
  async function bulkUpdateStatus(status: string) {
    for (const id of selectedIds) {
      await fetch(`${JAVA_API}/crm/leads/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({status}) });
    }
    deselectAll(); loadData();
  }
  async function bulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} leads permanently?`)) return;
    for (const id of selectedIds) { await fetch(`${JAVA_API}/crm/leads/${id}`, {method:'DELETE'}); }
    deselectAll(); loadData();
  }

  // ── Phase 2: Quotation Handlers ──
  function openQuoteBuilder(lead: any) {
    setQuoteLead(lead);
    setQuoteItems([{desc:'',qty:1,price:0}]);
    setQuoteTaxRate(18);
  }
  function addQuoteLine() { setQuoteItems([...quoteItems, {desc:'',qty:1,price:0}]); }
  function removeQuoteLine(i:number) { setQuoteItems(quoteItems.filter((_,idx)=>idx!==i)); }
  function updateQuoteLine(i:number, field:string, val:any) { const n=[...quoteItems]; (n[i] as any)[field]=val; setQuoteItems(n); }
  const quoteSubtotal = quoteItems.reduce((s,it)=>s+(it.qty*it.price),0);
  const quoteTotal = quoteSubtotal * (1 + quoteTaxRate/100);
  async function handleSaveQuotation() {
    if (!quoteLead) return;
    setQuoteSaving(true);
    try {
      await fetch(`${JAVA_API}/crm/leads/${quoteLead.id}/quotations`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ items: JSON.stringify(quoteItems), subtotal: quoteSubtotal.toFixed(2), taxRate: quoteTaxRate, total: quoteTotal.toFixed(2), validUntil: new Date(Date.now()+30*86400000).toISOString().split('T')[0], status: 'DRAFT' })
      });
      setQuoteLead(null);
    } catch(e) { console.error(e); }
    setQuoteSaving(false);
  }

  const KPICard = ({ icon, label, value }: any) => (
    <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">{icon}<span className="text-sm text-slate-400">{label}</span></div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="text-indigo-400" /> CRM & Pipeline
          </h2>
          <p className="text-sm text-slate-400 mt-1">Lead-to-Ledger intelligence for small-scale manufacturers.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleAIScorePipeline}
            disabled={isScoring}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md ${isScoring ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-[#1E293B] hover:bg-slate-800 text-indigo-400 border border-slate-700'}`}
          >
            {isScoring ? <><div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> Scoring...</> : <><Zap size={16} fill="currentColor" /> AI Score Leads</>}
          </button>
          
          <div className="flex items-center bg-[#1E293B] border border-slate-700 rounded-xl p-1">
            <button onClick={() => setViewMode('kanban')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'kanban' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white'}`}><LayoutDashboard size={18} /></button>
            <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white'}`}><List size={18} /></button>
          </div>

          <button onClick={() => setShowNewLead(true)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg">
            <Plus size={16} /> New Lead
          </button>
        </div>
      </div>

      {/* Pipeline KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard icon={<Users className="text-indigo-500" size={20} />} label="Total Leads" value={String(pipeline.totalLeads || 0)} />
        <KPICard icon={<DollarSign className="text-emerald-500" size={20} />} label="Pipeline Value" value={`₹${((pipeline.totalPipelineValue || 0) / 1000).toFixed(0)}K`} />
        <KPICard icon={<TrendingUp className="text-amber-500" size={20} />} label="Conversion Rate" value={`${pipeline.conversionRate || 0}%`} />
        <KPICard icon={<Target className="text-purple-500" size={20} />} label="Active Negotiations" value={String(pipeline.funnel?.NEGOTIATING || 0)} />
      </div>

      {error && <div className="text-red-400 p-4 font-semibold bg-red-400/10 border border-red-500 rounded-lg">{error}</div>}

      {/* Search, Filter, Sort Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search leads..." className="w-full bg-[#1E293B] border border-slate-700 rounded-xl pl-10 pr-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500" />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-slate-500" />
          {SOURCES.map(s => (<button key={s} onClick={()=>setSourceFilter(sourceFilter===s?null:s)} className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors ${sourceFilter===s?'bg-indigo-500 text-white':'bg-[#1E293B] text-slate-400 border border-slate-700 hover:border-slate-500'}`}>{s.replace('_',' ')}</button>))}
        </div>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} className="bg-[#1E293B] border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-2 outline-none">
          <option value="score">Sort: AI Score</option><option value="value">Sort: Value</option><option value="date">Sort: Newest</option>
        </select>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedIds.size > 0 && (
        <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className="flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-2.5">
          <span className="text-sm font-bold text-indigo-400">{selectedIds.size} selected</span>
          <select onChange={e=>{if(e.target.value)bulkUpdateStatus(e.target.value);e.target.value='';}} defaultValue="" className="bg-[#0F172A] border border-slate-700 text-xs text-slate-300 rounded px-2 py-1 outline-none">
            <option value="" disabled>Move to...</option>{FUNNEL_STAGES.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={bulkDelete} className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 size={12}/>Delete All</button>
          <button onClick={deselectAll} className="text-xs text-slate-400 hover:text-white ml-auto">Clear</button>
        </motion.div>
      )}

      {viewMode === 'kanban' ? (
        <div className="flex overflow-x-auto gap-4 pb-4 snap-x">
          {FUNNEL_STAGES.map((stage) => (
            <div key={stage} className="min-w-[320px] max-w-[320px] flex-shrink-0 bg-[#0F172A] rounded-xl border border-slate-800 flex flex-col snap-start">
              <div className={`p-3 border-b border-slate-800 flex items-center justify-between rounded-t-xl bg-gradient-to-r from-[${STATUS_COLORS[stage].replace('bg-', '')}]/10 to-transparent`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[stage]}`} />
                  <h3 className="font-bold text-slate-300 text-sm">{stage}</h3>
                </div>
                <span className="text-xs font-bold text-slate-500 bg-[#1E293B] px-2 py-0.5 rounded-full">
                  {filteredLeads.filter(l => l.status === stage).length}
                </span>
              </div>
              <div className="p-3 space-y-3 overflow-y-auto max-h-[65vh] custom-scrollbar">
                {filteredLeads.filter(l => l.status === stage).map(lead => (
                  <motion.div layoutId={`lead-${lead.id}`} key={lead.id} className="bg-[#1E293B] border border-slate-700 hover:border-slate-500 transition-colors p-4 rounded-xl shadow-sm group">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-white font-bold text-sm line-clamp-1">{lead.companyName || lead.company_name}</h4>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <UserCheck size={12} /> {lead.contactName || lead.contact_name}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-emerald-400 font-bold text-xs">₹{parseFloat(lead.potentialValue || lead.potential_value || 0).toLocaleString()}</span>
                        {lead.aiScore && (
                          <span className="text-[10px] text-indigo-400 font-bold mt-1 bg-indigo-500/10 px-1.5 py-0.5 rounded">AI: {lead.aiScore.toFixed(0)}</span>
                        )}
                      </div>
                    </div>
                    
                    {lead.notes && <p className="text-xs text-slate-500 line-clamp-2 mb-3 italic">"{lead.notes}"</p>}
                    
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-800">
                      <div className="flex items-center gap-1">
                        <button onClick={()=>toggleSelect(lead.id)} className={`p-1.5 rounded transition-colors ${selectedIds.has(lead.id)?'bg-indigo-500/20 text-indigo-400':'bg-slate-800 text-slate-400 hover:text-white'}`} title="Select"><CheckSquare size={14}/></button>
                        <button onClick={()=>openActivityDrawer(lead)} className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 rounded transition-colors" title="Activity Timeline"><Clock size={14}/></button>
                        {(lead.status === 'QUOTED' || lead.status === 'NEGOTIATING') && <button onClick={()=>openQuoteBuilder(lead)} className="p-1.5 bg-slate-800 hover:bg-purple-500/20 text-slate-400 hover:text-purple-400 rounded transition-colors" title="Build Quotation"><FileText size={14}/></button>}
                        <button onClick={() => handleDraftEmail(lead)} className="p-1.5 bg-slate-800 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded transition-colors" title="AI Draft Email">
                          <Mail size={14} />
                        </button>
                        <button onClick={() => handleDeleteLead(lead.id)} className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <select 
                          value={lead.status} 
                          onChange={(e) => handleUpdateStatus(lead.id, e.target.value)}
                          className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded px-1.5 py-1 outline-none"
                        >
                          {FUNNEL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Convert to Project Button exclusively for WON leads */}
                    {stage === 'WON' && (
                      <button onClick={() => handleConvertProject(lead)} className="mt-3 w-full py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded flex items-center justify-center gap-2 text-xs font-bold transition-colors">
                        <Rocket size={14} /> Convert to Project
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
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
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredLeads.map((lead: any) => (
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
                      <select 
                        value={lead.status} 
                        onChange={(e) => handleUpdateStatus(lead.id, e.target.value)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-full text-white ${STATUS_COLORS[lead.status] || 'bg-slate-600'} outline-none cursor-pointer appearance-none text-center`}
                      >
                        {FUNNEL_STAGES.map(s => <option key={s} value={s} className="bg-slate-800 text-white">{s}</option>)}
                      </select>
                    </td>
                    <td className="p-3 flex items-center gap-2">
                      <button onClick={()=>toggleSelect(lead.id)} className={`p-1.5 rounded-lg transition-colors ${selectedIds.has(lead.id)?'bg-indigo-500/20 text-indigo-400':'hover:bg-slate-700 text-slate-500'}`}><CheckSquare size={16}/></button>
                      <button onClick={()=>openActivityDrawer(lead)} className="p-1.5 rounded-lg hover:bg-amber-500/20 text-amber-400 transition-colors" title="Activity Log"><Clock size={16}/></button>
                      <button onClick={() => handleDraftEmail(lead)} className="p-1.5 rounded-lg hover:bg-indigo-500/20 text-indigo-400 transition-colors" title="Agentic Draft">
                        <Mail size={16} />
                      </button>
                      <button onClick={() => handleDeleteLead(lead.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors" title="Delete Lead">
                        <Trash2 size={16} />
                      </button>
                      {lead.status === 'WON' && (
                        <button onClick={() => handleConvertProject(lead)} className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-colors" title="Convert to Project">
                          <Rocket size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Draft Email Modal */}
      <AnimatePresence>
        {draftEmailLead && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !isDrafting && setDraftEmailLead(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-[#0F172A]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg"><Zap size={20} fill="currentColor" /></div>
                  <div>
                    <h3 className="text-white font-bold">Agentic Email Drafter</h3>
                    <p className="text-xs text-slate-400">Drafting for {draftEmailLead.contactName || draftEmailLead.contact_name} ({draftEmailLead.companyName || draftEmailLead.company_name})</p>
                  </div>
                </div>
                <button onClick={() => setDraftEmailLead(null)} disabled={isDrafting} className="text-slate-500 hover:text-white disabled:opacity-50"><X size={20} /></button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto">
                {isDrafting ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <div className="h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm animate-pulse">InsightMantra LLM is writing a highly personalized email...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-[#0F172A] p-4 rounded-xl border border-slate-700 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-mono">
                      {draftedEmailText}
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button onClick={copyEmailToClipboard} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-sm transition-colors">
                        {emailCopied ? <><CheckCircle2 size={16} /> Copied!</> : <><Copy size={16} /> Copy to Clipboard</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Lead Modal */}
      <AnimatePresence>
        {showNewLead && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowNewLead(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-[#1E293B] border border-slate-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white">Add New Lead</h3>
                <button onClick={() => setShowNewLead(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
              </div>
              <div className="space-y-3">
                <input placeholder="Contact Name *" value={newLead.contact_name} onChange={e => setNewLead({ ...newLead, contact_name: e.target.value })} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                <input placeholder="Email" value={newLead.contact_email} onChange={e => setNewLead({ ...newLead, contact_email: e.target.value })} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                <input placeholder="Company" value={newLead.company_name} onChange={e => setNewLead({ ...newLead, company_name: e.target.value })} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                <input placeholder="Potential Value (₹)" type="number" value={newLead.potential_value} onChange={e => setNewLead({ ...newLead, potential_value: e.target.value })} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500" />
                <select value={newLead.source} onChange={e => setNewLead({ ...newLead, source: e.target.value })} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500">
                  <option value="WEBSITE">Website</option><option value="REFERRAL">Referral</option>
                  <option value="COLD_CALL">Cold Call</option><option value="TRADE_SHOW">Trade Show</option>
                </select>
                <textarea placeholder="Notes" value={newLead.notes} onChange={e => setNewLead({ ...newLead, notes: e.target.value })} rows={3} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500 resize-none" />
                <button onClick={handleCreateLead} disabled={!newLead.contact_name} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors">
                  Create Lead
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Activity Timeline Drawer */}
      <AnimatePresence>
        {activityLead && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={()=>setActivityLead(null)}>
            <motion.div initial={{x:400}} animate={{x:0}} exit={{x:400}} transition={{type:'spring',damping:25}} className="w-full max-w-md bg-[#1E293B] border-l border-slate-700 h-full overflow-y-auto flex flex-col" onClick={e=>e.stopPropagation()}>
              <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-[#0F172A] sticky top-0 z-10">
                <div><h3 className="text-white font-bold">Activity Timeline</h3><p className="text-xs text-slate-400">{activityLead.companyName||activityLead.company_name} — {activityLead.contactName||activityLead.contact_name}</p></div>
                <button onClick={()=>setActivityLead(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
              <div className="p-4 border-b border-slate-800">
                <button onClick={()=>setShowLogActivity(!showLogActivity)} className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold py-2 rounded-xl transition-colors"><Plus size={14}/>Log Activity</button>
                {showLogActivity && (
                  <div className="mt-3 space-y-2 bg-[#0F172A] p-3 rounded-xl border border-slate-700">
                    <select value={newActivity.activityType} onChange={e=>setNewActivity({...newActivity,activityType:e.target.value})} className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none">
                      <option value="NOTE">📝 Note</option><option value="CALL">📞 Call</option><option value="EMAIL">📧 Email</option><option value="MEETING">🤝 Meeting</option><option value="TASK">✅ Task</option>
                    </select>
                    <textarea value={newActivity.description} onChange={e=>setNewActivity({...newActivity,description:e.target.value})} placeholder="What happened?" rows={2} className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none resize-none"/>
                    <input type="datetime-local" value={newActivity.followUpDate} onChange={e=>setNewActivity({...newActivity,followUpDate:e.target.value})} className="w-full bg-[#1E293B] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none" />
                    <button onClick={handleLogActivity} disabled={!newActivity.description} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-bold py-2 rounded-lg">Save Activity</button>
                  </div>
                )}
              </div>
              <div className="flex-1 p-4 space-y-3">
                {activities.length===0 ? <p className="text-sm text-slate-500 text-center py-8">No activities logged yet.</p> : activities.map((a:any)=>{
                  const Icon = ACTIVITY_ICONS[a.activityType] || StickyNote;
                  return (
                    <div key={a.id} className="flex gap-3 group">
                      <div className="mt-1 p-1.5 rounded-lg bg-slate-800 text-slate-400 shrink-0"><Icon size={14}/></div>
                      <div className="flex-1">
                        <div className="text-xs text-slate-500 flex items-center gap-2"><span className="font-bold text-slate-400">{a.activityType}</span><span>{new Date(a.createdAt||a.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div>
                        <p className="text-sm text-slate-300 mt-0.5">{a.description}</p>
                        {a.followUpDate && <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-400 font-bold"><CalendarCheck size={10}/>Follow-up: {new Date(a.followUpDate||a.follow_up_date).toLocaleDateString()}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quotation Builder Modal */}
      <AnimatePresence>
        {quoteLead && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={()=>setQuoteLead(null)}>
            <motion.div initial={{scale:0.9,y:20}} animate={{scale:1,y:0}} className="bg-[#1E293B] border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden" onClick={e=>e.stopPropagation()}>
              <div className="p-5 border-b border-slate-700 bg-[#0F172A] flex items-center justify-between">
                <div><h3 className="text-lg font-bold text-white flex items-center gap-2"><FileText size={20} className="text-purple-400"/>Quotation Builder</h3><p className="text-xs text-slate-400 mt-0.5">{quoteLead.companyName||quoteLead.company_name} — {quoteLead.contactName||quoteLead.contact_name}</p></div>
                <button onClick={()=>setQuoteLead(null)} className="text-slate-500 hover:text-white"><X size={20}/></button>
              </div>
              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  {quoteItems.map((it,i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#0F172A] border border-slate-800 rounded-xl p-3">
                      <input placeholder="Description" value={it.desc} onChange={e=>updateQuoteLine(i,'desc',e.target.value)} className="flex-1 bg-transparent text-sm text-white outline-none placeholder-slate-500"/>
                      <input type="number" placeholder="Qty" value={it.qty||''} onChange={e=>updateQuoteLine(i,'qty',parseInt(e.target.value)||0)} className="w-16 bg-[#1E293B] border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white text-center outline-none"/>
                      <input type="number" placeholder="Price" value={it.price||''} onChange={e=>updateQuoteLine(i,'price',parseFloat(e.target.value)||0)} className="w-24 bg-[#1E293B] border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white text-right outline-none"/>
                      <span className="text-sm text-emerald-400 font-bold w-24 text-right">₹{(it.qty*it.price).toLocaleString()}</span>
                      {quoteItems.length>1 && <button onClick={()=>removeQuoteLine(i)} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={12}/></button>}
                    </div>
                  ))}
                  <button onClick={addQuoteLine} className="w-full border border-dashed border-slate-700 text-slate-500 hover:text-white hover:border-slate-500 rounded-xl py-2 text-xs flex items-center justify-center gap-1 transition-colors"><Plus size={12}/>Add Line Item</button>
                </div>
                <div className="border-t border-slate-800 pt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-400">Subtotal</span><span className="text-white font-bold">₹{quoteSubtotal.toLocaleString()}</span></div>
                  <div className="flex items-center justify-between text-sm"><span className="text-slate-400">Tax Rate</span><div className="flex items-center gap-1"><input type="number" value={quoteTaxRate} onChange={e=>setQuoteTaxRate(parseFloat(e.target.value)||0)} className="w-16 bg-[#0F172A] border border-slate-700 rounded px-2 py-1 text-sm text-white text-center outline-none"/>%</div></div>
                  <div className="flex items-center justify-between text-lg border-t border-slate-800 pt-2"><span className="text-white font-bold">Total</span><span className="text-emerald-400 font-bold">₹{quoteTotal.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
                </div>
              </div>
              <div className="p-4 border-t border-slate-700 bg-[#0F172A] flex gap-3">
                <button onClick={handleSaveQuotation} disabled={quoteSaving||quoteItems.every(it=>!it.desc)} className="flex-1 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl transition-colors">{quoteSaving?'Saving...':'Save Quotation'}</button>
                <button onClick={()=>setQuoteLead(null)} className="px-4 py-2.5 bg-[#1E293B] text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-colors">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
