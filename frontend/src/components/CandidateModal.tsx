import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Candidate } from '../utils/api';

interface CandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (candidate: Partial<Candidate>) => void;
  initialCandidate?: Candidate | null;
}

export const CandidateModal: React.FC<CandidateModalProps> = ({ isOpen, onClose, onSave, initialCandidate }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [skillsStr, setSkillsStr] = useState('');
  const [experienceYears, setExperienceYears] = useState(0);
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialCandidate) {
      setFullName(initialCandidate.full_name);
      setEmail(initialCandidate.email || '');
      setLinkedinUrl(initialCandidate.linkedin_url || '');
      setSkillsStr(initialCandidate.skills ? initialCandidate.skills.join(', ') : '');
      setExperienceYears(initialCandidate.experience_years || 0);
      setIsBlacklisted(initialCandidate.is_blacklisted || false);
    } else {
      setFullName('');
      setEmail('');
      setLinkedinUrl('');
      setSkillsStr('');
      setExperienceYears(0);
      setIsBlacklisted(false);
    }
    setError('');
  }, [initialCandidate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName) {
      setError('Full Name is required.');
      return;
    }

    // Split skills by comma, clean whitespace, remove empty elements
    const skills = skillsStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const payload: Partial<Candidate> = {
      full_name: fullName,
      email: email || undefined,
      linkedin_url: linkedinUrl || undefined,
      skills,
      experience_years: experienceYears,
      is_blacklisted: isBlacklisted,
    };

    if (initialCandidate && initialCandidate.id) {
      payload.id = initialCandidate.id;
    }

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="cyber-panel border-cyber-magenta/30 max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-lg shadow-magenta-glow">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyber-slate/50 px-6 py-4 bg-cyber-gray/80">
          <h2 className="text-base font-bold font-sans tracking-wider text-cyber-magenta uppercase flex items-center gap-2">
            <span>🛡️</span>
            {initialCandidate ? 'Edit Candidate Ledger Record' : 'Index Custom Candidate Manual'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-cyber-magenta transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-cyber-magenta/15 border border-cyber-magenta/30 text-cyber-magenta rounded font-mono">
              ⚠️ {error}
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Candidate Full Name <span className="text-cyber-magenta">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Mohamed Sedky"
              className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-magenta focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Email */}
            <div className="space-y-1">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. mohamed.s@gmail.com"
                className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-magenta focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors"
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
                className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-magenta focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors"
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
              placeholder="e.g. https://linkedin.com/in/mohamed-sedky"
              className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-magenta focus:outline-none px-3 py-2 text-slate-200 rounded font-mono transition-colors"
            />
          </div>

          {/* Skills */}
          <div className="space-y-1">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
              Extracted Skills (Comma Separated)
            </label>
            <input
              type="text"
              value={skillsStr}
              onChange={(e) => setSkillsStr(e.target.value)}
              placeholder="e.g. Python, Docker, PyTorch, Arabic NLP"
              className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-magenta focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors"
            />
            <p className="text-[9px] text-slate-500 font-mono mt-0.5">
              Type skills separated by commas to add tags to candidate ledger.
            </p>
          </div>

          {/* Blacklisted Switch */}
          <div className="p-3 bg-cyber-magenta/5 border border-cyber-magenta/20 rounded-lg flex items-center justify-between">
            <div className="space-y-0.5 pr-2">
              <span className="text-[10px] font-mono uppercase font-bold text-cyber-magenta block">
                FLAG CANDIDATE FOR BLACKLIST
              </span>
              <p className="text-[9px] text-slate-400 leading-tight">
                Locks all automated vetting assessments and places warning signals on dashboards.
              </p>
            </div>
            <input
              type="checkbox"
              checked={isBlacklisted}
              onChange={(e) => setIsBlacklisted(e.target.checked)}
              className="w-4 h-4 accent-cyber-magenta cursor-pointer"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-cyber-slate/30">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-cyber-slate hover:bg-cyber-slate/30 hover:border-slate-400 text-slate-300 rounded font-mono transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-cyber-magenta/70 to-cyber-cyan/70 hover:from-cyber-magenta hover:to-cyber-cyan border border-cyber-magenta/50 text-white rounded font-mono flex items-center gap-1.5 shadow-magenta-glow transition-all"
            >
              <Save size={14} />
              <span>COMMIT CANDIDATE</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
