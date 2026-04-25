import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, BrainCircuit, Box, UploadCloud, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const Settings = () => {
  const [llmProvider, setLlmProvider] = useState('groq');
  const [capacity, setCapacity] = useState('2000');
  const [storeName, setStoreName] = useState('New Delhi Sector 5');
  
  const [status, setStatus] = useState<Record<string, string>>({});

  const handleAction = (id: string, action: string) => {
    setStatus(prev => ({ ...prev, [id]: 'processing' }));
    setTimeout(() => {
      setStatus(prev => ({ ...prev, [id]: 'done' }));
    }, 1500);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="text-indigo-400" size={28} />
        <h2 className="text-2xl font-bold text-white tracking-tight">Master Control Settings</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LLM Routing Overrides */}
        <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BrainCircuit className="text-emerald-400" />
            <h3 className="text-lg font-bold text-white">LLM Multi-Agent Provider</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">Switch the active inference engine across the Python Insights layer dynamically.</p>
          
          <select 
            value={llmProvider}
            onChange={(e) => setLlmProvider(e.target.value)}
            className="w-full bg-[#0F172A] border border-slate-700 text-white p-3 rounded-lg focus:outline-none focus:border-indigo-500 mb-4"
          >
            <option value="groq">Groq (llama-3.1-8b-instant)</option>
            <option value="gemini">Google Gemini (gemini-pro-latest)</option>
            <option value="openai">OpenAI (gpt-4o-mini)</option>
          </select>
          
          <button 
            onClick={() => handleAction('llm', 'Update')}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg flex justify-center items-center gap-2"
          >
            {status['llm'] === 'processing' ? <RefreshCw className="animate-spin" size={16}/> : 
             status['llm'] === 'done' ? <CheckCircle2 size={16}/> : 'Lock Engine Provider'}
          </button>
        </div>

        {/* Manual Configuration Panel */}
        <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Box className="text-amber-400" />
            <h3 className="text-lg font-bold text-white">Advanced Capacity & Tiers</h3>
          </div>
          <p className="text-sm text-slate-400 mb-4">Force rebalance configuration or override logical max bounds globally.</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 font-bold mb-1">REGISTER NEW STORE</label>
              <div className="flex gap-2">
                <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="w-full bg-[#0F172A] border border-slate-700 text-white p-2 rounded-lg" />
                <button 
                  onClick={() => handleAction('store', 'Add')}
                  className="bg-emerald-600 text-white px-4 rounded-lg font-bold hover:bg-emerald-500"
                >Add</button>
              </div>
            </div>
            
            <div>
              <label className="block text-xs text-slate-500 font-bold mb-1">GLOBAL TARGET CAPACITY (Target = max * 0.8)</label>
              <div className="flex gap-2">
                <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full bg-[#0F172A] border border-slate-700 text-white p-2 rounded-lg font-mono" />
                <button 
                  onClick={() => handleAction('cap', 'Update')}
                  className="bg-indigo-600 text-white px-4 rounded-lg font-bold hover:bg-indigo-500"
                >Apply</button>
              </div>
            </div>
          </div>
        </div>

        {/* System Operations */}
        <div className="lg:col-span-2 bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><UploadCloud className="text-indigo-400"/> Python Subsystem Analytics</h3>
            <p className="text-sm text-slate-400">Trigger manual CSV loads or Force Target Level mathematical recalculations via the new Advanced Formula matrix.</p>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => handleAction('recalc', 'Run')}
              className="bg-[#0F172A] border border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition"
            >
              {status['recalc'] === 'processing' ? <RefreshCw className="animate-spin" size={16}/> : 
               status['recalc'] === 'done' ? <><CheckCircle2 size={16}/> Matrix Computed</> : 'Force Recalc Thresholds'}
            </button>
            <button className="bg-[#0F172A] border border-slate-700 hover:border-slate-500 text-white px-6 py-2 rounded-lg font-bold">
              Upload CSV DB Matrix
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
