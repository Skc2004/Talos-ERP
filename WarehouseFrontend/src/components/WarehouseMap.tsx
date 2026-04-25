import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ArrowRightLeft } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const JAVA_API = 'http://localhost:8080';

interface WarehouseNode {
  code: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  maxCapacity: number;
  warehouseType: string;
  currentStock: number;
  utilization: number;
  status: string;
}

// Rebalance routes between warehouses
const REBALANCE_ROUTES = [
  { from: 'WAREHOUSE-A', to: 'WAREHOUSE-E', label: 'MUM→PUN' },
  { from: 'WAREHOUSE-B', to: 'WAREHOUSE-C', label: 'DEL→BLR' },
  { from: 'WAREHOUSE-A', to: 'WAREHOUSE-D', label: 'MUM→CHN' },
  { from: 'WAREHOUSE-B', to: 'WAREHOUSE-A', label: 'DEL→MUM' },
  { from: 'WAREHOUSE-C', to: 'WAREHOUSE-D', label: 'BLR→CHN' },
];

const statusColors: Record<string, { fill: string; stroke: string; pulse: string; text: string }> = {
  CRITICAL:      { fill: '#ef4444', stroke: '#dc2626', pulse: '#ef444480', text: 'text-red-400' },
  HIGH:          { fill: '#f59e0b', stroke: '#d97706', pulse: '#f59e0b80', text: 'text-amber-400' },
  OPTIMAL:       { fill: '#10b981', stroke: '#059669', pulse: '#10b98180', text: 'text-emerald-400' },
  LOW:           { fill: '#6366f1', stroke: '#4f46e5', pulse: '#6366f180', text: 'text-indigo-400' },
  UNDERUTILIZED: { fill: '#64748b', stroke: '#475569', pulse: '#64748b80', text: 'text-slate-400' },
};

// Create an SVG-based DivIcon dynamically for each warehouse
const buildCustomIcon = (wh: WarehouseNode) => {
  const colors = statusColors[wh.status] || statusColors.OPTIMAL;
  const nodeRadius = 14; 
  const pulseRadius = 14 + (wh.utilization / 100) * 10;
  const size = (pulseRadius + 15) * 2;
  const center = size / 2;

  const html = `
    <div style="position: relative; width: ${size}px; height: ${size}px; transform: translate(-50%, -50%);">
      
      <!-- Utilization badge floating top right -->
      <div style="position: absolute; top: ${center - 22}px; right: ${center - 30}px; background: ${colors.fill}; border: 1px solid ${colors.stroke}; color: white; font-size: 10px; font-weight: 800; padding: 2px 5px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5); z-index: 200;">
        ${Math.round(wh.utilization)}%
      </div>

      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <!-- Pulsing Ring -->
        <circle cx="${center}" cy="${center}" r="${pulseRadius}" fill="none"
          stroke="${colors.pulse}" stroke-width="2" opacity="0.5">
          <animate attributeName="r" values="${pulseRadius};${pulseRadius + 10};${pulseRadius}" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
        
        <!-- Solid Base Circle -->
        <circle cx="${center}" cy="${center}" r="${nodeRadius}"
          fill="#0F172A" stroke="${colors.fill}" stroke-width="2.5" opacity="1" />
        
        <!-- Lucide Store Icon -->
        <g transform="translate(${center - 10}, ${center - 10})" stroke="white" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/>
          <path d="M2 7h20"/>
          <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/>
        </g>
      </svg>
      
      <div style="position: absolute; width: 150px; left: 50%; bottom: 0px; transform: translateX(-50%); text-align: center; color: #1e293b; font-size: 11px; font-weight: 800; text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff; z-index: 100;">
        ${wh.city}
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-warehouse-icon',
    iconSize: [0, 0] // we center it via CSS above
  });
};

export const WarehouseMap = () => {
  const [warehouses, setWarehouses] = useState<WarehouseNode[]>([]);
  const [hovered, setHovered] = useState<WarehouseNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWarehouses();
    const interval = setInterval(fetchWarehouses, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, []);

  async function fetchWarehouses() {
    try {
      const res = await fetch(`${JAVA_API}/api/v1/warehouses/status`);
      const data = await res.json();
      setWarehouses(data);
    } catch {
      // Fallback data if Java is offline
      setWarehouses([
        { code:'WAREHOUSE-A', name:'Mumbai Central Hub', city:'Mumbai', state:'Maharashtra', latitude:19.076, longitude:72.877, maxCapacity:5000, warehouseType:'CENTRAL_HUB', currentStock:2800, utilization:56.0, status:'OPTIMAL' },
        { code:'WAREHOUSE-B', name:'Delhi NCR Distribution', city:'Delhi', state:'Delhi NCR', latitude:28.614, longitude:77.209, maxCapacity:8000, warehouseType:'DISTRIBUTION_CENTER', currentStock:6200, utilization:77.5, status:'HIGH' },
        { code:'WAREHOUSE-C', name:'Bangalore Tech Park', city:'Bangalore', state:'Karnataka', latitude:12.972, longitude:77.595, maxCapacity:3500, warehouseType:'FULFILLMENT_CENTER', currentStock:1400, utilization:40.0, status:'OPTIMAL' },
        { code:'WAREHOUSE-D', name:'Chennai Port Facility', city:'Chennai', state:'Tamil Nadu', latitude:13.083, longitude:80.271, maxCapacity:4000, warehouseType:'PORT_FACILITY', currentStock:3600, utilization:90.0, status:'CRITICAL' },
        { code:'WAREHOUSE-E', name:'Pune Manufacturing', city:'Pune', state:'Maharashtra', latitude:18.520, longitude:73.857, maxCapacity:2500, warehouseType:'MANUFACTURING', currentStock:800, utilization:32.0, status:'LOW' },
      ]);
    }
  }

  const whMap: Record<string, WarehouseNode> = {};
  warehouses.forEach(wh => { whMap[wh.code] = wh; });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  return (
    <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="text-indigo-400" size={20} />
          <h3 className="text-lg font-medium text-slate-200">Warehouse Network — Live Geospatial Map</h3>
        </div>
        <div className="flex items-center gap-4">
          {Object.entries(statusColors).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: val.fill }} />
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">{key}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Real World Map Container */}
        <div ref={containerRef} className="lg:col-span-3 relative rounded-xl border border-slate-800 overflow-hidden" style={{ minHeight: '400px' }} onMouseMove={handleMouseMove}>
          
          <MapContainer 
            center={[22.5, 78.5]} 
            zoom={4} 
            scrollWheelZoom={false}
            style={{ width: '100%', height: '100%', backgroundColor: '#0f172a' }}
            attributionControl={false}
          >
            {/* Using CartoDB Dark Matter base map for a sleek, dark professional erp look */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            
            {/* Rebalancer Routing Lines */}
            {REBALANCE_ROUTES.map((route, i) => {
              const from = whMap[route.from];
              const to = whMap[route.to];
              if (!from || !to) return null;
              
              return (
                <Polyline 
                  key={`route-${i}`} 
                  positions={[
                    [from.latitude, from.longitude],
                    [to.latitude, to.longitude]
                  ]}
                  pathOptions={{ color: '#6366f1', weight: 2, dashArray: '5, 8', opacity: 0.6 }}
                />
              );
            })}

            {/* Warehouse Markers */}
            {warehouses.map((wh) => (
              <Marker 
                key={wh.code}
                position={[wh.latitude, wh.longitude]}
                icon={buildCustomIcon(wh)}
                eventHandlers={{
                  mouseover: () => setHovered(wh),
                  mouseout: () => setHovered(null),
                }}
              />
            ))}
          </MapContainer>

          {/* Hover Tooltip Overlay (using framer-motion directly over the map) */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute z-[1000] bg-[#1E293B] border border-slate-700 rounded-xl p-4 shadow-2xl pointer-events-none"
                style={{
                  left: Math.min(tooltipPos.x + 16, (containerRef.current?.offsetWidth || 400) - 260),
                  top: Math.min(tooltipPos.y - 20, (containerRef.current?.offsetHeight || 400) - 200),
                  width: '240px'
                }}
              >
                <div className="text-sm font-bold text-white mb-1">{hovered.name}</div>
                <div className="text-[11px] text-slate-500 mb-3">{hovered.city}, {hovered.state} — {hovered.warehouseType.replace(/_/g, ' ')}</div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Current Stock</span>
                    <span className="text-sm font-bold text-white">{hovered.currentStock.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Max Capacity</span>
                    <span className="text-sm text-slate-300">{hovered.maxCapacity.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Utilization</span>
                    <span className={`text-sm font-bold ${(statusColors[hovered.status] || statusColors.OPTIMAL).text}`}>
                      {hovered.utilization}%
                    </span>
                  </div>
                  
                  {/* Capacity Bar */}
                  <div className="w-full h-2 bg-[#0F172A] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(hovered.utilization, 100)}%`,
                        background: (statusColors[hovered.status] || statusColors.OPTIMAL).fill
                      }} />
                  </div>
                  
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                    <span className="text-xs text-slate-400">Status</span>
                    <span className={`text-xs font-bold uppercase tracking-wide ${(statusColors[hovered.status] || statusColors.OPTIMAL).text}`}>
                      {hovered.status}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right panel: warehouse cards */}
        <div className="lg:col-span-2 space-y-2 max-h-[400px] overflow-y-auto">
          {warehouses.map((wh) => {
            const colors = statusColors[wh.status] || statusColors.OPTIMAL;
            return (
              <div key={wh.code}
                className={`bg-[#0F172A] border rounded-lg p-3 transition-all ${
                  hovered?.code === wh.code ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 hover:border-slate-700'
                }`}
                onMouseEnter={() => setHovered(wh)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-bold text-white">{wh.city}</div>
                    <div className="text-[10px] text-slate-600">{wh.code}</div>
                  </div>
                  <div className={`text-xs font-bold px-2 py-0.5 rounded-full border ${colors.text}`}
                    style={{ borderColor: colors.stroke, background: colors.fill + '15' }}>
                    {wh.status}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Stock: </span>
                    <span className="text-white font-bold">{wh.currentStock.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Cap: </span>
                    <span className="text-slate-300">{wh.maxCapacity.toLocaleString()}</span>
                  </div>
                  <div className="ml-auto">
                    <span className={`font-bold ${colors.text}`}>{wh.utilization}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${Math.min(wh.utilization, 100)}%`,
                    background: colors.fill
                  }} />
                </div>
              </div>
            );
          })}

          {/* Rebalancer legend */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-lg p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <ArrowRightLeft className="text-indigo-400" size={14} />
              <span className="text-xs font-bold text-slate-400">Rebalancer Routes</span>
            </div>
            <div className="space-y-1">
              {REBALANCE_ROUTES.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] text-slate-600">
                  <div className="h-0.5 w-4 bg-indigo-500/40 rounded" />
                  <span>{r.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
