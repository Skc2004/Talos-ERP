import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, UserPlus, Search, X, Plus, Trash2, Globe, Users, Phone, Mail, Briefcase, Edit2 } from 'lucide-react';

const JAVA_API = import.meta.env.VITE_JAVA_API_URL || 'http://localhost:8080/api/v1';
const SIZES = ['STARTUP','SMB','MID_MARKET','ENTERPRISE'];
const SIZE_LABELS: Record<string,string> = { STARTUP:'Startup', SMB:'SMB', MID_MARKET:'Mid-Market', ENTERPRISE:'Enterprise' };
const SIZE_COLORS: Record<string,string> = { STARTUP:'text-blue-400', SMB:'text-emerald-400', MID_MARKET:'text-amber-400', ENTERPRISE:'text-purple-400' };

export const ContactsDirectory = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newCompany, setNewCompany] = useState({ name:'', industry:'', size:'SMB', website:'', notes:'' });
  const [newContact, setNewContact] = useState({ name:'', email:'', phone:'', designation:'', companyId:'', notes:'' });

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [cRes, ctRes] = await Promise.all([fetch(`${JAVA_API}/contacts/companies`), fetch(`${JAVA_API}/contacts`)]);
      const c = await cRes.json(); const ct = await ctRes.json();
      setCompanies(Array.isArray(c)?c:[]); setContacts(Array.isArray(ct)?ct:[]);
    } catch { setCompanies([]); setContacts([]); }
  }

  async function handleAddCompany() {
    await fetch(`${JAVA_API}/contacts/companies`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newCompany) });
    setNewCompany({ name:'', industry:'', size:'SMB', website:'', notes:'' }); setShowAddCompany(false); loadAll();
  }
  async function handleAddContact() {
    await fetch(`${JAVA_API}/contacts`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(newContact) });
    setNewContact({ name:'', email:'', phone:'', designation:'', companyId:'', notes:'' }); setShowAddContact(false); loadAll();
  }
  async function deleteCompany(id:string) { if(!confirm('Delete company?')) return; await fetch(`${JAVA_API}/contacts/companies/${id}`,{method:'DELETE'}); loadAll(); }
  async function deleteContact(id:string) { if(!confirm('Delete contact?')) return; await fetch(`${JAVA_API}/contacts/${id}`,{method:'DELETE'}); loadAll(); }

  const filtered = search ? contacts.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase()) || c.designation?.toLowerCase().includes(search.toLowerCase())) : contacts;
  const companyContacts = selectedCompany ? contacts.filter(c => c.companyId === selectedCompany.id) : [];

  return (
    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2"><Building2 className="text-indigo-400"/>Contacts & Companies</h2>
          <p className="text-sm text-slate-400 mt-1">Centralized directory for all business relationships.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>setShowAddCompany(true)} className="flex items-center gap-2 bg-[#1E293B] hover:bg-slate-800 text-indigo-400 border border-slate-700 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"><Building2 size={16}/>Add Company</button>
          <button onClick={()=>setShowAddContact(true)} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-lg"><UserPlus size={16}/>Add Contact</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Companies List */}
        <div className="bg-[#1E293B] border border-slate-800 rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-800"><h3 className="text-sm font-bold text-slate-300 flex items-center gap-2"><Building2 size={16}/>Companies ({companies.length})</h3></div>
          <div className="p-2 max-h-[60vh] overflow-y-auto space-y-1">
            {companies.map(c => (
              <div key={c.id} onClick={()=>setSelectedCompany(selectedCompany?.id===c.id?null:c)} className={`p-3 rounded-lg cursor-pointer transition-colors group flex items-center justify-between ${selectedCompany?.id===c.id?'bg-indigo-500/10 border border-indigo-500/30':'hover:bg-slate-800 border border-transparent'}`}>
                <div>
                  <div className="text-sm font-medium text-white">{c.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {c.industry && <span className="text-[10px] text-slate-500">{c.industry}</span>}
                    {c.size && <span className={`text-[10px] font-bold ${SIZE_COLORS[c.size]||'text-slate-500'}`}>{SIZE_LABELS[c.size]||c.size}</span>}
                  </div>
                </div>
                <button onClick={e=>{e.stopPropagation();deleteCompany(c.id)}} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-red-400 rounded transition-all"><Trash2 size={12}/></button>
              </div>
            ))}
            {companies.length===0 && <p className="text-sm text-slate-500 text-center py-8">No companies yet.</p>}
          </div>
        </div>

        {/* Contacts Table */}
        <div className="lg:col-span-2 bg-[#1E293B] border border-slate-800 rounded-xl shadow-sm">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300">{selectedCompany ? `Contacts at ${selectedCompany.name}` : `All Contacts (${filtered.length})`}</h3>
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contacts..." className="w-full bg-[#0F172A] border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500"/>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[55vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0F172A] sticky top-0">
                <tr className="text-slate-500 text-xs uppercase tracking-wider">
                  <th className="p-3 text-left">Name</th><th className="p-3 text-left">Email</th><th className="p-3 text-left">Phone</th><th className="p-3 text-left">Role</th><th className="p-3 text-left">Company</th><th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(selectedCompany ? companyContacts : filtered).map(ct => {
                  const comp = companies.find(c=>c.id===ct.companyId);
                  return (
                    <tr key={ct.id} className="hover:bg-[#0F172A]/50 transition-colors">
                      <td className="p-3 text-white font-medium">{ct.name}</td>
                      <td className="p-3"><span className="text-slate-400 flex items-center gap-1"><Mail size={12}/>{ct.email||'—'}</span></td>
                      <td className="p-3"><span className="text-slate-400 flex items-center gap-1"><Phone size={12}/>{ct.phone||'—'}</span></td>
                      <td className="p-3 text-slate-400">{ct.designation||'—'}</td>
                      <td className="p-3 text-indigo-400 text-xs font-bold">{comp?.name||'—'}</td>
                      <td className="p-3"><button onClick={()=>deleteContact(ct.id)} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"><Trash2 size={14}/></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(selectedCompany?companyContacts:filtered).length===0 && <p className="text-sm text-slate-500 text-center py-8">No contacts found.</p>}
          </div>
        </div>
      </div>

      {/* Add Company Modal */}
      <AnimatePresence>
        {showAddCompany && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={()=>setShowAddCompany(false)}>
            <motion.div initial={{scale:0.9}} animate={{scale:1}} className="bg-[#1E293B] border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-white">Add Company</h3><button onClick={()=>setShowAddCompany(false)} className="text-slate-500 hover:text-white"><X size={20}/></button></div>
              <div className="space-y-3">
                <input placeholder="Company Name *" value={newCompany.name} onChange={e=>setNewCompany({...newCompany,name:e.target.value})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"/>
                <input placeholder="Industry (e.g. Manufacturing)" value={newCompany.industry} onChange={e=>setNewCompany({...newCompany,industry:e.target.value})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"/>
                <select value={newCompany.size} onChange={e=>setNewCompany({...newCompany,size:e.target.value})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none">{SIZES.map(s=><option key={s} value={s}>{SIZE_LABELS[s]}</option>)}</select>
                <input placeholder="Website" value={newCompany.website} onChange={e=>setNewCompany({...newCompany,website:e.target.value})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500"/>
                <button onClick={handleAddCompany} disabled={!newCompany.name} className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition-colors">Create Company</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Contact Modal */}
      <AnimatePresence>
        {showAddContact && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={()=>setShowAddContact(false)}>
            <motion.div initial={{scale:0.9}} animate={{scale:1}} className="bg-[#1E293B] border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e=>e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-bold text-white">Add Contact</h3><button onClick={()=>setShowAddContact(false)} className="text-slate-500 hover:text-white"><X size={20}/></button></div>
              <div className="space-y-3">
                <input placeholder="Full Name *" value={newContact.name} onChange={e=>setNewContact({...newContact,name:e.target.value})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500"/>
                <input placeholder="Email" value={newContact.email} onChange={e=>setNewContact({...newContact,email:e.target.value})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500"/>
                <input placeholder="Phone" value={newContact.phone} onChange={e=>setNewContact({...newContact,phone:e.target.value})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500"/>
                <input placeholder="Designation / Role" value={newContact.designation} onChange={e=>setNewContact({...newContact,designation:e.target.value})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-emerald-500"/>
                <select value={newContact.companyId} onChange={e=>setNewContact({...newContact,companyId:e.target.value})} className="w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none">
                  <option value="">— No Company —</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={handleAddContact} disabled={!newContact.name} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition-colors">Create Contact</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
