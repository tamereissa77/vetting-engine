import React, { useState, useEffect } from 'react';
import { Shield, Cpu, Database, Layers, Terminal, Sparkles, Network, Activity, Info, Briefcase } from 'lucide-react';
import { JobApplicationModal } from './JobApplicationModal';

export interface Job {
  id: number;
  role_name: string;
  stack_layer: string;
  category: string;
  engagement_tier: string;
  role_summary: string;
  red_flags: string;
  offerings?: string;
  is_open?: boolean;
}

const STACK_LAYERS = [
  { name: 'All Layers', filter: '' },
  { name: 'Layer 1 — Infrastructure', filter: 'Layer 1 — Infrastructure', icon: Cpu },
  { name: 'Layer 2 — Data', filter: 'Layer 2 — Data', icon: Database },
  { name: 'Layer 3 — Model', filter: 'Layer 3 — Model', icon: Layers },
  { name: 'Layer 4 — AI / Reasoning', filter: 'Layer 4 — AI / Reasoning', icon: Network },
  { name: 'Layer 5 — Application', filter: 'Layer 5 — Application', icon: Sparkles },
  { name: 'Strategy & Advisory', filter: 'Strategy & Advisory', icon: Terminal },
  { name: 'Strategy & Governance', filter: 'Strategy & Governance', icon: Shield },
  { name: 'Strategy & Enablement', filter: 'Strategy & Enablement', icon: Activity },
  { name: 'Governance & Security', filter: 'Governance & Security', icon: Shield },
  { name: 'Domain (Vertical)', filter: 'Domain (Vertical)', icon: Briefcase }
];

const getApiUrl = () => {
  const hostname = window.location.hostname;
  return `http://${hostname}:8001`;
};

export function NexusPortal() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'active' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    fetchJobs(false);
  }, [activeTab, selectedLayer]);

  useEffect(() => {
    const handleFocus = () => {
      fetchJobs(true);
    };
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => {
      fetchJobs(true);
    }, 10000); // Poll every 10 seconds in the background
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  const fetchJobs = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/jobs`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      } else {
        console.error('Failed to load job profiles');
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesLayer = selectedLayer
      ? job.stack_layer.toLowerCase().includes(selectedLayer.split('—')[0].trim().toLowerCase())
      : true;
    const matchesTab = activeTab === 'active' ? job.is_open : true;
    
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = query
      ? (
          job.role_name.toLowerCase().includes(query) ||
          job.role_summary.toLowerCase().includes(query) ||
          job.stack_layer.toLowerCase().includes(query) ||
          (job.offerings && job.offerings.toLowerCase().includes(query))
        )
      : true;

    return matchesLayer && matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#0a0f14]">
      
      {/* Header */}
      <header className="border-b border-cyber-slate/60 bg-cyber-dark/80 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded-lg shadow-cyan-glow">
            <Shield className="text-cyber-cyan animate-pulse" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider uppercase bg-gradient-to-r from-cyber-cyan to-cyber-magenta bg-clip-text text-transparent">
              Click Nexus // Talent Gateway
            </h1>
            <p className="text-[9px] tracking-widest font-mono text-slate-400">
              IMMUTABLE TALENT LEDGER & DECISION COMPLIANCE PORTAL
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1 bg-cyber-gray border border-cyber-slate rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-cyber-green animate-ping"></span>
            <span className="text-slate-300">VITTING INTEGRATION: ACTIVE</span>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex flex-col md:flex-row">
        
        {/* Sidebar */}
        <aside className="w-full md:w-80 border-r border-cyber-slate/40 bg-cyber-dark/40 p-4 flex flex-col gap-6 select-none">
          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mb-3 px-2">
              Sovereign AI Stack Grid
            </h3>
            <div className="space-y-1">
              {STACK_LAYERS.map((layer) => {
                const Icon = layer.icon;
                const isActive = selectedLayer === layer.filter;
                return (
                  <button
                    key={layer.name}
                    onClick={() => setSelectedLayer(layer.filter)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded font-mono text-[10px] transition-all duration-150 text-left ${
                      isActive 
                        ? 'bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan font-bold shadow-cyan-glow' 
                        : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-cyber-slate/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {Icon && <Icon size={12} className={isActive ? 'text-cyber-cyan' : 'text-slate-500'} />}
                      <span>{layer.name}</span>
                    </div>
                    {isActive && (
                      <span className="w-1 h-1 rounded-full bg-cyber-cyan shadow-cyan-glow-intense"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-auto p-4 border border-cyber-slate/30 bg-cyber-gray/30 rounded-lg">
            <div className="flex items-center gap-2 text-cyber-cyan font-mono text-[10px] uppercase tracking-wider mb-1">
              <Info size={12} />
              <span>Gateway Rules</span>
            </div>
            <p className="text-[9px] font-sans text-slate-400 leading-relaxed">
              Applications are automatically routed to the decentralized Vitting compliance engine. Integrity analysis processes within air-gapped sandboxes.
            </p>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6 md:p-8 space-y-6">
          <div className="max-w-5xl space-y-2">
            <h2 className="text-2xl font-bold font-sans text-slate-100 flex items-center gap-2">
              <span>🚀</span> Join the Sovereign AI Revolution
            </h2>
            <p className="text-xs text-slate-400 font-mono leading-relaxed">
              Select an open operational role. Apply using your verified CV and LinkedIn payload. Your profile will be instantly parsed and validated against compliance rules.
            </p>
          </div>

          {/* Sub-Navigation Tabs & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cyber-slate/40 pb-2">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('active')}
                className={`px-4 py-2 font-mono text-[11px] uppercase tracking-wider transition-all border-b-2 ${
                  activeTab === 'active'
                    ? 'border-cyber-cyan text-cyber-cyan font-bold shadow-cyan-glow'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                💼 Active Job Openings ({jobs.filter(j => j.is_open).length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 font-mono text-[11px] uppercase tracking-wider transition-all border-b-2 ${
                  activeTab === 'all'
                    ? 'border-cyber-cyan text-cyber-cyan font-bold shadow-cyan-glow'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                🗃️ All Roles Directory ({jobs.length})
              </button>
            </div>

            {/* Keyword Search Input */}
            <div className="flex items-center gap-2">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by role, keyword..."
                className="bg-[#0b1219] border border-cyber-slate/60 focus:border-cyber-cyan focus:outline-none px-3 py-1.5 text-xs text-slate-200 rounded font-mono w-64 transition-all hover:border-cyber-slate/85"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-2.5 py-1.5 bg-cyber-slate/30 border border-cyber-slate/50 text-slate-400 rounded text-[10px] font-mono hover:bg-cyber-slate/50 hover:text-slate-200 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Loading */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 rounded-full border-2 border-cyber-cyan border-t-transparent animate-spin"></div>
              <p className="font-mono text-xs text-slate-400">CONNECTING TO LEDGER POSTINGS...</p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="border border-dashed border-cyber-slate/50 rounded-lg py-16 text-center">
              <Briefcase className="mx-auto text-slate-500 mb-2" size={32} />
              <p className="font-mono text-xs text-slate-400">NO TARGET POSITIONS ACTIVE IN THIS LAYER</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredJobs.map((job) => (
                <div 
                  key={job.id} 
                  className="cyber-panel rounded-lg p-6 flex flex-col justify-between border border-cyber-slate/30 hover:border-cyber-cyan/40 hover:shadow-cyan-glow/10 transition-all duration-300 group"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-base font-bold text-slate-100 font-sans group-hover:text-cyber-cyan transition-colors">
                          {job.role_name}
                        </h4>
                        <span className="inline-block mt-1 px-2.5 py-0.5 bg-cyber-slate/60 text-slate-300 rounded font-mono text-[9px] uppercase tracking-wide border border-cyber-slate/40">
                          {job.stack_layer}
                        </span>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider rounded border ${
                        job.is_open 
                          ? 'bg-cyber-cyan/10 border-cyber-cyan/30 text-cyber-cyan shadow-cyan-glow' 
                          : 'bg-cyber-slate/30 border-cyber-slate/50 text-slate-500'
                      }`}>
                        {job.is_open ? 'OPENING ACTIVE' : 'CLOSED'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider border-b border-cyber-slate/20 pb-1">
                        Deployment Summary
                      </div>
                      <p className="text-xs text-slate-300 font-sans leading-relaxed">
                        {job.role_summary}
                      </p>
                    </div>

                    {job.offerings && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                          Key Architecture Stack
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {job.offerings.split(',').map((offering) => (
                            <span key={offering} className="px-2 py-0.5 bg-cyber-magenta/5 border border-cyber-magenta/20 text-cyber-magenta rounded text-[9px] font-mono">
                              {offering.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-cyber-slate/20 mt-6 flex justify-between items-center gap-4 flex-wrap">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                      DECISION CODE: #T-{job.id}
                    </span>
                    <div className="flex items-center gap-2">
                      {job.is_open ? (
                        <button
                          onClick={() => {
                            setSelectedJob(job);
                            setIsModalOpen(true);
                          }}
                          className="px-4 py-2 bg-cyber-cyan/15 hover:bg-cyber-cyan/35 border border-cyber-cyan/40 hover:border-cyber-cyan text-cyber-cyan hover:text-white rounded font-mono text-[10px] uppercase tracking-widest shadow-cyan-glow/10 hover:shadow-cyan-glow-intense/20 transition-all duration-200"
                        >
                          Apply For Role
                        </button>
                      ) : (
                        <span className="px-4 py-2 bg-cyber-slate/30 border border-cyber-slate/50 text-slate-500 rounded font-mono text-[10px] uppercase tracking-widest cursor-not-allowed">
                          Closed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {selectedJob && (
        <JobApplicationModal
          isOpen={isModalOpen}
          job={selectedJob}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedJob(null);
          }}
        />
      )}
    </div>
  );
}
