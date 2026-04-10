import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { motion } from 'framer-motion';
import { ShieldCheck, ShieldAlert, Clock, Activity, Zap, AlertTriangle } from 'lucide-react';

const cardAnim = {
  hidden: { opacity: 0, y: 15 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08 } })
};

export const SystemIntegrity = () => {
  const [testLogs, setTestLogs] = useState<any[]>([]);
  const [mlAudits, setMlAudits] = useState<any[]>([]);

  useEffect(() => {
    loadData();

    // Subscribe to real-time test_logs inserts
    const channel = supabase.channel('test_logs_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'test_logs' }, (payload: any) => {
        setTestLogs(prev => [payload.new, ...prev].slice(0, 20));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadData() {
    try {
      const logsRes = await supabase
        .table('test_logs')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(20);
      if (logsRes.data) setTestLogs(logsRes.data);

      const auditRes = await supabase
        .table('ml_audit')
        .select('*')
        .order('audited_at', { ascending: false })
        .limit(10);
      if (auditRes.data) setMlAudits(auditRes.data);
    } catch (e) {
      console.error('Failed to load QA data:', e);
    }
  }

  // Aggregate stats
  const latestRun = testLogs[0];
  const totalTests = testLogs.reduce((sum, l) => sum + (l.total_tests || 0), 0);
  const totalPassed = testLogs.reduce((sum, l) => sum + (l.passed || 0), 0);
  const overallPassRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '—';
  const avgLatency = testLogs.length > 0
    ? (testLogs.reduce((sum, l) => sum + (l.avg_response_ms || 0), 0) / testLogs.length).toFixed(1)
    : '—';

  const driftDetected = mlAudits.some(a => a.drift_detected);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="text-emerald-400" />
            System Integrity Monitor
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Live test results, ML model accuracy, and chaos resilience tracking.
          </p>
        </div>
        {latestRun && (
          <div className={`px-4 py-1.5 rounded-full text-xs font-bold border ${
            latestRun.pass_rate >= 95
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : latestRun.pass_rate >= 70
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}>
            {latestRun.pass_rate >= 95 ? 'ALL SYSTEMS GO' : latestRun.pass_rate >= 70 ? 'PARTIAL DEGRADATION' : 'SYSTEM ALERT'}
          </div>
        )}
      </div>

      {/* Aggregate KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div custom={0} variants={cardAnim} initial="hidden" animate="visible">
          <StatCard icon={<ShieldCheck className="text-emerald-500" size={20} />} label="Overall Pass Rate" value={`${overallPassRate}%`} />
        </motion.div>
        <motion.div custom={1} variants={cardAnim} initial="hidden" animate="visible">
          <StatCard icon={<Activity className="text-indigo-500" size={20} />} label="Total Test Runs" value={String(testLogs.length)} />
        </motion.div>
        <motion.div custom={2} variants={cardAnim} initial="hidden" animate="visible">
          <StatCard icon={<Clock className="text-slate-400" size={20} />} label="Avg Response Time" value={`${avgLatency}ms`} />
        </motion.div>
        <motion.div custom={3} variants={cardAnim} initial="hidden" animate="visible">
          <StatCard
            icon={driftDetected ? <AlertTriangle className="text-red-500" size={20} /> : <Zap className="text-emerald-500" size={20} />}
            label="Model Drift"
            value={driftDetected ? "DETECTED" : "STABLE"}
            alert={driftDetected}
          />
        </motion.div>
      </div>

      {/* Test Results Table */}
      <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-medium text-slate-200 mb-4">Test Execution History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-800 text-left">
                <th className="pb-3 pr-4">Run ID</th>
                <th className="pb-3 pr-4">Suite</th>
                <th className="pb-3 pr-4">Pass/Total</th>
                <th className="pb-3 pr-4">Rate</th>
                <th className="pb-3 pr-4">Latency</th>
                <th className="pb-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {testLogs.map((log, i) => (
                <tr key={log.id || i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 pr-4 font-mono text-xs text-slate-400">{log.run_id}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      log.suite === 'CHAOS' ? 'bg-red-500/20 text-red-400' :
                      log.suite === 'JAVA_UNIT' ? 'bg-indigo-500/20 text-indigo-400' :
                      'bg-emerald-500/20 text-emerald-400'
                    }`}>{log.suite}</span>
                  </td>
                  <td className="py-3 pr-4 text-slate-300">{log.passed}/{log.total_tests}</td>
                  <td className="py-3 pr-4">
                    <span className={`font-bold ${log.pass_rate >= 95 ? 'text-emerald-400' : log.pass_rate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                      {log.pass_rate}%
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-400">{log.avg_response_ms}ms</td>
                  <td className="py-3 text-slate-500 text-xs max-w-xs truncate">{log.notes}</td>
                </tr>
              ))}
              {testLogs.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-600">No test runs yet. Execute the Chaos Monkey or JUnit suite to populate.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ML Audit Trail */}
      {mlAudits.length > 0 && (
        <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-medium text-slate-200 mb-4">ML Model Audit Trail</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mlAudits.map((audit, i) => (
              <div key={audit.id || i} className={`p-4 rounded-lg border ${
                audit.drift_detected ? 'border-red-500/30 bg-red-500/5' : 'border-slate-700 bg-[#0F172A]'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-300">{audit.model_name}</span>
                  {audit.drift_detected && <span className="text-[10px] font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded">DRIFT</span>}
                </div>
                <div className="text-xs text-slate-500 space-y-1">
                  <div>MAPE: <span className="text-white font-mono">{audit.mape}%</span></div>
                  <div>RMSE: <span className="text-white font-mono">{audit.rmse}</span></div>
                  <div>Samples: <span className="text-white">{audit.sample_size}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

const StatCard = ({ icon, label, value, alert = false }: any) => (
  <div className={`bg-[#1E293B] border rounded-xl p-5 shadow-sm ${alert ? 'border-red-500/30' : 'border-slate-800'}`}>
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <span className="text-sm text-slate-400">{label}</span>
    </div>
    <div className={`text-2xl font-bold ${alert ? 'text-red-400' : 'text-white'}`}>{value}</div>
  </div>
);
