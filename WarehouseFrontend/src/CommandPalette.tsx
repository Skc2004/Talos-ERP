import React, { useEffect, useState, useRef } from 'react';
import { Search, Sparkles, Loader2, X, Table2, ChevronRight, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PYTHON_API = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8000';

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') { setOpen(false); setResult(null); }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      loadSuggestions();
    } else {
      setQuery('');
      setResult(null);
    }
  }, [open]);

  async function loadSuggestions() {
    try {
      const res = await fetch(`${PYTHON_API}/ai/suggestions`);
      const json = await res.json();
      setSuggestions(json.suggestions || []);
    } catch { setSuggestions(['Show me the P&L', 'Top leads by AI score', 'Stock below reorder point']); }
  }

  async function handleSubmit(questionOverride?: string) {
    const q = questionOverride || query;
    if (!q.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${PYTHON_API}/ai/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q })
      });
      const json = await res.json();
      setResult(json);
    } catch (e) {
      setResult({ status: 'error', message: 'AI gateway unreachable' });
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-24" onClick={() => setOpen(false)}>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-[#0F172A] border border-slate-700/50 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="p-1.5 bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 rounded-lg">
            <Sparkles className="text-emerald-400" size={18} />
          </div>
          <input
            ref={inputRef}
            className="w-full bg-transparent outline-none text-white text-base placeholder:text-slate-500"
            placeholder="Ask Talos anything... (P&L, leads, stock, forecasts)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          {loading && <Loader2 className="text-emerald-400 animate-spin shrink-0" size={18} />}
          <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Result */}
          {result && (
            <div className="p-4">
              {result.status === 'success' && result.data && result.data.length > 0 ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Bot className="text-emerald-400" size={16} />
                    <span className="text-sm font-medium text-emerald-400">{result.label}</span>
                    <span className="text-[10px] font-mono text-slate-600 ml-auto uppercase px-2 py-0.5 rounded-full bg-slate-800">{result.source}</span>
                  </div>
                  {/* Table */}
                  <div className="overflow-x-auto rounded-lg border border-slate-800">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-800/50">
                          {Object.keys(result.data[0]).map(key => (
                            <th key={key} className="text-left px-3 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider">{key.replace(/_/g, ' ')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.data.map((row: any, i: number) => (
                          <tr key={i} className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            {Object.values(row).map((val: any, j: number) => (
                              <td key={j} className="px-3 py-2 text-slate-300 font-mono text-xs">
                                {val === null ? <span className="text-slate-600">—</span> :
                                 typeof val === 'number' ? val.toLocaleString() :
                                 String(val).length > 40 ? String(val).substring(0, 40) + '...' : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 text-[10px] text-slate-600 font-mono">{result.row_count} rows • SQL: {result.sql?.substring(0, 80)}...</div>
                </div>
              ) : result.status === 'error' ? (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{result.message}</div>
              ) : result.status === 'no_match' ? (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm">{result.message}</div>
              ) : (
                <div className="p-4 bg-slate-800/50 rounded-lg text-slate-400 text-sm">No results found.</div>
              )}
            </div>
          )}

          {/* Suggestions (when no query and no result) */}
          {!result && !loading && (
            <div className="p-2">
              <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Suggestions</div>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(s); handleSubmit(s); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-emerald-500/10 hover:text-emerald-400 rounded-lg flex items-center gap-3 transition-colors"
                >
                  <ChevronRight size={14} className="text-slate-600" />
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Loading shimmer */}
          {loading && (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-4 bg-slate-800/50 rounded animate-pulse" style={{ width: `${80 - i * 15}%` }} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-slate-600">
            <Sparkles size={10} /> Powered by Gemini + Talos Intelligence
          </div>
          <div className="text-[10px] text-slate-600 font-mono">
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-500">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-500">K</kbd> to toggle
          </div>
        </div>
      </motion.div>
    </div>
  );
};
