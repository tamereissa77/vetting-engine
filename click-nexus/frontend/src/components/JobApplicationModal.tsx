import React, { useState, useEffect, useRef } from 'react';
import { X, Shield, UploadCloud, Linkedin, CheckCircle2, AlertTriangle, AlertCircle, FileText, ChevronRight, Terminal, Trophy } from 'lucide-react';
import { Job } from './NexusPortal';

interface ModalProps {
  isOpen: boolean;
  job: Job;
  onClose: () => void;
}

interface ApplicationResult {
  id: number;
  status: string;
  match_score: number;
  skills_match: string[];
  skills_gap: string[];
  red_flags_detected: string[];
  ai_verdict: string;
  is_disqualified: boolean;
  logs: string[];
}

const getApiUrl = () => {
  const hostname = window.location.hostname;
  return `http://${hostname}:8001`;
};

export function JobApplicationModal({ isOpen, job, onClose }: ModalProps) {
  const [step, setStep] = useState<number>(1);
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [contactNumber, setContactNumber] = useState<string>('');
  const [linkedinUrl, setLinkedinUrl] = useState<string>('');
  const [countryOfResidence, setCountryOfResidence] = useState<string>('');
  const [nationality, setNationality] = useState<string>('');
  const [linkedinText, setLinkedinText] = useState<string>('');
  const [isPastingLinkedin, setIsPastingLinkedin] = useState<boolean>(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  
  // Dynamic validation questions (Sliders)
  const [req1, setReq1] = useState<number>(3);
  const [req2, setReq2] = useState<number>(2);
  const [proofText, setProofText] = useState<string>('');

  // Drag and drop states
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Ingestion & Polling States
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [appDetails, setAppDetails] = useState<ApplicationResult | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, []);

  if (!isOpen) return null;

  const clearPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setCvFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCvFile(e.target.files[0]);
    }
  };

  const handleSubmitInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const startPollingApplication = (appId: number) => {
    clearPolling();
    pollTimerRef.current = window.setInterval(async () => {
      try {
        const res = await fetch(`${getApiUrl()}/api/applications/${appId}`);
        if (res.ok) {
          const data: ApplicationResult = await res.json();
          setAppDetails(data);
          setTerminalLogs(data.logs || []);
          if (data.status === 'completed' || data.status === 'failed') {
            clearPolling();
          }
        }
      } catch (err) {
        console.error('Error polling application status:', err);
      }
    }, 1500);
  };

  const handleDispatchApplication = async () => {
    if (!cvFile) {
      alert("Please upload your CV resume file to proceed.");
      return;
    }

    setStep(3);
    setTerminalLogs(["[00:00:00] Initializing Click Nexus Gateway dispatch handler...", "[00:00:01] Preparing candidate payloads for transmission..."]);

    const formData = new FormData();
    formData.append("job_profile_id", String(job.id));
    formData.append("job_role_name", job.role_name);
    formData.append("full_name", fullName);
    formData.append("email", email);
    formData.append("linkedin_url", linkedinUrl);
    formData.append("contact_number", contactNumber);
    formData.append("country_of_residence", countryOfResidence);
    formData.append("nationality", nationality);
    if (linkedinText) {
      formData.append("linkedin_text", linkedinText);
    }

    // Include the validated answers
    const answers = {
      layer_experience: req1,
      secure_environments: req2,
      justification: proofText
    };
    formData.append("validation_answers", JSON.stringify(answers));
    formData.append("cv_file", cvFile);

    try {
      const response = await fetch(`${getApiUrl()}/api/applications`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const resData = await response.json();
        setApplicationId(resData.id);
        setTerminalLogs(resData.logs || []);
        startPollingApplication(resData.id);
      } else {
        const errMsg = await response.text();
        setTerminalLogs((prev: string[]) => [...prev, `[ERROR] Ingestion Dispatch failed: Status ${response.status} - ${errMsg}`]);
      }
    } catch (err: any) {
      setTerminalLogs((prev: string[]) => [...prev, `[ERROR] Network error during dispatch: ${err.message}`]);
    }
  };

  const getComplianceClass = (score: number, disq: boolean) => {
    if (disq) return "text-cyber-magenta border-cyber-magenta/30 bg-cyber-magenta/5";
    if (score >= 70) return "text-cyber-green border-cyber-green/30 bg-cyber-green/5";
    if (score >= 50) return "text-yellow-500 border-yellow-500/30 bg-yellow-500/5";
    return "text-cyber-magenta border-cyber-magenta/30 bg-cyber-magenta/5";
  };

  const getComplianceText = (score: number, disq: boolean) => {
    if (disq) return "DISQUALIFIED // SECURITY RED FLAGS";
    if (score >= 70) return "VERIFIED // COMPLIANT PROFILE";
    if (score >= 50) return "CONDITIONAL // MANUAL REVIEW REQUIRED";
    return "NON-COMPLIANT // LOW ALIGNMENT";
  };

  // Derive dynamic requirement labels
  const getReqLabels = (layer: string) => {
    if (layer.includes("Infrastructure")) {
      return {
        q1: "Years working with On-Premise hardware clusters & bare-metal hypervisors (RTX/Nvidia):",
        q2: "Years implementing air-gapped system firewalls & local secure network topologies:"
      };
    } else if (layer.includes("Data")) {
      return {
        q1: "Years building vector search indices (pgvector, Qdrant, Milvus):",
        q2: "Years executing PostgreSQL scaling & custom DB function pipelines:"
      };
    }
    return {
      q1: "Years of engineering experience matching the requirements of this role:",
      q2: "Years implementing decentralized/secure software compliance architectures:"
    };
  };

  const reqLabels = getReqLabels(job.stack_layer);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-cyber-dark border border-cyber-slate rounded-lg shadow-cyan-glow overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-cyber-slate/50 px-6 py-4 bg-cyber-gray/40">
          <div className="flex items-center gap-2">
            <Shield className="text-cyber-cyan animate-pulse" size={16} />
            <span className="font-mono text-xs font-bold tracking-wider uppercase text-slate-300">
              Talent Ledger Submission: T-{job.id}
            </span>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-200 focus:outline-none transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Steps Breadcrumbs */}
        <div className="flex bg-[#070b0f] border-b border-cyber-slate/30 px-6 py-3 font-mono text-[9px] uppercase tracking-wider text-slate-500">
          <span className={step === 1 ? "text-cyber-cyan font-bold" : "text-slate-400"}>1. Identity Registry</span>
          <ChevronRight size={10} className="mx-2 text-slate-600" />
          <span className={step === 2 ? "text-cyber-cyan font-bold" : "text-slate-400"}>2. Ingestion Payloads</span>
          <ChevronRight size={10} className="mx-2 text-slate-600" />
          <span className={step === 3 ? "text-cyber-cyan font-bold" : "text-slate-400"}>3. Vitting Engine Compliance</span>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* STEP 1: Basic Information */}
          {step === 1 && (
            <form onSubmit={handleSubmitInfo} className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-100">Establish Registry Connection</h3>
                <p className="text-[10px] text-slate-400 font-mono">Input candidate contact endpoints to bind with Vitting index.</p>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-[#080d12]/60 border border-cyber-slate/50 text-slate-200 text-xs rounded px-3 py-2 font-mono focus:outline-none focus:border-cyber-cyan/60"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. jdoe@secure-channel.net"
                    className="w-full bg-[#080d12]/60 border border-cyber-slate/50 text-slate-200 text-xs rounded px-3 py-2 font-mono focus:outline-none focus:border-cyber-cyan/60"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Secure Contact Number</label>
                  <input
                    type="text"
                    required
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="e.g. +1 555-0199"
                    className="w-full bg-[#080d12]/60 border border-cyber-slate/50 text-slate-200 text-xs rounded px-3 py-2 font-mono focus:outline-none focus:border-cyber-cyan/60"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400">LinkedIn Profile Link</label>
                  <input
                    type="text"
                    required
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full bg-[#080d12]/60 border border-cyber-slate/50 text-slate-200 text-xs rounded px-3 py-2 font-mono focus:outline-none focus:border-cyber-cyan/60"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Country of Residence</label>
                  <input
                    type="text"
                    required
                    value={countryOfResidence}
                    onChange={(e) => setCountryOfResidence(e.target.value)}
                    placeholder="e.g. Egypt"
                    className="w-full bg-[#080d12]/60 border border-cyber-slate/50 text-slate-200 text-xs rounded px-3 py-2 font-mono focus:outline-none focus:border-cyber-cyan/60"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Nationality</label>
                  <input
                    type="text"
                    required
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    placeholder="e.g. Egyptian"
                    className="w-full bg-[#080d12]/60 border border-cyber-slate/50 text-slate-200 text-xs rounded px-3 py-2 font-mono focus:outline-none focus:border-cyber-cyan/60"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-cyber-cyan/15 hover:bg-cyber-cyan/35 border border-cyber-cyan/40 hover:border-cyber-cyan text-cyber-cyan hover:text-white rounded font-mono text-[10px] uppercase tracking-widest shadow-cyan-glow/15 transition-all flex items-center gap-1.5"
                >
                  <span>Continue</span>
                  <ChevronRight size={12} />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Ingestion Payloads */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-100">Upload Verification Payload</h3>
                <p className="text-[10px] text-slate-400 font-mono">Submit CV file or paste LinkedIn profile text to run vector compatibility matching.</p>
              </div>

              {/* Dynamic Requirements Sliders */}
              <div className="cyber-panel p-4 rounded border border-cyber-slate/40 space-y-4">
                <span className="text-[10px] font-mono text-cyber-cyan uppercase tracking-wider block border-b border-cyber-slate/20 pb-1">
                  1. Capability Verification Sliders
                </span>

                <div className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono text-slate-300">
                      <span>{reqLabels.q1}</span>
                      <span className="text-cyber-cyan font-bold">{req1} Years</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={req1}
                      onChange={(e) => setReq1(Number(e.target.value))}
                      className="w-full h-1 bg-cyber-slate rounded-lg appearance-none cursor-pointer accent-cyber-cyan"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono text-slate-300">
                      <span>{reqLabels.q2}</span>
                      <span className="text-cyber-cyan font-bold">{req2} Years</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={req2}
                      onChange={(e) => setReq2(Number(e.target.value))}
                      className="w-full h-1 bg-cyber-slate rounded-lg appearance-none cursor-pointer accent-cyber-cyan"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 pt-1">
                    <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Brief proof of architectural capabilities:</label>
                    <textarea
                      rows={2}
                      value={proofText}
                      onChange={(e) => setProofText(e.target.value)}
                      placeholder="Input cryptographic proof or reference projects detailing your skills in this layer..."
                      className="w-full bg-[#080d12]/60 border border-cyber-slate/50 text-slate-200 text-xs rounded px-3 py-2 font-mono focus:outline-none focus:border-cyber-cyan/60 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Payload Submission options */}
              <div className="space-y-4">
                <span className="text-[10px] font-mono text-cyber-cyan uppercase tracking-wider block border-b border-cyber-slate/20 pb-1">
                  2. Document & Profile Payloads
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* File Upload drag-and-drop */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border border-dashed rounded-lg p-5 flex flex-col items-center justify-center text-center transition-all ${
                      dragActive 
                        ? 'border-cyber-cyan bg-cyber-cyan/5 shadow-cyan-glow' 
                        : cvFile 
                          ? 'border-cyber-green bg-cyber-green/5' 
                          : 'border-cyber-slate/50 hover:border-cyber-cyan/40 hover:bg-cyber-slate/10'
                    }`}
                  >
                    <UploadCloud className={cvFile ? "text-cyber-green animate-pulse" : "text-slate-400"} size={28} />
                    <p className="font-mono text-[10px] text-slate-300 mt-2">
                      {cvFile ? cvFile.name : "DRAG & DROP RESUME CV"}
                    </p>
                    <p className="text-[8px] text-slate-500 mt-1">PDF or DOCX format (Max 10MB)</p>
                    
                    <label className="mt-3 px-3 py-1 bg-cyber-slate/50 hover:bg-cyber-slate text-slate-300 rounded font-mono text-[9px] uppercase tracking-wider cursor-pointer transition-colors border border-cyber-slate/60">
                      <span>Browse Files</span>
                      <input type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} />
                    </label>
                  </div>

                  {/* LinkedIn registered status */}
                  <div className="border border-cyber-slate/50 rounded-lg p-5 flex flex-col justify-between bg-cyber-gray/10">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 font-mono text-[10px] text-cyber-green">
                        <Linkedin className="text-cyber-green" size={14} />
                        <span>LINKEDIN REGISTERED</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono truncate">
                        {linkedinUrl}
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setIsPastingLinkedin(!isPastingLinkedin)}
                        className="text-[9px] font-mono text-cyber-cyan hover:underline uppercase tracking-wide flex items-center gap-1"
                      >
                        {isPastingLinkedin ? "[-] Hide paste container" : "[+] Paste raw profile text/source"}
                      </button>
                    </div>
                  </div>

                </div>

                {isPastingLinkedin && (
                  <div className="flex flex-col gap-1.5 animate-fade-in">
                    <label className="text-[9px] font-mono uppercase tracking-wider text-slate-400">Pasted LinkedIn Text Payload</label>
                    <textarea
                      rows={5}
                      value={linkedinText}
                      onChange={(e) => setLinkedinText(e.target.value)}
                      placeholder="Paste raw text copied from candidate's profile page, or HTML code..."
                      className="w-full bg-[#080d12]/60 border border-cyber-slate/50 text-slate-200 text-xs rounded px-3 py-2 font-mono focus:outline-none focus:border-cyber-cyan/60"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-cyber-slate/20">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-cyber-slate hover:bg-cyber-slate/30 text-slate-300 rounded font-mono text-[10px] uppercase tracking-widest transition-colors"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleDispatchApplication}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyber-magenta/20 to-cyber-cyan/20 hover:from-cyber-magenta/30 hover:to-cyber-cyan/30 border border-cyber-magenta/40 text-cyber-magenta hover:text-white rounded font-mono text-[10px] uppercase tracking-widest shadow-magenta-glow transition-all flex items-center gap-1.5"
                >
                  <span>Dispatch Application</span>
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Vitting Engine Compliance Checking */}
          {step === 3 && (
            <div className="space-y-6">
              
              {/* Vitting Sandbox Terminal Logs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1">
                    <Terminal size={12} className="text-cyber-cyan" />
                    Vitting Sandbox Logs: Pipeline Active
                  </span>
                  <span className="animate-pulse text-cyber-magenta font-bold">
                    {appDetails?.status === 'completed' 
                      ? 'EXECUTION COMPLETED' 
                      : appDetails?.status === 'failed' 
                        ? 'EXECUTION FAILED' 
                        : 'ANALYZING LEDGER...'}
                  </span>
                </div>

                <div className="bg-black/90 border border-cyber-slate rounded p-4 h-60 overflow-y-auto font-mono text-[10px] text-emerald-400 space-y-1.5 shadow-inner">
                  {terminalLogs.map((log, idx) => (
                    <div key={idx} className={log.includes('[ERROR]') ? 'text-cyber-magenta' : log.includes('resolved') ? 'text-cyber-cyan' : 'text-emerald-400'}>
                      {log}
                    </div>
                  ))}
                  {appDetails?.status !== 'completed' && appDetails?.status !== 'failed' && (
                    <div className="flex items-center gap-1 text-slate-500 animate-pulse">
                      <span>[LOG_POLLING] Waiting for engine update...</span>
                    </div>
                  )}
                  <div ref={terminalEndRef} />
                </div>
              </div>

              {/* Complete Compliance Scorecard Screen */}
              {appDetails?.status === 'completed' && (
                <div className="cyber-panel p-5 rounded border border-cyber-slate/50 animate-fade-in space-y-4 bg-cyber-dark/60">
                  <div className="flex flex-col md:flex-row items-center gap-6 border-b border-cyber-slate/20 pb-4">
                    
                    {/* Radial Score Gauge */}
                    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="48" cy="48" r="40" className="stroke-cyber-slate fill-none" strokeWidth="8" />
                        <circle 
                          cx="48" 
                          cy="48" 
                          r="40" 
                          className="stroke-cyber-cyan fill-none transition-all duration-1000" 
                          strokeWidth="8" 
                          strokeDasharray={2 * Math.PI * 40}
                          strokeDashoffset={2 * Math.PI * 40 * (1 - appDetails.match_score / 100)}
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-xl font-bold font-mono text-slate-100">{appDetails.match_score}%</span>
                        <span className="block text-[8px] font-mono text-slate-400 uppercase">Match</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-center md:text-left flex-1">
                      <div className={`inline-block px-3 py-1 font-mono text-[9px] uppercase tracking-widest border rounded font-bold ${getComplianceClass(appDetails.match_score, appDetails.is_disqualified)}`}>
                        {getComplianceText(appDetails.match_score, appDetails.is_disqualified)}
                      </div>
                      <h4 className="text-sm font-bold text-slate-200 mt-2">Vetted for: {job.role_name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">Ledger ID: #{appDetails.id} | Synced to Vitting Engine Sandbox.</p>
                    </div>
                  </div>

                  {/* Skills Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono text-cyber-green uppercase tracking-wider block">Validated Skills Match</span>
                      <div className="flex flex-wrap gap-1">
                        {appDetails.skills_match.length > 0 ? (
                          appDetails.skills_match.map(s => (
                            <span key={s} className="px-2 py-0.5 bg-cyber-green/5 border border-cyber-green/20 text-cyber-green text-[9px] font-mono rounded">
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 italic text-[10px]">No skills match parsed.</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[9px] font-mono text-yellow-500 uppercase tracking-wider block">Gaps & Deficiencies Detected</span>
                      <div className="flex flex-wrap gap-1">
                        {appDetails.skills_gap.length > 0 ? (
                          appDetails.skills_gap.map(s => (
                            <span key={s} className="px-2 py-0.5 bg-yellow-500/5 border border-yellow-500/20 text-yellow-500 text-[9px] font-mono rounded">
                              {s}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 italic text-[10px]">Perfect vector alignment.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Red flags & AI Verdict */}
                  {appDetails.red_flags_detected.length > 0 && (
                    <div className="p-3 bg-cyber-magenta/5 border border-cyber-magenta/20 rounded">
                      <div className="flex items-center gap-1.5 text-cyber-magenta font-mono text-[9px] uppercase tracking-wider mb-1">
                        <AlertTriangle size={12} />
                        <span>Security Compliance Red Flags</span>
                      </div>
                      <ul className="list-disc list-inside text-[10px] text-slate-300 space-y-0.5">
                        {appDetails.red_flags_detected.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-1 pt-2">
                    <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider block">Sovereign Compliance AI Verdict</span>
                    <p className="text-xs text-slate-300 font-sans leading-relaxed italic bg-cyber-gray/30 p-3 border border-cyber-slate/30 rounded">
                      "{appDetails.ai_verdict}"
                    </p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end pt-4 border-t border-cyber-slate/20">
                {(appDetails?.status === 'completed' || appDetails?.status === 'failed') ? (
                  <button
                    onClick={onClose}
                    className="px-5 py-2 bg-cyber-cyan/15 hover:bg-cyber-cyan/35 border border-cyber-cyan/40 hover:border-cyber-cyan text-cyber-cyan hover:text-white rounded font-mono text-[10px] uppercase tracking-widest shadow-cyan-glow/20 transition-all"
                  >
                    Finish & Close
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                    <div className="w-3.5 h-3.5 rounded-full border border-cyber-cyan border-t-transparent animate-spin"></div>
                    <span>Processing Sandbox Evaluation...</span>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
