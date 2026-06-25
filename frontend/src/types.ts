export type CandidateRank = {
  name: string;
  rank: number;
  signal_score: number;
  semantic_fit: number;
  evidence_strength: number;
  recency: number;
  domain_alignment: number;
  experience_match: number;
  career_growth: number;
  behavioral_fit: number;
  confidence: number;
  snr: number;
  trust_label: string;
  summary: string;
  risk_flags: string[];
  gaps: { skill: string; type: string }[];
  interview_probes: string[];
  skill_scores: Record<string, number>;
  strengths: string[];
  concerns: string[];
  recommendation: string;
  candidate_id?: string;
  current_title?: string;
  years_of_experience?: number;
  availability_score?: number;
};

export type RankingResponse = {
  job_title: string;
  naive_top: string;
  signalrank_top: string;
  ranking_corrected: boolean;
  candidates: CandidateRank[];
  insights: string[];
  metrics: Record<string, number>;
};

export type CareerCoachResult = {
  name: string;
  target_role: string;
  match_score: number;
  trust_label: string;
  recommendation: string;
  recruiter_likelihood: string;
  skill_scores: Record<string, number>;
  strengths: string[];
  concerns: string[];
  gaps: { skill: string; type: string }[];
  missing_must_have: string[];
  missing_nice_to_have: string[];
  weak_skills: string[];
  strong_skills: string[];
  resume_suggestions: string[];
  learning_roadmap: { priority: number; skill: string; action: string; timeline: string; impact: string }[];
  interview_probes: string[];
  risk_flags: string[];
  parsed_skills: string[];
  years_of_experience?: number;
  current_title?: string;
};

export type AppMode = "home" | "ranking" | "coach" | "compare";
export type RankingTab = "list" | "detail" | "explain" | "analytics";
