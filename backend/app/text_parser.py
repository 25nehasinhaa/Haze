from datetime import datetime
import re

from backend.app.schemas import CandidateProfile, CareerEvent, EvidenceItem, JobDescription

# Canonical skill keywords — aligned with the skill names used by the real
# JSONL dataset (see dataset_adapter.py) and the SignalRank alias map
# (see src/scoring/signalrank.py SKILL_ALIASES) so that uploaded resumes,
# uploaded job descriptions, and dataset candidates all score on the same
# vocabulary.
SKILL_KEYWORDS = [
    # AI / retrieval / ranking (primary challenge skills)
    "embeddings", "embedding", "semantic search", "vector search",
    "vector database", "vector db", "information retrieval", "retrieval",
    "hybrid search", "dense retrieval", "bm25",
    "sentence transformers", "sentence-transformers", "sentence-transformers",
    "hugging face transformers", "hugging face", "huggingface",
    "recommendation systems", "recommendation", "ranking", "reranking",
    "learning to rank", "learning-to-rank", "ndcg", "mrr",
    "fine-tuning llms", "fine-tuning", "fine tuning", "lora", "qlora", "peft",
    "langchain", "llms", "llm", "rag", "nlp",
    "faiss", "pinecone", "qdrant", "weaviate", "milvus", "pgvector",
    "elasticsearch", "opensearch",
    "a/b testing", "a/b test", "ab testing",
    # Core ML / data
    "python", "sql", "machine learning", "deep learning", "tensorflow",
    "pytorch", "xgboost", "reinforcement learning", "statistical modeling",
    "data science", "computer vision", "statistics", "bayesian",
    "optimization", "pattern recognition", "diffusion models",
    # MLOps / infra
    "mlops", "mlflow", "bentoml", "aws", "azure", "gcp", "docker",
    "kubernetes", "spark", "airflow", "data pipelines", "databricks",
    "stream processing", "graph analytics", "feature stores",
    # Legacy fraud-detection JD support
    "fraud detection", "anomaly detection", "model deployment",
    "model monitoring", "risk analytics",
    # Data Engineering
    "etl", "elt", "data pipelines", "data warehousing", "data modeling",
    "data lakehouse", "medallion architecture", "schema evolution",
    "delta lake", "snowflake", "snowpark", "databricks", "pyspark",
    "dbt", "data build tool", "apache spark", "apache flink", "hive",
    "apache hive", "apache airflow", "kafka", "apache kafka",
    "data validation", "data governance", "data quality", "data lineage",
    "tableau", "power bi", "looker", "streamlit", "plotly",
    "terraform", "jenkins", "ci/cd", "github actions", "azure devops",
    "linux", "bash", "shell scripting",
    "agentic ai", "fastapi", "prompt engineering", "github copilot",
    "dimensional modeling", "star schema", "data vault",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch",
    "hadoop", "hdfs", "hbase",
    "bigquery", "redshift", "azure synapse", "azure data factory",
    "data lake", "s3", "azure blob", "gcs",
    "prefect", "dagster", "luigi", "dask",
    "great expectations", "dbt core", "dbt cloud",
]

DOMAIN_KEYWORDS = [
    "fintech", "payments", "risk", "banking", "healthcare", "ecommerce",
    "e-commerce", "retail", "iot", "telemetry", "cloud", "security",
    "recruiting", "hr-tech", "hr", "talent", "ai", "ml", "search",
    "saas", "startup",
]

BEHAVIORAL_KEYWORDS = [
    "mentored", "mentoring", "led", "owned", "ownership", "collaborated",
    "collaboration", "stakeholder", "cross-functional", "incident",
    "communicated", "presented", "production", "shipped", "launched",
    "architecture", "evaluation", "end-to-end",
]


def extract_years_of_experience(text: str) -> float | None:
    """
    Extract stated years of experience from free text, e.g.
    '6 years experience', '5+ years of experience', '8 yrs'.
    Falls back to None if not found (caller should use career_events instead).
    """
    patterns = [
        r"(\d+(?:\.\d+)?)\+?\s*years?\s+(?:of\s+)?experience",
        r"(\d+(?:\.\d+)?)\+?\s*yrs?\s+(?:of\s+)?experience",
        r"experience\s*[:\-]\s*(\d+(?:\.\d+)?)\+?\s*years?",
    ]
    lower = text.lower()
    for pattern in patterns:
        match = re.search(pattern, lower)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                continue
    return None


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip())


def extract_years(text: str) -> list[int]:
    years = [int(value) for value in re.findall(r"\b(?:19|20)\d{2}\b", text)]
    return sorted(set(year for year in years if 1990 <= year <= datetime.now().year))


def extract_skills(text: str) -> list[str]:
    from src.scoring.signalrank import normalize_skill
    lower = text.lower()
    found = [skill for skill in SKILL_KEYWORDS if skill in lower]
    # Normalize to canonical names and dedupe while preserving order
    normalized: list[str] = []
    seen: set[str] = set()
    for skill in found:
        canon = normalize_skill(skill)
        if canon not in seen:
            seen.add(canon)
            normalized.append(canon)
    return normalized


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
    yoe = extract_years_of_experience(text)
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

    # Try to extract a title from the first line (e.g. "Jane Doe - Senior AI Engineer")
    first_line = text.split(".")[0][:120]
    title_guess = ""
    if " - " in first_line:
        title_guess = first_line.split(" - ", 1)[1].split(",")[0].strip()
    elif "," in first_line:
        title_guess = first_line.split(",", 1)[1].split(",")[0].strip()

    return CandidateProfile(
        name=name,
        headline=f"Uploaded candidate profile: {name}",
        summary=summary,
        skills=skills,
        domains=domains,
        evidence=evidence + behavioral_evidence,
        career_events=events,
        years_of_experience=yoe,
        current_title=title_guess,
    )


def parse_job_description_text(text: str) -> JobDescription:
    """
    Parse free-text job description into structured JobDescription.
    Delegates skill/domain extraction to dataset_adapter._extract_jd_from_text,
    the same logic used for DOCX-uploaded JDs and the official challenge JD,
    so every JD entry point (typed text, uploaded text, uploaded DOCX,
    official dataset JD) produces skills on the same canonical vocabulary
    that SignalRank and the dataset candidates use.
    """
    from backend.app.dataset_adapter import _extract_jd_from_text

    cleaned = clean_text(text)
    title_match = re.search(r"(?:title|role)\s*[:\-]\s*([A-Za-z0-9 ,/+&-]{4,80})", cleaned, re.IGNORECASE)
    title = title_match.group(1).strip() if title_match else "Uploaded Hiring Role"

    jd_dict = _extract_jd_from_text(title, cleaned)

    # Layer in behavioral seniority signals detected directly in the text
    # (dataset_adapter's extractor uses a different signal list tuned for
    # the AI Engineer JD; this adds resume/JD-upload-specific signals too).
    extra_signals = [keyword for keyword in BEHAVIORAL_KEYWORDS if keyword in cleaned.lower()]
    combined_signals = list(dict.fromkeys(jd_dict["seniority_signals"] + extra_signals))[:10]

    return JobDescription(
        title=jd_dict["title"],
        summary=jd_dict["summary"],
        must_have_skills=jd_dict["must_have_skills"],
        nice_to_have_skills=jd_dict["nice_to_have_skills"],
        domains=jd_dict["domains"] or extract_domains(cleaned),
        seniority_signals=combined_signals,
    )



def parse_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extract plain text from PDF bytes using pdfminer.six."""
    try:
        from pdfminer.high_level import extract_text_to_fp
        from pdfminer.layout import LAParams
        import io
        output = io.StringIO()
        extract_text_to_fp(io.BytesIO(pdf_bytes), output, laparams=LAParams())
        return output.getvalue()
    except Exception:
        return pdf_bytes.decode("utf-8", errors="ignore")
