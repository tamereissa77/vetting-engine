import React, { useState, useEffect, useRef } from 'react';
import { 
   Shield, Activity, Database, Cpu, Layers, Terminal, Plus, 
   Trash2, Edit, UploadCloud, Linkedin, CheckCircle2, 
   AlertTriangle, User, Mail, FileText, Sparkles, Network,
   UserX, UserCheck, ClipboardList, AlertCircle
 } from 'lucide-react';
import { api, TalentProfile, Candidate, CandidateDetails } from './utils/api';
import { AssessmentRing } from './components/AssessmentRing';
import { ProfileModal } from './components/ProfileModal';
import { CandidateModal } from './components/CandidateModal';
import { DossierModal } from './components/DossierModal';

const STACK_LAYERS_FILTER = [
  { name: 'All Layers', filter: '' },
  { name: 'Layer 1 — Infrastructure', filter: 'Layer 1 — Infrastructure' },
  { name: 'Layer 2 — Data', filter: 'Layer 2 — Data' },
  { name: 'Layer 3 — Model', filter: 'Layer 3 — Model' },
  { name: 'Layer 4 — AI / Reasoning', filter: 'Layer 4 — AI / Reasoning' },
  { name: 'Layer 5 — Application', filter: 'Layer 5 — Application' },
  { name: 'Strategy & Advisory', filter: 'Strategy & Advisory' },
  { name: 'Strategy & Governance', filter: 'Strategy & Governance' },
  { name: 'Strategy & Enablement', filter: 'Strategy & Enablement' },
  { name: 'Governance & Security', filter: 'Governance & Security' },
  { name: 'Domain (Vertical)', filter: 'Domain (Vertical)' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'profiles' | 'vetting' | 'candidates'>('profiles');
  const [selectedLayer, setSelectedLayer] = useState<string>('');
  
  // Data States
  const [profiles, setProfiles] = useState<TalentProfile[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [candidateDetails, setCandidateDetails] = useState<CandidateDetails | null>(null);
  const [selectedMatchProfiles, setSelectedMatchProfiles] = useState<number[]>([]);
  const [activeAssessmentIndex, setActiveAssessmentIndex] = useState<number>(0);
  
  // UI states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialProfile, setModalInitialProfile] = useState<TalentProfile | null>(null);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [modalInitialCandidate, setModalInitialCandidate] = useState<Candidate | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);
  const [systemConfig, setSystemConfig] = useState<{ provider: string; model: string } | null>(null);
  const [activeVettingProfileId, setActiveVettingProfileId] = useState<number | null>(null);
  const [ledgerFilterQuery, setLedgerFilterQuery] = useState<string>('');
  const [registryFilterRole, setRegistryFilterRole] = useState<string>('');
  const [registryFilterMinScore, setRegistryFilterMinScore] = useState<number>(0);
  
  // Computed state for filtered candidates in the Registry tab
  const filteredCandidates = candidates.filter(candidate => {
    if (registryFilterRole && candidate.highest_role_name !== registryFilterRole) {
      return false;
    }
    if (registryFilterMinScore > 0 && (candidate.highest_score ?? 0) < registryFilterMinScore) {
      return false;
    }
    return true;
  });

  // Computed candidate list for the left archive ledger panel
  const ledgerCandidates = candidates.filter(candidate => {
    const query = ledgerFilterQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      candidate.full_name,
      candidate.email || '',
      candidate.linkedin_url || '',
      candidate.highest_role_name || ''
    ].some(value => value.toLowerCase().includes(query));
  });
  
  // WebSocket Progress states
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskLogs, setTaskLogs] = useState<string[]>([]);
  const [taskProgress, setTaskProgress] = useState<number>(0);
  const [taskStatus, setTaskStatus] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Initial Fetches
  useEffect(() => {
    fetchProfiles();
    fetchCandidates();
  }, [selectedLayer]);

  useEffect(() => {
    fetchSystemConfig();
  }, []);

  const fetchSystemConfig = async () => {
    try {
      const res = await fetch(import.meta.env.VITE_API_URL || 'http://localhost:8000');
      if (res.ok) {
        const data = await res.json();
        if (data.provider) {
          setSystemConfig({ provider: data.provider, model: data.model });
        }
      }
    } catch (err) {
      console.error('Failed to retrieve server config:', err);
    }
  };

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [taskLogs]);

  // Refetch candidate details if selected ID changes
  useEffect(() => {
    if (selectedCandidateId !== null) {
      fetchCandidateDetails(selectedCandidateId);
    } else {
      setCandidateDetails(null);
    }
  }, [selectedCandidateId]);

  const fetchProfiles = async () => {
    try {
      const data = await api.getProfiles(selectedLayer);
      setProfiles(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCandidates = async () => {
    try {
      const data = await api.getCandidates();
      setCandidates(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCandidateDetails = async (id: number) => {
    try {
      const details = await api.getCandidateDetails(id);
      setCandidateDetails(details);
      // Initialize match checkbox selects
      if (details.assessments && details.assessments.length > 0) {
        setActiveAssessmentIndex(0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Profile Save (Create / Update)
  const handleSaveProfile = async (profilePayload: TalentProfile) => {
    try {
      if (profilePayload.id) {
        await api.updateProfile(profilePayload.id, profilePayload);
      } else {
        await api.createProfile(profilePayload);
      }
      setIsModalOpen(false);
      fetchProfiles();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  const handleDeleteProfile = async (id: number) => {
    if (!window.confirm('Are you sure you want to purge this Sovereign Talent Profile?')) return;
    try {
      await api.deleteProfile(id);
      fetchProfiles();
    } catch (err) {
      console.error(err);
    }
  };

  // Candidate Save & Delete CRUD Handlers
  const handleSaveCandidate = async (payload: Partial<Candidate>) => {
    try {
      if (payload.id) {
        await api.updateCandidate(payload.id, payload);
      } else {
        await api.createCandidate(payload);
      }
      setIsCandidateModalOpen(false);
      fetchCandidates();
      if (selectedCandidateId === payload.id && selectedCandidateId !== null) {
        fetchCandidateDetails(selectedCandidateId);
      }
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  const handleDeleteCandidate = async (id: number) => {
    if (!window.confirm('Are you sure you want to purge this candidate from ledger?')) return;
    try {
      await api.deleteCandidate(id);
      if (selectedCandidateId === id) {
        setSelectedCandidateId(null);
      }
      fetchCandidates();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleBlacklist = async (candidate: Candidate) => {
    try {
      await api.updateCandidate(candidate.id, {
        full_name: candidate.full_name,
        email: candidate.email,
        linkedin_url: candidate.linkedin_url,
        skills: candidate.skills,
        experience_years: candidate.experience_years,
        is_blacklisted: !candidate.is_blacklisted
      });
      fetchCandidates();
      if (selectedCandidateId === candidate.id) {
        fetchCandidateDetails(candidate.id);
      }
    } catch (err) {
      console.error('Failed to toggle blacklist status:', err);
    }
  };

  // WebSocket task progress listener
  const startTaskProgressStream = (taskId: string) => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    setActiveTaskId(taskId);
    setTaskLogs([`[SYSTEM] Connecting to WebSocket logging stream for task ${taskId}...`]);
    setTaskProgress(0);
    setTaskStatus('processing');

    const ws = api.connectTaskProgress(
      taskId,
      (payload) => {
        setTaskProgress(payload.progress);
        setTaskStatus(payload.status);
        setTaskLogs((prev) => [...prev, `[WORKER] ${payload.message}`]);

        if (payload.status === 'completed' || payload.status === 'failed') {
          setTaskLogs((prev) => [
            ...prev,
            `[SYSTEM] Process finished with status: ${payload.status.toUpperCase()}`
          ]);
           // Refresh lists
          fetchCandidates();
          setActiveVettingProfileId(null);
          if (selectedCandidateId !== null) {
            fetchCandidateDetails(selectedCandidateId);
          } else if (payload.data && payload.data.candidate_id) {
            setSelectedCandidateId(payload.data.candidate_id);
          }
          // Close after delay
          setTimeout(() => {
            setActiveTaskId(null);
          }, 4000);
        }
      },
      () => {
        setTaskLogs((prev) => [...prev, `[SYSTEM ERROR] Failed to connect to progress tracking feed.`]);
        setTaskStatus('failed');
      }
    );
    wsRef.current = ws;
  };

  // CV PDF Upload
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadMultipleFiles(e.dataTransfer.files);
    }
  };
 
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadMultipleFiles(e.target.files);
    }
  };
 
  const uploadMultipleFiles = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const res = await api.uploadCV(file);
        // Start streaming task progress. If multiple files are uploaded, 
        // the progress logger will track the latest launched task.
        startTaskProgressStream(res.task_id);
      } catch (err: any) {
        alert(`Failed to upload ${file.name}: ` + (err.message || err));
      }
    }
  };

  // LinkedIn Scanner Submit
  const handleLinkedInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkedinUrl) return;
    try {
      const res = await api.scanLinkedIn(linkedinUrl);
      setLinkedinUrl('');
      startTaskProgressStream(res.task_id);
    } catch (err) {
      alert('LinkedIn trigger failed: ' + err);
    }
  };

  // Run AI Assessment Matchmaking
  const handleRunMatchmaking = async () => {
    if (!selectedCandidateId || selectedMatchProfiles.length === 0) return;
    try {
      const res = await api.matchCandidate(selectedCandidateId, selectedMatchProfiles);
      startTaskProgressStream(res.task_id);
      setSelectedMatchProfiles([]);
    } catch (err) {
      alert('Matchmaking assessment failed: ' + err);
    }
  };

  const toggleMatchProfileSelection = (id: number) => {
    setSelectedMatchProfiles((prev) => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      
      {/* 1. Header Grid */}
      <header className="border-b border-cyber-slate/60 bg-cyber-dark/80 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 z-10 sticky top-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyber-cyan/10 border border-cyber-cyan/30 rounded-lg shadow-cyan-glow">
            <Shield className="text-cyber-cyan animate-pulse" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider uppercase bg-gradient-to-r from-cyber-cyan to-cyber-magenta bg-clip-text text-transparent">
              Click group - VITTING ENGINE
            </h1>
            <p className="text-[10px] tracking-widest font-mono text-slate-400">
              LOCAL COMPLIANCE ARCHITECTURE & DECOUPLED PIPELINE
            </p>
          </div>
        </div>
        
        {/* Status Indicators */}
        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1 bg-cyber-gray border border-cyber-slate rounded-full">
            <span className="w-2 h-2 rounded-full bg-cyber-green animate-ping"></span>
            <span className="text-slate-300">AI Stack:</span>
            <span className="text-cyber-cyan uppercase font-bold">
              {systemConfig ? `${systemConfig.provider} (${systemConfig.model})` : 'Active (Local)'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <div>
              PROFILES: <span className="text-cyber-cyan font-bold">{profiles.length}</span>
            </div>
            <div>
              CANDIDATES: <span className="text-cyber-magenta font-bold">{candidates.length}</span>
            </div>
          </div>
        </div>
      </header>

      {/* 2. Layout Framework */}
      <div className="flex-1 flex flex-col md:flex-row">
        
        {/* Left Panel: 5-Layer Sovereign AI Stack Sidebar */}
        <aside className="w-full md:w-80 border-r border-cyber-slate/40 bg-cyber-dark/40 p-4 flex flex-col gap-6 select-none">
          {/* Navigation Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-cyber-gray border border-cyber-slate rounded-lg">
            <button
              onClick={() => setActiveTab('profiles')}
              className={`py-2 rounded-md font-mono text-[10px] uppercase tracking-wide transition-all ${
                activeTab === 'profiles' 
                  ? 'bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan font-bold shadow-cyan-glow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Profiles
            </button>
            <button
              onClick={() => setActiveTab('vetting')}
              className={`py-2 rounded-md font-mono text-[10px] uppercase tracking-wide transition-all ${
                activeTab === 'vetting' 
                  ? 'bg-cyber-magenta/10 border border-cyber-magenta/30 text-cyber-magenta font-bold shadow-magenta-glow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Vetting
            </button>
            <button
              onClick={() => setActiveTab('candidates')}
              className={`py-2 rounded-md font-mono text-[10px] uppercase tracking-wide transition-all ${
                activeTab === 'candidates' 
                  ? 'bg-cyber-magenta/10 border border-cyber-magenta/30 text-cyber-magenta font-bold shadow-magenta-glow' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Registry
            </button>
          </div>

          {/* 5-Layer Visual Stack representation */}
          <div className="flex-1 flex flex-col gap-2">
            <h3 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
              <Layers size={14} className="text-cyber-cyan" />
              <span>Sovereign AI Stack Grid</span>
            </h3>
            
            <div className="space-y-1">
              {STACK_LAYERS_FILTER.map((layer) => {
                const isActive = selectedLayer === layer.filter;
                return (
                  <button
                    key={layer.name}
                    onClick={() => {
                      setSelectedLayer(layer.filter);
                      // Switch to profiles tab since we are filtering profiles
                      setActiveTab('profiles');
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all text-xs flex items-center justify-between ${
                      isActive 
                        ? 'bg-cyber-cyan/10 border-cyber-cyan text-cyber-cyan font-bold shadow-cyan-glow' 
                        : 'bg-cyber-gray/40 border-cyber-slate/30 text-slate-300 hover:border-cyber-slate hover:bg-cyber-gray/70'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {layer.filter.includes('Layer 1') && <ServerIcon className={isActive ? 'text-cyber-cyan' : 'text-slate-500'} />}
                      {layer.filter.includes('Layer 2') && <Database className={isActive ? 'text-cyber-cyan' : 'text-slate-500'} size={14} />}
                      {layer.filter.includes('Layer 3') && <Cpu className={isActive ? 'text-cyber-cyan' : 'text-slate-500'} size={14} />}
                      {layer.filter.includes('Layer 4') && <Network className={isActive ? 'text-cyber-cyan' : 'text-slate-500'} size={14} />}
                      {layer.filter.includes('Layer 5') && <Sparkles className={isActive ? 'text-cyber-cyan' : 'text-slate-500'} size={14} />}
                      {!layer.filter && <Shield size={14} className={isActive ? 'text-cyber-cyan' : 'text-slate-500'} />}
                      {layer.filter && !layer.filter.includes('Layer') && <Activity className={isActive ? 'text-cyber-cyan' : 'text-slate-500'} size={14} />}
                      <span className="truncate">{layer.name}</span>
                    </div>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyber-cyan"></div>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-cyber-gray/40 border border-cyber-slate/30 rounded-lg text-[10px] font-mono text-slate-400 space-y-1">
            <div className="font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-magenta"></span>
              SECURE LEDGER INTEGRITY
            </div>
            <div>Database: Postgres v15</div>
            <div>Security: Local Sandbox</div>
            <div>Region: Air-Gapped Jurisdiction</div>
            <div className="pt-2 text-slate-400 border-t border-cyber-slate/20 text-[9px] uppercase tracking-widest">
              Developed by OriginCraft
            </div>
          </div>
        </aside>

        {/* Main Workspace Frame */}
        <main className="flex-1 p-6 overflow-y-auto max-h-[calc(100vh-80px)]">
          
          {/* TAB 1: Profiles CRUD Admin Dashboard */}
          {activeTab === 'profiles' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold font-sans text-slate-100 flex items-center gap-2">
                    <span>📋</span>
                    {selectedLayer ? `Profiles: ${selectedLayer}` : 'Talent Profiles Ledger'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    Admin register for vetting benchmarks and requirements criteria.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setModalInitialProfile(null);
                    setIsModalOpen(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-cyber-cyan/20 to-cyber-magenta/20 hover:from-cyber-cyan/30 hover:to-cyber-magenta/30 border border-cyber-cyan/30 text-cyber-cyan hover:text-white rounded font-mono text-xs uppercase tracking-wider flex items-center gap-2 btn-cyan-glow transition-all"
                >
                  <Plus size={16} />
                  <span>Add Target Role</span>
                </button>
              </div>

              {/* Profiles Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {profiles.map((profile) => (
                  <div 
                    key={profile.id}
                    className="cyber-panel rounded-lg p-5 flex flex-col justify-between group hover:border-cyber-cyan/40 transition-all duration-300"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-4 border-b border-cyber-slate/30 pb-3 mb-3">
                        <div>
                          <span className="px-2 py-0.5 bg-cyber-dark text-slate-300 border border-cyber-slate rounded-full text-[9px] font-mono tracking-wider uppercase">
                            {profile.stack_layer}
                          </span>
                          <h4 className="text-base font-bold font-sans text-slate-100 group-hover:text-cyber-cyan transition-colors mt-1">
                            {profile.role_name}
                          </h4>
                        </div>
                        <span className="px-2 py-1 bg-cyber-magenta/10 border border-cyber-magenta/30 text-cyber-magenta rounded text-[10px] font-mono uppercase tracking-wider">
                          {profile.engagement_tier}
                        </span>
                      </div>

                      {/* Summary */}
                      <p className="text-xs text-slate-300 leading-relaxed font-sans mb-4">
                        {profile.role_summary}
                      </p>

                      {/* Red Flags warning box */}
                      <div className="bg-cyber-magenta/5 border border-cyber-magenta/20 rounded p-3 mb-4">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-cyber-magenta flex items-center gap-1.5 mb-1.5">
                          <AlertTriangle size={12} />
                          <span>Screen-Out Red Flags</span>
                        </div>
                        <ul className="text-[11px] text-slate-300 space-y-1 pl-4 list-disc font-sans">
                          {profile.red_flags.split(';').map((flag, idx) => (
                            <li key={idx} className="leading-tight">
                              {flag.trim()}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Offerings if present */}
                      {profile.offerings && (
                        <div className="text-[11px] font-sans text-slate-400 bg-cyber-slate/20 rounded p-2.5 mb-4 border border-cyber-slate/30">
                          <strong className="text-slate-300 font-mono text-[9px] uppercase tracking-wider block mb-1">MAPPED DELIVERABLES:</strong>
                          {profile.offerings}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-3 border-t border-cyber-slate/20 mt-2">
                      <button
                        onClick={() => {
                          setModalInitialProfile(profile);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-cyber-cyan border border-transparent hover:border-cyber-cyan/20 rounded transition-colors"
                        title="Edit profile criteria"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteProfile(profile.id!)}
                        className="p-1.5 text-slate-400 hover:text-cyber-magenta border border-transparent hover:border-cyber-magenta/20 rounded transition-colors"
                        title="Purge profile"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}

                {profiles.length === 0 && (
                  <div className="col-span-full py-16 text-center border border-dashed border-cyber-slate rounded-lg">
                    <p className="text-sm font-mono text-slate-400">
                      No talent profiles found matching filter layer. Add new target role above.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Vetting Center & Matchmaking */}
          {activeTab === 'vetting' && (
            <div className="space-y-6">
              
              {/* Top Pipeline Inputs (CV upload & LinkedIn URL) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* CV Upload zone */}
                <div 
                  className={`cyber-panel rounded-lg p-5 border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 min-h-[140px] ${
                    dragActive ? 'border-cyber-cyan bg-cyber-cyan/5' : 'border-cyber-slate/50 hover:border-cyber-cyan/30'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-upload-input')?.click()}
                >
                  <input
                    id="file-upload-input"
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                  />
                  <UploadCloud className="text-cyber-cyan mb-2" size={32} />
                  <p className="text-xs font-semibold text-slate-200 text-center font-sans">
                    DRAG & DROP CANDIDATE RESUME (.PDF, .DOCX)
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-mono">
                    OR CLICK TO BROWSE LOCAL FILESYSTEM
                  </p>
                </div>

                {/* LinkedIn scanner mock form */}
                <form onSubmit={handleLinkedInSubmit} className="cyber-panel rounded-lg p-5 flex flex-col justify-between min-h-[140px]">
                  <div>
                    <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5 mb-2">
                      <Linkedin size={14} className="text-cyber-cyan" />
                      <span>LinkedIn Profile Scraping Gateway</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 font-sans mb-3">
                      Simulate robust CAPTCHA bypassing, experience harvesting, and model injection.
                    </p>
                    <input
                      type="url"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="e.g. https://linkedin.com/in/alex-rivera-ops"
                      className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-xs text-slate-200 rounded font-mono"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full mt-3 py-2 bg-cyber-cyan/10 hover:bg-cyber-cyan/20 border border-cyber-cyan/30 hover:border-cyber-cyan text-cyber-cyan hover:text-white rounded font-mono text-xs uppercase tracking-wider transition-all"
                  >
                    Trigger LinkedIn Scraper Pipeline
                  </button>
                </form>
              </div>

              {/* Candidates Ledger List & Assessor Workspace Split */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Candidates List (4 cols) */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="cyber-panel rounded-lg p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
                          Candidate Archive Ledger
                        </h3>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {ledgerCandidates.length} / {candidates.length}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="search"
                          value={ledgerFilterQuery}
                          onChange={(e) => setLedgerFilterQuery(e.target.value)}
                          placeholder="Filter by name, role, email or LinkedIn"
                          className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-xs text-slate-200 rounded font-mono"
                        />
                        {ledgerFilterQuery && (
                          <button
                            type="button"
                            onClick={() => setLedgerFilterQuery('')}
                            className="px-3 py-2 bg-cyber-slate border border-cyber-slate/50 text-slate-300 rounded text-[10px] font-mono hover:bg-cyber-slate/80 transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {ledgerCandidates.map((c) => {
                        const isSelected = selectedCandidateId === c.id;
                        return (
                          <button
                            key={c.id}
                            onClick={() => setSelectedCandidateId(c.id)}
                            className={`w-full text-left p-3 rounded border transition-all flex flex-col gap-1.5 ${
                              isSelected 
                                ? 'bg-cyber-magenta/10 border-cyber-magenta text-white shadow-magenta-glow' 
                                : 'bg-cyber-gray/50 border-cyber-slate/30 text-slate-300 hover:border-cyber-slate'
                            }`}
                          >
                            <div className="flex justify-between items-start w-full">
                              <span className="text-xs font-bold font-sans truncate">{c.full_name}</span>
                              <span className="text-[9px] font-mono text-slate-400">
                                {new Date(c.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            
                            {/* Skills tags preview */}
                            {c.skills && c.skills.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {c.skills.slice(0, 3).map((s) => (
                                  <span key={s} className="px-1.5 py-0.5 bg-cyber-dark text-[8px] font-mono rounded border border-cyber-slate text-slate-400">
                                    {s}
                                  </span>
                                ))}
                                {c.skills.length > 3 && (
                                  <span className="text-[8px] font-mono text-slate-500">+{c.skills.length - 3}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[9px] font-mono text-slate-500 italic">No skills extracted yet</span>
                            )}

                            {c.linkedin_url && (
                              <div className="text-[9px] font-mono text-cyber-cyan truncate flex items-center gap-1">
                                <Linkedin size={10} />
                                <span className="truncate">{c.linkedin_url}</span>
                              </div>
                            )}
                          </button>
                        );
                      })}

                      {candidates.length === 0 && (
                        <p className="text-xs font-mono text-slate-400 text-center py-8">
                          No candidate records indexed. Parse a CV or LinkedIn profile to populate.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Workspace Assessor & Reports (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                  {candidateDetails ? (
                    <div className="cyber-panel rounded-lg p-5 space-y-6">
                      
                      {/* Candidate Meta Header */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyber-slate/30 pb-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2.5 border rounded-lg ${
                            candidateDetails.is_blacklisted 
                              ? 'bg-cyber-magenta/10 border-cyber-magenta/50 text-cyber-magenta' 
                              : 'bg-cyber-slate/50 border-cyber-slate text-slate-400'
                          }`}>
                            <User size={22} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h2 className="text-lg font-bold font-sans text-slate-100">
                                {candidateDetails.full_name}
                              </h2>
                              {candidateDetails.is_blacklisted && (
                                <span className="px-2 py-0.5 bg-cyber-magenta/20 border border-cyber-magenta/40 text-cyber-magenta rounded text-[8px] font-mono uppercase tracking-widest animate-pulse">
                                  BLACKLISTED
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400 font-mono">
                              <span className="flex items-center gap-1">
                                <Mail size={12} />
                                {candidateDetails.email || 'N/A'}
                              </span>
                              <span>•</span>
                              <span>Exp: {candidateDetails.experience_years} years</span>
                            </div>
                          </div>
                        </div>

                        {candidateDetails.linkedin_url && (
                          <a 
                            href={candidateDetails.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 border border-cyber-cyan/30 bg-cyber-cyan/5 text-cyber-cyan rounded text-xs font-mono flex items-center gap-1.5 self-start md:self-center hover:bg-cyber-cyan/10 transition-colors"
                          >
                            <Linkedin size={12} />
                            <span>LinkedIn Profile</span>
                          </a>
                        )}
                      </div>

                      {/* Blacklist banner restriction */}
                      {candidateDetails.is_blacklisted && (
                        <div className="p-4 bg-cyber-magenta/10 border-2 border-cyber-magenta text-cyber-magenta rounded-lg flex items-center gap-3 shadow-magenta-glow">
                          <AlertCircle size={22} className="shrink-0 animate-bounce" />
                          <div>
                            <h4 className="font-bold font-mono tracking-wide uppercase text-xs">⚠️ DEVIANT POSTURE FLAG DETECTED</h4>
                            <p className="text-[10px] text-slate-300 mt-0.5">
                              This candidate record is currently blacklisted in the compliance database. Matchmaking assessments and execution queries are restricted.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Matchmaking trigger board */}
                      <div className={`p-4 bg-cyber-gray border rounded-lg transition-opacity ${
                        candidateDetails.is_blacklisted ? 'border-cyber-magenta/30 opacity-50' : 'border-cyber-slate'
                      }`}>
                        <h4 className="text-xs font-mono uppercase tracking-wider text-slate-200 mb-3 flex items-center gap-1.5">
                          <Network size={14} className={candidateDetails.is_blacklisted ? 'text-cyber-magenta' : 'text-cyber-cyan'} />
                          <span>Select Target Profiles for Matchmaking Vetting</span>
                        </h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto mb-4 border border-cyber-slate/40 p-2.5 rounded bg-cyber-dark/50">
                          {profiles.map((p) => (
                            <label 
                              key={p.id}
                              className={`flex items-center gap-2 p-2 rounded border text-xs transition-colors ${
                                candidateDetails.is_blacklisted 
                                  ? 'bg-cyber-dark/50 border-transparent text-slate-500 cursor-not-allowed'
                                  : selectedMatchProfiles.includes(p.id!)
                                    ? 'bg-cyber-cyan/5 border-cyber-cyan/50 text-cyber-cyan cursor-pointer'
                                    : 'bg-cyber-gray/30 border-transparent text-slate-300 hover:bg-cyber-gray/80 cursor-pointer'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="accent-cyber-cyan"
                                checked={selectedMatchProfiles.includes(p.id!)}
                                disabled={candidateDetails.is_blacklisted}
                                onChange={() => toggleMatchProfileSelection(p.id!)}
                              />
                              <span className="truncate">{p.role_name}</span>
                            </label>
                          ))}
                        </div>

                        <div className="flex justify-between items-center gap-4">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {candidateDetails.is_blacklisted 
                              ? 'Blacklist blockade active. Execution locked.' 
                              : `${selectedMatchProfiles.length} profiles selected for evaluation.`}
                          </span>
                          <button
                            onClick={handleRunMatchmaking}
                            disabled={selectedMatchProfiles.length === 0 || candidateDetails.is_blacklisted}
                            className="px-4 py-2 bg-cyber-magenta/15 hover:bg-cyber-magenta/30 border border-cyber-magenta/40 text-cyber-magenta hover:text-white disabled:opacity-40 disabled:pointer-events-none rounded font-mono text-xs uppercase tracking-wider transition-all"
                          >
                            Execute Vetting Engines
                          </button>
                        </div>
                      </div>

                      {/* Display Assessments Report */}
                      {candidateDetails.assessments && candidateDetails.assessments.length > 0 ? (
                        <div className="space-y-6">

                          {/* Scorecard Summary Matrix */}
                          <div className="p-4 bg-cyber-gray/40 border border-cyber-slate/50 rounded-lg space-y-3 shadow-md">
                            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5 border-b border-cyber-slate/30 pb-2">
                              <ClipboardList size={14} className="text-cyber-cyan" />
                              <span>Sovereign Vetting Scorecard Matrix</span>
                            </h3>

                            <div className="space-y-2">
                              {candidateDetails.assessments.map((a, idx) => {
                                const hasRed = a.red_flags_detected && a.red_flags_detected.length > 0;
                                const isFocused = activeAssessmentIndex === idx;
                                
                                // Score color
                                let scoreColor = 'text-cyber-cyan';
                                let barColor = 'bg-cyber-cyan';
                                if (hasRed || a.match_score < 50) {
                                  scoreColor = 'text-cyber-magenta';
                                  barColor = 'bg-cyber-magenta';
                                } else if (a.match_score >= 50 && a.match_score < 80) {
                                  scoreColor = 'text-cyber-yellow';
                                  barColor = 'bg-cyber-yellow';
                                }

                                return (
                                  <div 
                                    key={a.id}
                                    onClick={() => setActiveAssessmentIndex(idx)}
                                    className={`p-3 rounded border flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer transition-all ${
                                      isFocused 
                                        ? 'bg-cyber-dark border-cyber-cyan shadow-cyan-glow/20 shadow-sm' 
                                        : 'bg-cyber-gray/30 border-cyber-slate/30 hover:border-cyber-slate hover:bg-cyber-gray/50'
                                    }`}
                                  >
                                    {/* Role name & layer */}
                                    <div className="md:w-1/3 truncate">
                                      <div className="text-xs font-bold text-slate-100 truncate">{a.role_name}</div>
                                      <div className="text-[9px] font-mono text-slate-400 mt-0.5">{a.stack_layer}</div>
                                    </div>

                                    {/* Progress Bar Score */}
                                    <div className="flex-1 flex items-center gap-3">
                                      <div className="w-full bg-cyber-dark rounded-full h-1.5 overflow-hidden border border-cyber-slate/50">
                                        <div 
                                          className={`${barColor} h-full transition-all duration-500`}
                                          style={{ width: `${a.match_score}%` }}
                                        />
                                      </div>
                                      <span className={`text-xs font-bold font-mono ${scoreColor} w-10 text-right`}>
                                        {a.match_score}%
                                      </span>
                                    </div>

                                    {/* Red Flags count & action */}
                                    <div className="flex items-center justify-between md:justify-end gap-6">
                                      {hasRed ? (
                                        <span className="flex items-center gap-1 text-[10px] text-cyber-magenta font-mono">
                                          <AlertTriangle size={12} />
                                          <span>{a.red_flags_detected.length} RED FLAGS</span>
                                        </span>
                                      ) : (
                                        <span className="flex items-center gap-1 text-[10px] text-cyber-green font-mono">
                                          <CheckCircle2 size={12} />
                                          <span>COMPLIANT</span>
                                        </span>
                                      )}

                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveAssessmentIndex(idx);
                                        }}
                                        className={`px-2 py-1 border text-[9px] font-mono rounded uppercase transition-colors ${
                                          isFocused 
                                            ? 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/10' 
                                            : 'border-cyber-slate text-slate-400 hover:border-cyber-cyan hover:text-cyber-cyan'
                                        }`}
                                      >
                                        Inspect
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          
                          {/* Assessment Select/Tabs */}
                          <div className="flex items-center gap-2 overflow-x-auto border-b border-cyber-slate/30 pb-2">
                            {candidateDetails.assessments.map((a, idx) => (
                              <button
                                key={a.id}
                                onClick={() => setActiveAssessmentIndex(idx)}
                                className={`px-3 py-1.5 rounded border text-xs font-mono whitespace-nowrap transition-colors ${
                                  activeAssessmentIndex === idx
                                    ? 'bg-cyber-cyan/10 border-cyber-cyan text-cyber-cyan font-bold'
                                    : 'bg-cyber-gray/40 border-cyber-slate/30 text-slate-400 hover:text-slate-200'
                                }`}
                              >
                                {a.role_name} ({a.match_score}%)
                              </button>
                            ))}
                          </div>

                          {/* Selected Assessment layout */}
                          {(() => {
                            const a = candidateDetails.assessments[activeAssessmentIndex];
                            if (!a) return null;
                            const hasRedFlags = a.red_flags_detected && a.red_flags_detected.length > 0;
                            const glowClass = (hasRedFlags || a.match_score < 50) 
                              ? 'border-cyber-magenta shadow-magenta-glow' 
                              : a.match_score >= 80 
                                ? 'border-cyber-cyan shadow-cyan-glow' 
                                : 'border-cyber-yellow shadow-md';

                            return (
                              <div className={`border rounded-lg p-5 bg-cyber-dark/40 transition-all ${glowClass}`}>
                                
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                                  <div>
                                    <span className="px-2 py-0.5 bg-cyber-gray text-slate-400 border border-cyber-slate rounded text-[9px] font-mono tracking-wider uppercase">
                                      {a.stack_layer}
                                    </span>
                                    <h3 className="text-base font-bold font-sans mt-1">
                                      Vetting Report: {a.role_name}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                      EVALUATED ON: {new Date(a.created_at).toLocaleString()}
                                    </p>
                                  </div>
                                  
                                  {/* SVGRing */}
                                  <AssessmentRing score={a.match_score} hasRedFlags={hasRedFlags} />
                                </div>

                                {/* Red flags detected notification */}
                                {hasRedFlags && (
                                  <div className="bg-cyber-magenta/10 border border-cyber-magenta/40 text-cyber-magenta rounded-lg p-4 mb-6 animate-pulse">
                                    <h4 className="text-xs font-mono uppercase tracking-wider font-bold flex items-center gap-2 mb-2">
                                      <AlertTriangle size={14} />
                                      CRITICAL RED FLAGS DETECTED
                                    </h4>
                                    <ul className="text-xs space-y-1 list-disc pl-5">
                                      {a.red_flags_detected.map((flag, i) => (
                                        <li key={i}>{flag}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Skills Comparison Matrix */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                  
                                  {/* Match */}
                                  <div className="border border-cyber-green/20 bg-cyber-green/5 rounded-lg p-4">
                                    <h4 className="text-[10px] font-mono uppercase tracking-wider text-cyber-green flex items-center gap-1.5 mb-2.5">
                                      <CheckCircle2 size={12} />
                                      <span>Matched Capabilities</span>
                                    </h4>
                                    {a.skills_match && a.skills_match.length > 0 ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {a.skills_match.map((s) => (
                                          <span key={s} className="px-2 py-0.5 bg-cyber-dark/80 text-[10px] text-cyber-green border border-cyber-green/20 font-mono rounded">
                                            {s}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-xs font-mono italic text-slate-500">None identified</span>
                                    )}
                                  </div>

                                  {/* Gap */}
                                  <div className="border border-cyber-magenta/20 bg-cyber-magenta/5 rounded-lg p-4">
                                    <h4 className="text-[10px] font-mono uppercase tracking-wider text-cyber-magenta flex items-center gap-1.5 mb-2.5">
                                      <XCircleIcon className="text-cyber-magenta" />
                                      <span>Capability Gaps</span>
                                    </h4>
                                    {a.skills_gap && a.skills_gap.length > 0 ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {a.skills_gap.map((s) => (
                                          <span key={s} className="px-2 py-0.5 bg-cyber-dark/80 text-[10px] text-cyber-magenta border border-cyber-magenta/20 font-mono rounded">
                                            {s}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-xs font-mono italic text-slate-500">No missing gaps found</span>
                                    )}
                                  </div>
                                </div>

                                {/* Detailed AI Verdict Rationale */}
                                <div className="space-y-2">
                                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                    <Terminal size={12} className="text-cyber-cyan" />
                                    <span>AI Verdict Decisions Log</span>
                                  </h4>
                                  <div className="bg-cyber-gray border border-cyber-slate/50 p-4 rounded text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-line max-h-[220px] overflow-y-auto">
                                    {a.ai_verdict}
                                  </div>
                                </div>

                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="py-12 border border-dashed border-cyber-slate rounded text-center">
                          <p className="text-xs font-mono text-slate-400">
                            No matchmaking analysis exists for this candidate. Select target profiles above and execute assessment.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="cyber-panel rounded-lg p-12 text-center">
                      <FileText className="text-slate-500 mx-auto mb-3" size={36} />
                      <p className="text-sm font-mono text-slate-400">
                        Select a candidate from the ledger list to analyze details and trigger assessments.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: Candidates Registry Dashboard */}
          {activeTab === 'candidates' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold font-sans text-slate-100 flex items-center gap-2">
                    <span>🛡️</span>
                    Candidate Archive Ledger Registry
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    System directory for candidate registrations, profile configurations, and blacklist policies.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setModalInitialCandidate(null);
                    setIsCandidateModalOpen(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-cyber-magenta/20 to-cyber-cyan/20 hover:from-cyber-magenta/30 hover:to-cyber-cyan/30 border border-cyber-magenta/30 text-cyber-magenta hover:text-white rounded font-mono text-xs uppercase tracking-wider flex items-center gap-2 shadow-magenta-glow transition-all"
                >
                  <Plus size={16} />
                  <span>Index Candidate</span>
                </button>
              </div>

              {/* Ledger Vetting Filters */}
              <div className="cyber-panel rounded-lg p-4 border border-cyber-slate/30 bg-cyber-dark/40 backdrop-blur-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-6">
                    {/* Role Filter */}
                    <div className="flex flex-col gap-1.5 min-w-[240px]">
                      <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                        Filter by Best Fit Role
                      </label>
                      <select
                        value={registryFilterRole}
                        onChange={(e) => setRegistryFilterRole(e.target.value)}
                        className="bg-cyber-dark/80 border border-cyber-slate/50 text-slate-200 text-xs rounded px-3 py-2 font-mono focus:outline-none focus:border-cyber-cyan/60 transition-colors"
                      >
                        <option value="">All Roles</option>
                        {Array.from(new Set(profiles.map((p) => p.role_name))).sort().map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Min Score Filter */}
                    <div className="flex flex-col gap-1.5 min-w-[200px]">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                          Min Matching Score
                        </label>
                        <span className="text-xs font-mono font-bold text-cyber-cyan">
                          {registryFilterMinScore}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={registryFilterMinScore}
                        onChange={(e) => setRegistryFilterMinScore(Number(e.target.value))}
                        className="w-full h-1 bg-cyber-slate rounded-lg appearance-none cursor-pointer accent-cyber-cyan"
                      />
                    </div>
                  </div>

                  {/* Count & Reset */}
                  <div className="flex items-center gap-4 self-end md:self-auto">
                    <span className="text-[10px] font-mono text-slate-400">
                      MATCHES: <span className="text-cyber-green font-bold">{filteredCandidates.length}</span> / {candidates.length}
                    </span>
                    {(registryFilterRole || registryFilterMinScore > 0) && (
                      <button
                        onClick={() => {
                          setRegistryFilterRole('');
                          setRegistryFilterMinScore(0);
                        }}
                        className="px-3 py-1 bg-cyber-magenta/10 hover:bg-cyber-magenta/25 border border-cyber-magenta/30 hover:border-cyber-magenta/50 text-cyber-magenta hover:text-white rounded font-mono text-[9px] uppercase tracking-wider transition-all"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Candidates Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCandidates.map((candidate) => {
                  return (
                    <div 
                      key={candidate.id}
                      className={`cyber-panel rounded-lg p-5 flex flex-col justify-between border transition-all duration-300 ${
                        candidate.is_blacklisted 
                          ? 'border-cyber-magenta/50 shadow-magenta-glow bg-cyber-magenta/5' 
                          : 'border-cyber-slate/50 hover:border-cyber-cyan/40'
                      }`}
                    >
                      <div>
                        {/* Name and Status Header */}
                        <div className="flex items-start justify-between gap-4 border-b border-cyber-slate/30 pb-3 mb-3">
                          <div className="truncate">
                            <h4 className="text-sm font-bold font-sans text-slate-100 truncate">
                              {candidate.full_name}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono block truncate mt-0.5">
                              {candidate.email || 'No email registered'}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider ${
                            candidate.is_blacklisted 
                              ? 'bg-cyber-magenta/25 text-cyber-magenta border border-cyber-magenta/30 animate-pulse' 
                              : 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20'
                          }`}>
                            {candidate.is_blacklisted ? 'Deviant' : 'Compliant'}
                          </span>
                        </div>

                        {/* Experience and Skills */}
                        <div className="space-y-3 mb-4 text-xs font-sans text-slate-300">
                          <div className="flex justify-between font-mono text-[10px] text-slate-400">
                            <span>EXPERIENCE:</span>
                            <span className="text-slate-200">{candidate.experience_years} Years</span>
                          </div>

                          <div>
                            <span className="text-[9px] font-mono text-slate-400 block mb-1">CAPABILITY LEDGER TAGS:</span>
                            {candidate.skills && candidate.skills.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {candidate.skills.map((s) => (
                                  <span key={s} className="px-1.5 py-0.5 bg-cyber-dark/80 text-[8px] text-slate-400 border border-cyber-slate font-mono rounded">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] font-sans text-slate-500 italic block">No tags parsed yet.</span>
                            )}
                          </div>

                          {candidate.linkedin_url && (
                            <div className="text-[10px] font-mono text-cyber-cyan truncate flex items-center gap-1 mt-2">
                              <Linkedin size={10} />
                              <span className="truncate">{candidate.linkedin_url}</span>
                            </div>
                          )}

                          {/* Best Vetting Fit */}
                          <div className="border-t border-cyber-slate/20 pt-3 mt-3">
                            <span className="text-[9px] font-mono text-slate-400 block mb-1">BEST FIT ROLE:</span>
                            {candidate.highest_role_name ? (
                              <div className="flex items-center justify-between bg-cyber-dark/50 border border-cyber-slate/30 rounded px-2.5 py-1.5 shadow-inner">
                                <span className="text-[10px] font-mono text-slate-200 truncate pr-2" title={candidate.highest_role_name}>
                                  {candidate.highest_role_name}
                                </span>
                                <span className={`text-[10px] font-mono font-bold shrink-0 ${
                                  (candidate.highest_score ?? 0) >= 80 ? 'text-cyber-green' :
                                  (candidate.highest_score ?? 0) >= 60 ? 'text-cyber-cyan' :
                                  (candidate.highest_score ?? 0) >= 40 ? 'text-cyber-yellow' :
                                  'text-cyber-magenta'
                                }`}>
                                  {candidate.highest_score}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-500 italic block">No assessments recorded.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-between items-center pt-3 border-t border-cyber-slate/20 mt-2">
                        {/* Blacklist toggle */}
                        <button
                          onClick={() => handleToggleBlacklist(candidate)}
                          className={`flex items-center gap-1 py-1 px-2.5 rounded border text-[9px] font-mono uppercase tracking-wider transition-colors ${
                            candidate.is_blacklisted
                              ? 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green hover:bg-cyber-green/20'
                              : 'bg-cyber-magenta/10 border-cyber-magenta/30 text-cyber-magenta hover:bg-cyber-magenta/20'
                          }`}
                          title={candidate.is_blacklisted ? 'Whitelist candidate record' : 'Blacklist candidate record'}
                        >
                          {candidate.is_blacklisted ? <UserCheck size={10} /> : <UserX size={10} />}
                          <span>{candidate.is_blacklisted ? 'Whitelist' : 'Blacklist'}</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              setSelectedCandidateId(candidate.id);
                              setIsDossierModalOpen(true);
                            }}
                            className="px-2 py-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/25 border border-cyber-cyan/30 text-cyber-cyan hover:text-white rounded font-mono text-[9px] uppercase tracking-wider transition-colors"
                            title="Inspect complete vetting dossier & scorecard"
                          >
                            Dossier
                          </button>
                          <button
                            onClick={() => {
                              setModalInitialCandidate(candidate);
                              setIsCandidateModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-cyber-cyan border border-transparent hover:border-cyber-cyan/20 rounded transition-colors"
                            title="Edit candidate profile parameters"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteCandidate(candidate.id)}
                            className="p-1.5 text-slate-400 hover:text-cyber-magenta border border-transparent hover:border-cyber-magenta/20 rounded transition-colors"
                            title="Purge candidate record"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {candidates.length === 0 ? (
                  <div className="col-span-full py-16 text-center border border-dashed border-cyber-slate rounded-lg">
                    <p className="text-sm font-mono text-slate-400">
                      No candidate records indexed. Register a new candidate manually above.
                    </p>
                  </div>
                ) : filteredCandidates.length === 0 ? (
                  <div className="col-span-full py-16 text-center border border-dashed border-cyber-slate rounded-lg bg-cyber-magenta/5 border-cyber-magenta/20">
                    <p className="text-sm font-mono text-cyber-magenta">
                      No candidates match the filter criteria. Adjust the vetting role or minimum score.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Floating task log terminal */}
          {activeTaskId && (
            <div className="fixed bottom-6 right-6 z-50 w-full max-w-lg cyber-panel border-cyber-cyan/50 shadow-cyan-glow-intense rounded-lg overflow-hidden flex flex-col">
              <div className="bg-cyber-gray px-4 py-2 border-b border-cyber-slate/60 flex items-center justify-between text-xs font-mono">
                <span className="text-cyber-cyan flex items-center gap-1.5">
                  <Terminal size={14} className="animate-pulse" />
                  <span>Sovereign Worker Thread {activeTaskId.slice(0, 8)}</span>
                </span>
                <span className="px-2 py-0.5 bg-cyber-dark text-[10px] text-cyber-cyan font-bold uppercase rounded border border-cyber-cyan/20">
                  {taskStatus}
                </span>
              </div>
              
              <div className="h-44 bg-cyber-dark p-3 font-mono text-[10px] text-slate-300 overflow-y-auto space-y-1">
                {taskLogs.map((log, idx) => (
                  <div key={idx} className="leading-tight break-all">
                    {log}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>

              {/* Progress indicator */}
              <div className="bg-cyber-gray border-t border-cyber-slate/50 p-3 font-mono text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span>QUEUE PROGRESS</span>
                  <span>{taskProgress}%</span>
                </div>
                <div className="w-full bg-cyber-dark border border-cyber-slate rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-cyber-cyan to-cyber-magenta h-full transition-all duration-300"
                    style={{ width: `${taskProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Profile CRUD Modal */}
      <ProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProfile}
        initialProfile={modalInitialProfile}
      />

      {/* Candidate CRUD Modal */}
      <CandidateModal
        isOpen={isCandidateModalOpen}
        onClose={() => setIsCandidateModalOpen(false)}
        onSave={handleSaveCandidate}
        initialCandidate={modalInitialCandidate}
      />

      {/* Dossier Modal */}
      <DossierModal
        isOpen={isDossierModalOpen}
        onClose={() => setIsDossierModalOpen(false)}
        candidateDetails={candidateDetails}
        profiles={profiles}
        activeVettingProfileId={activeVettingProfileId}
        taskProgress={taskProgress}
        onRunVetting={async (candidateId, profileId) => {
          try {
            setActiveVettingProfileId(profileId);
            const res = await api.matchCandidate(candidateId, [profileId]);
            startTaskProgressStream(res.task_id);
          } catch (err) {
            alert('Failed to trigger vetting assessment: ' + err);
            setActiveVettingProfileId(null);
          }
        }}
      />
    </div>
  );
}

// Extra inline utility icons for clean bundle size
function ServerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="14" 
      height="14" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
      <line x1="6" y1="6" x2="6.01" y2="6"></line>
      <line x1="6" y1="18" x2="6.01" y2="18"></line>
    </svg>
  );
}

function XCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="12" 
      height="12" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      {...props}
    >
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
  );
}
