import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { TalentProfile } from '../utils/api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (profile: TalentProfile) => void;
  initialProfile?: TalentProfile | null;
}

const STACK_LAYERS = [
  'Layer 1 — Infrastructure',
  'Layer 2 — Data',
  'Layer 3 — Model',
  'Layer 4 — AI / Reasoning',
  'Layer 5 — Application',
  'Strategy & Advisory',
  'Strategy & Governance',
  'Strategy & Enablement',
  'Governance & Security',
  'Domain (Vertical)'
];

const ENGAGEMENT_TIERS = [
  'Full-Time',
  'Full-Time (core)',
  'Fractional',
  'Fractional (highest leverage)',
  'Fractional / Project',
  'Project / Specialist',
  'Project / Advisory'
];

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, onSave, initialProfile }) => {
  const [roleName, setRoleName] = useState('');
  const [stackLayer, setStackLayer] = useState(STACK_LAYERS[0]);
  const [category, setCategory] = useState('');
  const [engagementTier, setEngagementTier] = useState(ENGAGEMENT_TIERS[0]);
  const [roleSummary, setRoleSummary] = useState('');
  const [redFlags, setRedFlags] = useState('');
  const [offerings, setOfferings] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialProfile) {
      setRoleName(initialProfile.role_name);
      setStackLayer(initialProfile.stack_layer);
      setCategory(initialProfile.category);
      setEngagementTier(initialProfile.engagement_tier);
      setRoleSummary(initialProfile.role_summary);
      setRedFlags(initialProfile.red_flags);
      setOfferings(initialProfile.offerings || '');
    } else {
      setRoleName('');
      setStackLayer(STACK_LAYERS[0]);
      setCategory('');
      setEngagementTier(ENGAGEMENT_TIERS[0]);
      setRoleSummary('');
      setRedFlags('');
      setOfferings('');
    }
    setError('');
  }, [initialProfile, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName || !category || !roleSummary || !redFlags) {
      setError('Please fill in all required fields.');
      return;
    }

    const payload: TalentProfile = {
      role_name: roleName,
      stack_layer: stackLayer,
      category: category,
      engagement_tier: engagementTier,
      role_summary: roleSummary,
      red_flags: redFlags,
      offerings: offerings || undefined,
    };

    if (initialProfile && initialProfile.id) {
      payload.id = initialProfile.id;
    }

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="cyber-panel border-cyber-cyan/30 max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-lg shadow-cyan-glow">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-cyber-slate/50 px-6 py-4 bg-cyber-gray/80">
          <h2 className="text-xl font-bold font-sans tracking-wide text-cyber-cyan uppercase flex items-center gap-2">
            <span>🛡️</span>
            {initialProfile ? 'Edit Talent Profile Ledger' : 'Create Custom Talent Profile'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-cyber-cyan transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          {error && (
            <div className="p-3 bg-cyber-magenta/15 border border-cyber-magenta/30 text-cyber-magenta rounded font-mono">
              ⚠️ {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Role Name */}
            <div className="space-y-1">
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400">
                Role Name <span className="text-cyber-magenta">*</span>
              </label>
              <input
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Lead Sovereign AI Architect"
                className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors"
                required
              />
            </div>

            {/* Stack Layer */}
            <div className="space-y-1">
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 font-mono">
                Sovereign Stack Layer
              </label>
              <select
                value={stackLayer}
                onChange={(e) => setStackLayer(e.target.value)}
                className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors"
              >
                {STACK_LAYERS.map((layer) => (
                  <option key={layer} value={layer}>
                    {layer}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="space-y-1">
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400">
                Category / Specialization <span className="text-cyber-magenta">*</span>
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Engineering, Advisory"
                className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors"
                required
              />
            </div>

            {/* Engagement Tier */}
            <div className="space-y-1">
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400">
                Engagement Tier
              </label>
              <select
                value={engagementTier}
                onChange={(e) => setEngagementTier(e.target.value)}
                className="w-full bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors"
              >
                {ENGAGEMENT_TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Role Summary */}
          <div className="space-y-1">
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400">
              Role Summary <span className="text-cyber-magenta">*</span>
            </label>
            <textarea
              value={roleSummary}
              onChange={(e) => setRoleSummary(e.target.value)}
              placeholder="Detail the primary objectives, stack involvement, and mission for this talent profile..."
              className="w-full h-24 bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors resize-none"
              required
            />
          </div>

          {/* Red Flags */}
          <div className="space-y-1">
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 text-cyber-yellow">
              Critical Screen-Out Red Flags <span className="text-cyber-magenta">*</span>
            </label>
            <textarea
              value={redFlags}
              onChange={(e) => setRedFlags(e.target.value)}
              placeholder="List screen-out items (e.g. Cloud-only admin with no air-gap; Theoretical security with no deployment record...)"
              className="w-full h-20 bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors resize-none"
              required
            />
          </div>

          {/* Offerings */}
          <div className="space-y-1">
            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400">
              Target Offerings (Optional)
            </label>
            <textarea
              value={offerings}
              onChange={(e) => setOfferings(e.target.value)}
              placeholder="Specific core deliverables or offerings mapped to this role..."
              className="w-full h-16 bg-cyber-dark border border-cyber-slate focus:border-cyber-cyan focus:outline-none px-3 py-2 text-slate-200 rounded font-sans transition-colors resize-none"
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
              className="px-5 py-2 bg-gradient-to-r from-cyber-cyan/80 to-cyber-magenta/80 hover:from-cyber-cyan hover:to-cyber-magenta border border-cyber-cyan/50 text-white rounded font-mono btn-cyan-glow transition-all"
            >
              SAVE RECORD
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
