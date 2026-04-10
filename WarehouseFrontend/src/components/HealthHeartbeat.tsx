import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Wifi, WifiOff, Server, Database, Brain } from 'lucide-react';

interface ServiceStatus {
  name: string;
  url: string;
  status: 'UP' | 'DOWN' | 'CHECKING';
  latencyMs: number;
  icon: React.ReactNode;
  message: string;
}

export const HealthHeartbeat = () => {
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: 'Java Core', url: 'http://localhost:8080/actuator/health', status: 'CHECKING', latencyMs: 0, icon: <Server size={14} />, message: 'Checking...' },
    { name: 'AI Engine', url: 'http://localhost:8000/', status: 'CHECKING', latencyMs: 0, icon: <Brain size={14} />, message: 'Checking...' },
    { name: 'Database', url: '', status: 'CHECKING', latencyMs: 0, icon: <Database size={14} />, message: 'Checking...' },
  ]);
  const [expanded, setExpanded] = useState(false);

  const checkHealth = useCallback(async () => {
    const updated: ServiceStatus[] = [];

    // Check Java Core
    try {
      const start = Date.now();
      const res = await fetch('http://localhost:8080/actuator/health', { signal: AbortSignal.timeout(5000) });
      const latency = Date.now() - start;
      updated.push({
        name: 'Java Core', url: 'http://localhost:8080', status: res.ok ? 'UP' : 'DOWN',
        latencyMs: latency, icon: <Server size={14} />,
        message: res.ok ? `Operational (${latency}ms)` : 'Service degraded'
      });
    } catch {
      updated.push({ name: 'Java Core', url: '', status: 'DOWN', latencyMs: 0, icon: <Server size={14} />, message: 'Unreachable — Circuit Breaker active' });
    }

    // Check InsightMantra
    try {
      const start = Date.now();
      const res = await fetch('http://localhost:8000/', { signal: AbortSignal.timeout(5000) });
      const latency = Date.now() - start;
      updated.push({
        name: 'AI Engine', url: 'http://localhost:8000', status: res.ok ? 'UP' : 'DOWN',
        latencyMs: latency, icon: <Brain size={14} />,
        message: res.ok ? `Operational (${latency}ms)` : 'AI service degraded'
      });
    } catch {
      updated.push({ name: 'AI Engine', url: '', status: 'DOWN', latencyMs: 0, icon: <Brain size={14} />, message: 'Offline — Using cached intelligence' });
    }

    // Check Supabase via a lightweight query
    try {
      const start = Date.now();
      const { data, error } = await (await import('../supabaseClient')).supabase.table('sku_master').select('id').limit(1);
      const latency = Date.now() - start;
      updated.push({
        name: 'Database', url: '', status: error ? 'DOWN' : 'UP',
        latencyMs: latency, icon: <Database size={14} />,
        message: error ? 'Database connection issue' : `Connected (${latency}ms)`
      });
    } catch {
      updated.push({ name: 'Database', url: '', status: 'DOWN', latencyMs: 0, icon: <Database size={14} />, message: 'Internet connection slow' });
    }

    setServices(updated);
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [checkHealth]);

  const allUp = services.every(s => s.status === 'UP');
  const anyDown = services.some(s => s.status === 'DOWN');

  return (
    <div className="relative">
      {/* Heartbeat Icon */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors"
        title="System Health"
      >
        <Heart
          size={18}
          className={`transition-colors ${
            allUp ? 'text-emerald-500' : anyDown ? 'text-red-500' : 'text-amber-500'
          }`}
          fill={allUp ? '#10b981' : anyDown ? '#ef4444' : '#f59e0b'}
        />
        {/* Pulse animation */}
        {allUp && (
          <motion.div
            className="absolute inset-0 rounded-lg border-2 border-emerald-500/30"
            animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        )}
      </button>

      {/* Expanded Status Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 top-12 w-72 bg-[#1E293B] border border-slate-800 rounded-xl shadow-2xl z-50 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-white">System Health</h4>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                allUp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {allUp ? 'ALL SYSTEMS GO' : 'DEGRADED'}
              </span>
            </div>

            <div className="space-y-2">
              {services.map((svc, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-[#0F172A] rounded-lg">
                  <div className={`${svc.status === 'UP' ? 'text-emerald-500' : svc.status === 'DOWN' ? 'text-red-500' : 'text-slate-500'}`}>
                    {svc.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-300">{svc.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{svc.message}</div>
                  </div>
                  <div className={`h-2 w-2 rounded-full shrink-0 ${
                    svc.status === 'UP' ? 'bg-emerald-500' : svc.status === 'DOWN' ? 'bg-red-500' : 'bg-slate-600'
                  } ${svc.status === 'UP' ? 'animate-pulse' : ''}`} />
                </div>
              ))}
            </div>

            <button onClick={checkHealth} className="w-full mt-3 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 py-1.5 rounded-lg transition-colors">
              Recheck Now
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
