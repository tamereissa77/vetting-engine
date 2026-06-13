import React, { useState, useEffect } from 'react';
import { X, User, Mail, Shield, AlertTriangle, CheckCircle2, Play, Terminal, FileText, Linkedin } from 'lucide-react';
import { CandidateDetails, TalentProfile, Candidate } from '../utils/api';

interface DossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateDetails: CandidateDetails | null;
  profiles: TalentProfile[];
  onRunVetting: (candidateId: number, profileId: number) => void;
  activeVettingProfileId: number | null;
  taskProgress: number;
  onUpdateCandidate?: (payload: Partial<Candidate>) => Promise<void>;
  onToggleDisqualifyAssessment?: (assessmentId: number, disqualified: boolean) => Promise<void>;
}

export const DossierModal: React.FC<DossierModalProps> = ({
  isOpen,
  onClose,
  candidateDetails,
  profiles,
  onRunVetting,
  activeVettingProfileId,
  taskProgress,
  onUpdateCandidate,
  onToggleDisqualifyAssessment,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'scorecard' | 'details'>('scorecard');
  const [expandedAssessments, setExpandedAssessments] = useState<number[]>([]);

  // Local state for editing form
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaveSuccess, setIsSaveSuccess] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);

  useEffect(() => {
    if (candidateDetails && isOpen) {
      setFullName(candidateDetails.full_name || '');
      setEmail(candidateDetails.email || '');
      setContactNumber(candidateDetails.contact_number || '');
      setExperienceYears(candidateDetails.experience_years || 0);
      setLinkedinUrl(candidateDetails.linkedin_url || '');
      setNotes(candidateDetails.notes || '');
      setIsSaveSuccess(false);
      setIsEditingDetails(false);
    }
  }, [candidateDetails, isOpen]);

  if (!isOpen || !candidateDetails) return null;

  const toggleExpandAssessment = (profileId: number) => {
    setExpandedAssessments((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId]
    );
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateCandidate || !candidateDetails) return;
    try {
      await onUpdateCandidate({
        id: candidateDetails.id,
        full_name: fullName,
        email,
        contact_number: contactNumber,
        experience_years: experienceYears,
        linkedin_url: linkedinUrl,
        notes,
        skills: candidateDetails.skills,
        is_blacklisted: candidateDetails.is_blacklisted,
      });
      setIsSaveSuccess(true);
      setIsEditingDetails(false);
      setTimeout(() => setIsSaveSuccess(false), 4000);
    } catch (err: any) {
      alert('Failed to update candidate details: ' + (err.message || err));
    }
  };

  // Map of profile ID to assessment
  const assessmentMap = new Map();
  if (candidateDetails.assessments) {
    candidateDetails.assessments.forEach((a) => {
      assessmentMap.set(a.profile_id, a);
    });
  }

  const isBlacklisted = candidateDetails.is_blacklisted;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="cyber-panel border-cyber-cyan/30 max-w-5xl w-full h-[90vh] overflow-hidden rounded-lg shadow-cyan-glow flex flex-col bg-cyber-dark/95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyber-slate/50 px-6 py-4 bg-cyber-gray/90 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 border rounded ${isBlacklisted ? 'bg-cyber-magenta/10 border-cyber-magenta text-cyber-magenta' : 'bg-cyber-cyan/10 border-cyber-cyan text-cyber-cyan'}`}>
              <Shield size={20} className={isBlacklisted ? '' : 'animate-pulse'} />
            </div>
            <div>
              <h2 className="text-base font-bold font-sans tracking-wider text-slate-100 uppercase flex items-center gap-2">
                <span>Candidate Vetting Dossier:</span>
                <span className={isBlacklisted ? 'text-cyber-magenta' : 'text-cyber-cyan'}>{candidateDetails.full_name}</span>
              </h2>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Archival Ledger ID: ST-{candidateDetails.id} • compliance classification: {isBlacklisted ? 'DEVIANT' : 'COMPLIANT'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-cyber-cyan transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Sub-navigation & Candidate Brief */}
        <div className="bg-cyber-gray/40 border-b border-cyber-slate/30 px-6 py-3 shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 font-mono">
            <span className="flex items-center gap-1">
              <User size={12} className="text-slate-400" />
              Exp: {candidateDetails.experience_years} Years
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Mail size={12} className="text-slate-400" />
              {candidateDetails.email || 'N/A'}
            </span>
            {candidateDetails.contact_number && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-400">📞</span>
                  {candidateDetails.contact_number}
                </span>
              </>
            )}
            {candidateDetails.linkedin_url && (
              <>
                <span>•</span>
                <a
                  href={candidateDetails.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-cyber-cyan hover:underline"
                >
                  <Linkedin size={12} />
                  LinkedIn Profile
                </a>
              </>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveSubTab('scorecard')}
              className={`px-3 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors border ${
                activeSubTab === 'scorecard'
                  ? 'bg-cyber-cyan/10 border-cyber-cyan text-cyber-cyan font-bold shadow-cyan-glow/20'
                  : 'bg-cyber-dark/50 border-cyber-slate/30 text-slate-400 hover:text-slate-200'
              }`}
            >
              Vetting scorecard
            </button>
            <button
              onClick={() => setActiveSubTab('details')}
              className={`px-3 py-1 rounded font-mono text-[10px] uppercase tracking-wider transition-colors border ${
                activeSubTab === 'details'
                  ? 'bg-cyber-cyan/10 border-cyber-cyan text-cyber-cyan font-bold shadow-cyan-glow/20'
                  : 'bg-cyber-dark/50 border-cyber-slate/30 text-slate-400 hover:text-slate-200'
              }`}
            >
              Details
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-cyber-dark/50 min-h-0">
          {isBlacklisted && (
            <div className="mb-6 p-4 bg-cyber-magenta/15 border border-cyber-magenta/40 text-cyber-magenta rounded-lg flex items-center gap-3">
              <AlertTriangle size={20} className="shrink-0 animate-pulse" />
              <div className="text-xs">
                <h4 className="font-bold font-mono tracking-wide uppercase">🛡️ BLACKLIST POLICY BLOCKADE ACTIVE</h4>
                <p className="text-slate-300 mt-0.5">
                  Vetting execution matches are restricted for blacklisted candidates. Remove blacklist state from the Candidate Registry list to unlock evaluations.
                </p>
              </div>
            </div>
          )}

          {activeSubTab === 'scorecard' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-cyber-slate/30">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300">
                  Target Profile Scorecard Matrix
                </h3>
                <span className="text-[10px] font-mono text-slate-400">
                  Vetted: {candidateDetails.assessments?.length || 0} / {profiles.length} roles
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {profiles.map((profile) => {
                  const assessment = assessmentMap.get(profile.id);
                  const isAssessed = !!assessment;
                  const isExpanded = expandedAssessments.includes(profile.id!);

                  let scoreColor = 'text-cyber-cyan';
                  let barColor = 'bg-cyber-cyan';
                  let hasRedFlags = false;

                  if (isAssessed) {
                    hasRedFlags = assessment.red_flags_detected && assessment.red_flags_detected.length > 0;
                    if (assessment.is_disqualified) {
                      scoreColor = 'text-slate-400';
                      barColor = 'bg-slate-500';
                    } else if (hasRedFlags || assessment.match_score < 50) {
                      scoreColor = 'text-cyber-magenta';
                      barColor = 'bg-cyber-magenta';
                    } else if (assessment.match_score >= 50 && assessment.match_score < 80) {
                      scoreColor = 'text-cyber-yellow';
                      barColor = 'bg-cyber-yellow';
                    }
                  }

                  const isRunning = profile.id === activeVettingProfileId;

                  return (
                    <div
                      key={profile.id}
                      className={`border rounded-lg transition-all duration-300 ${
                        isAssessed
                          ? assessment.is_disqualified
                            ? 'opacity-60 bg-slate-900/40 border-slate-800'
                            : isExpanded
                              ? 'border-cyber-cyan/40 bg-cyber-cyan/5'
                              : 'border-cyber-slate/40 hover:border-cyber-cyan/30 bg-cyber-gray/20'
                          : isRunning
                            ? 'border-cyber-cyan/50 bg-cyber-cyan/5 shadow-cyan-glow animate-pulse bg-cyber-gray/20'
                            : 'border-cyber-slate/20 opacity-75 bg-cyber-gray/20'
                      }`}
                    >
                      {/* Row Brief Header */}
                      <div
                        onClick={() => isAssessed && toggleExpandAssessment(profile.id!)}
                        className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none ${
                          isAssessed ? 'cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        {/* Profile Info */}
                        <div className="md:w-1/3 truncate">
                          <span className="px-1.5 py-0.2 bg-cyber-dark text-slate-400 border border-cyber-slate rounded-[7px] text-[8px] font-mono tracking-wider uppercase">
                            {profile.stack_layer}
                          </span>
                          <h4 className="text-xs font-bold font-sans mt-1 text-slate-200">
                            {profile.role_name}
                          </h4>
                        </div>

                        {/* Status / Score Bar */}
                        <div className="flex-1 flex items-center gap-3">
                          {isAssessed ? (
                            <>
                              <div className="w-full bg-cyber-dark rounded-full h-1.5 overflow-hidden border border-cyber-slate/50">
                                <div
                                  className={`${barColor} h-full transition-all duration-500`}
                                  style={{ width: `${assessment.match_score}%` }}
                                />
                              </div>
                              <span className={`text-xs font-bold font-mono ${scoreColor} w-10 text-right`}>
                                {assessment.match_score}%
                              </span>
                            </>
                          ) : isRunning ? (
                            <>
                              <div className="w-full bg-cyber-dark rounded-full h-1.5 overflow-hidden border border-cyber-cyan/30">
                                <div
                                  className="bg-cyber-cyan h-full transition-all duration-300 animate-pulse"
                                  style={{ width: `${taskProgress}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold font-mono text-cyber-cyan w-10 text-right animate-pulse">
                                {taskProgress}%
                              </span>
                            </>
                          ) : (
                            <div className="flex-1 text-xs font-mono text-slate-500 italic">
                              Pending matching evaluation
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-4 justify-between md:justify-end shrink-0">
                          {isAssessed ? (
                            <div className="flex items-center gap-3">
                              {assessment.is_disqualified ? (
                                <span className="flex items-center gap-1 text-[10px] text-slate-400 font-mono font-bold uppercase">
                                  <XCircleIcon className="text-slate-400 shrink-0" />
                                  Disqualified
                                </span>
                              ) : hasRedFlags ? (
                                <span className="flex items-center gap-1 text-[10px] text-cyber-magenta font-mono font-bold uppercase animate-pulse">
                                  <AlertTriangle size={12} />
                                  {assessment.red_flags_detected.length} Red Flags
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-[10px] text-cyber-green font-mono font-bold uppercase">
                                  <CheckCircle2 size={12} />
                                  Compliant
                                </span>
                              )}

                              {onToggleDisqualifyAssessment && (
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await onToggleDisqualifyAssessment(assessment.id, !assessment.is_disqualified);
                                  }}
                                  className={`px-2 py-0.5 border text-[9px] font-mono rounded uppercase transition-colors shrink-0 ${
                                    assessment.is_disqualified
                                      ? 'border-cyber-cyan/50 text-cyber-cyan hover:bg-cyber-cyan/10'
                                      : 'border-cyber-magenta/50 text-cyber-magenta hover:bg-cyber-magenta/10'
                                  }`}
                                >
                                  {assessment.is_disqualified ? 'Re-qualify' : 'Disqualify'}
                                </button>
                              )}

                              <span className="text-[10px] text-slate-400 font-mono">
                                {isExpanded ? 'Collapse ▲' : 'Inspect Details ▼'}
                              </span>
                            </div>
                          ) : isRunning ? (
                            <span className="px-3 py-1 bg-cyber-cyan/15 border border-cyber-cyan/40 text-cyber-cyan rounded font-mono text-[9px] uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan animate-ping shrink-0" />
                              Vetting...
                            </span>
                          ) : (
                            <button
                              disabled={isBlacklisted}
                              onClick={(e) => {
                                  e.stopPropagation();
                                  if (profile.id) onRunVetting(candidateDetails.id, profile.id);
                              }}
                              className="px-3 py-1 bg-cyber-cyan/10 hover:bg-cyber-cyan/35 border border-cyber-cyan/30 text-cyber-cyan hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded font-mono text-[9px] uppercase tracking-wider flex items-center gap-1 transition-colors"
                            >
                              <Play size={10} />
                              Run Engine
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded Assessment details */}
                      {isAssessed && isExpanded && (
                        <div className="px-4 pb-4 border-t border-cyber-slate/20 pt-4 space-y-4 text-xs font-sans animate-slide-down">
                          
                          {/* Match / Gap Lists */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            
                            {/* Skills Matches */}
                            <div className="border border-cyber-green/20 bg-cyber-green/5 rounded-lg p-3">
                              <h5 className="text-[9px] font-mono uppercase tracking-wider text-cyber-green flex items-center gap-1 mb-2">
                                <CheckCircle2 size={10} />
                                Matched Capabilities
                              </h5>
                              {assessment.skills_match && assessment.skills_match.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {assessment.skills_match.map((s: string) => (
                                    <span key={s} className="px-1.5 py-0.5 bg-cyber-dark text-[9px] text-cyber-green border border-cyber-green/20 font-mono rounded">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500 font-mono italic text-[10px]">None matched</span>
                              )}
                            </div>

                            {/* Skills Gaps */}
                            <div className="border border-cyber-magenta/20 bg-cyber-magenta/5 rounded-lg p-3">
                              <h5 className="text-[9px] font-mono uppercase tracking-wider text-cyber-magenta flex items-center gap-1 mb-2">
                                <XCircleIcon className="text-cyber-magenta" />
                                Capability Gaps
                              </h5>
                              {assessment.skills_gap && assessment.skills_gap.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {assessment.skills_gap.map((s: string) => (
                                    <span key={s} className="px-1.5 py-0.5 bg-cyber-dark text-[9px] text-cyber-magenta border border-cyber-magenta/20 font-mono rounded">
                                      {s}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500 font-mono italic text-[10px]">None identified</span>
                              )}
                            </div>
                          </div>

                          {/* Critical Red Flags details */}
                          {hasRedFlags && (
                            <div className="bg-cyber-magenta/10 border border-cyber-magenta/30 text-cyber-magenta rounded-lg p-3">
                              <h5 className="text-[9px] font-mono uppercase tracking-wider font-bold flex items-center gap-1 mb-1.5">
                                <AlertTriangle size={12} />
                                Critical Red Flag Detections
                              </h5>
                              <ul className="list-disc pl-4 space-y-1 font-sans text-xs">
                                {assessment.red_flags_detected.map((flag: string, i: number) => (
                                  <li key={i}>{flag}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* AI Rationale verdict logs */}
                          <div className="space-y-1.5">
                            <h5 className="text-[9px] font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1">
                              <Terminal size={10} className="text-cyber-cyan" />
                              AI Vetting Decision Log
                            </h5>
                            <div className="bg-cyber-gray border border-cyber-slate/50 p-3 rounded font-sans text-[11px] text-slate-300 whitespace-pre-line leading-relaxed max-h-[160px] overflow-y-auto">
                              {assessment.ai_verdict}
                            </div>
                          </div>

                          <div className="text-[9px] font-mono text-slate-500 text-right">
                            Assessment Log timestamp: {new Date(assessment.created_at).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : !isEditingDetails ? (
            <div className="space-y-6 animate-fade-in">
              {/* Header */}
              <div className="flex justify-between items-center pb-2 border-b border-cyber-slate/30 shrink-0">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <FileText size={14} className="text-cyber-cyan" />
                  <span>Candidate Vetting Record & Source Payload</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditingDetails(true)}
                  className="px-3.5 py-1.5 bg-cyber-cyan/10 hover:bg-cyber-cyan/35 border border-cyber-cyan/30 text-cyber-cyan hover:text-white rounded font-mono text-[9px] uppercase tracking-wider transition-colors flex items-center gap-1"
                >
                  Edit Details
                </button>
              </div>

              {/* Vetting Record Metadata Card */}
              <div className="bg-cyber-gray/25 border border-cyber-slate/40 rounded-lg p-5 space-y-4">
                {isSaveSuccess && (
                  <span className="text-[10px] font-mono text-cyber-green block animate-pulse">
                    ✓ Changes successfully saved to secure ledger.
                  </span>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 block uppercase">Full Name:</span>
                    <span className="text-slate-200 font-medium">{fullName}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 block uppercase">Contact Number:</span>
                    <span className="text-slate-200">{contactNumber || <span className="italic text-slate-500">Not registered</span>}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 block uppercase">Email Address:</span>
                    <span className="text-slate-200">{email || <span className="italic text-slate-500">Not registered</span>}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 block uppercase">Years of Experience:</span>
                    <span className="text-slate-200">{experienceYears} Years</span>
                  </div>
                </div>
                
                {linkedinUrl && (
                  <div className="text-xs">
                    <span className="text-[9px] font-mono text-slate-400 block uppercase">LinkedIn Profile URL:</span>
                    <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-cyber-cyan hover:underline font-mono truncate block">
                      {linkedinUrl}
                    </a>
                  </div>
                )}

                <div className="text-xs border-t border-cyber-slate/20 pt-3">
                  <span className="text-[9px] font-mono text-slate-400 block uppercase mb-1">Vetting Log Remarks / Notes:</span>
                  <div className="bg-cyber-dark/40 border border-cyber-slate/30 p-3 rounded text-slate-300 font-sans leading-relaxed whitespace-pre-wrap min-h-[60px] font-light">
                    {notes || <span className="italic text-slate-500">No notes or special assessment remarks recorded yet. Click 'Edit Details' to add.</span>}
                  </div>
                </div>
              </div>

              {/* Extracted Capabilities Ledger */}
              <div className="p-4 bg-cyber-gray/40 border border-cyber-slate/30 rounded-lg">
                <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-200 mb-2">Extracted Capabilities Ledger</h4>
                <div className="flex flex-wrap gap-1.5">
                  {candidateDetails.skills && candidateDetails.skills.length > 0 ? (
                    candidateDetails.skills.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20 rounded font-mono text-[9px]">
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 font-sans italic">No skills extracted from source dossier yet.</span>
                  )}
                </div>
              </div>

              {/* Raw Dossier Text */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  <span>Raw Source document payload</span>
                  <span className="px-2 py-0.5 bg-cyber-slate/40 text-slate-400 text-[8px] uppercase rounded">
                    {candidateDetails.linkedin_url ? 'LinkedIn Scraped Experience' : 'CV Document Extract'}
                  </span>
                </div>
                <div className="bg-cyber-dark/80 border border-cyber-slate/60 p-4 rounded-lg font-mono text-xs text-slate-300 max-h-60 overflow-y-auto whitespace-pre-line leading-relaxed shadow-inner">
                  {candidateDetails.cv_raw_text?.replace(/\(mockup\)/gi, '').trim() || 'No raw source document registered for this candidate ledger.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {/* Form header */}
              <div className="flex justify-between items-center pb-2 border-b border-cyber-slate/30 shrink-0">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <User size={14} className="text-cyber-cyan" />
                  <span>Edit Candidate Profile Details</span>
                </h3>
              </div>

              {/* Form Grid */}
              <form onSubmit={handleFormSubmit} className="space-y-4 text-xs bg-cyber-gray/25 border border-cyber-slate/40 rounded-lg p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors"
                      required
                    />
                  </div>

                  {/* Contact Number */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Contact Number
                    </label>
                    <input
                      type="text"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="e.g. +1 (555) 019-2834"
                      className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors"
                    />
                  </div>

                  {/* Exp Years */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(parseInt(e.target.value) || 0)}
                      className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors"
                    />
                  </div>
                </div>

                {/* LinkedIn URL */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    LinkedIn Profile URL
                  </label>
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-slate-200 rounded font-mono transition-colors"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    Candidate Notes / Vetting Log Remarks
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Enter special vetting remarks, references, or assessment notes here..."
                    className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors resize-y font-light leading-relaxed font-sans"
                  />
                </div>

                {/* Submit and Cancel buttons */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingDetails(false)}
                    className="px-4 py-2 border border-cyber-slate hover:bg-cyber-slate/30 hover:border-slate-400 text-slate-300 rounded font-mono text-[10px] uppercase tracking-widest transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-cyber-cyan/15 hover:bg-cyber-cyan/35 border border-cyber-cyan/40 hover:border-cyber-cyan text-cyber-cyan hover:text-white rounded font-mono text-[10px] uppercase tracking-widest shadow-cyan-glow/20 transition-all flex items-center gap-1.5"
                  >
                    <span>Save Details</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-cyber-slate/50 px-6 py-4 bg-cyber-gray/90 z-10 shrink-0 flex justify-between items-center">
          <div className="text-[10px] font-mono text-slate-500">
            Secure air-gapped matching compliance. Powered by Gemini 2.5 Pro.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-1.5 border border-cyber-slate hover:bg-cyber-slate/30 text-slate-300 hover:text-white rounded font-mono text-xs uppercase tracking-wider transition-colors"
          >
            Close dossier
          </button>
        </div>
      </div>
    </div>
  );
};

// Inline icon component to prevent layout compilation errors
function XCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="10"
      height="10"
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
