import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Thermometer, Activity, X, Wrench } from 'lucide-react';

interface MachineData {
  temp: number;
  vibration: number;
  status: string;
  lastUpdate: string;
}

const MACHINE_LAYOUT = [
  { id: 'EXTRUDER-01', x: 15, y: 25, label: 'Extruder #1', icon: '⚙️' },
  { id: 'MOLDING-A3', x: 50, y: 50, label: 'Molding A3', icon: '🔩' },
  { id: 'PACKAGING-LINE-2', x: 82, y: 72, label: 'Packaging #2', icon: '📦' },
];

// SVG conveyor path between machines
const CONVEYOR_PATHS = [
  'M 15 30 C 30 30, 35 50, 50 50',
  'M 55 55 C 65 55, 70 70, 82 72',
];

export const DigitalTwin = () => {
  const [machines, setMachines] = useState<Record<string, MachineData>>({
    'EXTRUDER-01': { temp: 195, vibration: 52.3, status: 'NOMINAL', lastUpdate: 'Just now' },
    'MOLDING-A3': { temp: 182, vibration: 48.1, status: 'NOMINAL', lastUpdate: 'Just now' },
    'PACKAGING-LINE-2': { temp: 85, vibration: 44.7, status: 'NOMINAL', lastUpdate: 'Just now' },
  });
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    async function fetchLatest() {
        const machineIds = ["EXTRUDER-01", "MOLDING-A3", "PACKAGING-LINE-2"];
        const updates: any = {};
        for (const mid of machineIds) {
            const { data } = await supabase
                .from('iot_telemetry')
                .select('*')
                .eq('machine_id', mid)
                .order('recorded_at', { ascending: false })
                .limit(1);
            if (data && data.length > 0) {
                updates[mid] = {
                    temp: parseFloat(data[0].temp_celsius),
                    status: data[0].status,
                    vibration: parseFloat(data[0].vibration_hz || 0),
                    lastUpdate: new Date(data[0].recorded_at).toLocaleTimeString()
                };
            }
        }
        if (Object.keys(updates).length > 0) {
            setMachines(prev => ({ ...prev, ...updates }));
        }
    }
    fetchLatest();

    const channel = supabase.channel('iot-telemetry-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'iot_telemetry' }, payload => {
        const node = payload.new as any;
        const isAnomaly = node.status === 'ANOMALY_DETECTED' || node.temp_celsius > 210;
        
        setMachines(prev => ({
          ...prev,
          [node.machine_id]: {
            temp: node.temp_celsius,
            vibration: node.vibration_hz,
            status: node.status,
            lastUpdate: new Date().toLocaleTimeString(),
          }
        }));

        if (isAnomaly) {
          setAlerts(prev => [`🚨 ${node.machine_id}: ${node.temp_celsius.toFixed(1)}°C (${node.status})`, ...prev.slice(0, 4)]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="bg-[#1E293B] border border-slate-800 p-6 rounded-2xl shadow-lg relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Activity size={18} className="text-emerald-400" />
          Digital Twin — Live Factory Floor
        </h3>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono text-slate-500">REALTIME</span>
        </div>
      </div>

      {/* SVG Factory Floor */}
      <div className="relative w-full h-72 bg-[#0F172A] rounded-xl border border-slate-700 overflow-hidden">
        {/* Grid */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" strokeWidth="0.5" />
            </pattern>
            {/* Animated conveyor dash */}
            <linearGradient id="conveyorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Conveyor Belt Paths */}
          {CONVEYOR_PATHS.map((d, i) => (
            <g key={i}>
              <path d={d} fill="none" stroke="#334155" strokeWidth="3" strokeLinecap="round"
                    style={{ transform: 'scale(1%,1%)', transformOrigin: 'center' }} />
              <path d={d} fill="none" stroke="url(#conveyorGrad)" strokeWidth="2" strokeLinecap="round"
                    strokeDasharray="8 12">
                <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="2s" repeatCount="indefinite" />
              </path>
            </g>
          ))}

          {/* Zone Labels */}
          <text x="10%" y="12%" fill="#475569" fontSize="10" fontFamily="monospace">ZONE A — Extrusion</text>
          <text x="40%" y="38%" fill="#475569" fontSize="10" fontFamily="monospace">ZONE B — Molding</text>
          <text x="68%" y="62%" fill="#475569" fontSize="10" fontFamily="monospace">ZONE C — Packaging</text>
        </svg>

        {/* Machine Nodes */}
        {MACHINE_LAYOUT.map(m => {
          const data = machines[m.id] || { temp: 0, vibration: 0, status: 'OFFLINE', lastUpdate: '-' };
          const isAnomaly = data.status === 'ANOMALY_DETECTED' || data.temp > 210;
          const isWarning = data.temp > 200 && !isAnomaly;

          return (
            <motion.div
              key={m.id}
              className="absolute cursor-pointer group"
              style={{ left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%, -50%)' }}
              whileHover={{ scale: 1.1 }}
              onClick={() => setSelectedMachine(selectedMachine === m.id ? null : m.id)}
            >
              {/* Glow ring for anomaly */}
              {isAnomaly && (
                <div className="absolute inset-0 w-16 h-16 -m-2 rounded-xl bg-red-500/20 animate-ping" />
              )}

              <div className={`w-14 h-14 rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-300 ${
                isAnomaly ? 'bg-red-500/30 border-red-400 shadow-[0_0_25px_rgba(239,68,68,0.5)]' :
                isWarning ? 'bg-amber-500/20 border-amber-400' :
                'bg-emerald-500/20 border-emerald-500/50 group-hover:border-emerald-400'
              }`}>
                <span className="text-lg">{m.icon}</span>
                <span className={`text-[10px] font-bold ${isAnomaly ? 'text-red-300' : 'text-emerald-300'}`}>
                  {data.temp.toFixed(0)}°
                </span>
              </div>

              {/* Label */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-[9px] font-mono text-slate-500 bg-[#0F172A]/80 px-1.5 py-0.5 rounded">
                  {m.id}
                </span>
              </div>

              {/* Live vibration indicator */}
              <div className="absolute -top-2 -right-2">
                <div className={`text-[8px] font-bold px-1 rounded ${
                  data.vibration > 58 ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-400'
                }`}>
                  {data.vibration.toFixed(0)}Hz
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedMachine && machines[selectedMachine] && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 bg-[#0F172A] border border-slate-800 rounded-xl p-4 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Wrench size={14} className="text-indigo-400" />
                {selectedMachine} — Live Diagnostics
              </h4>
              <button onClick={() => setSelectedMachine(null)} className="text-slate-500 hover:text-slate-300">
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              <MiniStat label="Temperature" value={`${machines[selectedMachine].temp.toFixed(1)}°C`}
                        color={machines[selectedMachine].temp > 210 ? 'text-red-400' : 'text-emerald-400'} />
              <MiniStat label="Vibration" value={`${machines[selectedMachine].vibration.toFixed(1)} Hz`}
                        color={machines[selectedMachine].vibration > 58 ? 'text-amber-400' : 'text-emerald-400'} />
              <MiniStat label="Status" value={machines[selectedMachine].status.replace('_', ' ')}
                        color={machines[selectedMachine].status === 'NOMINAL' ? 'text-emerald-400' : 'text-red-400'} />
              <MiniStat label="Last Update" value={machines[selectedMachine].lastUpdate} color="text-slate-400" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert Feed */}
      {alerts.length > 0 && (
        <div className="mt-3 space-y-1">
          {alerts.map((a, i) => (
            <motion.div key={i} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-1.5 font-mono">
              {a}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

const MiniStat = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <div className="bg-slate-800/50 rounded-lg p-2">
    <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
    <div className={`text-sm font-bold mt-1 ${color}`}>{value}</div>
  </div>
);
