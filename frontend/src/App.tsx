import React, { useState, useEffect, useRef } from 'react';
import { 
   Shield, Activity, Database, Cpu, Layers, Terminal, Plus,
   Trash2, Edit, UploadCloud, Linkedin, CheckCircle2,
   AlertTriangle, User, Mail, FileText, Sparkles, Network,
   UserX, UserCheck, ClipboardList, AlertCircle,
   ChevronDown, ChevronUp, CalendarDays, TrendingUp, Clock, X, Sun, Moon
 } from 'lucide-react';
import { api, API_URL, TalentProfile, Candidate, CandidateDetails, Project, UtilizationData } from './utils/api';
import { AssessmentRing } from './components/AssessmentRing';
import { ProfileModal } from './components/ProfileModal';
import { CandidateModal } from './components/CandidateModal';
import { DossierModal } from './components/DossierModal';
import { RangePicker } from './components/RangePicker';

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
  const [activeTab, setActiveTab] = useState<'profiles' | 'vetting' | 'candidates' | 'planner' | 'projects' | 'utilization'>('profiles');
  const [selectedLayer, setSelectedLayer] = useState<string>('');
  
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // SOW Planner States
  const [sowText, setSowText] = useState('');
  const [sowFile, setSowFile] = useState<File | null>(null);
  const [plannerResults, setPlannerResults] = useState<{
    matched_profiles: Array<{ id: number; role_name: string; relevance_reason: string }>;
    missing_profiles: Array<TalentProfile>;
  } | null>(null);
  const [isPlannerLoading, setIsPlannerLoading] = useState(false);
  const [addedProfileNames, setAddedProfileNames] = useState<string[]>([]);
  const [plannerDragActive, setPlannerDragActive] = useState(false);

  // Project States
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [activeViewProjectId, setActiveViewProjectId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);

  const fetchProjects = async () => {
    try {
      const data = await api.listProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  const handleLoadProject = (projectId: number | null, allProjectsList?: Project[]) => {
    const list = allProjectsList || projects;
    if (!projectId) {
      setSelectedProjectId(null);
      setSowText('');
      setSowFile(null);
      setPlannerResults(null);
      setProjectName('');
      setAddedProfileNames([]);
      return;
    }
    const project = list.find((p) => p.id === projectId);
    if (!project) return;
    setSelectedProjectId(project.id);
    setSowText(project.sow_text || '');
    setSowFile(null);
    setPlannerResults(project.analysis_results);
    setProjectName(project.name);
    
    // Check which missing profiles already exist in the active ledger
    const existingNames = profiles.map((p) => p.role_name);
    const missing = project.analysis_results.missing_profiles || [];
    const alreadyAdded = missing
      .filter((mp: TalentProfile) => existingNames.includes(mp.role_name))
      .map((mp: TalentProfile) => mp.role_name);
    setAddedProfileNames(alreadyAdded);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      alert('Please enter a project name.');
      return;
    }
    if (!plannerResults) {
      alert('No SOW analysis results to save.');
      return;
    }
    setIsSavingProject(true);
    try {
      const payload = {
        name: projectName.trim(),
        sow_text: sowText,
        sow_filename: sowFile ? sowFile.name : (selectedProjectId ? (projects.find(p => p.id === selectedProjectId)?.sow_filename || '') : ''),
        analysis_results: plannerResults
      };
      const saved = await api.createProject(payload);
      await fetchProjects();
      setSelectedProjectId(saved.id);
      alert('Project workspace saved successfully!');
    } catch (err: any) {
      alert(`Failed to save project: ${err.message || err}`);
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDeleteProject = async (projectId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    try {
      await api.deleteProject(projectId);
      await fetchProjects();
      if (selectedProjectId === projectId) {
        handleLoadProject(null);
      }
    } catch (err: any) {
      alert(`Failed to delete project: ${err.message || err}`);
    }
  };

  // Assignment date modal state
  const [assignModal, setAssignModal] = useState<{
    candidateId: number;
    candidateName: string;
    projectId: number;
    profileId: number | undefined;
    profileName: string;
    startDate: string;
    endDate: string;
  } | null>(null);

  const handleAssignCandidate = async (projectId: number, candidateId: number, profileId?: number, startDate?: string, endDate?: string) => {
    try {
      await api.assignCandidateToProject(projectId, candidateId, profileId, startDate, endDate);
      fetchCandidates();
      if (selectedProjectId) {
        const list = await api.listProjects();
        setProjects(list);
        handleLoadProject(selectedProjectId, list);
      }
      if (activeTab === 'utilization') fetchUtilization();
    } catch (err: any) {
      alert(err.message || 'Failed to assign candidate');
    }
  };

  const handleConfirmAssign = async () => {
    if (!assignModal) return;
    await handleAssignCandidate(
      assignModal.projectId,
      assignModal.candidateId,
      assignModal.profileId,
      assignModal.startDate || undefined,
      assignModal.endDate || undefined,
    );
    setAssignModal(null);
  };

  const handleReleaseAssignment = async (assignmentId: number) => {
    try {
      await api.releaseAssignment(assignmentId);
      fetchCandidates();
      const list = await api.listProjects();
      setProjects(list);
      if (selectedProjectId) handleLoadProject(selectedProjectId, list);
      if (activeTab === 'utilization') fetchUtilization();
    } catch (err: any) {
      alert(err.message || 'Failed to release assignment');
    }
  };

  const handleAnalyzeScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sowText.trim() && !sowFile) {
      alert('Please provide either Scope of Work text or upload an SOW document.');
      return;
    }
    setIsPlannerLoading(true);
    setPlannerResults(null);
    setAddedProfileNames([]);
    try {
      const results = await api.analyzeProjectScope(sowText || undefined, sowFile || undefined);
      setPlannerResults(results);
    } catch (err: any) {
      alert(err.message || 'Scope analysis failed');
    } finally {
      setIsPlannerLoading(false);
    }
  };

  const handleAddMissingProfile = async (profile: TalentProfile) => {
    try {
      await api.createProfile(profile);
      setAddedProfileNames((prev) => [...prev, profile.role_name]);
      fetchProfiles();
    } catch (err: any) {
      alert(`Failed to add profile: ${err.message || err}`);
    }
  };

  const handleAddAllMissingProfiles = async () => {
    if (!plannerResults || !plannerResults.missing_profiles) return;
    const missing = plannerResults.missing_profiles.filter(
      (p) => !addedProfileNames.includes(p.role_name)
    );
    if (missing.length === 0) return;
    
    let successCount = 0;
    for (const profile of missing) {
      try {
        await api.createProfile(profile);
        setAddedProfileNames((prev) => [...prev, profile.role_name]);
        successCount++;
      } catch (err) {
        console.error(`Failed to add bulk profile ${profile.role_name}:`, err);
      }
    }
    fetchProfiles();
    alert(`Successfully added ${successCount} profiles to the ledger!`);
  };
  
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
  const [registrySearchQuery, setRegistrySearchQuery] = useState<string>('');

  // Delete confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    candidateId: number | null;
    candidateName: string;
    message: string;
    canProceed: boolean;
  }>({ isOpen: false, candidateId: null, candidateName: '', message: '', canProceed: false });
  
  // Computed state for filtered candidates in the Registry tab
  const filteredCandidates = candidates.filter((candidate) => {
    if (registrySearchQuery.trim()) {
      const q = registrySearchQuery.trim().toLowerCase();
      if (!candidate.full_name.toLowerCase().includes(q)) {
        return false;
      }
    }
    if (registryFilterRole) {
      const activeAssessment = candidate.assessments?.find((a) => a.role_name === registryFilterRole);
      if (!activeAssessment) {
        return false;
      }
      if (registryFilterMinScore > 0 && activeAssessment.match_score < registryFilterMinScore) {
        return false;
      }
    } else {
      if (registryFilterMinScore > 0 && (candidate.highest_score ?? 0) < registryFilterMinScore) {
        return false;
      }
    }
    return true;
  });

  const [expandedProfiles, setExpandedProfiles] = useState<Record<number, boolean>>({});
  const [expandedCandidates, setExpandedCandidates] = useState<Record<number, boolean>>({});
  const [profileSearchQuery, setProfileSearchQuery] = useState('');

  // Computed state for filtered talent profiles
  const filteredProfiles = profiles.filter((profile) => {
    const query = profileSearchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      profile.role_name.toLowerCase().includes(query) ||
      profile.role_summary.toLowerCase().includes(query) ||
      profile.category.toLowerCase().includes(query) ||
      profile.stack_layer.toLowerCase().includes(query)
    );
  });

  // Computed dynamic matched profiles and missing gaps for SOW Planner
  const plannerMatchedProfiles = (() => {
    if (!plannerResults) return [];
    const list = [...plannerResults.matched_profiles];
    const missing = plannerResults.missing_profiles || [];
    missing.forEach((mp) => {
      const activeProf = profiles.find((p) => p.role_name === mp.role_name);
      if (activeProf) {
        const alreadyMatched = list.some((m) => m.role_name === mp.role_name);
        if (!alreadyMatched) {
          list.push({
            id: activeProf.id!,
            role_name: mp.role_name,
            relevance_reason: `Newly added: ${mp.role_summary || 'Identified missing gap successfully imported to ledger.'}`
          });
        }
      }
    });
    return list;
  })();

  const plannerMissingProfiles = (() => {
    if (!plannerResults) return [];
    const missing = plannerResults.missing_profiles || [];
    return missing.filter((mp) => !profiles.some((p) => p.role_name === mp.role_name));
  })();

  const toggleProfileExpanded = (id: number) => {
    setExpandedProfiles((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCandidateExpanded = (id: number) => {
    setExpandedCandidates((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAllProfiles = () => {
    const next: Record<number, boolean> = {};
    profiles.forEach((p) => {
      if (p.id) next[p.id] = true;
    });
    setExpandedProfiles(next);
  };

  const collapseAllProfiles = () => {
    setExpandedProfiles({});
  };

  const expandAllCandidates = () => {
    const next: Record<number, boolean> = {};
    filteredCandidates.forEach((c) => {
      if (c.id) next[c.id] = true;
    });
    setExpandedCandidates(next);
  };

  const collapseAllCandidates = () => {
    setExpandedCandidates({});
  };

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
    fetchProjects();
  }, []);

  // Utilization state
  const [utilData, setUtilData] = useState<UtilizationData | null>(null);
  const [utilLoading, setUtilLoading] = useState(false);
  const [expandedUtilCandidates, setExpandedUtilCandidates] = useState<Set<number>>(new Set());
  const toggleUtilCandidate = (id: number) => setExpandedUtilCandidates(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const fetchUtilization = async () => {
    setUtilLoading(true);
    try {
      const data = await api.getUtilization();
      setUtilData(data);
    } catch (err) {
      console.error('Failed to fetch utilization data:', err);
    } finally {
      setUtilLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'utilization') fetchUtilization();
  }, [activeTab]);

  const fetchSystemConfig = async () => {
    try {
      const res = await fetch(API_URL);
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
      let saved: TalentProfile;
      if (profilePayload.id) {
        saved = await api.updateProfile(profilePayload.id, profilePayload);
      } else {
        saved = await api.createProfile(profilePayload);
      }
      setIsModalOpen(false);
      fetchProfiles();
      if (saved && saved.id) {
        setExpandedProfiles((prev) => ({ ...prev, [saved.id!]: true }));
      }
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
      let saved: any;
      if (payload.id) {
        saved = await api.updateCandidate(payload.id, payload);
      } else {
        saved = await api.createCandidate(payload);
      }
      setIsCandidateModalOpen(false);
      fetchCandidates();
      if (saved && saved.id) {
        setExpandedCandidates((prev) => ({ ...prev, [saved.id]: true }));
      }
      if (saved && saved.task_id) {
        startTaskProgressStream(saved.task_id);
      }
      if (selectedCandidateId === payload.id && selectedCandidateId !== null) {
        fetchCandidateDetails(selectedCandidateId);
      }
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    }
  };

  const handleDeleteCandidate = (id: number) => {
    const candidate = candidates.find(c => c.id === id);
    const name = candidate?.full_name || 'Unknown';
    if (candidate && (candidate.assignments || []).length > 0) {
      const projectNames = [...new Set((candidate.assignments || []).map(a => a.project_name).filter(Boolean))].join(', ');
      setDeleteConfirm({
        isOpen: true,
        candidateId: null,
        candidateName: name,
        message: `This candidate has active assignments in: ${projectNames || 'a project'}. Please release all assignments first, then try again.`,
        canProceed: false,
      });
      return;
    }
    setDeleteConfirm({
      isOpen: true,
      candidateId: id,
      candidateName: name,
      message: `You are about to delete "${name}" from the archive ledger. This action cannot be undone. Are you sure?`,
      canProceed: true,
    });
  };

  const confirmDeleteCandidate = async () => {
    const id = deleteConfirm.candidateId;
    setDeleteConfirm({ isOpen: false, candidateId: null, candidateName: '', message: '', canProceed: false });
    if (!id) return;
    try {
      await api.deleteCandidate(id);
      if (selectedCandidateId === id) {
        setSelectedCandidateId(null);
        setCandidateDetails(null);
      }
      fetchCandidates();
    } catch (err: any) {
      setDeleteConfirm({
        isOpen: true,
        candidateId: null,
        candidateName: '',
        message: err.message || 'Failed to delete candidate.',
        canProceed: false,
      });
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

  const handleToggleDisqualifyAssessment = async (assessmentId: number, disqualified: boolean) => {
    try {
      await api.disqualifyAssessment(assessmentId, disqualified);
      // Refresh candidate details to update DossierModal state
      if (selectedCandidateId !== null) {
        await fetchCandidateDetails(selectedCandidateId);
      }
      // Refresh general lists (updates Profiles Ledger badges, Registry role filter, and Projects Matches)
      await fetchCandidates();
    } catch (err: any) {
      alert(err.message || 'Failed to change assessment status');
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
        if (wsRef.current !== ws) return;
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
            if (wsRef.current === ws) {
              setActiveTaskId(null);
            }
          }, 4000);
        }
      },
      () => {
        if (wsRef.current !== ws) return;
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

        {/* Top-Center Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-cyber-gray border border-cyber-slate rounded-lg select-none">
          <button
            onClick={() => setActiveTab('profiles')}
            className={`px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-wide transition-all ${
              activeTab === 'profiles' 
                ? 'bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan font-bold shadow-cyan-glow' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Profiles
          </button>
          <button
            onClick={() => setActiveTab('vetting')}
            className={`px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-wide transition-all ${
              activeTab === 'vetting' 
                ? 'bg-cyber-magenta/10 border border-cyber-magenta/30 text-cyber-magenta font-bold shadow-magenta-glow' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Vetting
          </button>
          <button
            onClick={() => setActiveTab('candidates')}
            className={`px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-wide transition-all ${
              activeTab === 'candidates' 
                ? 'bg-cyber-magenta/10 border border-cyber-magenta/30 text-cyber-magenta font-bold shadow-magenta-glow' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Registry
          </button>
          <button
            onClick={() => setActiveTab('planner')}
            className={`px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-wide transition-all ${
              activeTab === 'planner' 
                ? 'bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan font-bold shadow-cyan-glow' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Planner
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-wide transition-all ${
              activeTab === 'projects'
                ? 'bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan font-bold shadow-cyan-glow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Projects
          </button>
          <button
            onClick={() => setActiveTab('utilization')}
            className={`px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-wide transition-all ${
              activeTab === 'utilization'
                ? 'bg-cyber-green/10 border border-cyber-green/30 text-cyber-green font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Utilization
          </button>
        </div>
        
        {/* Status Indicators */}
        <div className="flex items-center gap-6 text-xs font-mono">
          {/* Theme Toggler */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3 py-1 bg-cyber-gray border border-cyber-slate hover:border-slate-400 rounded-full text-slate-300 hover:text-slate-100 transition-colors focus:outline-none"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Sun size={12} className="text-cyber-cyan" /> : <Moon size={12} className="text-cyber-magenta" />}
            <span className="text-[10px] tracking-wider uppercase font-bold">
              {theme === 'light' ? 'Light' : 'Dark'}
            </span>
          </button>

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
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold font-sans text-slate-100 flex items-center gap-2">
                    <span>📋</span>
                    {selectedLayer ? `Profiles: ${selectedLayer}` : 'Talent Profiles Ledger'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    Admin register for vetting benchmarks and requirements criteria.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search Bar */}
                  <div className="flex gap-2">
                    <input
                      type="search"
                      value={profileSearchQuery}
                      onChange={(e) => setProfileSearchQuery(e.target.value)}
                      placeholder="Search profiles by title, summary..."
                      className="bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-xs text-slate-200 rounded font-mono w-60 transition-colors"
                    />
                    {profileSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setProfileSearchQuery('')}
                        className="px-3 py-2 bg-cyber-slate border border-cyber-slate/50 text-slate-300 rounded text-[10px] font-mono hover:bg-cyber-slate/80 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  
                  {/* Expand/Collapse All */}
                  <div className="flex items-center bg-cyber-dark border border-cyber-slate/50 rounded p-1 font-mono text-[10px]">
                    <button
                      onClick={expandAllProfiles}
                      className="px-2 py-1 hover:text-cyber-cyan text-slate-400 rounded transition-colors"
                    >
                      Expand All
                    </button>
                    <span className="text-slate-600 px-1">|</span>
                    <button
                      onClick={collapseAllProfiles}
                      className="px-2 py-1 hover:text-cyber-cyan text-slate-400 rounded transition-colors"
                    >
                      Collapse All
                    </button>
                  </div>
                  
                  {/* Add Target Role */}
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
              </div>

              {/* Profiles Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                {filteredProfiles.map((profile) => {
                  const isExpanded = !!expandedProfiles[profile.id!];
                  return (
                    <div 
                      key={profile.id}
                      className="cyber-panel rounded-lg p-5 flex flex-col justify-between group hover:border-cyber-cyan/40 transition-all duration-300"
                    >
                      <div>
                        {/* Card Header */}
                        <div 
                          onClick={() => toggleProfileExpanded(profile.id!)}
                          className="flex items-start justify-between gap-4 border-b border-cyber-slate/30 pb-3 mb-3 cursor-pointer select-none"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 bg-cyber-dark text-slate-300 border border-cyber-slate rounded-full text-[9px] font-mono tracking-wider uppercase">
                                {profile.stack_layer}
                              </span>
                              <span className="px-2 py-0.5 bg-cyber-magenta/10 border border-cyber-magenta/30 text-cyber-magenta rounded text-[9px] font-mono uppercase tracking-wider">
                                {profile.engagement_tier}
                              </span>
                              <span className="px-2 py-0.5 bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan rounded text-[9px] font-mono uppercase tracking-wider font-bold">
                                {candidates.filter((c) => c.assessments && c.assessments.some((a) => a.role_name === profile.role_name)).length} Candidates
                              </span>
                            </div>
                            <h4 className="text-base font-bold font-sans text-slate-100 group-hover:text-cyber-cyan transition-colors mt-1.5">
                              {profile.role_name}
                            </h4>
                          </div>
                          <div className="p-1 text-slate-400 group-hover:text-cyber-cyan transition-colors rounded hover:bg-cyber-gray/50">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>

                        {/* Summary */}
                        <p 
                          onClick={() => toggleProfileExpanded(profile.id!)}
                          className={`text-xs text-slate-300 leading-relaxed font-sans mb-4 cursor-pointer ${
                            !isExpanded ? 'line-clamp-2' : ''
                          }`}
                        >
                          {profile.role_summary}
                        </p>

                        {/* Expanded details */}
                        {isExpanded && (
                          <>
                            {/* Red Flags warning box */}
                            <div className="bg-cyber-magenta/5 border border-cyber-magenta/20 rounded p-3 mb-4">
                              <div className="text-[10px] font-mono uppercase tracking-widest text-cyber-magenta flex items-center gap-1.5 mb-1.5">
                                <AlertTriangle size={12} />
                                <span>Screen-Out Red Flags</span>
                              </div>
                              <ul className="text-[11px] text-slate-300 space-y-1 pl-4 list-disc font-sans">
                                {profile.red_flags
                                  .split(/[;\n]+/)
                                  .map((f) => f.replace(/^-\s*/, '').trim())
                                  .filter(Boolean)
                                  .map((flag, idx) => (
                                    <li key={idx} className="leading-tight">
                                      {flag}
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
                          </>
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
                  );
                })}

                {profiles.length === 0 ? (
                  <div className="col-span-full py-16 text-center border border-dashed border-cyber-slate rounded-lg">
                    <p className="text-sm font-mono text-slate-400">
                      No talent profiles found matching filter layer. Add new target role above.
                    </p>
                  </div>
                ) : filteredProfiles.length === 0 ? (
                  <div className="col-span-full py-16 text-center border border-dashed border-cyber-slate rounded-lg bg-cyber-magenta/5 border-cyber-magenta/20">
                    <p className="text-sm font-mono text-cyber-magenta">
                      No profiles match the search query. Adjust the query to filter again.
                    </p>
                  </div>
                ) : null}
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
                          <div
                            key={c.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedCandidateId(c.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedCandidateId(c.id); }}
                            className={`w-full text-left p-3 rounded border transition-all flex flex-col gap-1.5 cursor-pointer ${
                              isSelected 
                                ? 'bg-cyber-magenta/10 border-cyber-magenta text-white shadow-magenta-glow' 
                                : 'bg-cyber-gray/50 border-cyber-slate/30 text-slate-300 hover:border-cyber-slate'
                            }`}
                          >
                            <div className="flex justify-between items-start w-full">
                              <span className="text-xs font-bold font-sans truncate">{c.full_name}</span>
                              <span className="text-[9px] font-mono text-slate-400 shrink-0">
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
                          </div>
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

                        <div className="flex items-center gap-2 self-start md:self-center">
                          {candidateDetails.linkedin_url && (
                            <a 
                              href={candidateDetails.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 border border-cyber-cyan/30 bg-cyber-cyan/5 text-cyber-cyan rounded text-xs font-mono flex items-center gap-1.5 hover:bg-cyber-cyan/10 transition-colors"
                            >
                              <Linkedin size={12} />
                              <span>LinkedIn Profile</span>
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteCandidate(candidateDetails.id)}
                            className="px-3 py-1.5 border border-red-500/40 bg-red-900/15 text-red-400 rounded text-xs font-mono flex items-center gap-1.5 hover:bg-red-900/30 hover:text-red-300 transition-colors font-bold"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
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
                                const isDisqualified = a.is_disqualified === true;
                                
                                // Score color
                                let scoreColor = 'text-cyber-cyan';
                                let barColor = 'bg-cyber-cyan';
                                if (isDisqualified) {
                                  scoreColor = 'text-slate-600';
                                  barColor = 'bg-slate-600';
                                } else if (hasRed || a.match_score < 50) {
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
                                      isDisqualified
                                        ? 'bg-cyber-gray/15 border-cyber-slate/20 opacity-60'
                                        : isFocused 
                                          ? 'bg-cyber-dark border-cyber-cyan shadow-cyan-glow/20 shadow-sm' 
                                          : 'bg-cyber-gray/30 border-cyber-slate/30 hover:border-cyber-slate hover:bg-cyber-gray/50'
                                    }`}
                                  >
                                    {/* Role name & layer */}
                                    <div className="md:w-1/3 truncate">
                                      <div className={`text-xs font-bold truncate ${isDisqualified ? 'text-slate-500 line-through' : 'text-slate-100'}`}>{a.role_name}</div>
                                      <div className="text-[9px] font-mono text-slate-400 mt-0.5">{a.stack_layer}</div>
                                    </div>

                                    {/* Progress Bar Score */}
                                    <div className="flex-1 flex items-center gap-3">
                                      {isDisqualified ? (
                                        <span className="text-[10px] font-mono text-red-400/80 bg-red-900/20 border border-red-500/30 px-2 py-0.5 rounded uppercase tracking-wider">
                                          Disqualified
                                        </span>
                                      ) : (
                                        <>
                                          <div className="w-full bg-cyber-dark rounded-full h-1.5 overflow-hidden border border-cyber-slate/50">
                                            <div 
                                              className={`${barColor} h-full transition-all duration-500`}
                                              style={{ width: `${a.match_score}%` }}
                                            />
                                          </div>
                                          <span className={`text-xs font-bold font-mono ${scoreColor} w-10 text-right`}>
                                            {a.match_score}%
                                          </span>
                                        </>
                                      )}
                                    </div>

                                    {/* Red Flags count & action */}
                                    <div className="flex items-center justify-between md:justify-end gap-3">
                                      {!isDisqualified && (
                                        hasRed ? (
                                          <span className="flex items-center gap-1 text-[10px] text-cyber-magenta font-mono">
                                            <AlertTriangle size={12} />
                                            <span>{a.red_flags_detected.length} RED FLAGS</span>
                                          </span>
                                        ) : (
                                          <span className="flex items-center gap-1 text-[10px] text-cyber-green font-mono">
                                            <CheckCircle2 size={12} />
                                            <span>COMPLIANT</span>
                                          </span>
                                        )
                                      )}

                                      {/* Disqualify / Re-qualify toggle */}
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleDisqualifyAssessment(a.id, !isDisqualified);
                                        }}
                                        className={`px-2 py-1 border text-[9px] font-mono rounded uppercase transition-colors font-bold ${
                                          isDisqualified
                                            ? 'border-cyber-green/50 text-cyber-green bg-cyber-green/10 hover:bg-cyber-green/20'
                                            : 'border-red-500/40 text-red-400 bg-red-900/10 hover:bg-red-900/25'
                                        }`}
                                        title={isDisqualified ? 'Re-qualify this candidate for this profile' : 'Disqualify this candidate from this profile'}
                                      >
                                        {isDisqualified ? 'Re-qualify' : 'Disqualify'}
                                      </button>

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
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-cyber-dark border border-cyber-slate/50 rounded p-1 font-mono text-[10px]">
                    <button
                      onClick={expandAllCandidates}
                      className="px-2 py-1 hover:text-cyber-cyan text-slate-400 rounded transition-colors"
                    >
                      Expand All
                    </button>
                    <span className="text-slate-600 px-1">|</span>
                    <button
                      onClick={collapseAllCandidates}
                      className="px-2 py-1 hover:text-cyber-cyan text-slate-400 rounded transition-colors"
                    >
                      Collapse All
                    </button>
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
              </div>

              {/* Ledger Vetting Filters */}
              <div className="cyber-panel rounded-lg p-4 border border-cyber-slate/30 bg-cyber-dark/40 backdrop-blur-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-6">
                    {/* Name Filter */}
                    <div className="flex flex-col gap-1.5 min-w-[240px]">
                      <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                        Search by Candidate Name
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={registrySearchQuery}
                          onChange={(e) => setRegistrySearchQuery(e.target.value)}
                          placeholder="Type name to filter..."
                          className="w-full bg-cyber-dark/80 border border-cyber-slate/50 text-slate-200 text-xs rounded px-3 py-2 font-mono focus:outline-none focus:border-cyber-cyan/60 transition-colors placeholder:text-slate-500"
                        />
                        {registrySearchQuery && (
                          <button
                            onClick={() => setRegistrySearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 font-sans text-sm focus:outline-none"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>

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
                    {(registryFilterRole || registryFilterMinScore > 0 || registrySearchQuery) && (
                      <button
                        onClick={() => {
                          setRegistryFilterRole('');
                          setRegistryFilterMinScore(0);
                          setRegistrySearchQuery('');
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                {filteredCandidates.map((candidate) => {
                  const isExpanded = !!expandedCandidates[candidate.id];
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
                        <div 
                          onClick={() => toggleCandidateExpanded(candidate.id)}
                          className="flex items-start justify-between gap-4 border-b border-cyber-slate/30 pb-3 mb-3 cursor-pointer select-none"
                        >
                          <div className="truncate flex-1">
                            <h4 className="text-sm font-bold font-sans text-slate-100 truncate">
                              {candidate.full_name}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono block truncate mt-0.5">
                              {candidate.email || 'No email registered'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                            {(() => {
                              const asgns = candidate.assignments || [];
                              const isAssigned = asgns.length > 0;
                              if (!isAssigned) {
                                return (
                                  <span className="px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-cyber-green/15 text-cyber-green border border-cyber-green/30">
                                    Available
                                  </span>
                                );
                              }
                              return null;
                            })()}
                            <span className={`px-2 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider ${
                              candidate.is_blacklisted 
                                ? 'bg-cyber-magenta/25 text-cyber-magenta border border-cyber-magenta/30 animate-pulse' 
                                : 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20'
                            }`}>
                              {candidate.is_blacklisted ? 'Deviant' : 'Compliant'}
                            </span>
                            <div className="p-0.5 text-slate-400 rounded hover:bg-cyber-gray/50 transition-colors">
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                          </div>
                        </div>

                        {/* Experience and Skills */}
                        <div className="space-y-3 mb-4 text-xs font-sans text-slate-300">
                          <div className="flex justify-between font-mono text-[10px] text-slate-400">
                            <span>EXPERIENCE:</span>
                            <span className="text-slate-200">{candidate.experience_years} Years</span>
                          </div>

                          {isExpanded && (
                            <>
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
                            </>
                          )}

                          {/* Best Vetting Fit */}
                          <div className="border-t border-cyber-slate/20 pt-3 mt-3">
                            {registryFilterRole ? (
                              <>
                                <span className="text-[9px] font-mono text-slate-400 block mb-1">FILTERED ROLE FIT:</span>
                                {(() => {
                                  const activeAssessment = candidate.assessments?.find((a) => a.role_name === registryFilterRole);
                                  return activeAssessment ? (
                                    <div className="flex items-center justify-between bg-cyber-dark/50 border border-cyber-slate/30 rounded px-2.5 py-1.5 shadow-inner">
                                      <span className="text-[10px] font-mono text-slate-200 truncate pr-2" title={activeAssessment.role_name}>
                                        {activeAssessment.role_name}
                                      </span>
                                      <span className={`text-[10px] font-mono font-bold shrink-0 ${
                                        activeAssessment.match_score >= 80 ? 'text-cyber-green' :
                                        activeAssessment.match_score >= 60 ? 'text-cyber-cyan' :
                                        activeAssessment.match_score >= 40 ? 'text-cyber-yellow' :
                                        'text-cyber-magenta'
                                      }`}>
                                        {activeAssessment.match_score}%
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] font-mono text-slate-500 italic block">No assessment for this role.</span>
                                  );
                                })()}
                              </>
                            ) : (
                              <>
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
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-between items-center gap-2 pt-3 border-t border-cyber-slate/20 mt-2 flex-wrap">
                        {/* Blacklist toggle & release buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleToggleBlacklist(candidate)}
                            className={`flex items-center gap-1 py-1.5 px-2 rounded border text-[8px] font-mono tracking-tight transition-colors whitespace-nowrap shrink-0 ${
                              candidate.is_blacklisted
                                ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20'
                                : 'bg-cyber-cyan/10 border-cyber-cyan/30 text-cyber-cyan hover:bg-cyber-cyan/20'
                            }`}
                            title={candidate.is_blacklisted ? 'Whitelist candidate record' : 'Blacklist candidate record'}
                          >
                            {candidate.is_blacklisted ? <UserCheck size={10} className="shrink-0" /> : <UserX size={10} className="shrink-0" />}
                            <span>{candidate.is_blacklisted ? 'BLACKLISTED (whitelist)' : 'BLACKLIST'}</span>
                          </button>

                          {(candidate.assignments || []).map(a => (
                            <span
                              key={a.id}
                              className="flex items-center gap-1 py-1 px-2 rounded border border-cyber-magenta/30 bg-cyber-magenta/5 text-cyber-magenta text-[8px] font-mono tracking-tight whitespace-nowrap shrink-0 font-semibold"
                              title={`Assigned to ${a.project_name || 'project'}`}
                            >
                              ASSIGNED: {a.project_name ? (a.project_name.length > 18 ? `${a.project_name.slice(0, 18)}...` : a.project_name) : 'project'}{a.start_date ? ` (${a.start_date})` : ''}
                            </span>
                          ))}
                        </div>

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

          {/* TAB 4: SOW Project Planner */}
          {activeTab === 'planner' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyber-slate/20 pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold font-sans text-slate-100 flex items-center gap-2">
                    <span>🎯</span>
                    Project SOW Planner & Gap Identifier
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    Upload project Scope of Work (SOW) documents to audit active ledger gaps and match talent requirements.
                  </p>
                </div>

                {/* Project Workspace Management */}
                <div className="flex items-center gap-3 bg-cyber-dark/85 border border-cyber-slate/50 p-2.5 rounded-lg backdrop-blur-md self-start md:self-center">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Load Project Workspace</span>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={selectedProjectId || ''}
                        onChange={(e) => handleLoadProject(e.target.value ? Number(e.target.value) : null)}
                        className="bg-cyber-gray border border-cyber-slate text-slate-200 text-xs rounded px-3 py-1.5 font-mono focus:outline-none focus:border-cyber-cyan/60 transition-colors w-48"
                      >
                        <option value="">-- Start New Project --</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      
                      {selectedProjectId && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteProject(selectedProjectId, e)}
                          className="p-1.5 bg-cyber-magenta/10 hover:bg-cyber-magenta/25 border border-cyber-magenta/30 hover:border-cyber-magenta text-cyber-magenta hover:text-white rounded transition-colors"
                          title="Delete Project Workspace"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleLoadProject(null)}
                    className="px-2.5 py-1.5 bg-cyber-slate border border-cyber-slate/50 text-slate-300 rounded text-[9px] font-mono hover:bg-cyber-slate/85 transition-colors self-end"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Form Panel: Scope Import (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                  <form onSubmit={handleAnalyzeScope} className="cyber-panel rounded-lg p-5 space-y-4">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5 border-b border-cyber-slate/30 pb-2">
                      <FileText size={14} className="text-cyber-cyan" />
                      <span>Import SOW Scope</span>
                    </h3>

                    {/* SOW Text Input */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        Scope Description / pasted SOW text
                      </label>
                      <textarea
                        value={sowText}
                        onChange={(e) => setSowText(e.target.value)}
                        placeholder="Paste Scope of Work or requirements specifications directly..."
                        className="w-full h-40 bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none p-3 text-xs text-slate-200 rounded font-sans transition-colors resize-none"
                      />
                    </div>

                    {/* SOW File upload zone */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
                        OR UPLOAD SOW DOCUMENT (.PDF, .DOCX, .TXT)
                      </label>
                      <div 
                        className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                          plannerDragActive ? 'border-cyber-cyan bg-cyber-cyan/5' : 'border-cyber-slate/50 hover:border-cyber-cyan/30'
                        } ${sowFile ? 'border-cyber-green bg-cyber-green/5' : ''}`}
                        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setPlannerDragActive(true); }}
                        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setPlannerDragActive(false); }}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setPlannerDragActive(true); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setPlannerDragActive(false);
                          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            setSowFile(e.dataTransfer.files[0]);
                          }
                        }}
                        onClick={() => document.getElementById('sow-file-input')?.click()}
                      >
                        <input
                          id="sow-file-input"
                          type="file"
                          className="hidden"
                          accept=".pdf,.docx,.txt"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              setSowFile(e.target.files[0]);
                            }
                          }}
                        />
                        <UploadCloud className={sowFile ? 'text-cyber-green' : 'text-cyber-cyan'} size={24} />
                        <span className="text-[10px] font-sans text-slate-300 font-semibold mt-1">
                          {sowFile ? sowFile.name : 'DRAG & DROP SOW DOCUMENT'}
                        </span>
                        <span className="text-[8px] font-mono text-slate-500">
                          {sowFile ? `${(sowFile.size / 1024).toFixed(1)} KB — Click to change` : 'OR CLICK TO BROWSE'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isPlannerLoading || (!sowText.trim() && !sowFile)}
                      className="w-full py-2 bg-gradient-to-r from-cyber-cyan/20 to-cyber-magenta/20 hover:from-cyber-cyan/30 hover:to-cyber-magenta/30 border border-cyber-cyan/30 text-cyber-cyan hover:text-white rounded font-mono text-xs uppercase tracking-wider transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5"
                    >
                      {isPlannerLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-cyber-cyan border-t-transparent"></div>
                          <span>Analyzing Scope...</span>
                        </>
                      ) : (
                        <>
                          <Cpu size={14} />
                          <span>Analyze Project Scope</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Right Results Panel (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  {plannerResults ? (
                    <div className="space-y-6">
                      
                      {/* Save Project Card */}
                      <form onSubmit={handleSaveProject} className="cyber-panel rounded-lg p-4 border border-cyber-cyan/30 bg-cyber-cyan/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="text-xs font-mono uppercase tracking-wider text-cyber-cyan flex items-center gap-1.5 mb-1.5">
                            <span>💾</span>
                            {selectedProjectId ? 'Update Project Workspace' : 'Save Project Workspace'}
                          </h4>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={projectName}
                              onChange={(e) => setProjectName(e.target.value)}
                              placeholder="e.g., Arabic AI Legal Agent Suite"
                              className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-1.5 text-xs text-slate-200 rounded font-mono"
                              required
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={isSavingProject}
                          className="px-4 py-2 bg-cyber-cyan/20 hover:bg-cyber-cyan/35 border border-cyber-cyan text-cyber-cyan hover:text-white rounded font-mono text-xs uppercase tracking-wider transition-all self-end md:self-auto shrink-0"
                        >
                          {isSavingProject ? 'Saving...' : (selectedProjectId ? 'Overwrite Workspace' : 'Save Workspace')}
                        </button>
                      </form>

                      {/* Matched Profiles Section */}
                      <div className="cyber-panel rounded-lg p-5 space-y-4">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-cyber-cyan flex items-center gap-1.5 border-b border-cyber-slate/30 pb-2">
                          <CheckCircle2 size={14} />
                          <span>Matched Talent Profiles ({plannerMatchedProfiles.length})</span>
                        </h3>
                        
                        <div className="space-y-2">
                          {plannerMatchedProfiles.map((match) => (
                            <div key={match.id} className="p-3 bg-cyber-dark/50 border border-cyber-slate/40 rounded flex flex-col gap-3 items-start w-full">
                              <div className="flex flex-col md:flex-row justify-between gap-3 items-start md:items-center w-full">
                                <div className="flex-1">
                                  <h4 className="text-xs font-bold text-slate-200">{match.role_name}</h4>
                                  <p className="text-[10px] text-slate-400 font-sans mt-0.5 leading-relaxed">{match.relevance_reason}</p>
                                </div>
                                <span className="px-2 py-0.5 bg-cyber-cyan/10 border border-cyber-cyan/20 text-cyber-cyan rounded text-[8px] font-mono uppercase tracking-widest shrink-0">
                                  Active Profile
                                </span>
                              </div>

                              {/* Vetted Matching Candidates for SOW Profile */}
                              <div className="mt-2 w-full border-t border-cyber-slate/20 pt-2.5">
                                <span className="text-[9px] font-mono text-slate-400 block mb-1.5 uppercase tracking-wider">Vetting Archive Matches:</span>
                                {(() => {
                                  const matchingCands = candidates.filter((c) => 
                                    c.assessments && c.assessments.some((a) => a.role_name === match.role_name)
                                  );
                                  
                                  if (matchingCands.length === 0) {
                                    return (
                                      <p className="text-[10px] font-sans text-slate-500 italic">No candidates assessed for this role yet. Vet a candidate in the Vetting tab first.</p>
                                    );
                                  }
                                  
                                  return (
                                    <div className="space-y-1.5 w-full">
                                      {matchingCands.map((c) => {
                                        const matchingAssessment = c.assessments?.find((a) => a.role_name === match.role_name);
                                        const score = matchingAssessment?.match_score || 0;
                                        const thisProfileSlots = (c.assignments || []).filter(a => a.project_id === selectedProjectId && a.profile_id === match.id);
                                        const otherSlots = (c.assignments || []).filter(a => !(a.project_id === selectedProjectId && a.profile_id === match.id));
                                        const isAssignedHere = thisProfileSlots.length > 0;

                                        return (
                                          <div key={c.id} className="flex flex-col gap-1.5 bg-cyber-dark/80 border border-cyber-slate/30 p-2 rounded text-[11px] w-full">
                                            {/* Candidate info row */}
                                            <div className="flex justify-between items-center gap-3">
                                              <div className="flex items-center gap-2 truncate">
                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                  isAssignedHere ? 'bg-cyber-cyan animate-pulse' : (c.assignments || []).length === 0 ? 'bg-cyber-green' : 'bg-cyber-yellow'
                                                }`} />
                                                <span className="font-bold text-slate-300 truncate">{c.full_name}</span>
                                                <span className="text-[9px] text-slate-500 shrink-0">({c.experience_years}y exp)</span>
                                                <span className={`text-[10px] font-bold font-mono shrink-0 ${
                                                  score >= 80 ? 'text-cyber-green' : score >= 60 ? 'text-cyber-cyan' : 'text-cyber-yellow'
                                                }`}>
                                                  {score}% Match
                                                </span>
                                              </div>
                                              {/* Always show Assign button */}
                                              <button
                                                type="button"
                                                disabled={!selectedProjectId}
                                                onClick={() => selectedProjectId && setAssignModal({
                                                  candidateId: c.id,
                                                  candidateName: c.full_name,
                                                  projectId: selectedProjectId,
                                                  profileId: match.id,
                                                  profileName: match.role_name,
                                                  startDate: '',
                                                  endDate: '',
                                                })}
                                                className="px-2 py-0.5 bg-cyber-cyan/15 hover:bg-cyber-cyan/25 border border-cyber-cyan/35 text-cyber-cyan hover:text-white disabled:opacity-40 disabled:pointer-events-none rounded font-mono text-[9px] uppercase tracking-wider transition-colors font-bold shrink-0"
                                                title={!selectedProjectId ? "Save this SOW Project workspace before assigning candidates" : "Add assignment slot"}
                                              >
                                                + Slot
                                              </button>
                                            </div>
                                            {/* Existing slots for this profile */}
                                            {thisProfileSlots.map(slot => (
                                              <div key={slot.id} className="flex justify-between items-center gap-2 pl-3 py-0.5 border-l-2 border-cyber-cyan/30">
                                                <span className="text-[9px] font-mono text-slate-400">
                                                  {slot.start_date || '?'} → {slot.end_date || 'open'}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => handleReleaseAssignment(slot.id)}
                                                  className="px-1.5 py-0.5 bg-cyber-magenta/15 hover:bg-cyber-magenta/25 border border-cyber-magenta/35 text-cyber-magenta hover:text-white rounded font-mono text-[8px] uppercase tracking-wider transition-colors font-bold shrink-0"
                                                >
                                                  Release
                                                </button>
                                              </div>
                                            ))}
                                            {/* Other project/profile slots indicator */}
                                            {otherSlots.length > 0 && (
                                              <div className="pl-3 text-[8px] font-mono text-cyber-yellow">
                                                Also in: {otherSlots.map(s => s.project_name || 'project').join(', ')}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          ))}

                          {plannerMatchedProfiles.length === 0 && (
                            <p className="text-xs font-sans text-slate-500 italic py-4">No matching active profiles found for this scope.</p>
                          )}
                        </div>
                      </div>

                      {/* Missing Profiles (Talent Gaps) Section */}
                      <div className="cyber-panel rounded-lg p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-cyber-slate/30 pb-2">
                          <h3 className="text-xs font-mono uppercase tracking-wider text-cyber-magenta flex items-center gap-1.5">
                            <AlertCircle size={14} />
                            <span>Missing Profile Gaps ({plannerMissingProfiles.length})</span>
                          </h3>
                          
                          {plannerMissingProfiles.length > 0 && (
                            <button
                              type="button"
                              onClick={handleAddAllMissingProfiles}
                              className="px-2.5 py-1 bg-cyber-magenta/10 hover:bg-cyber-magenta/25 border border-cyber-magenta/30 hover:border-cyber-magenta text-cyber-magenta hover:text-white rounded font-mono text-[9px] uppercase tracking-wider transition-all"
                            >
                              Add All to Ledger
                            </button>
                          )}
                        </div>

                        <div className="space-y-4">
                          {plannerMissingProfiles.map((p, idx) => {
                            return (
                              <div key={idx} className="p-4 bg-cyber-dark/30 border border-cyber-slate/50 rounded-lg flex flex-col justify-between gap-4">
                                <div>
                                  <div className="flex justify-between items-start gap-4">
                                    <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="px-1.5 py-0.5 bg-cyber-dark text-slate-400 border border-cyber-slate rounded-full text-[8px] font-mono uppercase">
                                          {p.stack_layer}
                                        </span>
                                        <span className="px-1.5 py-0.5 bg-cyber-magenta/10 border border-cyber-magenta/20 text-cyber-magenta rounded text-[8px] font-mono uppercase">
                                          {p.engagement_tier}
                                        </span>
                                      </div>
                                      <h4 className="text-sm font-bold text-slate-100 mt-1">{p.role_name}</h4>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleAddMissingProfile(p)}
                                      className="bg-cyber-magenta/10 border border-cyber-magenta/30 text-cyber-magenta hover:bg-cyber-magenta/20 hover:text-white px-3 py-1 text-[9px] font-mono uppercase tracking-wider rounded border transition-all"
                                    >
                                      + Add to Ledger
                                    </button>
                                  </div>

                                  <p className="text-xs text-slate-300 font-sans mt-3 leading-relaxed">{p.role_summary}</p>
                                  
                                  {p.red_flags && (
                                    <div className="bg-cyber-magenta/5 border border-cyber-magenta/15 rounded p-2.5 mt-3 text-[10px] font-sans">
                                      <strong className="text-cyber-magenta font-mono text-[9px] uppercase tracking-wider block mb-1">SCREEN-OUT RED FLAGS:</strong>
                                      {p.red_flags}
                                    </div>
                                  )}
                                  
                                  {p.offerings && (
                                    <div className="bg-cyber-slate/20 border border-cyber-slate/30 rounded p-2.5 mt-2 text-[10px] font-sans">
                                      <strong className="text-slate-400 font-mono text-[9px] uppercase tracking-wider block mb-1">MAPPED DELIVERABLES:</strong>
                                      {p.offerings}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {plannerResults.missing_profiles.length === 0 && (
                            <p className="text-xs font-sans text-slate-500 italic py-4">All project scope requirements are covered by existing profiles. No missing profile gaps detected!</p>
                          )}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="cyber-panel rounded-lg p-12 text-center">
                      <Cpu className="text-slate-500 mx-auto mb-3 animate-pulse" size={36} />
                      <p className="text-sm font-mono text-slate-400">
                        {isPlannerLoading ? 'Scope analysis in progress...' : 'Pasted SOW description text or uploaded scope document will analyze here.'}
                      </p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 5: Projects Management Workspace */}
          {activeTab === 'projects' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-cyber-cyan uppercase tracking-wider font-mono">
                  Sovereign Projects Registry
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-sans">
                  Browse and audit air-gapped project allocations, resource compliance, and SOW blueprints.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left side: Projects index */}
                <div className="lg:col-span-4 space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-widest">
                    Saved Workspaces ({projects.length})
                  </span>
                  
                  {projects.length === 0 ? (
                    <div className="cyber-panel p-6 text-center text-slate-500 italic text-xs">
                      No projects saved yet. Analyze an SOW in the Planner tab and save it as a project workspace.
                    </div>
                  ) : (
                    projects.map((p) => {
                      const isSelected = activeViewProjectId === p.id;
                      const rawMissing = p.analysis_results?.missing_profiles || [];
                      const promotedCount = rawMissing.filter((mp: TalentProfile) => profiles.some(pr => pr.role_name === mp.role_name)).length;
                      const matchedCount = (p.analysis_results?.matched_profiles?.length || 0) + promotedCount;
                      const missingCount = rawMissing.length - promotedCount;
                      const resourcesCount = new Set(
                        candidates.flatMap(c => (c.assignments || []).filter(a => a.project_id === p.id).map(() => c.id))
                      ).size;
                      
                      return (
                        <div
                          key={p.id}
                          onClick={() => setActiveViewProjectId(p.id)}
                          className={`p-4 rounded-lg border transition-all cursor-pointer select-none relative group ${
                            isSelected 
                              ? 'bg-cyber-cyan/10 border-cyber-cyan text-cyber-cyan shadow-cyan-glow font-bold' 
                              : 'bg-cyber-gray/40 border-cyber-slate/30 text-slate-300 hover:border-cyber-slate hover:bg-cyber-gray/70'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-3">
                            <h3 className="text-xs font-bold font-mono tracking-wide truncate pr-6">
                              {p.name}
                            </h3>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm(`Are you sure you want to delete project '${p.name}'?`)) {
                                  try {
                                    await api.deleteProject(p.id);
                                    if (activeViewProjectId === p.id) setActiveViewProjectId(null);
                                    fetchProjects();
                                    fetchCandidates();
                                  } catch (err) {
                                    alert('Failed to delete project: ' + err);
                                  }
                                }
                              }}
                              className="absolute top-3 right-3 text-slate-500 hover:text-cyber-magenta opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                              title="Delete project"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          
                          <div className="mt-2 text-[10px] text-slate-400 font-sans space-y-1">
                            <div className="flex justify-between">
                              <span>Matched Roles:</span>
                              <span className="font-mono font-bold text-cyber-green">{matchedCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Missing Gaps:</span>
                              <span className="font-mono font-bold text-cyber-yellow">{missingCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Assigned Talent:</span>
                              <span className="font-mono font-bold text-cyber-magenta">{resourcesCount}</span>
                            </div>
                          </div>
                          
                          <div className="mt-3 pt-2 border-t border-cyber-slate/20 flex justify-between items-center text-[8px] font-mono text-slate-500">
                            <span>{p.sow_filename || 'TEXT SCOPE'}</span>
                            <span>{new Date(p.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Right side: Project detail view */}
                <div className="lg:col-span-8">
                  {(() => {
                    const activeProject = projects.find(p => p.id === activeViewProjectId);
                    if (!activeProject) {
                      return (
                        <div className="cyber-panel p-12 text-center rounded-lg">
                          <Layers className="text-slate-500 mx-auto mb-3 animate-pulse" size={36} />
                          <p className="text-sm font-mono text-slate-400">
                            Select a saved project from the registry list to browse its scope validation and active resource allocation.
                          </p>
                        </div>
                      );
                    }
                    
                    // All assignment slots for this project (with candidate reference)
                    const projectSlots = candidates.flatMap(c =>
                      (c.assignments || [])
                        .filter(a => a.project_id === activeProject.id)
                        .map(a => ({ slot: a, candidate: c }))
                    );
                    const assignedResources = [...new Map(projectSlots.map(ps => [ps.candidate.id, ps.candidate])).values()];

                    // Dynamic requirements mapping for the active project
                    const projectMatchedProfiles = (() => {
                      const list = [...(activeProject.analysis_results?.matched_profiles || [])];
                      const projectMissing = activeProject.analysis_results?.missing_profiles || [];
                      projectMissing.forEach((mp) => {
                        const activeProf = profiles.find((p) => p.role_name === mp.role_name);
                        if (activeProf) {
                          const alreadyMatched = list.some((m) => m.role_name === mp.role_name);
                          if (!alreadyMatched) {
                            list.push({
                              id: activeProf.id!,
                              role_name: mp.role_name,
                              relevance_reason: `Newly added: ${mp.role_summary || 'Identified missing gap successfully imported to ledger.'}`
                            });
                          }
                        }
                      });
                      return list;
                    })();

                    const projectMissingProfiles = (activeProject.analysis_results?.missing_profiles || []).filter(
                      (mp) => !profiles.some((p) => p.role_name === mp.role_name)
                    );
                    
                    return (
                      <div className="space-y-6">
                        {/* Project Header Info */}
                        <div className="cyber-panel p-4 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div>
                            <span className="text-[9px] font-mono text-cyber-cyan uppercase tracking-widest block">
                              Active Workspace Details
                            </span>
                            <h3 className="text-sm font-bold font-mono text-slate-200 mt-0.5">
                              {activeProject.name}
                            </h3>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-slate-400 mt-1">
                              <span>Created: {new Date(activeProject.created_at).toLocaleString()}</span>
                              {activeProject.sow_filename && (
                                <span className="text-cyber-green">File: {activeProject.sow_filename}</span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              handleLoadProject(activeProject.id);
                              setActiveTab('planner');
                            }}
                            className="px-3 py-1.5 bg-cyber-cyan/15 hover:bg-cyber-cyan/25 border border-cyber-cyan/35 text-cyber-cyan hover:text-white rounded font-mono text-[10px] uppercase tracking-wider transition-all"
                          >
                            Open in SOW Planner
                          </button>
                        </div>

                        {/* Role allocation view — profiles with assigned candidates grouped */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                              Role Allocations ({assignedResources.length} / {projectMatchedProfiles.length} Filled)
                            </span>
                          </div>

                          {projectMatchedProfiles.length === 0 ? (
                            <div className="bg-cyber-gray/30 border border-cyber-slate/30 p-6 text-center text-slate-500 italic text-xs rounded-lg">
                              No matched profiles for this project. Analyze the SOW in the Planner tab first.
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {projectMatchedProfiles.map((prof) => {
                                const profSlots = projectSlots.filter(ps => ps.slot.profile_id === prof.id);
                                const isFilled = profSlots.length > 0;
                                return (
                                  <div key={prof.id} className="border border-cyber-slate/30 rounded-lg overflow-hidden">
                                    {/* Role header row */}
                                    <div className={`px-3 py-2 flex items-center justify-between gap-2 ${isFilled ? 'bg-cyber-green/5 border-b border-cyber-slate/20' : 'bg-cyber-dark/40 border-b border-cyber-slate/10'}`}>
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isFilled ? 'bg-cyber-green' : 'bg-cyber-slate/40'}`} />
                                        <span className="text-[11px] font-bold font-mono text-slate-200 truncate">{prof.role_name}</span>
                                      </div>
                                      <span className={`text-[8px] font-mono uppercase tracking-widest shrink-0 ${isFilled ? 'text-cyber-green' : 'text-slate-600'}`}>
                                        {isFilled ? `${profSlots.length} Slot${profSlots.length > 1 ? 's' : ''}` : 'Open'}
                                      </span>
                                    </div>
                                    {/* Assignment slot rows */}
                                    {isFilled ? (
                                      profSlots.map(({ slot, candidate: res }) => (
                                        <div key={slot.id} className="px-3 py-2.5 bg-cyber-dark/30 flex justify-between items-center gap-3 border-b border-cyber-slate/10 last:border-0">
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-xs font-bold text-slate-200">{res.full_name}</span>
                                              <span className="text-[9px] font-mono text-slate-400 bg-cyber-gray px-1.5 py-0.5 rounded shrink-0">{res.experience_years}y exp</span>
                                              {slot.start_date && (
                                                <span className="text-[9px] font-mono text-slate-500 shrink-0">
                                                  {slot.start_date} → {slot.end_date || 'open'}
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                              {res.skills.slice(0, 4).map(s => (
                                                <span key={s} className="px-1.5 py-0.5 bg-cyber-slate/20 text-slate-300 rounded text-[8px] font-mono">{s}</span>
                                              ))}
                                              {res.skills.length > 4 && <span className="text-[8px] text-slate-500 font-mono">+{res.skills.length - 4}</span>}
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleReleaseAssignment(slot.id)}
                                            className="px-2 py-0.5 bg-cyber-magenta/15 hover:bg-cyber-magenta/25 border border-cyber-magenta/35 text-cyber-magenta hover:text-white rounded font-mono text-[9px] uppercase tracking-wider transition-all font-bold shrink-0"
                                          >
                                            Release
                                          </button>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="px-3 py-2 bg-cyber-dark/20">
                                        <span className="text-[10px] font-sans text-slate-600 italic">No candidate assigned — use SOW Planner to assign</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {/* Fallback: slots with a profile outside the matched list */}
                              {projectSlots.filter(ps => !projectMatchedProfiles.some(p => p.id === ps.slot.profile_id)).map(({ slot, candidate: res }) => (
                                <div key={slot.id} className="border border-cyber-yellow/20 rounded-lg overflow-hidden">
                                  <div className="px-3 py-2 flex items-center justify-between gap-2 bg-cyber-dark/40 border-b border-cyber-yellow/10">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-cyber-yellow" />
                                      <span className="text-[11px] font-bold font-mono text-slate-400 truncate">{slot.profile_name || 'Unclassified Role'}</span>
                                    </div>
                                    <span className="text-[8px] font-mono uppercase tracking-widest text-cyber-yellow shrink-0">Assigned</span>
                                  </div>
                                  <div className="px-3 py-2.5 bg-cyber-dark/30 flex justify-between items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-slate-200">{res.full_name}</span>
                                        <span className="text-[9px] font-mono text-slate-400 bg-cyber-gray px-1.5 py-0.5 rounded shrink-0">{res.experience_years}y exp</span>
                                        {slot.start_date && <span className="text-[9px] font-mono text-slate-500">{slot.start_date} → {slot.end_date || 'open'}</span>}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleReleaseAssignment(slot.id)}
                                      className="px-2 py-0.5 bg-cyber-magenta/15 hover:bg-cyber-magenta/25 border border-cyber-magenta/35 text-cyber-magenta hover:text-white rounded font-mono text-[9px] uppercase tracking-wider transition-all font-bold shrink-0"
                                    >
                                      Release
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Identified Missing Gaps */}
                        <div className="space-y-3">
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
                            Identified Missing Gaps ({projectMissingProfiles.length})
                          </span>
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {projectMissingProfiles.map((mis: any, idx: number) => (
                              <div key={idx} className="p-3 bg-cyber-gray/30 border border-cyber-slate/20 rounded-lg flex justify-between items-start gap-2">
                                <div className="flex-1">
                                  <h4 className="text-[11px] font-bold text-slate-200">{mis.role_name}</h4>
                                  <span className="text-[8px] font-mono text-cyber-yellow uppercase tracking-widest block mt-0.5">
                                    {mis.stack_layer}
                                  </span>
                                  <p className="text-[10px] text-slate-400 font-sans mt-1 leading-relaxed">
                                    {mis.role_summary}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await api.createProfile(mis);
                                      fetchProfiles();
                                    } catch (err) {
                                      alert('Failed to add profile: ' + err);
                                    }
                                  }}
                                  className="px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider rounded border border-cyber-cyan/35 text-cyber-cyan bg-cyber-cyan/10 hover:bg-cyber-cyan/20 transition-all shrink-0 font-bold"
                                >
                                  Add
                                </button>
                              </div>
                            ))}
                            {projectMissingProfiles.length === 0 && (
                              <div className="text-[10px] text-slate-500 italic p-3 text-center">
                                No missing profile gaps identified.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Collapsible raw SOW text */}
                        {activeProject.sow_text && (
                          <div className="border border-cyber-slate/20 rounded-lg overflow-hidden">
                            <details className="group">
                              <summary className="bg-cyber-gray/30 px-4 py-2.5 font-mono text-[10px] text-slate-400 uppercase tracking-widest cursor-pointer select-none flex justify-between items-center group-open:border-b group-open:border-cyber-slate/20 hover:text-slate-200 transition-colors">
                                <span>Browse Raw SOW Blueprint</span>
                                <span className="text-[8px] text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                              </summary>
                              <div className="p-4 bg-cyber-dark/60 font-sans text-xs text-slate-300 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
                                {activeProject.sow_text}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: Resource Utilization */}
          {activeTab === 'utilization' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyber-slate/20 pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold font-sans text-slate-100 flex items-center gap-2">
                    <TrendingUp size={20} className="text-cyber-green" />
                    Resource Utilization
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    Monitor time allocation, capacity coverage, and resource availability across all active projects.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchUtilization}
                  disabled={utilLoading}
                  className="px-3 py-1.5 bg-cyber-green/10 hover:bg-cyber-green/20 border border-cyber-green/30 text-cyber-green rounded font-mono text-[10px] uppercase tracking-wider transition-all disabled:opacity-50 shrink-0"
                >
                  {utilLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {utilLoading && !utilData && (
                <div className="flex items-center justify-center py-20 text-slate-500 gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyber-green border-t-transparent" />
                  <span className="font-mono text-xs uppercase tracking-wider">Loading utilization data...</span>
                </div>
              )}

              {utilData && (() => {
                const { summary, active_assignments, upcoming_assignments, past_assignments, unscheduled_assignments, available_candidates, project_coverage } = utilData;
                const allAssigned = [...active_assignments, ...upcoming_assignments, ...unscheduled_assignments];
                const scheduledAssignments = allAssigned.filter(a => a.start_date && a.end_date);

                // Gantt window
                let ganttStart = new Date();
                let ganttEnd = new Date();
                ganttEnd.setMonth(ganttEnd.getMonth() + 6);
                if (scheduledAssignments.length > 0) {
                  const starts = scheduledAssignments.map(a => new Date(a.start_date!));
                  const ends = scheduledAssignments.map(a => new Date(a.end_date!));
                  const minS = new Date(Math.min(...starts.map(d => d.getTime())));
                  const maxE = new Date(Math.max(...ends.map(d => d.getTime())));
                  minS.setDate(minS.getDate() - 7);
                  maxE.setDate(maxE.getDate() + 7);
                  ganttStart = minS;
                  ganttEnd = maxE;
                }
                const ganttTotalDays = Math.max(1, (ganttEnd.getTime() - ganttStart.getTime()) / 86400000);

                // Month labels for Gantt header
                const ganttMonths: { label: string; widthPct: number }[] = [];
                const cur = new Date(ganttStart.getFullYear(), ganttStart.getMonth(), 1);
                while (cur <= ganttEnd) {
                  const monthStart = new Date(cur);
                  const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
                  const clampedStart = monthStart < ganttStart ? ganttStart : monthStart;
                  const clampedEnd = monthEnd > ganttEnd ? ganttEnd : monthEnd;
                  const days = Math.max(0, (clampedEnd.getTime() - clampedStart.getTime()) / 86400000 + 1);
                  ganttMonths.push({
                    label: cur.toLocaleString('default', { month: 'short', year: '2-digit' }),
                    widthPct: (days / ganttTotalDays) * 100,
                  });
                  cur.setMonth(cur.getMonth() + 1);
                }

                const barLeft = (startStr: string) => {
                  const diff = (new Date(startStr).getTime() - ganttStart.getTime()) / 86400000;
                  return Math.max(0, (diff / ganttTotalDays) * 100);
                };
                const barWidth = (startStr: string, endStr: string) => {
                  const days = (new Date(endStr).getTime() - new Date(startStr).getTime()) / 86400000 + 1;
                  return Math.min(100, (days / ganttTotalDays) * 100);
                };
                const todayLeft = ((new Date().getTime() - ganttStart.getTime()) / 86400000 / ganttTotalDays) * 100;

                const statusOf = (a: typeof active_assignments[0]) => {
                  if (!a.start_date || !a.end_date) return 'unscheduled';
                  const today = new Date(); today.setHours(0,0,0,0);
                  const s = new Date(a.start_date); const e = new Date(a.end_date);
                  if (s <= today && today <= e) return 'active';
                  if (s > today) return 'upcoming';
                  return 'past';
                };

                const durationDays = (s: string, e: string) =>
                  Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1;

                return (
                  <div className="space-y-6">
                    {/* KPI Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        { label: 'Total Candidates', value: summary.total_candidates, color: 'text-slate-200', bg: 'bg-cyber-gray/40 border-cyber-slate/30' },
                        { label: 'Active Now', value: summary.active_assignments, color: 'text-cyber-green', bg: 'bg-cyber-green/5 border-cyber-green/20' },
                        { label: 'Upcoming', value: summary.upcoming_assignments, color: 'text-cyber-cyan', bg: 'bg-cyber-cyan/5 border-cyber-cyan/20' },
                        { label: 'Past', value: summary.past_assignments, color: 'text-slate-400', bg: 'bg-cyber-gray/30 border-cyber-slate/20' },
                        { label: 'Unscheduled', value: summary.unscheduled_assignments, color: 'text-cyber-yellow', bg: 'bg-cyber-yellow/5 border-cyber-yellow/20' },
                        { label: 'Available', value: summary.available_candidates, color: 'text-cyber-magenta', bg: 'bg-cyber-magenta/5 border-cyber-magenta/20' },
                      ].map(({ label, value, color, bg }) => (
                        <div key={label} className={`cyber-panel rounded-lg p-4 border ${bg} text-center`}>
                          <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
                          <div className="text-[9px] font-mono text-slate-500 uppercase tracking-wider mt-1">{label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Project Coverage */}
                    <div className="cyber-panel rounded-lg p-5 space-y-4">
                      <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-cyber-slate/30 pb-2">
                        <Layers size={13} />
                        Project Coverage
                      </h3>
                      {project_coverage.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No projects found.</p>
                      ) : (
                        <div className="space-y-3">
                          {project_coverage.map(p => (
                            <div key={p.project_id}>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-[11px] font-bold font-mono text-slate-200 truncate max-w-[60%]">{p.project_name}</span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {p.filled_roles} / {p.required_roles} roles
                                  <span className={`ml-2 font-bold ${p.coverage_pct >= 80 ? 'text-cyber-green' : p.coverage_pct >= 40 ? 'text-cyber-yellow' : 'text-cyber-magenta'}`}>
                                    {p.coverage_pct}%
                                  </span>
                                </span>
                              </div>
                              <div className="w-full bg-cyber-dark border border-cyber-slate/20 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${p.coverage_pct >= 80 ? 'bg-cyber-green' : p.coverage_pct >= 40 ? 'bg-cyber-yellow' : 'bg-cyber-magenta'}`}
                                  style={{ width: `${p.coverage_pct}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Resource Timeline (Gantt) */}
                    {scheduledAssignments.length > 0 && (
                      <div className="cyber-panel rounded-lg p-5 space-y-4">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-cyber-slate/30 pb-2">
                          <CalendarDays size={13} />
                          Resource Timeline
                          <span className="ml-auto text-[9px] text-slate-600 font-normal normal-case tracking-normal">
                            {ganttStart.toLocaleDateString()} — {ganttEnd.toLocaleDateString()}
                          </span>
                        </h3>
                        <div className="overflow-x-auto">
                          <div style={{ minWidth: '600px' }}>
                            {/* Month headers */}
                            <div className="flex border-b border-cyber-slate/20 mb-2 pb-1">
                              {ganttMonths.map((m, i) => (
                                <div key={i} style={{ width: `${m.widthPct}%` }} className="text-[8px] font-mono text-slate-500 uppercase tracking-wider text-center shrink-0">
                                  {m.label}
                                </div>
                              ))}
                            </div>
                            {/* Candidate rows */}
                            <div className="space-y-1.5 relative">
                              {/* Today line */}
                              {todayLeft >= 0 && todayLeft <= 100 && (
                                <div className="absolute top-0 bottom-0 w-px bg-cyber-yellow/60 z-10 pointer-events-none" style={{ left: `${todayLeft}%` }} />
                              )}
                              {/* Group all slots per candidate into a single row */}
                              {Array.from(
                                scheduledAssignments.reduce((map, a) => {
                                  if (!map.has(a.candidate_id)) map.set(a.candidate_id, { full_name: a.full_name, slots: [] });
                                  map.get(a.candidate_id)!.slots.push(a);
                                  return map;
                                }, new Map<number, { full_name: string; slots: typeof scheduledAssignments }>())
                              ).map(([candidateId, row]) => (
                                <div key={candidateId} className="flex items-center gap-2 h-7">
                                  <div className="w-32 shrink-0 text-[10px] font-mono text-slate-300 truncate text-right pr-2">{row.full_name}</div>
                                  <div className="flex-1 relative h-5 bg-cyber-dark/50 rounded border border-cyber-slate/10">
                                    {row.slots.map((a, aIdx) => {
                                      const left = barLeft(a.start_date!);
                                      const width = barWidth(a.start_date!, a.end_date!);
                                      const status = statusOf(a);
                                      const barColor = status === 'active' ? 'bg-cyber-green' : status === 'upcoming' ? 'bg-cyber-cyan' : 'bg-slate-600';
                                      return (
                                        <div
                                          key={aIdx}
                                          className={`absolute top-0.5 bottom-0.5 rounded ${barColor} opacity-80 flex items-center px-1.5 overflow-hidden`}
                                          style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
                                          title={`${a.full_name} — ${a.assigned_project_name} / ${a.assigned_profile_name || 'No role'} | ${a.start_date} → ${a.end_date}`}
                                        >
                                          <span className="text-[8px] font-mono text-white truncate leading-none">{a.assigned_profile_name || a.assigned_project_name}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {/* Legend */}
                            <div className="flex gap-4 mt-3 pt-2 border-t border-cyber-slate/10">
                              {[['bg-cyber-green','Active'],['bg-cyber-cyan','Upcoming'],['bg-slate-600','Past'],['bg-cyber-yellow/60','Today']].map(([cls, label]) => (
                                <div key={label} className="flex items-center gap-1.5">
                                  <div className={`w-3 h-2 rounded ${cls}`} />
                                  <span className="text-[8px] font-mono text-slate-500">{label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* All Assignments Table */}
                    <div className="cyber-panel rounded-lg p-5 space-y-4">
                      <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-cyber-slate/30 pb-2">
                        <Clock size={13} />
                        All Assignments ({new Set([...allAssigned, ...past_assignments].map(a => a.candidate_id)).size} candidates · {allAssigned.length + past_assignments.length} slots)
                      </h3>
                      {[...allAssigned, ...past_assignments].length === 0 ? (
                        <p className="text-xs text-slate-500 italic text-center py-4">No candidates are currently assigned to any project.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          {(() => {
                            const allSlots = [...allAssigned, ...past_assignments];
                            const statusStyles: Record<string, string> = {
                              active: 'text-cyber-green bg-cyber-green/10 border-cyber-green/20',
                              upcoming: 'text-cyber-cyan bg-cyber-cyan/10 border-cyber-cyan/20',
                              past: 'text-slate-500 bg-cyber-gray/30 border-cyber-slate/20',
                              unscheduled: 'text-cyber-yellow bg-cyber-yellow/10 border-cyber-yellow/20',
                            };
                            const statusPriority: Record<string, number> = { active: 0, upcoming: 1, unscheduled: 2, past: 3 };
                            type CandidateGroup = { candidate_id: number; full_name: string; slots: typeof allSlots };
                            const groupMap = new Map<number, CandidateGroup>();
                            for (const a of allSlots) {
                              const g = groupMap.get(a.candidate_id);
                              if (g) g.slots.push(a);
                              else groupMap.set(a.candidate_id, { candidate_id: a.candidate_id, full_name: a.full_name, slots: [a] });
                            }
                            const groups = [...groupMap.values()];
                            return (
                              <table className="w-full text-[11px] font-mono">
                                <thead>
                                  <tr className="border-b border-cyber-slate/20 text-[9px] text-slate-500 uppercase tracking-wider">
                                    <th className="text-left py-2 pr-3">Candidate</th>
                                    <th className="text-left py-2 pr-3">Project</th>
                                    <th className="text-left py-2 pr-3">Role</th>
                                    <th className="text-left py-2 pr-3">Start</th>
                                    <th className="text-left py-2 pr-3">End</th>
                                    <th className="text-left py-2 pr-3">Duration</th>
                                    <th className="text-left py-2 pr-3">Status</th>
                                    <th className="text-left py-2"></th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-cyber-slate/10">
                                  {groups.map(group => {
                                    const isExpanded = expandedUtilCandidates.has(group.candidate_id);
                                    const dominantStatus = group.slots.reduce<string>((best, a) => {
                                      const s = statusOf(a);
                                      return (statusPriority[s] ?? 99) < (statusPriority[best] ?? 99) ? s : best;
                                    }, 'past');
                                    const datesWithValues = group.slots.filter(a => a.start_date && a.end_date);
                                    const earliestStart = datesWithValues.length ? datesWithValues.map(a => a.start_date!).sort()[0] : null;
                                    const latestEnd = datesWithValues.length ? datesWithValues.map(a => a.end_date!).sort().reverse()[0] : null;
                                    return (
                                      <React.Fragment key={group.candidate_id}>
                                        {/* Summary row — click to expand/collapse */}
                                        <tr
                                          className="hover:bg-cyber-gray/20 transition-colors cursor-pointer select-none"
                                          onClick={() => toggleUtilCandidate(group.candidate_id)}
                                        >
                                          <td className="py-2.5 pr-3 font-bold text-slate-200">
                                            <span className="flex items-center gap-1.5">
                                              {isExpanded
                                                ? <ChevronDown size={11} className="text-cyber-cyan shrink-0" />
                                                : <ChevronDown size={11} className="text-slate-500 shrink-0 -rotate-90" />}
                                              {group.full_name}
                                              <span className="ml-1 px-1 py-0 rounded bg-cyber-slate/40 text-[8px] text-slate-400 border border-cyber-slate/30">
                                                {group.slots.length} slot{group.slots.length !== 1 ? 's' : ''}
                                              </span>
                                            </span>
                                          </td>
                                          <td colSpan={4} className="py-2.5 pr-3 text-slate-500 text-[10px]">
                                            {earliestStart && latestEnd
                                              ? `${earliestStart} → ${latestEnd}`
                                              : group.slots.length > 1 ? `${group.slots.length} projects` : (group.slots[0]?.assigned_project_name || '—')}
                                          </td>
                                          <td className="py-2.5 pr-3 text-slate-500">—</td>
                                          <td className="py-2.5 pr-3">
                                            <span className={`px-1.5 py-0.5 rounded border text-[8px] uppercase tracking-widest font-bold ${statusStyles[dominantStatus]}`}>
                                              {dominantStatus}
                                            </span>
                                          </td>
                                          <td className="py-2.5" />
                                        </tr>
                                        {/* Slot detail rows — shown when expanded */}
                                        {isExpanded && group.slots.map((a, si) => {
                                          const status = statusOf(a);
                                          return (
                                            <tr key={`${group.candidate_id}-${si}`} className="bg-cyber-dark/30 hover:bg-cyber-dark/50 transition-colors border-l-2 border-cyber-cyan/20">
                                              <td className="py-1.5 pr-3 pl-5 text-slate-500 text-[10px] italic">└ slot {si + 1}</td>
                                              <td className="py-1.5 pr-3 text-slate-400 truncate max-w-[120px]">{a.assigned_project_name || '—'}</td>
                                              <td className="py-1.5 pr-3 text-slate-400 truncate max-w-[140px]">{a.assigned_profile_name || '—'}</td>
                                              <td className="py-1.5 pr-3 text-slate-300">{a.start_date || '—'}</td>
                                              <td className="py-1.5 pr-3 text-slate-300">{a.end_date || '—'}</td>
                                              <td className="py-1.5 pr-3 text-slate-400">
                                                {a.start_date && a.end_date ? `${durationDays(a.start_date, a.end_date)}d` : '—'}
                                              </td>
                                              <td className="py-1.5 pr-3">
                                                <span className={`px-1.5 py-0.5 rounded border text-[8px] uppercase tracking-widest font-bold ${statusStyles[status]}`}>
                                                  {status}
                                                </span>
                                              </td>
                                              <td className="py-1.5">
                                                <button
                                                  type="button"
                                                  onClick={e => { e.stopPropagation(); handleReleaseAssignment(a.assignment_id); }}
                                                  className="px-1.5 py-0.5 text-[8px] font-mono font-bold uppercase tracking-wider text-cyber-magenta border border-cyber-magenta/30 bg-cyber-magenta/10 hover:bg-cyber-magenta/25 rounded transition-all"
                                                >
                                                  Release
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </React.Fragment>
                                    );
                                  })}
                                </tbody>
                              </table>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Available Candidates */}
                    {available_candidates.length > 0 && (
                      <div className="cyber-panel rounded-lg p-5 space-y-4">
                        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-cyber-slate/30 pb-2">
                          <UserCheck size={13} />
                          Available for Assignment ({available_candidates.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {available_candidates.map(c => (
                            <div key={c.id} className="flex items-center gap-2 p-2.5 bg-cyber-dark/40 border border-cyber-slate/20 rounded-lg">
                              <div className="w-1.5 h-1.5 rounded-full bg-cyber-green shrink-0" />
                              <div className="min-w-0">
                                <span className="text-[11px] font-bold text-slate-200 block truncate">{c.full_name}</span>
                                <span className="text-[9px] font-mono text-slate-500">{c.experience_years}y exp</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Floating task log terminal */}
          {activeTaskId && (
            <div className="fixed bottom-6 right-6 z-[100] w-full max-w-lg cyber-panel border-cyber-cyan/50 shadow-cyan-glow-intense rounded-lg overflow-hidden flex flex-col">
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
        taskStatus={taskStatus}
        onUpdateCandidate={handleSaveCandidate}
        onToggleDisqualifyAssessment={handleToggleDisqualifyAssessment}
        onUploadCv={async (candidateId, file) => {
          try {
            const res = await api.uploadCVForCandidate(candidateId, file);
            startTaskProgressStream(res.task_id);
          } catch (err: any) {
            alert('Failed to upload CV: ' + (err.message || err));
          }
        }}
        onSyncLinkedin={async (candidateId) => {
          try {
            const res = await api.scanLinkedInForCandidate(candidateId);
            startTaskProgressStream(res.task_id);
          } catch (err: any) {
            alert('Failed to sync LinkedIn: ' + (err.message || err));
          }
        }}
        onPasteLinkedin={async (candidateId, text) => {
          try {
            const res = await api.pasteLinkedInForCandidate(candidateId, text);
            startTaskProgressStream(res.task_id);
          } catch (err: any) {
            alert('Failed to process pasted LinkedIn profile: ' + (err.message || err));
          }
        }}
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

      {/* Assignment Date Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="cyber-panel border border-cyber-cyan/30 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold font-mono text-cyber-cyan uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  Assign Candidate
                </h3>
                <p className="text-[11px] text-slate-300 mt-1 font-sans">
                  <span className="font-bold text-slate-100">{assignModal.candidateName}</span>
                  {' → '}
                  <span className="text-cyber-cyan">{assignModal.profileName}</span>
                </p>
              </div>
              <button type="button" onClick={() => setAssignModal(null)} className="text-slate-500 hover:text-slate-200 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Calendar range picker */}
            <RangePicker
              busyRanges={
                candidates.find(c => c.id === assignModal.candidateId)?.assignments ?? []
              }
              startDate={assignModal.startDate}
              endDate={assignModal.endDate}
              onChange={(start, end) =>
                setAssignModal(prev => prev ? { ...prev, startDate: start, endDate: end } : null)
              }
            />

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-cyber-slate/30">
              <button
                type="button"
                onClick={() => setAssignModal(null)}
                className="px-3 py-1.5 border border-cyber-slate/50 text-slate-400 rounded text-xs font-mono uppercase tracking-wider hover:bg-cyber-slate/20 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAssign}
                className="px-4 py-1.5 bg-cyber-cyan/20 hover:bg-cyber-cyan/35 border border-cyber-cyan text-cyber-cyan hover:text-white rounded text-xs font-mono uppercase tracking-wider font-bold transition-all"
              >
                Confirm Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="cyber-panel border border-cyber-slate/50 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-2 rounded-lg shrink-0 ${
                deleteConfirm.canProceed
                  ? 'bg-red-900/20 border border-red-500/30 text-red-400'
                  : 'bg-cyber-yellow/10 border border-cyber-yellow/30 text-cyber-yellow'
              }`}>
                {deleteConfirm.canProceed ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
              </div>
              <div>
                <h3 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider">
                  {deleteConfirm.canProceed ? 'Confirm Deletion' : 'Cannot Delete'}
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed font-sans">
                  {deleteConfirm.message}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-cyber-slate/30">
              <button
                type="button"
                onClick={() => setDeleteConfirm({ isOpen: false, candidateId: null, candidateName: '', message: '', canProceed: false })}
                className="px-4 py-1.5 border border-cyber-slate/50 text-slate-400 rounded text-xs font-mono uppercase tracking-wider hover:bg-cyber-slate/30 hover:text-slate-200 transition-colors"
              >
                {deleteConfirm.canProceed ? 'No' : 'OK'}
              </button>
              {deleteConfirm.canProceed && (
                <button
                  type="button"
                  onClick={confirmDeleteCandidate}
                  className="px-4 py-1.5 border border-red-500/50 bg-red-900/20 text-red-400 rounded text-xs font-mono uppercase tracking-wider hover:bg-red-900/40 hover:text-red-300 transition-colors font-bold"
                >
                  Yes, Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
