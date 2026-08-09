import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings as SettingsIcon, BrainCircuit, Box, RefreshCw, CheckCircle2, Shield, Bell, GitBranch,
  Clock, Plus, Trash2, X, ToggleLeft, ToggleRight, AlertTriangle, Zap, Users, Target, Layers,
  ChevronRight, Save, Edit2
} from 'lucide-react';

const JAVA_API = import.meta.env.VITE_JAVA_API_URL || 'http://localhost:8080/api/v1';

// ── Tab Definitions ──
const TABS = [
  { key: 'pipeline', label: 'Pipeline Config', icon: Layers },
  { key: 'sla', label: 'SLA Definitions', icon: Clock },
  { key: 'rules', label: 'Workflow Rules', icon: GitBranch },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'system', label: 'System', icon: BrainCircuit },
];

const TRIGGER_EVENTS = ['LEAD_CREATED','LEAD_STAGE_CHANGED','LEAD_SCORE_UPDATED','PROJECT_STATUS_CHANGED','QA_COMPLETED','TIME_LOGGED'];
const ACTION_TYPES = ['AUTO_ASSIGN','SEND_NOTIFICATION','CHANGE_STATUS','ESCALATE','CREATE_TASK'];
const PRIORITIES = ['LOW','MEDIUM','HIGH','CRITICAL'];
const PRIORITY_COLORS: Record<string,string> = { LOW:'text-slate-400', MEDIUM:'text-blue-400', HIGH:'text-amber-400', CRITICAL:'text-red-400' };
const CHANNELS = ['IN_APP','EMAIL','BOTH'];

export const Settings = () => {
  const [activeTab, setActiveTab] = useState('pipeline');

  // ── Pipeline Config ──
  const [pipelineStages, setPipelineStages] = useState<string[]>(['NEW','CONTACTED','QUOTED','NEGOTIATING','WON','LOST']);
  const [leadSources, setLeadSources] = useState<string[]>(['WEBSITE','REFERRAL','COLD_CALL','TRADE_SHOW','LINKEDIN','PARTNER']);
  const [newStage, setNewStage] = useState('');
  const [newSource, setNewSource] = useState('');
  const [pipelineSaved, setPipelineSaved] = useState(false);

  // ── SLA Definitions ──
  const [slas, setSlas] = useState<any[]>([]);
  const [showAddSla, setShowAddSla] = useState(false);
  const [newSla, setNewSla] = useState({ name:'', leadSource:'', leadStage:'', responseHours:24, escalationHours:48, priority:'MEDIUM' });

  // ── Workflow Rules ──
  const [rules, setRules] = useState<any[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ name:'', triggerEvent:'LEAD_CREATED', actionType:'SEND_NOTIFICATION', isActive:true });

  // ── Notifications ──
  const [notifPrefs, setNotifPrefs] = useState<any[]>([]);

  // ── System ──
  const [llmProvider, setLlmProvider] = useState('groq');
  const [systemStatus, setSystemStatus] = useState<Record<string,string>>({});

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      // Load pipeline settings
      const [stagesRes, sourcesRes] = await Promise.allSettled([
        fetch(`${JAVA_API}/admin/settings/pipeline_stages`),
        fetch(`${JAVA_API}/admin/settings/lead_sources`)
      ]);
      if (stagesRes.status === 'fulfilled' && stagesRes.value.ok) {
        const d = await stagesRes.value.json();
        if (d.settingValue) setPipelineStages(JSON.parse(d.settingValue));
      }
      if (sourcesRes.status === 'fulfilled' && sourcesRes.value.ok) {
        const d = await sourcesRes.value.json();
        if (d.settingValue) setLeadSources(JSON.parse(d.settingValue));
      }

      // Load SLAs
      const slaRes = await fetch(`${JAVA_API}/admin/sla`).catch(()=>null);
      if (slaRes?.ok) { const d = await slaRes.json(); setSlas(Array.isArray(d)?d:[]); }

      // Load Rules
      const rulesRes = await fetch(`${JAVA_API}/admin/workflow-rules`).catch(()=>null);
      if (rulesRes?.ok) { const d = await rulesRes.json(); setRules(Array.isArray(d)?d:[]); }

      // Load Notifications
      const notifRes = await fetch(`${JAVA_API}/admin/notifications`).catch(()=>null);
      if (notifRes?.ok) { const d = await notifRes.json(); setNotifPrefs(Array.isArray(d)?d:[]); }
    } catch(e) { console.error('Settings load:', e); }
  }

  // ── Pipeline Handlers ──
  function addStage() { if (newStage && !pipelineStages.includes(newStage.toUpperCase())) { setPipelineStages([...pipelineStages, newStage.toUpperCase()]); setNewStage(''); } }
  function removeStage(s:string) { if (['NEW','WON','LOST'].includes(s)) return; setPipelineStages(pipelineStages.filter(x=>x!==s)); }
  function addSource() { if (newSource && !leadSources.includes(newSource.toUpperCase())) { setLeadSources([...leadSources, newSource.toUpperCase()]); setNewSource(''); } }
  function removeSource(s:string) { setLeadSources(leadSources.filter(x=>x!==s)); }
  async function savePipelineConfig() {
    await Promise.all([
      fetch(`${JAVA_API}/admin/settings/pipeline_stages`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ settingValue: JSON.stringify(pipelineStages), category:'crm' }) }),
      fetch(`${JAVA_API}/admin/settings/lead_sources`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ settingValue: JSON.stringify(leadSources), category:'crm' }) }),
    ]);
    setPipelineSaved(true); setTimeout(()=>setPipelineSaved(false), 2000);
  }

  // ── SLA Handlers ──
  async function handleAddSla() {
    await fetch(`${JAVA_API}/admin/sla`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newSla) });
    setShowAddSla(false); setNewSla({ name:'', leadSource:'', leadStage:'', responseHours:24, escalationHours:48, priority:'MEDIUM' }); loadAll();
  }
  async function deleteSla(id:string) { await fetch(`${JAVA_API}/admin/sla/${id}`, {method:'DELETE'}); loadAll(); }

  // ── Rule Handlers ──
  async function handleAddRule() {
    await fetch(`${JAVA_API}/admin/workflow-rules`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newRule) });
    setShowAddRule(false); setNewRule({ name:'', triggerEvent:'LEAD_CREATED', actionType:'SEND_NOTIFICATION', isActive:true }); loadAll();
  }
  async function toggleRule(id:string) { await fetch(`${JAVA_API}/admin/workflow-rules/${id}/toggle`, {method:'PUT'}); loadAll(); }
  async function deleteRule(id:string) { await fetch(`${JAVA_API}/admin/workflow-rules/${id}`, {method:'DELETE'}); loadAll(); }

  // ── Notification Handlers ──
  async function toggleNotif(pref:any) {
    await fetch(`${JAVA_API}/admin/notifications/${pref.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...pref, isEnabled: !pref.isEnabled || !pref.is_enabled }) });
    loadAll();
  }
  async function updateNotifChannel(pref:any, channel:string) {
    await fetch(`${JAVA_API}/admin/notifications/${pref.id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...pref, channel }) });
    loadAll();
  }

  // ── System Handlers ──
  const handleSystemAction = (id: string) => {
    setSystemStatus(prev => ({ ...prev, [id]: 'processing' }));
    setTimeout(() => setSystemStatus(prev => ({ ...prev, [id]: 'done' })), 1500);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <SettingsIcon className="text-indigo-400" size={28} />
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Admin Command Center</h2>
          <p className="text-sm text-slate-400 mt-0.5">Configure pipeline stages, SLAs, workflow automation, and system governance.</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-[#1E293B] border border-slate-800 rounded-xl p-1.5">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.key} onClick={()=>setActiveTab(tab.key)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <Icon size={16}/>{tab.label}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: Pipeline Config */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === 'pipeline' && (
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Stages */}
          <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1"><Layers size={18} className="text-indigo-400"/>Lead Pipeline Stages</h3>
            <p className="text-xs text-slate-500 mb-4">Define the stages a lead moves through. NEW, WON, LOST are locked.</p>
            <div className="space-y-2 mb-4">
              {pipelineStages.map((s, i) => (
                <div key={s} className="flex items-center gap-2 bg-[#0F172A] border border-slate-800 rounded-lg px-3 py-2.5">
                  <span className="text-xs text-slate-600 font-mono w-5">{i+1}</span>
                  <ChevronRight size={12} className="text-slate-700"/>
                  <span className="text-sm font-medium text-white flex-1">{s}</span>
                  {['NEW','WON','LOST'].includes(s) ? (
                    <span className="text-[10px] text-slate-600 font-bold bg-slate-800 px-2 py-0.5 rounded">LOCKED</span>
                  ) : (
                    <button onClick={()=>removeStage(s)} className="text-red-400/50 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newStage} onChange={e=>setNewStage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addStage()} placeholder="Add stage..." className="flex-1 bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"/>
              <button onClick={addStage} disabled={!newStage} className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-30 text-white px-3 rounded-lg transition-colors"><Plus size={16}/></button>
            </div>
          </div>

          {/* Lead Sources */}
          <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1"><Target size={18} className="text-emerald-400"/>Lead Sources</h3>
            <p className="text-xs text-slate-500 mb-4">Define where your leads come from. Used for filtering and SLA routing.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {leadSources.map(s => (
                <span key={s} className="flex items-center gap-1.5 bg-[#0F172A] border border-slate-800 rounded-lg px-3 py-2 text-sm text-white">
                  {s}
                  <button onClick={()=>removeSource(s)} className="text-red-400/50 hover:text-red-400 ml-1 transition-colors"><X size={12}/></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newSource} onChange={e=>setNewSource(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSource()} placeholder="Add source..." className="flex-1 bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500"/>
              <button onClick={addSource} disabled={!newSource} className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 text-white px-3 rounded-lg transition-colors"><Plus size={16}/></button>
            </div>
          </div>

          {/* Save Button */}
          <div className="lg:col-span-2">
            <button onClick={savePipelineConfig} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${pipelineSaved ? 'bg-emerald-500 text-white' : 'bg-indigo-500 hover:bg-indigo-600 text-white'}`}>
              {pipelineSaved ? <><CheckCircle2 size={16}/>Saved!</> : <><Save size={16}/>Save Pipeline Configuration</>}
            </button>
          </div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: SLA Definitions */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === 'sla' && (
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-4">
          <div className="flex items-center justify-between">
            <div><h3 className="text-lg font-bold text-white">Service Level Agreements</h3><p className="text-xs text-slate-500">Define response and escalation timeframes per lead source or stage.</p></div>
            <button onClick={()=>setShowAddSla(true)} className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"><Plus size={14}/>Add SLA</button>
          </div>

          <div className="bg-[#1E293B] border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#0F172A]"><tr className="text-slate-500 text-xs uppercase tracking-wider"><th className="p-3 text-left">Name</th><th className="p-3 text-left">Source</th><th className="p-3 text-left">Stage</th><th className="p-3 text-center">Response</th><th className="p-3 text-center">Escalation</th><th className="p-3 text-center">Priority</th><th className="p-3"></th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {slas.map(sla => (
                  <tr key={sla.id} className="hover:bg-[#0F172A]/50 transition-colors">
                    <td className="p-3 text-white font-medium">{sla.name}</td>
                    <td className="p-3 text-slate-400">{sla.leadSource || sla.lead_source || '—'}</td>
                    <td className="p-3 text-slate-400">{sla.leadStage || sla.lead_stage || '—'}</td>
                    <td className="p-3 text-center"><span className="bg-blue-500/10 text-blue-400 text-xs font-bold px-2 py-1 rounded">{sla.responseHours || sla.response_hours}h</span></td>
                    <td className="p-3 text-center"><span className="bg-amber-500/10 text-amber-400 text-xs font-bold px-2 py-1 rounded">{sla.escalationHours || sla.escalation_hours}h</span></td>
                    <td className="p-3 text-center"><span className={`text-xs font-bold ${PRIORITY_COLORS[sla.priority] || 'text-slate-400'}`}>{sla.priority}</span></td>
                    <td className="p-3"><button onClick={()=>deleteSla(sla.id)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"><Trash2 size={14}/></button></td>
                  </tr>
                ))}
                {slas.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No SLAs defined. Click "Add SLA" to create one.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Add SLA Modal */}
          <AnimatePresence>
            {showAddSla && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={()=>setShowAddSla(false)}>
                <motion.div initial={{scale:0.9}} animate={{scale:1}} className="bg-[#1E293B] border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e=>e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-white">New SLA Definition</h3><button onClick={()=>setShowAddSla(false)} className="text-slate-500 hover:text-white"><X size={20}/></button></div>
                  <div className="space-y-3">
                    <input placeholder="SLA Name *" value={newSla.name} onChange={e=>setNewSla({...newSla,name:e.target.value})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"/>
                    <div className="grid grid-cols-2 gap-3">
                      <select value={newSla.leadSource} onChange={e=>setNewSla({...newSla,leadSource:e.target.value})} className="bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none">
                        <option value="">Any Source</option>{leadSources.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                      <select value={newSla.leadStage} onChange={e=>setNewSla({...newSla,leadStage:e.target.value})} className="bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none">
                        <option value="">Any Stage</option>{pipelineStages.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="block text-[10px] text-slate-500 font-bold mb-1">RESPONSE (hrs)</label><input type="number" value={newSla.responseHours} onChange={e=>setNewSla({...newSla,responseHours:parseInt(e.target.value)||0})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none"/></div>
                      <div><label className="block text-[10px] text-slate-500 font-bold mb-1">ESCALATION (hrs)</label><input type="number" value={newSla.escalationHours} onChange={e=>setNewSla({...newSla,escalationHours:parseInt(e.target.value)||0})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none"/></div>
                      <div><label className="block text-[10px] text-slate-500 font-bold mb-1">PRIORITY</label><select value={newSla.priority} onChange={e=>setNewSla({...newSla,priority:e.target.value})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none">{PRIORITIES.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
                    </div>
                    <button onClick={handleAddSla} disabled={!newSla.name} className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition-colors">Create SLA</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: Workflow Rules */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === 'rules' && (
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-4">
          <div className="flex items-center justify-between">
            <div><h3 className="text-lg font-bold text-white">Workflow Automation Rules</h3><p className="text-xs text-slate-500">Define if-this-then-that rules that trigger automatically on business events.</p></div>
            <button onClick={()=>setShowAddRule(true)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"><Zap size={14}/>Add Rule</button>
          </div>

          <div className="space-y-3">
            {rules.map(rule => (
              <div key={rule.id} className={`bg-[#1E293B] border rounded-xl p-4 transition-colors ${(rule.isActive ?? rule.is_active) ? 'border-slate-800' : 'border-slate-800/50 opacity-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={()=>toggleRule(rule.id)} className="shrink-0">
                      {(rule.isActive ?? rule.is_active) ? <ToggleRight size={24} className="text-emerald-400"/> : <ToggleLeft size={24} className="text-slate-600"/>}
                    </button>
                    <div>
                      <div className="text-sm font-bold text-white">{rule.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded">WHEN: {rule.triggerEvent || rule.trigger_event}</span>
                        <ChevronRight size={10} className="text-slate-600"/>
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded">DO: {rule.actionType || rule.action_type}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={()=>deleteRule(rule.id)} className="p-2 hover:bg-red-500/10 text-red-400/50 hover:text-red-400 rounded-lg transition-colors"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
            {rules.length === 0 && <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-8 text-center text-slate-500">No workflow rules configured. Click "Add Rule" to automate a business event.</div>}
          </div>

          {/* Add Rule Modal */}
          <AnimatePresence>
            {showAddRule && (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={()=>setShowAddRule(false)}>
                <motion.div initial={{scale:0.9}} animate={{scale:1}} className="bg-[#1E293B] border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e=>e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-white flex items-center gap-2"><Zap size={18} className="text-emerald-400"/>New Workflow Rule</h3><button onClick={()=>setShowAddRule(false)} className="text-slate-500 hover:text-white"><X size={20}/></button></div>
                  <div className="space-y-3">
                    <input placeholder="Rule Name *" value={newRule.name} onChange={e=>setNewRule({...newRule,name:e.target.value})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500"/>
                    <div><label className="block text-[10px] text-slate-500 font-bold mb-1">TRIGGER EVENT</label><select value={newRule.triggerEvent} onChange={e=>setNewRule({...newRule,triggerEvent:e.target.value})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none">{TRIGGER_EVENTS.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}</select></div>
                    <div><label className="block text-[10px] text-slate-500 font-bold mb-1">ACTION</label><select value={newRule.actionType} onChange={e=>setNewRule({...newRule,actionType:e.target.value})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none">{ACTION_TYPES.map(a=><option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}</select></div>
                    <button onClick={handleAddRule} disabled={!newRule.name} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition-colors">Create Rule</button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: Notifications */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === 'notifications' && (
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="space-y-4">
          <div><h3 className="text-lg font-bold text-white">Notification Preferences</h3><p className="text-xs text-slate-500">Control which events generate alerts and through which channels.</p></div>
          <div className="bg-[#1E293B] border border-slate-800 rounded-xl divide-y divide-slate-800">
            {notifPrefs.map(pref => {
              const eventType = pref.eventType || pref.event_type;
              const isEnabled = pref.isEnabled ?? pref.is_enabled;
              return (
                <div key={pref.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <button onClick={()=>toggleNotif(pref)}>
                      {isEnabled ? <ToggleRight size={24} className="text-emerald-400"/> : <ToggleLeft size={24} className="text-slate-600"/>}
                    </button>
                    <div>
                      <div className="text-sm font-medium text-white">{eventType?.replace(/_/g,' ')}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{eventType === 'LEAD_CREATED' ? 'When a new lead enters the pipeline' : eventType === 'LEAD_WON' ? 'When a lead is converted to WON' : eventType === 'QA_FAILED' ? 'When a QA checklist has failed items' : eventType === 'PROJECT_OVERDUE' ? 'When a project passes its deadline' : eventType === 'SLA_BREACH' ? 'When response time exceeds SLA threshold' : 'Business event notification'}</div>
                    </div>
                  </div>
                  <select value={pref.channel} onChange={e=>updateNotifChannel(pref, e.target.value)} className={`bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold outline-none ${isEnabled ? 'text-white' : 'text-slate-600'}`} disabled={!isEnabled}>
                    {CHANNELS.map(c=><option key={c} value={c}>{c.replace('_',' ')}</option>)}
                  </select>
                </div>
              );
            })}
            {notifPrefs.length === 0 && <div className="p-8 text-center text-slate-500">No notification preferences configured. They will be seeded when the database migration runs.</div>}
          </div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════════════ */}
      {/* TAB: System */}
      {/* ══════════════════════════════════════════════ */}
      {activeTab === 'system' && (
        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4"><BrainCircuit className="text-emerald-400"/><h3 className="text-lg font-bold text-white">LLM Multi-Agent Provider</h3></div>
            <p className="text-sm text-slate-400 mb-4">Switch the active inference engine across the Python Insights layer.</p>
            <select value={llmProvider} onChange={e=>setLlmProvider(e.target.value)} className="w-full bg-[#0F172A] border border-slate-700 text-white p-3 rounded-lg outline-none focus:border-indigo-500 mb-4">
              <option value="groq">Groq (llama-3.1-8b-instant)</option>
              <option value="gemini">Google Gemini (gemini-pro-latest)</option>
              <option value="openai">OpenAI (gpt-4o-mini)</option>
            </select>
            <button onClick={()=>handleSystemAction('llm')} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-lg flex justify-center items-center gap-2 transition-colors">
              {systemStatus['llm']==='processing' ? <RefreshCw className="animate-spin" size={16}/> : systemStatus['llm']==='done' ? <><CheckCircle2 size={16}/>Locked</> : 'Lock Engine Provider'}
            </button>
          </div>

          <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4"><Box className="text-amber-400"/><h3 className="text-lg font-bold text-white">System Operations</h3></div>
            <p className="text-sm text-slate-400 mb-4">Force recalculations or trigger subsystem diagnostics.</p>
            <div className="space-y-3">
              <button onClick={()=>handleSystemAction('recalc')} className="w-full bg-[#0F172A] border border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 px-6 py-2.5 rounded-lg font-bold flex justify-center items-center gap-2 transition-colors">
                {systemStatus['recalc']==='processing' ? <RefreshCw className="animate-spin" size={16}/> : systemStatus['recalc']==='done' ? <><CheckCircle2 size={16}/>Computed</> : 'Force Recalc Thresholds'}
              </button>
              <button className="w-full bg-[#0F172A] border border-slate-700 hover:border-slate-500 text-white px-6 py-2.5 rounded-lg font-bold transition-colors">Upload CSV DB Matrix</button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
