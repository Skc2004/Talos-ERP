import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-32">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-neutral-800 flex items-center gap-3">
          <Search className="text-neutral-400" size={20} />
          <input
            autoFocus
            className="w-full bg-transparent outline-none text-white text-lg placeholder:text-neutral-500"
            placeholder="Type a command or search SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {search.includes('Mumbai') && (
            <button className="w-full text-left p-3 hover:bg-emerald-900/40 hover:text-emerald-400 text-neutral-300 rounded-lg">
              Check Forecast: Mumbai Center
            </button>
          )}
          <button onClick={() => setOpen(false)} className="w-full text-left p-3 hover:bg-neutral-800 text-neutral-300 rounded-lg">
            Action: Refill Steel Bolts (SKU: STB-882)
          </button>
          <button onClick={() => setOpen(false)} className="w-full text-left p-3 hover:bg-neutral-800 text-neutral-300 rounded-lg">
            Jump to: FICO Ledger
          </button>
        </div>
      </div>
    </div>
  );
};
