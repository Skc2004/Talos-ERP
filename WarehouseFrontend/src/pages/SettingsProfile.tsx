import React from 'react';
import { motion } from 'framer-motion';

export const SettingsProfile = ({ session, role }: any) => {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-6"
        >
            <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">System Profile</h2>
                <p className="text-slate-400">Manage your credentials and internal RBAC assignments.</p>
            </div>

            <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-medium text-slate-200 mb-4">Current Session</h3>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-[#0F172A] rounded-lg border border-slate-800">
                        <div className="text-sm text-slate-500 mb-1">Email / Identity</div>
                        <div className="font-medium text-slate-300">{session?.user?.email || 'N/A'}</div>
                    </div>
                    
                    <div className="p-4 bg-[#0F172A] rounded-lg border border-slate-800">
                        <div className="text-sm text-slate-500 mb-1">Assigned JWT Claim</div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-emerald-400 font-bold">{role || 'USER'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {role === 'SUPER_ADMIN' && (
                <div className="bg-[#1E293B] border border-slate-800 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-medium text-amber-500 mb-4">Super Admin: User Management</h3>
                    <p className="text-sm text-slate-400 mb-4">Because you are a Super Admin, you can manually override roles in the profiles table via the Python backend.</p>
                    
                    {/* Mock user list for demo */}
                    <div className="space-y-3">
                        {['worker1@talos.com', 'analyst@talos.com'].map(e => (
                            <div key={e} className="flex items-center justify-between p-3 bg-[#0F172A] rounded-lg border border-slate-800">
                                <span className="text-sm text-slate-300">{e}</span>
                                <select className="bg-slate-800 text-xs text-white border border-slate-700 rounded px-2 py-1 outline-none">
                                    <option>WAREHOUSE_OP</option>
                                    <option>PLANNER</option>
                                    <option>SUPER_ADMIN</option>
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </motion.div>
    );
};
