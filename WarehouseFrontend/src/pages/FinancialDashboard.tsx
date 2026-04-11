import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, TrendingUp, TrendingDown, DollarSign, Plus, Trash2, X, BarChart3, ArrowDownRight, ArrowUpRight, Radio } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '../supabaseClient';

const JAVA_API = import.meta.env.VITE_JAVA_API_URL || 'http://localhost:8080/api/v1';

export const FinancialDashboard = () => {
  const [pnl, setPnl] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpense, setNewExpense] = useState({ description: '', category: 'PAYROLL', amount: '', expense_date: '' });
  const [lastUpdated, setLastUpdated] = useState<string>('—');
  const [liveFeed, setLiveFeed] = useState<any[]>([]);

  useEffect(() => {
    loadPnL(); loadExpenses();

    // ── Continuous Close: Realtime subscription to general_ledger ──
    const channel = supabase.channel('ledger-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'general_ledger' }, (payload) => {
        // Auto-refresh P&L on new ledger entries
        loadPnL();
        setLastUpdated(new Date().toLocaleTimeString());
        setLiveFeed(prev => [payload.new, ...prev.slice(0, 9)]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadPnL() {
    try {
      const res = await fetch(`${JAVA_API}/finance/pnl`);
      if (!res.ok) throw new Error('Failed to fetch P&L');
      setPnl(await res.json());
    } catch (e) {
      setPnl({ error: 'Data service disconnected or degraded.' });
    }
  }

  async function loadExpenses() {
    try {
      const res = await fetch(`${JAVA_API}/finance/expenses`);
      setExpenses(await res.json());
    } catch { setExpenses([]); }
  }

  async function handleAddExpense() {
    try {
      await fetch(`${JAVA_API}/finance/expenses`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: newExpense.description, category: newExpense.category,
          amount: parseFloat(newExpense.amount), expenseDate: newExpense.expense_date || new Date().toISOString().split('T')[0]
        })
      });
      setShowAddExpense(false);
      setNewExpense({ description: '', category: 'PAYROLL', amount: '', expense_date: '' });
      loadPnL(); loadExpenses();
    } catch (e) { console.error(e); }
  }

  async function handleDeleteExpense(id: string) {
    try {
      await fetch(`${JAVA_API}/finance/expenses/${id}`, { method: 'DELETE' });
      loadPnL(); loadExpenses();
    } catch (e) { console.error(e); }
  }

  const fmt = (val: number) => `₹${Math.abs(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const waterfallColors: Record<string, string> = {
    income: '#10b981', expense: '#ef4444', subtotal: '#6366f1', total: '#10b981'
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Wallet className="text-emerald-400" /> Financial Engine
          </h2>
          <p className="text-sm text-slate-400 mt-1">Real-time Profit & Loss, Cash Flow, and Expense Tracking.</p>
        </div>
        <button onClick={() => setShowAddExpense(true)}
          className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg">
          <Plus size={16} /> Log Expense
        </button>
      </div>

      {/* P&L KPIs */}
      {pnl?.error ? (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
          <p className="text-sm text-red-400 font-semibold">{pnl.error}</p>
        </div>
      ) : pnl ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <PnLCard label="Gross Revenue" value={fmt(pnl.grossRevenue)} icon={<ArrowUpRight className="text-emerald-500" size={18} />} positive />
          <PnLCard label="COGS" value={fmt(pnl.costOfGoodsSold)} icon={<ArrowDownRight className="text-red-400" size={18} />} />
          <PnLCard label="Operating Exp." value={fmt(pnl.operatingExpenses)} icon={<ArrowDownRight className="text-red-400" size={18} />} />
          <PnLCard label="EBITDA" value={fmt(pnl.ebitda)} icon={<BarChart3 className="text-indigo-400" size={18} />} positive={pnl.ebitda > 0} />
          <PnLCard label="Net Profit" value={fmt(pnl.netProfit)} icon={<DollarSign className="text-emerald-500" size={18} />}
            subtitle={`Margin: ${pnl.profitMarginPercent?.toFixed(1)}%`} positive={pnl.netProfit > 0} highlight />
        </div>
      ) : null}

      {/* Waterfall Chart */}
      {pnl?.waterfall?.length > 0 && (
        <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-medium text-slate-200 mb-4">P&L Waterfall</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={pnl.waterfall} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
              <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} angle={-20} textAnchor="end" height={60} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                formatter={(val: any) => [fmt(Math.abs(val)), '']} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {pnl.waterfall.map((entry: any, i: number) => (
                  <Cell key={i} fill={waterfallColors[entry.type] || '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Expenses Table */}
      <div className="bg-[#1E293B] border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-medium text-slate-200">Expense Ledger</h3>
          <span className="text-xs text-slate-500">{expenses.length} entries</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0F172A]">
              <tr className="text-slate-500 text-xs uppercase tracking-wider">
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {expenses.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">No expenses logged yet. Click "Log Expense" to start tracking.</td></tr>
              ) : expenses.map((exp: any) => (
                <tr key={exp.id} className="hover:bg-[#0F172A]/50 transition-colors">
                  <td className="p-3 text-slate-400 text-xs">{exp.expenseDate || exp.expense_date}</td>
                  <td className="p-3 text-white">{exp.description}</td>
                  <td className="p-3"><span className="text-[10px] font-bold bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{exp.category}</span></td>
                  <td className="p-3 text-right text-red-400 font-semibold">₹{parseFloat(exp.amount).toLocaleString()}</td>
                  <td className="p-3 text-center">
                    <button onClick={() => handleDeleteExpense(exp.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {showAddExpense && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAddExpense(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1E293B] border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white">Log Expense</h3>
                <button onClick={() => setShowAddExpense(false)} className="text-slate-500 hover:text-white"><X size={20} /></button>
              </div>
              <div className="space-y-3">
                <input placeholder="Description *" value={newExpense.description} onChange={e => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500" />
                <select value={newExpense.category} onChange={e => setNewExpense({ ...newExpense, category: e.target.value })}
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500">
                  <option value="PAYROLL">Payroll</option><option value="RENT">Rent</option>
                  <option value="LOGISTICS">Logistics</option><option value="MARKETING">Marketing</option>
                  <option value="UTILITIES">Utilities</option><option value="RAW_MATERIALS">Raw Materials</option>
                  <option value="MAINTENANCE">Maintenance</option><option value="OTHER">Other</option>
                </select>
                <input placeholder="Amount (₹) *" type="number" value={newExpense.amount} onChange={e => setNewExpense({ ...newExpense, amount: e.target.value })}
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500" />
                <input type="date" value={newExpense.expense_date} onChange={e => setNewExpense({ ...newExpense, expense_date: e.target.value })}
                  className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500" />
                <button onClick={handleAddExpense} disabled={!newExpense.description || !newExpense.amount}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors">
                  Log Expense
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const PnLCard = ({ label, value, icon, subtitle, positive, highlight }: any) => (
  <div className={`bg-[#1E293B] border rounded-xl p-4 shadow-sm ${highlight ? 'border-emerald-500/50' : 'border-slate-800'}`}>
    <div className="flex items-center gap-1.5 mb-2">{icon}<span className="text-xs text-slate-400">{label}</span></div>
    <div className={`text-xl font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>{value}</div>
    {subtitle && <div className="text-[10px] text-slate-500 mt-1">{subtitle}</div>}
  </div>
);
