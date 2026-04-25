import React from 'react';
import { motion } from 'framer-motion';
import { WarehouseMap } from '../components/WarehouseMap';
import { MapPin } from 'lucide-react';

export const WarehouseMapPage = () => {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <MapPin className="text-indigo-400" /> Warehouse Network
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Real-time capacity and stock distribution across all warehouse locations.
          Hover nodes to inspect details. Flow lines show active rebalancer routes.
        </p>
      </div>
      <WarehouseMap />
    </motion.div>
  );
};
