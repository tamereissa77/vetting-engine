const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && envUrl !== 'http://localhost:8000') {
    return envUrl;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return envUrl || 'http://localhost:8000';
};

export const API_URL = getApiUrl();

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

export interface CandidateAssignmentRecord {
  id: number;
  project_id: number;
  project_name: string | null;
  profile_id: number | null;
  profile_name: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface Candidate {
  id: number;
  full_name: string;
  email: string;
  linkedin_url?: string;
  contact_number?: string;
  notes?: string;
  skills: string[];
  experience_years: number;
  is_blacklisted: boolean;
  assignments: CandidateAssignmentRecord[];
  created_at: string;
  highest_score?: number | null;
  highest_role_name?: string | null;
  assessments?: Array<{ role_name: string; match_score: number }>;
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
  is_disqualified?: boolean;
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

export interface Project {
  id: number;
  name: string;
  sow_text?: string;
  sow_filename?: string;
  analysis_results: {
    matched_profiles: Array<{ id: number; role_name: string; relevance_reason: string }>;
    missing_profiles: TalentProfile[];
  };
  created_at: string;
  assigned_resources?: Candidate[];
}

export interface AssignmentRecord {
  assignment_id: number;
  candidate_id: number;
  full_name: string;
  experience_years: number;
  assigned_project_id: number;
  assigned_project_name: string | null;
  assigned_profile_id: number | null;
  assigned_profile_name: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface UtilizationData {
  as_of: string;
  summary: {
    total_candidates: number;
    active_assignments: number;
    upcoming_assignments: number;
    past_assignments: number;
    unscheduled_assignments: number;
    available_candidates: number;
  };
  active_assignments: AssignmentRecord[];
  upcoming_assignments: AssignmentRecord[];
  past_assignments: AssignmentRecord[];
  unscheduled_assignments: AssignmentRecord[];
  available_candidates: Array<{ id: number; full_name: string; experience_years: number; skills: string[] }>;
  project_coverage: Array<{
    project_id: number;
    project_name: string;
    required_roles: number;
    filled_roles: number;
    coverage_pct: number;
  }>;
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

  async uploadCVForCandidate(candidateId: number, file: File): Promise<{ candidate_id: number; task_id: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/api/candidates/${candidateId}/upload`, {
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

  async scanLinkedInForCandidate(candidateId: number): Promise<{ candidate_id: number; task_id: string; message: string }> {
    const res = await fetch(`${API_URL}/api/candidates/${candidateId}/linkedin`, {
      method: 'POST',
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

  async disqualifyAssessment(assessmentId: number, disqualified: boolean): Promise<void> {
    const res = await fetch(`${API_URL}/api/assessments/${assessmentId}/disqualify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disqualified }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to update disqualification status');
    }
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
  },

  async analyzeProjectScope(sowText?: string, file?: File): Promise<{
    matched_profiles: Array<{ id: number; role_name: string; relevance_reason: string }>;
    missing_profiles: Array<TalentProfile>;
  }> {
    const formData = new FormData();
    if (sowText) formData.append('sow_text', sowText);
    if (file) formData.append('file', file);

    const res = await fetch(`${API_URL}/api/projects/analyze-scope`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to analyze project scope');
    }
    return res.json();
  },

  async listProjects(): Promise<Project[]> {
    const res = await fetch(`${API_URL}/api/projects`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  async getProject(id: number): Promise<Project> {
    const res = await fetch(`${API_URL}/api/projects/${id}`);
    if (!res.ok) throw new Error('Failed to fetch project');
    return res.json();
  },

  async createProject(project: {
    name: string;
    sow_text?: string;
    sow_filename?: string;
    analysis_results: any;
  }): Promise<Project> {
    const res = await fetch(`${API_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to save project');
    }
    return res.json();
  },

  async deleteProject(id: number): Promise<void> {
    const res = await fetch(`${API_URL}/api/projects/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to delete project');
  },

  async assignCandidateToProject(projectId: number, candidateId: number, profileId?: number, startDate?: string, endDate?: string): Promise<any> {
    const params = new URLSearchParams();
    if (profileId !== undefined) params.append('profile_id', String(profileId));
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const qs = params.toString();
    const url = `${API_URL}/api/projects/${projectId}/assign/${candidateId}${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to assign candidate');
    }
    return res.json();
  },

  async getUtilization(): Promise<UtilizationData> {
    const res = await fetch(`${API_URL}/api/utilization`);
    if (!res.ok) throw new Error('Failed to fetch utilization data');
    return res.json();
  },

  async releaseAssignment(assignmentId: number): Promise<any> {
    const res = await fetch(`${API_URL}/api/assignments/${assignmentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Failed to release assignment');
    }
    return res.json();
  }
};
