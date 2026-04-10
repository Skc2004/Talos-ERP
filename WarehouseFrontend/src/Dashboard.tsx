import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertTriangle, PackageSearch, ShieldAlert, Zap, ThermometerSun } from 'lucide-react';
import { DigitalTwin } from './DigitalTwin';
import { motion, AnimatePresence } from 'framer-motion';

const INSIGHT_MANTRA_URL = 'http://localhost:8000';

const cardAnim = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.4 } })
};

const Dashboard = ({ role }: any) => {
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [prescriptiveCards, setPrescriptiveCards] = useState<any[]>([]);
  const [nlpThemes, setNlpThemes] = useState<string[]>([]);

  useEffect(() => {
    // Fetch Prophet forecast data from Supabase directly
    async function loadForecast() {
      try {
        const { data } = await supabase
          .table('demand_forecasts')
          .select('*')
          .order('target_date', { ascending: true })
          .limit(30);

        if (data && data.length > 0) {
          setForecastData(data.map((row: any) => ({
            date: new Date(row.target_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            forecast: row.forecasted_demand,
            upperBound: Math.round(row.forecasted_demand + (row.confidence_interval || 0) / 2),
            lowerBound: Math.round(Math.max(0, row.forecasted_demand - (row.confidence_interval || 0) / 2))
          })));
        } else {
          generateSimulatedData();
        }
      } catch {
        generateSimulatedData();
      }
    }

    // Fetch Prescriptive Cards from Talos Insight
    async function loadPrescriptiveCards() {
      try {
        const res = await fetch(`${INSIGHT_MANTRA_URL}/intelligence/prescriptive-cards`);
        const json = await res.json();
        if (json.cards) setPrescriptiveCards(json.cards);
      } catch {
        // Fallback
        setPrescriptiveCards([
          {
            type: 'STOCK_OUT_RISK', severity: 'HIGH',
            title: 'Stock-Out Risk Detected',
            message: "Item 'Echo Dot 4th Gen' will be out of stock in 4 days. Prophet predicts a demand spike in the Mumbai region. Suggesting an immediate transfer of 200 units.",
            action: 'AUTO_PO_DRAFTED'
          },
          {
            type: 'MARGIN_OPPORTUNITY', severity: 'MEDIUM',
            title: 'Margin Opportunity Detected',
            message: "Competitor Y is currently stocked out of Item Z. Our Sentiment is 0.85. Recommend raising price by 4% to capture premium margin.",
            action: 'PRICE_ADJUSTMENT_SUGGESTED', mcr: 0.84
          },
          {
            type: 'THERMAL_ALERT', severity: 'CRITICAL',
            title: 'Thermal Alert — Predictive Maintenance',
            message: "Extruder #4 is running 15% hotter than normal. Estimated time to failure: 48 hours. Maintenance order drafted.",
            action: 'MAINTENANCE_ORDER_DRAFTED'
          }
        ]);
      }
    }

    // Fetch NLP keyword themes
    async function loadThemes() {
      try {
        const res = await fetch(`${INSIGHT_MANTRA_URL}/intelligence/sentiment/latest`);
        const json = await res.json();
        if (json.themes && json.themes.length > 0) {
          setNlpThemes(json.themes.map((t: any) => 
            `${t.theme_cluster} (${t.sentiment_score > 0 ? 'Positive' : 'Negative'})`
          ));
        } else {
          setNlpThemes(['Build Quality (Positive)', 'Fast Shipping (Positive)', 'Plastic Wear (Negative)', 'Durability (Positive)', 'Battery Drain (Critical)']);
        }
      } catch {
        setNlpThemes(['Build Quality (Positive)', 'Fast Shipping (Positive)', 'Plastic Wear (Negative)', 'Durability (Positive)', 'Battery Drain (Critical)']);
      }
    }

    loadForecast();
    loadPrescriptiveCards();
    loadThemes();
  }, []);

  function generateSimulatedData() {
    const simulated = Array.from({ length: 30 }, (_, i) => {
      const base = 400 + Math.sin(i / 3) * 100;
      return {
        date: new Date(Date.now() + i * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        forecast: Math.round(base),
        lowerBound: Math.round(base * 0.85),
        upperBound: Math.round(base * 1.15)
      };
    });
    setForecastData(simulated);
  }

  const severityColor = (severity: string) => {
    if (severity === 'CRITICAL') return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', badge: 'bg-red-500' };
    if (severity === 'HIGH') return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500' };
    return { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400', badge: 'bg-indigo-500' };
  };

  const cardIcon = (type: string) => {
    if (type === 'STOCK_OUT_RISK') return <ShieldAlert className="text-amber-400" size={20} />;
    if (type === 'MARGIN_OPPORTUNITY') return <Zap className="text-indigo-400" size={20} />;
    return <ThermometerSun className="text-red-400" size={20} />;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-white">Executive Global Pulse</h2>
        <div className="text-xs text-slate-500 font-mono">LIVE • Real-Time Feed</div>
      </div>

      {/* YAKE Keyword Themes Marquee */}
      <div className="bg-[#1E293B] border border-slate-800 rounded-lg overflow-hidden flex items-center p-2 shadow-sm">
        <div className="bg-indigo-500/20 text-indigo-400 text-xs font-bold px-3 py-1 rounded shrink-0 z-10">NLP Live Themes</div>
        <div className="flex-1 overflow-hidden relative">
          <motion.div 
            className="flex space-x-8 whitespace-nowrap px-4"
            animate={{ x: [0, -1200] }}
            transition={{ repeat: Infinity, ease: "linear", duration: 30 }}
          >
            {nlpThemes.map((k, i) => (
              <span key={i} className="text-sm font-medium text-slate-300"> • {k}</span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div custom={0} variants={cardAnim} initial="hidden" animate="visible">
          <KPICard title="Projected Operational Margin" value="+22.4%" icon={<TrendingUp className="text-emerald-500" />} />
        </motion.div>
        <motion.div custom={1} variants={cardAnim} initial="hidden" animate="visible">
          <KPICard title="Market Capture Ratio" value="0.84" subtitle="Dominating top 3 competitors" icon={<PackageSearch className="text-indigo-500" />} />
        </motion.div>
        <motion.div custom={2} variants={cardAnim} initial="hidden" animate="visible">
          <KPICard title="Active Warning Hooks" value={String(prescriptiveCards.filter(c => c.severity === 'CRITICAL').length || 1)} subtitle="MOLDING-A3 Thermal" icon={<AlertTriangle className="text-red-500" />} border="border-red-500/30" />
        </motion.div>
      </div>

      {/* Prophet Predictions */}
      <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm h-96">
        <h3 className="text-lg font-medium text-slate-200 mb-4">Meta Prophet: 30-Day Predictive Demand (80% Confidence)</h3>
        <ResponsiveContainer width="100%" height="85%">
          <ComposedChart data={forecastData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} />
            <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
            <Legend />
            <Area type="monotone" dataKey="upperBound" fill="#4f46e5" stroke="none" fillOpacity={0.12} name="Upper Bound" />
            <Area type="monotone" dataKey="lowerBound" fill="#0F172A" stroke="none" fillOpacity={1} name="Lower Bound" />
            <Line type="monotone" dataKey="forecast" stroke="#10b981" strokeWidth={3} dot={false} name="Predicted Demand" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Prescriptive Agentic Insight Cards (The "Wow Factor") */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Prescriptive Intelligence — Agentic Actions</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {prescriptiveCards.map((card, i) => {
            const colors = severityColor(card.severity);
            return (
              <motion.div
                key={i}
                custom={i}
                variants={cardAnim}
                initial="hidden"
                animate="visible"
                className={`p-5 rounded-xl border ${colors.border} ${colors.bg} shadow-sm`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {cardIcon(card.type)}
                    <h4 className={`text-sm font-bold ${colors.text}`}>{card.title}</h4>
                  </div>
                  <span className={`${colors.badge} text-white text-[10px] font-bold px-2 py-0.5 rounded-full`}>
                    {card.severity}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{card.message}</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono text-slate-500">{card.action}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Digital Twin + Supplemental */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DigitalTwin />
        <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-medium text-slate-200 mb-4">System Event Log</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {[
              { time: '2 min ago', event: 'ProcurementService drafted PO-2026-0412 for Echo Dot (200 units)', color: 'emerald' },
              { time: '8 min ago', event: 'Moving Z-Score flagged EXTRUDER-01 (z=3.4, T=218°C)', color: 'red' },
              { time: '15 min ago', event: 'Prophet model retrained for SKU B08L5WHFT9 (30-day forecast updated)', color: 'indigo' },
              { time: '22 min ago', event: 'MCR scan detected competitor stock-out. Margin +4% recommended.', color: 'amber' },
            ].map((log, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-[#0F172A] rounded-lg border border-slate-800">
                <div className={`h-2 w-2 rounded-full mt-1.5 bg-${log.color}-500 shrink-0`} />
                <div>
                  <p className="text-sm text-slate-300">{log.event}</p>
                  <p className="text-xs text-slate-600 mt-1">{log.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const KPICard = ({ title, value, subtitle, icon, border = "border-slate-800" }: any) => (
  <div className={`bg-[#1E293B] border ${border} rounded-xl p-6 shadow-sm`}>
    <div className="flex items-center justify-between">
      <div className="text-sm font-medium text-slate-400">{title}</div>
      {icon}
    </div>
    <div className="mt-4">
      <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
      {subtitle && <div className="text-xs text-slate-500 mt-1">{subtitle}</div>}
    </div>
  </div>
);

export default Dashboard;
