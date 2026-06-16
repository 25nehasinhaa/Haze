from datetime import datetime
import re

from backend.app.schemas import CandidateProfile, CareerEvent, EvidenceItem, JobDescription

SKILL_KEYWORDS = [
    "python",
    "sql",
    "machine learning",
    "deep learning",
    "fraud detection",
    "anomaly detection",
    "model deployment",
    "model monitoring",
    "mlops",
    "aws",
    "azure",
    "gcp",
    "docker",
    "kubernetes",
    "spark",
    "airflow",
    "stream processing",
    "graph analytics",
    "risk analytics",
    "feature stores",
    "nlp",
    "computer vision",
    "statistics",
    "bayesian",
    "optimization",
    "pattern recognition",
]

DOMAIN_KEYWORDS = [
    "fintech",
    "payments",
    "risk",
    "banking",
    "healthcare",
    "ecommerce",
    "retail",
    "iot",
    "telemetry",
    "cloud",
    "security",
    "recruiting",
    "hr",
]

BEHAVIORAL_KEYWORDS = [
    "mentored",
    "led",
    "owned",
    "collaborated",
    "stakeholder",
    "cross-functional",
    "incident",
    "communicated",
    "presented",
]


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def extract_years(text: str) -> list[int]:
    years = [int(value) for value in re.findall(r"\b(?:19|20)\d{2}\b", text)]
    return sorted(set(year for year in years if 1990 <= year <= datetime.now().year))


def extract_skills(text: str) -> list[str]:
    lower = text.lower()
    return [skill for skill in SKILL_KEYWORDS if skill in lower]


def extract_domains(text: str) -> list[str]:
    lower = text.lower()
    return [domain for domain in DOMAIN_KEYWORDS if domain in lower]


def evidence_level(text: str, skill: str) -> str:
    lower = text.lower()
    skill_index = lower.find(skill)
    if skill_index < 0:
        return "unsupported"
    window = lower[max(0, skill_index - 140): skill_index + 220]
    strong_markers = ["built", "owned", "deployed", "production", "led", "reduced", "improved", "launched"]
    partial_markers = ["used", "worked", "developed", "implemented", "created", "maintained"]
    if any(marker in window for marker in strong_markers):
        return "strong"
    if any(marker in window for marker in partial_markers):
        return "partial"
    return "weak"


def source_snippet(text: str, skill: str) -> str:
    lower = text.lower()
    index = lower.find(skill)
    if index < 0:
        return f"{skill} was inferred from the uploaded profile text."
    snippet = clean_text(text[max(0, index - 90): index + 180])
    return snippet[:260]


def parse_candidate_text(name: str, text: str) -> CandidateProfile:
    text = clean_text(text)
    skills = extract_skills(text)
    domains = extract_domains(text)
    years = extract_years(text)
    current_year = datetime.now().year
    last_year = max(years) if years else current_year
    evidence = [
        EvidenceItem(
            claim=skill,
            level=evidence_level(text, skill),
            last_used=last_year,
            source=source_snippet(text, skill),
        )
        for skill in skills
    ]
    behavioral_evidence = [
        EvidenceItem(
            claim=keyword,
            level="partial",
            last_used=last_year,
            source=source_snippet(text, keyword),
        )
        for keyword in BEHAVIORAL_KEYWORDS
        if keyword in text.lower()
    ]
    events = [
        CareerEvent(year=year, event=f"Career evidence detected around {year}.")
        for year in years[-4:]
    ] or [CareerEvent(year=current_year, event="Uploaded profile parsed by HAZE.")]
    summary = text[:360] + ("..." if len(text) > 360 else "")
    return CandidateProfile(
        name=name,
        headline=f"Uploaded candidate profile: {name}",
        summary=summary,
        skills=skills,
        domains=domains,
        evidence=evidence + behavioral_evidence,
        career_events=events,
    )


def parse_job_description_text(text: str) -> JobDescription:
    text = clean_text(text)
    skills = extract_skills(text)
    domains = extract_domains(text)
    seniority = [keyword for keyword in BEHAVIORAL_KEYWORDS if keyword in text.lower()]
    title_match = re.search(r"(?:title|role)\s*[:\-]\s*([A-Za-z0-9 ,/+&-]{4,80})", text, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else "Uploaded Hiring Role"
    must_have = skills[:8] or ["python", "machine learning", "sql"]
    nice_to_have = [skill for skill in skills[8:14] if skill not in must_have]
    return JobDescription(
        title=title,
        summary=text[:420] + ("..." if len(text) > 420 else ""),
        must_have_skills=must_have,
        nice_to_have_skills=nice_to_have,
        domains=domains,
        seniority_signals=seniority,
    )

