import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCheck, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: any; cls: string; dot: string }> = {
  INFO:     { icon: Info,          cls: 'text-slate-300',  dot: 'bg-slate-400' },
  WARNING:  { icon: AlertTriangle, cls: 'text-amber-300',  dot: 'bg-amber-400' },
  CRITICAL: { icon: XCircle,       cls: 'text-red-300',    dot: 'bg-red-400' },
  SUCCESS:  { icon: CheckCircle,   cls: 'text-emerald-300',dot: 'bg-emerald-400' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export const NotificationCentre = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
    const channel = supabase.channel('notifications_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        setNotifications(prev => [payload.new, ...prev.slice(0, 19)]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function loadNotifications() {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20);
    if (data) setNotifications(data);
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button onClick={() => setOpen(o => !o)}
        className={`relative p-2 rounded-xl transition-colors ${open ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
        <Bell size={18}/>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 animate-pulse">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }} transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-[#0F172A]">
              <span className="text-sm font-bold text-white">Notifications</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  <CheckCheck size={13}/> Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-10">
                  <Bell size={24} className="mx-auto mb-2 text-slate-700"/>
                  <p className="text-sm text-slate-500">All caught up! 🎉</p>
                </div>
              ) : (
                notifications.map(n => {
                  const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.INFO;
                  const Icon = cfg.icon;
                  return (
                    <button key={n.id} onClick={() => { markRead(n.id); }}
                      className={`w-full flex items-start gap-3 p-4 text-left border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${!n.is_read ? 'bg-indigo-500/5' : ''}`}>
                      <Icon size={16} className={`${cfg.cls} shrink-0 mt-0.5`}/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold ${cfg.cls} truncate`}>{n.title}</span>
                          {!n.is_read && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`}/>}
                        </div>
                        {n.message && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>}
                        <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
