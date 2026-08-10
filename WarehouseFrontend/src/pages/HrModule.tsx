import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { 
  Users, UserPlus, DollarSign, Clock, Building, 
  Search, X, Briefcase, Mail, CheckCircle2, XCircle, Calendar, Plus, BarChart3, Activity
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Legend, Tooltip as RechartsTooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer 
} from 'recharts';

// --- Types ---
interface Employee {
  id: string;
  auth_user_id?: string;
  name: string;
  email: string;
  department: string;
  role: string;
  hourly_rate: number;
  is_active: boolean;
  created_at: string;
}

interface TimeEntry {
  id: string;
  project_id: string;
  employee_id: string;
  hours: number;
  description: string;
  logged_at: string;
  projects?: { project_name: string };
  hr_employees?: { name: string };
}

interface Project {
  id: string;
  project_name: string;
  status: string;
}

interface ProjectAssignment {
  id: string;
  employee_name: string;
  project_id: string;
  role: string;
  allocated_hours: number;
}

// --- Constants ---
const DEPARTMENTS = ["Engineering", "QA", "Production", "Finance", "Sales", "Warehouse", "Assembly"];

const DEPT_COLORS: Record<string, string> = {
  Engineering: '#6366f1', // indigo
  QA: '#14b8a6', // teal
  Production: '#f97316', // orange
  Finance: '#10b981', // emerald
  Sales: '#a855f7', // purple
  Warehouse: '#f59e0b', // amber
  Assembly: '#3b82f6', // blue
};

const inputCls = "w-full bg-[#0F172A] border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-violet-500 transition-colors";

export const HrModule = () => {
  const [activeTab, setActiveTab] = useState<'directory' | 'org' | 'time'>('directory');
  
  // Data State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  
  // UI State
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  
  // Modals & Expansions
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [showLogTimeModal, setShowLogTimeModal] = useState(false);
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);
  
  // Time Tracking Filter
  const [timeEmpFilter, setTimeEmpFilter] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [empRes, timeRes, projRes, assignRes] = await Promise.all([
        supabase.from('hr_employees').select('*').order('name'),
        supabase.from('time_entries').select('*, projects(project_name), hr_employees(name)').order('logged_at', { ascending: false }),
        supabase.from('projects').select('*'),
        supabase.from('project_assignments').select('*')
      ]);

      if (empRes.data) setEmployees(empRes.data);
      if (timeRes.data) setTimeEntries(timeRes.data);
      if (projRes.data) setProjects(projRes.data);
      if (assignRes.data) setAssignments(assignRes.data);
    } catch (error) {
      console.error('Error fetching HR data:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- Derived Data ---
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            emp.department.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = selectedDept ? emp.department === selectedDept : true;
      return matchesSearch && matchesDept;
    });
  }, [employees, searchQuery, selectedDept]);

  const deptStats = useMemo(() => {
    const stats: Record<string, { count: number; totalRate: number; totalHours: number }> = {};
    DEPARTMENTS.forEach(d => stats[d] = { count: 0, totalRate: 0, totalHours: 0 });
    
    employees.forEach(emp => {
      if (stats[emp.department]) {
        stats[emp.department].count += 1;
        stats[emp.department].totalRate += Number(emp.hourly_rate) || 0;
      }
    });

    assignments.forEach(a => {
      const emp = employees.find(e => e.name === a.employee_name);
      if (emp && stats[emp.department]) {
        stats[emp.department].totalHours += Number(a.allocated_hours) || 0;
      }
    });

    return Object.entries(stats).map(([dept, data]) => ({
      department: dept,
      count: data.count,
      avgRate: data.count > 0 ? data.totalRate / data.count : 0,
      totalHours: data.totalHours,
      monthlyCost: data.count * (data.count > 0 ? data.totalRate / data.count : 0) * 160
    })).filter(s => s.count > 0);
  }, [employees, assignments]);

  const filteredTimeEntries = useMemo(() => {
    if (timeEmpFilter === 'all') return timeEntries;
    return timeEntries.filter(t => t.employee_id === timeEmpFilter);
  }, [timeEntries, timeEmpFilter]);

  const timeStats = useMemo(() => {
    const totalHours = filteredTimeEntries.reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
    const avgHours = filteredTimeEntries.length > 0 ? totalHours / filteredTimeEntries.length : 0;
    
    const empHours: Record<string, number> = {};
    filteredTimeEntries.forEach(t => {
      const name = t.hr_employees?.name || 'Unknown';
      empHours[name] = (empHours[name] || 0) + Number(t.hours);
    });
    
    let topContributor = { name: '-', hours: 0 };
    Object.entries(empHours).forEach(([name, hours]) => {
      if (hours > topContributor.hours) {
        topContributor = { name, hours };
      }
    });

    return { totalHours, avgHours, topContributor };
  }, [filteredTimeEntries]);

  // --- Handlers ---
  const toggleEmployeeStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('hr_employees').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) {
      setEmployees(prev => prev.map(e => e.id === id ? { ...e, is_active: !currentStatus } : e));
    }
  };

  const handleAddEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newEmp = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      department: formData.get('department') as string,
      role: formData.get('role') as string,
      hourly_rate: Number(formData.get('hourly_rate')),
      is_active: true
    };
    
    const { data, error } = await supabase.from('hr_employees').insert([newEmp]).select();
    if (!error && data) {
      setEmployees(prev => [...prev, data[0]]);
      setShowAddEmpModal(false);
    }
  };

  const handleLogTime = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newEntry = {
      employee_id: formData.get('employee_id') as string,
      project_id: formData.get('project_id') as string,
      hours: Number(formData.get('hours')),
      description: formData.get('description') as string,
      logged_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase.from('time_entries').insert([newEntry]).select('*, projects(project_name), hr_employees(name)');
    if (!error && data) {
      setTimeEntries(prev => [data[0], ...prev]);
      setShowLogTimeModal(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // --- Renders ---
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      className="p-6 text-white min-h-screen"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-violet-400" />
            Human Resources
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage personnel, track time, and analyze department costs</p>
        </div>
        
        <div className="flex bg-[#1E293B] p-1 rounded-lg border border-slate-800">
          {[
            { id: 'directory', label: 'Directory', icon: Users },
            { id: 'org', label: 'Org & Costs', icon: Building },
            { id: 'time', label: 'Time Tracking', icon: Clock }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id 
                  ? 'bg-violet-500 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500"></div>
        </div>
      ) : (
        <>
          {activeTab === 'directory' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex-1 flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  <button
                    onClick={() => setSelectedDept(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedDept === null ? 'bg-violet-500/20 text-violet-400 border border-violet-500/50' : 'bg-[#1E293B] text-slate-300 border border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    All Departments
                  </button>
                  {DEPARTMENTS.map(dept => (
                    <button
                      key={dept}
                      onClick={() => setSelectedDept(dept)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        selectedDept === dept ? 'bg-violet-500/20 text-violet-400 border border-violet-500/50' : 'bg-[#1E293B] text-slate-300 border border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
                
                <div className="flex gap-3">
                  <div className="relative w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search employees..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`${inputCls} pl-9`}
                    />
                  </div>
                  <button
                    onClick={() => setShowAddEmpModal(true)}
                    className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Employee
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEmployees.map(emp => (
                  <div key={emp.id} className="bg-[#1E293B] border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                    <div 
                      className="p-5 flex-1 cursor-pointer hover:bg-slate-800/50 transition-colors"
                      onClick={() => setExpandedEmpId(expandedEmpId === emp.id ? null : emp.id)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-inner"
                            style={{ backgroundColor: DEPT_COLORS[emp.department] || '#475569' }}
                          >
                            {getInitials(emp.name)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">{emp.name}</h3>
                            <span className="text-xs text-slate-400">{emp.role}</span>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          emp.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                      
                      <div className="space-y-2 mt-4">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Building className="w-4 h-4 text-slate-500" />
                          <span 
                            className="px-2 py-0.5 rounded text-xs"
                            style={{ backgroundColor: `${DEPT_COLORS[emp.department]}20`, color: DEPT_COLORS[emp.department] }}
                          >
                            {emp.department}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <span className="truncate">{emp.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <DollarSign className="w-4 h-4 text-slate-500" />
                          <span>${emp.hourly_rate}/hr</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-slate-800/30 border-t border-slate-800 flex justify-between items-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleEmployeeStatus(emp.id, emp.is_active); }}
                        className={`text-xs px-3 py-1.5 rounded transition-colors ${
                          emp.is_active 
                            ? 'text-red-400 hover:bg-red-500/10' 
                            : 'text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                      >
                        {emp.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <span className="text-[10px] text-slate-500">
                        Joined {new Date(emp.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <AnimatePresence>
                      {expandedEmpId === emp.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-slate-800 bg-slate-900/50 overflow-hidden"
                        >
                          <div className="p-4">
                            <h4 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Recent Time Entries</h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                              {timeEntries.filter(t => t.employee_id === emp.id).length > 0 ? (
                                timeEntries.filter(t => t.employee_id === emp.id).slice(0, 5).map(entry => (
                                  <div key={entry.id} className="text-sm bg-slate-800/50 p-2 rounded flex justify-between items-center">
                                    <div className="truncate pr-2">
                                      <span className="text-violet-400 font-medium">{entry.projects?.project_name}</span>
                                      <span className="text-slate-400 text-xs ml-2">{new Date(entry.logged_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="whitespace-nowrap font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-xs">
                                      {entry.hours}h
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-xs text-slate-500 italic text-center py-2">No time entries found</p>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'org' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {deptStats.map(stat => (
                  <div key={stat.department} className="bg-[#1E293B] border border-slate-800 p-5 rounded-xl">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DEPT_COLORS[stat.department] }}></div>
                        <h3 className="font-semibold">{stat.department}</h3>
                      </div>
                      <span className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded font-mono">
                        {stat.count} {stat.count === 1 ? 'Emp' : 'Emps'}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Monthly Cost Est.</p>
                        <p className="text-lg font-semibold text-emerald-400">${stat.monthlyCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      </div>
                      <div className="flex justify-between text-sm border-t border-slate-700/50 pt-2">
                        <span className="text-slate-400">Avg Rate</span>
                        <span>${stat.avgRate.toFixed(2)}/hr</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-slate-700/50 pt-2">
                        <span className="text-slate-400">Allocated</span>
                        <span>{stat.totalHours}h</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[#1E293B] border border-slate-800 p-5 rounded-xl">
                  <h3 className="font-semibold mb-6 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-violet-400" />
                    Headcount by Department
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deptStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="department" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#f8fafc' }}
                          cursor={{fill: '#334155', opacity: 0.4}}
                        />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {deptStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={DEPT_COLORS[entry.department] || '#6366f1'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-[#1E293B] border border-slate-800 p-5 rounded-xl">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-violet-400" />
                    Department Distribution
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={deptStats}
                          dataKey="count"
                          nameKey="department"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {deptStats.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={DEPT_COLORS[entry.department] || '#6366f1'} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#f8fafc' }} />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'time' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#1E293B] border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                  <div className="p-3 bg-violet-500/10 rounded-lg text-violet-400">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Total Hours Logged</p>
                    <p className="text-2xl font-bold">{timeStats.totalHours}<span className="text-sm font-normal text-slate-500 ml-1">hrs</span></p>
                  </div>
                </div>
                <div className="bg-[#1E293B] border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Avg per Entry</p>
                    <p className="text-2xl font-bold">{timeStats.avgHours.toFixed(1)}<span className="text-sm font-normal text-slate-500 ml-1">hrs</span></p>
                  </div>
                </div>
                <div className="bg-[#1E293B] border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-lg text-amber-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm text-slate-400">Top Contributor</p>
                    <p className="text-xl font-bold truncate">{timeStats.topContributor.name}</p>
                    <p className="text-xs text-slate-500">{timeStats.topContributor.hours} hrs</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#1E293B] border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h3 className="font-semibold">Time Entries</h3>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <select
                      value={timeEmpFilter}
                      onChange={(e) => setTimeEmpFilter(e.target.value)}
                      className={`${inputCls} w-full sm:w-48 appearance-none`}
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center' }}
                    >
                      <option value="all">All Employees</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowLogTimeModal(true)}
                      className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      Log Time
                    </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
                      <tr>
                        <th className="px-6 py-3">Employee</th>
                        <th className="px-6 py-3">Project</th>
                        <th className="px-6 py-3">Description</th>
                        <th className="px-6 py-3">Hours</th>
                        <th className="px-6 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTimeEntries.length > 0 ? (
                        filteredTimeEntries.map(entry => (
                          <tr key={entry.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                            <td className="px-6 py-4 font-medium text-white">
                              {entry.hr_employees?.name || 'Unknown'}
                            </td>
                            <td className="px-6 py-4">
                              <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs">
                                {entry.projects?.project_name || 'No Project'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-300 max-w-xs truncate">
                              {entry.description}
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-mono text-emerald-400">{entry.hours}h</span>
                            </td>
                            <td className="px-6 py-4 text-slate-400">
                              {new Date(entry.logged_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                            No time entries found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showAddEmpModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1E293B] border border-slate-700 rounded-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-slate-700">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-violet-400" />
                  Add New Employee
                </h3>
                <button onClick={() => setShowAddEmpModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddEmployee} className="p-4 space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                  <input name="name" required className={inputCls} placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Email</label>
                  <input name="email" type="email" required className={inputCls} placeholder="john@taloserp.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Department</label>
                    <select name="department" required className={`${inputCls} appearance-none`}>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Role</label>
                    <input name="role" required className={inputCls} placeholder="Software Engineer" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Hourly Rate ($)</label>
                  <input name="hourly_rate" type="number" step="0.01" required className={inputCls} placeholder="50.00" />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                  <button type="button" onClick={() => setShowAddEmpModal(false)} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm transition-colors">
                    Save Employee
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showLogTimeModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1E293B] border border-slate-700 rounded-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 border-b border-slate-700">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-violet-400" />
                  Log Time
                </h3>
                <button onClick={() => setShowLogTimeModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleLogTime} className="p-4 space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Employee</label>
                  <select name="employee_id" required className={`${inputCls} appearance-none`}>
                    {employees.filter(e => e.is_active).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Project</label>
                  <select name="project_id" required className={`${inputCls} appearance-none`}>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.project_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Hours</label>
                  <input name="hours" type="number" step="0.5" required className={inputCls} placeholder="4.0" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Description</label>
                  <textarea name="description" required className={`${inputCls} resize-none h-24`} placeholder="What did you work on?"></textarea>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                  <button type="button" onClick={() => setShowLogTimeModal(false)} className="px-4 py-2 text-sm text-slate-300 hover:text-white">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm transition-colors">
                    Save Entry
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
