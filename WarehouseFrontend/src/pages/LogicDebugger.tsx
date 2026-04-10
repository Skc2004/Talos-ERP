import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Activity, ShieldCheck, AlertOctagon } from 'lucide-react';

const JAVA_API = import.meta.env.VITE_JAVA_API_URL || 'http://localhost:8080';

const cardAnim = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.35 } })
};

export const LogicDebugger = () => {
  const [skus, setSkus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRebalancing() {
      try {
        const res = await fetch(`${JAVA_API}/inventory/rebalance`);
        if (!res.ok) throw new Error('API degraded');
        const data = await res.json();
        setSkus(data);
      } catch {
        setError('Connection to Rebalancing Engine lost. Operating in degraded mode.');
        setSkus([]);
      } finally {
        setLoading(false);
      }
    }
    loadRebalancing();
  }, []);

  if (loading) return <div className="text-slate-500 animate-pulse p-8">Computing Rebalancing Matrix...</div>;

  if (error) return <div className="text-red-400 p-8 font-semibold bg-red-400/10 border-l-4 border-red-500 rounded-lg">{error}</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="text-indigo-400" />
            Logic Debugger — Live Engine Output
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Real-time mathematical exposure of the Java Spring Boot Rebalancing Engine.
            Every value below is computed from live database aggregates — zero hardcoding.
          </p>
        </div>
      </div>

      {/* Formula Reference */}
      <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="text-xs font-mono text-slate-500 space-y-1">
          <div><span className="text-emerald-400">ROP</span> = (d_avg × L) + SS</div>
          <div><span className="text-emerald-400">SS</span>  = Z × σ_d × √L &nbsp;&nbsp; <span className="text-slate-600">// Z = 1.645 for 95% service level</span></div>
          <div><span className="text-emerald-400">Health</span> = (Current Stock − SS) / d_avg &nbsp;&nbsp; <span className="text-slate-600">// target: 7–14 days</span></div>
        </div>
      </div>

      {/* Per-SKU Cards */}
      {skus.map((sku, idx) => (
        <motion.div
          key={sku.sku}
          custom={idx}
          variants={cardAnim}
          initial="hidden"
          animate="visible"
          className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white">{sku.sku}</h3>
              <p className="text-sm text-slate-500">{sku.description}</p>
            </div>
            <HealthBadge status={sku.healthStatus} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <MetricTile label="Current Stock" value={sku.currentStock} />
            <MetricTile label="Avg Demand (d)" value={`${sku.avgDailyDemand_d}/day`} />
            <MetricTile label="Std Dev (σ)" value={sku.stdDevDemand_sigma} />
            <MetricTile label="Lead Time (L)" value={`${sku.leadTimeDays} days`} />
            <MetricTile label="Safety Stock" value={sku.safetyStock_SS} accent="indigo" />
            <MetricTile label="Reorder Point" value={sku.reorderPoint_ROP} accent="indigo" />
          </div>

          <div className="flex items-center gap-6 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="text-slate-600" size={14} />
              <span className="text-sm text-slate-400">Health: <strong className="text-white">{sku.healthScoreDays} days</strong> of coverage</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertOctagon className={`${sku.daysUntilStockout < 7 ? 'text-red-500' : 'text-slate-600'}`} size={14} />
              <span className="text-sm text-slate-400">Stockout in: <strong className={sku.daysUntilStockout < 7 ? 'text-red-400' : 'text-white'}>{sku.daysUntilStockout} days</strong></span>
            </div>
            {sku.needsReorder && (
              <div className="ml-auto flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-bold text-amber-400">REORDER REQUIRED</span>
              </div>
            )}
          </div>

          {/* Raw JSON for the "Man Behind The Curtain" */}
          <details className="text-xs">
            <summary className="text-slate-600 cursor-pointer hover:text-slate-400 transition-colors">Show raw engine output</summary>
            <pre className="mt-2 p-3 bg-[#0F172A] rounded-lg border border-slate-800 font-mono text-emerald-400 overflow-x-auto">
              {JSON.stringify(sku, null, 2)}
            </pre>
          </details>
        </motion.div>
      ))}
    </motion.div>
  );
};

const HealthBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    OPTIMAL: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    HEALTHY: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    WARNING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30'
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide border ${map[status] || map.CRITICAL}`}>
      {status}
    </span>
  );
};

const MetricTile = ({ label, value, accent = "slate" }: any) => (
  <div className={`p-3 bg-[#0F172A] rounded-lg border border-slate-800`}>
    <div className="text-[11px] text-slate-500 font-medium mb-0.5">{label}</div>
    <div className={`text-lg font-bold ${accent === 'indigo' ? 'text-indigo-400' : 'text-white'}`}>{value}</div>
  </div>
);
