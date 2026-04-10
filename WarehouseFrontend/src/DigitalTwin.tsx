import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export const DigitalTwin = () => {
    const [machines, setMachines] = useState<{ [id: string]: { temp: number, status: string }}>({
        "EXTRUDER-01": { temp: 195, status: 'NOMINAL' },
        "MOLDING-A3": { temp: 182, status: 'NOMINAL' },
        "PACKAGING-LINE-2": { temp: 85, status: 'NOMINAL' }
    });

    useEffect(() => {
        const stream = supabase.channel('public:iot_telemetry')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'iot_telemetry' }, payload => {
                const node = payload.new;
                setMachines(prev => ({
                    ...prev,
                    [node.machine_id]: { temp: node.temp_celsius, status: node.status }
                }));
            }).subscribe();

        return () => { supabase.removeChannel(stream); };
    }, []);

    return (
        <div className="bg-neutral-900 border border-neutral-700 p-6 rounded-2xl shadow-lg mt-8 relative">
            <h3 className="text-lg font-semibold text-white mb-4">Digital Twin (Live 2D Map)</h3>
            <div className="relative w-full h-64 bg-neutral-800 rounded-xl border border-neutral-600 overflow-hidden">
                {/* Visual Floor Plan Grid Pattern */}
                <div className="absolute inset-0" style={{ backgroundSize: '40px 40px', backgroundImage: 'linear-gradient(to right, #374151 1px, transparent 1px), linear-gradient(to bottom, #374151 1px, transparent 1px)', opacity: 0.2 }}></div>
                
                {/* Machine Nodes */}
                <MachineNode id="EXTRUDER-01" data={machines["EXTRUDER-01"]} top="20%" left="15%" />
                <MachineNode id="MOLDING-A3" data={machines["MOLDING-A3"]} top="50%" left="45%" />
                <MachineNode id="PACKAGING-LINE-2" data={machines["PACKAGING-LINE-2"]} top="70%" left="80%" />
            </div>
        </div>
    );
};

const MachineNode = ({ id, data, top, left }) => {
    const isAnomaly = data.status === 'ANOMALY_DETECTED' || data.temp > 210;
    
    return (
        <div className="absolute flex flex-col items-center" style={{ top, left, transform: 'translate(-50%, -50%)' }}>
            <div className={`w-12 h-12 rounded-lg border-2 ${isAnomaly ? 'bg-red-500 animate-pulse border-red-300 shadow-[0_0_20px_rgba(239,68,68,0.8)]' : 'bg-emerald-600 border-emerald-400'} flex items-center justify-center transition-colors duration-300`}>
                <span className="text-white text-[10px] font-bold">{data.temp.toFixed(0)}°</span>
            </div>
            <div className="mt-2 text-xs bg-neutral-900/80 px-2 py-1 rounded-md text-neutral-300 whitespace-nowrap border border-neutral-700">
                {id}
            </div>
        </div>
    );
};
