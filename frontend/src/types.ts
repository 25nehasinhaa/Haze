export type CandidateRank = {
  name: string;
  rank: number;
  signal_score: number;
  semantic_fit: number;
  evidence_strength: number;
  recency: number;
  domain_alignment: number;
  snr: number;
  trust_label: string;
  summary: string;
  risk_flags: string[];
  gaps: { skill: string; type: string }[];
  interview_probes: string[];
  skill_scores: Record<string, number>;
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

