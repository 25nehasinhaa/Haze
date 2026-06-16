from pydantic import BaseModel, Field


class EvidenceItem(BaseModel):
    claim: str
    level: str = Field(pattern="^(strong|partial|weak|unsupported)$")
    last_used: int
    source: str


class CareerEvent(BaseModel):
    year: int
    event: str


class CandidateProfile(BaseModel):
    name: str
    headline: str
    summary: str
    skills: list[str]
    domains: list[str]
    evidence: list[EvidenceItem]
    career_events: list[CareerEvent]


class JobDescription(BaseModel):
    title: str
    summary: str
    must_have_skills: list[str]
    nice_to_have_skills: list[str] = []
    domains: list[str] = []
    seniority_signals: list[str] = []


class RankingRequest(BaseModel):
    job_description: JobDescription
    candidates: list[CandidateProfile]


class TextCandidateInput(BaseModel):
    name: str
    text: str


class TextRankingRequest(BaseModel):
    job_description_text: str
    candidates: list[TextCandidateInput]
    include_dataset: bool = True


class CandidateRank(BaseModel):
    name: str
    rank: int
    signal_score: float
    semantic_fit: float
    evidence_strength: float
    recency: float
    domain_alignment: float
    experience_match: float
    career_growth: float
    behavioral_fit: float
    confidence: float
    snr: float
    trust_label: str
    summary: str
    risk_flags: list[str]
    gaps: list[dict[str, str]]
    interview_probes: list[str]
    skill_scores: dict[str, float]
    strengths: list[str]
    concerns: list[str]
    recommendation: str


class RankingResponse(BaseModel):
    job_title: str
    naive_top: str
    signalrank_top: str
    ranking_corrected: bool
    candidates: list[CandidateRank]
    insights: list[str]
    metrics: dict[str, float]
