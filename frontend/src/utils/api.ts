const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface TalentProfile {
  id?: number;
  role_name: string;
  stack_layer: string;
  category: string;
  engagement_tier: string;
  role_summary: string;
  red_flags: string;
  offerings?: string;
}

export interface Candidate {
  id: number;
  full_name: string;
  email: string;
  linkedin_url?: string;
  skills: string[];
  experience_years: number;
  is_blacklisted: boolean;
  created_at: string;
  highest_score?: number | null;
  highest_role_name?: string | null;
}

export interface Assessment {
  id: number;
  profile_id: number;
  role_name: string;
  stack_layer: string;
  match_score: number;
  skills_match: string[];
  skills_gap: string[];
  red_flags_detected: string[];
  ai_verdict: string;
  created_at: string;
}

export interface CandidateDetails extends Candidate {
  cv_raw_text: string;
  assessments: Assessment[];
}

export interface TaskProgress {
  task_id: string;
  message: string;
  progress: number;
  status: 'processing' | 'completed' | 'failed';
  data?: any;
}

export const api = {
  // Profiles CRUD
  async getProfiles(stackLayer?: string): Promise<TalentProfile[]> {
    let url = `${API_URL}/api/profiles/raw`;
    if (stackLayer) {
      url = `${API_URL}/api/profiles?stack_layer=${encodeURIComponent(stackLayer)}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to retrieve profiles');
    return res.json();
  },

  async createProfile(profile: TalentProfile): Promise<TalentProfile> {
    const res = await fetch(`${API_URL}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to create profile');
    }
    return res.json();
  },

  async updateProfile(profileId: number, profile: TalentProfile): Promise<TalentProfile> {
    const res = await fetch(`${API_URL}/api/profiles/${profileId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to update profile');
    }
    return res.json();
  },

  async deleteProfile(profileId: number): Promise<void> {
    const res = await fetch(`${API_URL}/api/profiles/${profileId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete profile');
  },

  async importProfileFile(file: File): Promise<TalentProfile> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/api/profiles/import-file`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to import profile from file');
    }
    return res.json();
  },

  async generateProfileFromTitle(title: string): Promise<TalentProfile> {
    const res = await fetch(`${API_URL}/api/profiles/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to generate profile from title');
    }
    return res.json();
  },

  // Candidates
  async getCandidates(): Promise<Candidate[]> {
    const res = await fetch(`${API_URL}/api/candidates`);
    if (!res.ok) throw new Error('Failed to retrieve candidates list');
    return res.json();
  },

  async getCandidateDetails(candidateId: number): Promise<CandidateDetails> {
    const res = await fetch(`${API_URL}/api/candidates/${candidateId}`);
    if (!res.ok) throw new Error('Failed to retrieve candidate assessment files');
    return res.json();
  },

  async createCandidate(candidate: Partial<Candidate>): Promise<Candidate> {
    const res = await fetch(`${API_URL}/api/candidates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to create candidate manually');
    }
    return res.json();
  },

  async updateCandidate(candidateId: number, candidate: Partial<Candidate>): Promise<Candidate> {
    const res = await fetch(`${API_URL}/api/candidates/${candidateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candidate),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to update candidate');
    }
    return res.json();
  },

  async deleteCandidate(candidateId: number): Promise<void> {
    const res = await fetch(`${API_URL}/api/candidates/${candidateId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete candidate');
  },

  async uploadCV(file: File): Promise<{ candidate_id: number; task_id: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/api/candidates/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload and parse CV');
    return res.json();
  },

  async scanLinkedIn(linkedinUrl: string): Promise<{ candidate_id: number; task_id: string; message: string }> {
    const formData = new FormData();
    formData.append('linkedin_url', linkedinUrl);
    const res = await fetch(`${API_URL}/api/candidates/linkedin`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to initialize LinkedIn scan');
    return res.json();
  },

  async matchCandidate(candidateId: number, profileIds: number[]): Promise<{ task_id: string; message: string }> {
    const res = await fetch(`${API_URL}/api/candidates/${candidateId}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_ids: profileIds }),
    });
    if (!res.ok) throw new Error('Failed to trigger matchmaking engine');
    return res.json();
  },

  // WebSocket progress connection helper
  connectTaskProgress(taskId: string, onUpdate: (data: TaskProgress) => void, onError?: (err: Event) => void): WebSocket {
    const wsUrl = `${API_URL.replace('http', 'ws')}/ws/tasks/${taskId}`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const payload: TaskProgress = JSON.parse(event.data);
        onUpdate(payload);
      } catch (err) {
        console.error('Failed to parse WebSocket task stream message:', err);
      }
    };
    if (onError) {
      ws.onerror = onError;
    }
    return ws;
  }
};
