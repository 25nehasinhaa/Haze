import type { RankingResponse } from "../types";

export const fallbackRanking: RankingResponse = {
  job_title: "Senior Machine Learning Engineer - Fraud Detection",
  naive_top: "Aarav Keyword",
  signalrank_top: "Meera Evidence",
  ranking_corrected: true,
  insights: [
    "SignalRank corrected the naive shortlist: Aarav Keyword was replaced by Meera Evidence after evidence validation.",
    "Meera Evidence is the strongest current match with 81.3 SignalRank score and 7.3 SNR.",
    "Hidden-gem candidates with transferable evidence: Riya HiddenGem."
  ],
  metrics: {
    average_signal_score: 39.9,
    average_snr: 2.87,
    verified_matches: 1,
    risk_profiles: 2
  },
  candidates: [
    {
      name: "Meera Evidence",
      rank: 1,
      signal_score: 81.3,
      semantic_fit: 95,
      evidence_strength: 91.2,
      recency: 100,
      domain_alignment: 100,
      snr: 7.3,
      trust_label: "Verified strong match",
      summary: "Lower keyword density than Aarav, but stronger evidence in payment risk systems and production ML ownership.",
      risk_flags: ["No major evidence risks found."],
      gaps: [],
      interview_probes: ["Ask for a recent end-to-end project and the candidate's exact ownership."],
      skill_scores: { python: 100, "machine learning": 100, "fraud detection": 65, "anomaly detection": 100, "model deployment": 100, "model monitoring": 100, sql: 100 }
    },
    {
      name: "Riya HiddenGem",
      rank: 2,
      signal_score: 69,
      semantic_fit: 82,
      evidence_strength: 86,
      recency: 100,
      domain_alignment: 0,
      snr: 3.37,
      trust_label: "Reliable match",
      summary: "Strong anomaly detection, streaming, monitoring, and signal processing evidence transfers well.",
      risk_flags: ["Critical gaps to validate: fraud detection"],
      gaps: [{ skill: "fraud detection", type: "critical gap" }],
      interview_probes: ["Validate depth in fraud detection with a production example."],
      skill_scores: { python: 100, "machine learning": 100, "fraud detection": 8, "anomaly detection": 100, "model deployment": 100, "model monitoring": 100, sql: 65 }
    },
    {
      name: "Kabir Stale",
      rank: 3,
      signal_score: 6.6,
      semantic_fit: 39,
      evidence_strength: 43,
      recency: 42,
      domain_alignment: 33,
      snr: 0.38,
      trust_label: "Risky or incomplete fit",
      summary: "Strong historical fraud analytics profile, but role-relevant evidence is old.",
      risk_flags: ["Stale evidence: fraud detection, anomaly detection", "Critical gaps to validate: model deployment, model monitoring"],
      gaps: [{ skill: "model deployment", type: "critical gap" }, { skill: "model monitoring", type: "critical gap" }],
      interview_probes: ["Validate production ML ownership."],
      skill_scores: { python: 49, "machine learning": 49, "fraud detection": 20, "anomaly detection": 6, "model deployment": 8, "model monitoring": 8, sql: 75 }
    },
    {
      name: "Aarav Keyword",
      rank: 4,
      signal_score: 2.7,
      semantic_fit: 45,
      evidence_strength: 31,
      recency: 66,
      domain_alignment: 33,
      snr: 0.42,
      trust_label: "Keyword-heavy, weak evidence",
      summary: "Broad AI engineer profile with many role keywords but weak supporting evidence.",
      risk_flags: ["Unsupported claims: fraud detection, model monitoring, graph analytics", "Skills list is broader than supporting evidence."],
      gaps: [{ skill: "fraud detection", type: "critical gap" }, { skill: "model monitoring", type: "critical gap" }],
      interview_probes: ["Probe whether resume keywords reflect hands-on work or surface-level exposure."],
      skill_scores: { python: 100, "machine learning": 49, "fraud detection": 8, "anomaly detection": 13, "model deployment": 6, "model monitoring": 8, sql: 49 }
    }
  ]
};

