import io
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.app.config import get_settings
from backend.app.evaluation import evaluate_ranking
from backend.app.ingestion import load_demo_data
from backend.app.pipeline import run_hiring_pipeline
from backend.app.schemas import RankingRequest, RankingResponse, TextRankingRequest
from backend.app.text_parser import parse_candidate_text, parse_job_description_text
from backend.app.dataset_adapter import (
    load_jsonl_candidates,
    load_jsonl_candidates_cached,
    parse_jd_docx,
    export_submission_csv,
    jsonl_to_internal,
    _extract_jd_from_text,
)

router = APIRouter()


def _extract_name_from_resume(text: str) -> str | None:
    """
    Extract a candidate's name from the first non-empty line of a resume.
    Handles common patterns: "Jane Doe - Title", "Jane Doe, Title", "Jane Doe".
    Returns None if no plausible name-like line is found.
    """
    import re as _re

    first_line = text.strip().split("\n")[0].strip()
    if not first_line:
        return None
    # Strip trailing " - ..." or ", ..." description
    for sep in [" - ", ", "]:
        if sep in first_line:
            first_line = first_line.split(sep, 1)[0].strip()
            break
    # Plausible name: 2-4 title-case words, no digits
    words = first_line.split()
    if 1 < len(words) <= 4 and not any(ch.isdigit() for ch in first_line):
        if all(w[0].isupper() for w in words if w):
            return first_line[:60]
    return None


# ── Health ──────────────────────────────────────────────────────────────────

@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": get_settings().app_name}


# ── Demo (4 synthetic candidates, existing JD) ───────────────────────────────

@router.get("/demo", response_model=RankingResponse)
def demo() -> dict:
    settings = get_settings()
    jd, candidates = load_demo_data(settings.data_dir)
    return run_hiring_pipeline(
        jd.model_dump(),
        [c.model_dump() for c in candidates],
        apply_availability_modifier=False,
    )


# ── Structured ranking (POST body) ──────────────────────────────────────────

@router.post("/rank", response_model=RankingResponse)
def rank(request: RankingRequest) -> dict:
    return run_hiring_pipeline(
        request.job_description.model_dump(),
        [c.model_dump() for c in request.candidates],
        apply_availability_modifier=False,
    )


# ── Text-based ranking (raw text upload) ────────────────────────────────────

@router.post("/text-rank", response_model=RankingResponse)
def text_rank(request: TextRankingRequest) -> dict:
    """
    Accept raw JD text + candidate texts.
    Optionally blend in dataset candidates.
    """
    settings = get_settings()
    jd = parse_job_description_text(request.job_description_text)

    text_candidates = [
        parse_candidate_text(c.name, c.text).model_dump()
        for c in request.candidates
    ]

    if request.include_dataset:
        jsonl_path = settings.data_dir / "candidates.jsonl"
        if jsonl_path.exists():
            dataset_candidates = load_jsonl_candidates(jsonl_path, limit=2000)
            all_candidates = text_candidates + dataset_candidates
        else:
            all_candidates = text_candidates
    else:
        all_candidates = text_candidates

    return run_hiring_pipeline(
        jd.model_dump(),
        all_candidates,
        top_k=200,
        apply_availability_modifier=True,
    )


# ── Dataset ranking (JSONL candidates + DOCX or text JD) ────────────────────

@router.post("/rank-dataset")
def rank_dataset(
    top_k: int = Query(default=100, ge=10, le=5000),
    filter_open_to_work: bool = Query(default=False),
) -> dict:
    """
    Rank candidates from the official JSONL dataset against the challenge JD.
    Returns top_k candidates ranked by SignalRank + availability.

    Uses cached dataset loading + cached TF-IDF index (first call pays the
    ~30s setup cost; subsequent calls with the same filter reuse the cache).
    """
    settings = get_settings()

    # Load JD
    jd_docx = settings.data_dir / "job_description.docx"
    jd_json = settings.data_dir / "job_description.json"
    if jd_docx.exists():
        jd = parse_jd_docx(jd_docx)
    elif jd_json.exists():
        import json
        with jd_json.open() as f:
            jd = json.load(f)
    else:
        raise HTTPException(status_code=404, detail="No job description found in data directory")

    # Load candidates (cached across requests)
    jsonl_path = settings.data_dir / "candidates.jsonl"
    if not jsonl_path.exists():
        raise HTTPException(status_code=404, detail="candidates.jsonl not found in data directory")

    candidates = load_jsonl_candidates_cached(
        jsonl_path,
        limit=None,  # all 100k
        filter_open_to_work=filter_open_to_work,
    )

    ranking = run_hiring_pipeline(
        jd,
        candidates,
        top_k=top_k,  # TF-IDF retrieval already ranks by relevance; no need to over-fetch
        apply_availability_modifier=True,
        use_cache=True,
    )

    # Trim to top_k
    ranking["candidates"] = ranking["candidates"][:top_k]
    return ranking


# ── Upload endpoints ─────────────────────────────────────────────────────────

@router.post("/upload/rank")
async def upload_and_rank(
    jd_file: UploadFile = File(None),
    jd_text: str = Form(None),
    resume_files: list[UploadFile] = File(default=[]),
    include_dataset: bool = Form(default=True),
    top_k: int = Form(default=50),
) -> dict:
    """
    Accept uploaded JD (docx or txt) and resume files.
    Blend uploaded resumes with dataset candidates if include_dataset=True.
    """
    settings = get_settings()

    # Parse JD
    if jd_file:
        content = await jd_file.read()
        filename = jd_file.filename or ""
        if filename.endswith(".docx"):
            tmp = Path("/tmp/uploaded_jd.docx")
            tmp.write_bytes(content)
            jd = parse_jd_docx(tmp)
        else:
            jd = _extract_jd_from_text("Uploaded Role", content.decode("utf-8", errors="ignore"))
    elif jd_text:
        jd = _extract_jd_from_text("Uploaded Role", jd_text)
    else:
        # Fall back to challenge JD
        jd_docx = settings.data_dir / "job_description.docx"
        if jd_docx.exists():
            jd = parse_jd_docx(jd_docx)
        else:
            raise HTTPException(status_code=400, detail="No job description provided")

    # Parse uploaded resumes — extract candidate name from resume content
    # (first line, before a separator) rather than the uploaded filename,
    # since filenames are rarely the candidate's real name.
    uploaded_candidates = []
    for rf in resume_files:
        content = await rf.read()
        filename = rf.filename or ""
        if filename.lower().endswith(".pdf"):
            from backend.app.text_parser import parse_pdf_bytes
            text = parse_pdf_bytes(content)
        else:
            text = content.decode("utf-8", errors="ignore")
        fallback_name = filename.replace(".txt", "").replace(".pdf", "")
        name = _extract_name_from_resume(text) or fallback_name
        uploaded_candidates.append(
            parse_candidate_text(name, text).model_dump()
        )

    # Blend with dataset candidates
    if include_dataset:
        jsonl_path = settings.data_dir / "candidates.jsonl"
        if jsonl_path.exists():
            dataset_candidates = load_jsonl_candidates(jsonl_path, limit=3000)
            all_candidates = uploaded_candidates + dataset_candidates
        else:
            all_candidates = uploaded_candidates
    else:
        all_candidates = uploaded_candidates

    if not all_candidates:
        raise HTTPException(status_code=400, detail="No candidates to rank")

    ranking = run_hiring_pipeline(
        jd,
        all_candidates,
        top_k=min(top_k * 5, len(all_candidates)),
        apply_availability_modifier=True,
    )
    ranking["candidates"] = ranking["candidates"][:top_k]
    return ranking


# ── CSV submission export ────────────────────────────────────────────────────

@router.get("/export/submission")
def export_submission(
    top_n: int = Query(default=100, ge=10, le=100),
) -> StreamingResponse:
    """
    Run dataset ranking and export as submission CSV.
    """
    settings = get_settings()

    jd_docx = settings.data_dir / "job_description.docx"
    if jd_docx.exists():
        jd = parse_jd_docx(jd_docx)
    else:
        raise HTTPException(status_code=404, detail="job_description.docx not found")

    jsonl_path = settings.data_dir / "candidates.jsonl"
    if not jsonl_path.exists():
        raise HTTPException(status_code=404, detail="candidates.jsonl not found")

    candidates = load_jsonl_candidates_cached(jsonl_path, limit=None)
    ranking = run_hiring_pipeline(
        jd,
        candidates,
        top_k=max(top_n * 2, 200),
        apply_availability_modifier=True,
        use_cache=True,
    )
    ranking["candidates"] = ranking["candidates"][:top_n]

    output_path = Path("/tmp/submission.csv")
    export_submission_csv(ranking, output_path, top_n=top_n)

    csv_content = output_path.read_text(encoding="utf-8")
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=submission.csv"},
    )


# ── Evaluate ─────────────────────────────────────────────────────────────────

@router.get("/evaluate")
def evaluate() -> dict:
    settings = get_settings()
    jd, candidates = load_demo_data(settings.data_dir)
    ranking = run_hiring_pipeline(
        jd.model_dump(),
        [c.model_dump() for c in candidates],
        apply_availability_modifier=False,
    )
    return evaluate_ranking(ranking).__dict__


# ── Career coach (personal resume analysis) ─────────────────────────────────

@router.post("/career-coach")
async def career_coach(
    resume_file: UploadFile = File(None),
    resume_text: str = Form(None),
    jd_file: UploadFile = File(None),
    jd_text: str = Form(None),
) -> dict:
    """
    AI career coach: parse your resume against a JD and return a full
    match score, skill gap analysis, strengths, concerns, improvement
    suggestions, and learning roadmap.
    """
    settings = get_settings()

    # Parse resume
    if resume_file:
        content = await resume_file.read()
        filename = resume_file.filename or ""
        if filename.lower().endswith(".pdf"):
            from backend.app.text_parser import parse_pdf_bytes
            rtext = parse_pdf_bytes(content)
        else:
            rtext = content.decode("utf-8", errors="ignore")
    elif resume_text:
        rtext = resume_text
    else:
        raise HTTPException(status_code=400, detail="No resume provided")

    name = _extract_name_from_resume(rtext) or "Your Profile"
    candidate = parse_candidate_text(name, rtext).model_dump()

    # Parse JD
    if jd_file:
        content = await jd_file.read()
        fname = jd_file.filename or ""
        if fname.endswith(".docx"):
            tmp = Path("/tmp/coach_jd.docx")
            tmp.write_bytes(content)
            jd = parse_jd_docx(tmp)
        else:
            jd = _extract_jd_from_text("Target Role", content.decode("utf-8", errors="ignore"))
    elif jd_text:
        jd = _extract_jd_from_text("Target Role", jd_text)
    else:
        jd_docx = settings.data_dir / "job_description.docx"
        if jd_docx.exists():
            jd = parse_jd_docx(jd_docx)
        else:
            raise HTTPException(status_code=400, detail="No job description provided")

    # Run through SignalRank as a single candidate
    from src.scoring.signalrank import rank_by_signalrank, normalize_skill
    results = rank_by_signalrank(jd, [candidate])
    result = results[0] if results else {}

    # Build career coach analysis
    must_have = jd.get("must_have_skills", [])
    nice_to_have = jd.get("nice_to_have_skills", [])
    candidate_skills_set = {normalize_skill(s) for s in candidate.get("skills", [])}

    missing_must = [s for s in must_have if normalize_skill(s) not in candidate_skills_set]
    missing_nice = [s for s in nice_to_have if normalize_skill(s) not in candidate_skills_set]

    skill_scores = result.get("skill_scores", {})
    weak_skills = [s for s, score in skill_scores.items() if score < 50]
    strong_skills = [s for s, score in skill_scores.items() if score >= 75]

    signal_score = result.get("signal_score", 0)
    if signal_score >= 70:
        recruiter_likelihood = "High — Strong profile match, likely to pass ATS and recruiter screen."
    elif signal_score >= 50:
        recruiter_likelihood = "Medium — Competitive but has addressable gaps. Target roles before upskilling."
    else:
        recruiter_likelihood = "Low — Significant skill gaps. Prioritize learning roadmap before applying."

    # Build learning roadmap
    roadmap = []
    for i, skill in enumerate(missing_must[:5], 1):
        roadmap.append({
            "priority": i,
            "skill": skill,
            "action": f"Build hands-on project using {skill}",
            "timeline": "2-4 weeks",
            "impact": "High — Required by JD"
        })
    for i, skill in enumerate(missing_nice[:3], len(missing_must[:5]) + 1):
        roadmap.append({
            "priority": i,
            "skill": skill,
            "action": f"Add {skill} to side project or portfolio",
            "timeline": "1-2 months",
            "impact": "Medium — Differentiator"
        })

    # Resume improvement suggestions
    evidence_items = candidate.get("evidence", [])
    unsupported = [e["claim"] for e in evidence_items if e.get("level") == "unsupported"]
    suggestions = []
    if unsupported:
        suggestions.append(f"Add quantified evidence for: {', '.join(unsupported[:3])}. Use numbers, scale, and outcomes.")
    if missing_must:
        suggestions.append(f"Add projects or experience covering: {', '.join(missing_must[:3])}.")
    if result.get("snr", 0) < 0.5:
        suggestions.append("Resume may contain too many unrelated skills. Focus on the most relevant signals for this role.")
    if not any("production" in e.get("source", "").lower() for e in evidence_items):
        suggestions.append("Add evidence of production deployment, scale, and ownership — these are critical signals for senior roles.")
    if len(candidate.get("career_events", [])) < 2:
        suggestions.append("Expand your career history section with clear role titles, companies, dates, and outcome-driven bullets.")

    # ── Extended metrics ────────────────────────────────────────────────────
    snr = result.get("snr", 0)
    confidence_score = result.get("confidence", 0)
    evidence_items = candidate.get("evidence", [])
    unsupported = [e["claim"] for e in evidence_items if e.get("level") == "unsupported"]

    ats_score = min(100, round(
        len(candidate_skills_set.intersection({normalize_skill(s) for s in must_have + nice_to_have}))
        / max(len(must_have), 1) * 100
    ))
    recruiter_confidence = round(min(100, signal_score * 0.5 + confidence_score * 0.3 + min(snr * 50, 30) * 0.2))
    interview_prob = round(min(95, max(5, recruiter_confidence * 0.9 - len(result.get("gaps", [])) * 5)))
    offer_prob = round(min(80, max(2, interview_prob * 0.55 - len(missing_must) * 4)))
    max_improvement = min(40, len(missing_must) * 7 + len(suggestions) * 3)
    expected_score_after = min(99, round(signal_score + max_improvement))

    resume_text_lower = rtext.lower()
    all_jd_terms = must_have + nice_to_have + jd.get("seniority_signals", []) + jd.get("domains", [])
    missing_keywords = [t for t in all_jd_terms if normalize_skill(t) not in candidate_skills_set and t.lower() not in resume_text_lower][:8]

    tech_markers = ["faiss","pinecone","qdrant","weaviate","elasticsearch","langchain","sentence transformers","hugging face","pytorch","tensorflow","xgboost","mlflow","docker","kubernetes","airflow","spark"]
    missing_technologies = [t for t in missing_must + missing_nice if any(m in t.lower() for m in tech_markers)][:6]

    cert_map = {
        "machine learning": "Google ML Professional Certificate",
        "embeddings": "Hugging Face NLP Course (free)",
        "information retrieval": "Coursera — Text Retrieval and Search Engines",
        "recommendation systems": "Coursera — Recommender Systems Specialization",
        "vector search": "Pinecone / Weaviate free certification",
        "learning to rank": "LTR with XGBoost (Kaggle Learn)",
        "fine-tuning llms": "DeepLearning.AI — Finetuning LLMs Short Course",
        "langchain": "LangChain Official Certification",
        "mlops": "MLOps Specialization — DeepLearning.AI",
        "sql": "Mode SQL Tutorial or StrataScratch Premium",
        "anomaly detection": "Coursera — Anomaly Detection in Time Series",
        "fraud detection": "Kaggle Fraud Detection Competition",
        "semantic search": "Hugging Face Semantic Search Course",
        "nlp": "Stanford CS224N (free on YouTube)",
    }
    suggested_certs = list(dict.fromkeys(cert_map.get(normalize_skill(s)) for s in missing_must + missing_nice if normalize_skill(s) in cert_map if cert_map.get(normalize_skill(s))))[:5]

    project_map = {
        "embeddings": "Semantic document search engine with sentence-transformers + FAISS",
        "vector search": "Deploy Qdrant/Weaviate, benchmark ANN retrieval with BEIR",
        "information retrieval": "Hybrid BM25 + dense retrieval with BEIR benchmark evaluation",
        "recommendation systems": "Collaborative filtering + content-based recommender on MovieLens",
        "learning to rank": "XGBoost LTR model on MSLR dataset, measure NDCG@10",
        "fine-tuning llms": "Fine-tune Mistral-7B on domain data using LoRA/QLoRA",
        "langchain": "End-to-end RAG chatbot with LangChain + FAISS + evaluation framework",
        "semantic search": "Production semantic search API with Elasticsearch + embeddings",
        "sentence transformers": "Cross-encoder re-ranking pipeline with BEIR evaluation",
        "nlp": "NER + classification pipeline on a domain-specific corpus",
    }
    suggested_projects = list(dict.fromkeys(project_map.get(normalize_skill(s)) for s in missing_must + missing_nice if normalize_skill(s) in project_map if project_map.get(normalize_skill(s))))[:4]

    interview_topics = []
    for skill in (strong_skills or list(candidate_skills_set))[:4]:
        interview_topics.append(f"Deep-dive: {skill} — implementation details, trade-offs, and production lessons")
    for gap in result.get("gaps", [])[:3]:
        interview_topics.append(f"Address gap in {gap['skill']} — prepare a transferable answer or ramp plan")
    interview_topics = interview_topics[:8]

    action_plan = {
        "immediate": list(filter(None, [
            "Add quantified metrics to top 3 bullet points (%, scale, latency, revenue impact).",
            "Tailor your resume summary to match the target role title and 2 key skills.",
            f"Verify or remove unsubstantiated claims: {', '.join(unsupported[:2])}" if unsupported else None,
        ]))[:3],
        "next_30_days": list(filter(None, [
            f"Build a project demonstrating: {missing_must[0]}" if missing_must else None,
            f"Complete: {suggested_certs[0]}" if suggested_certs else None,
            "Add 2–3 production-level outcome bullets per role with numbers.",
        ]))[:3],
        "next_90_days": list(filter(None, [
            f"Build portfolio project: {suggested_projects[0]}" if suggested_projects else None,
            "Contribute to an open-source project in your target domain.",
            f"Earn: {suggested_certs[1]}" if len(suggested_certs) > 1 else None,
            "Apply to 10 target roles after resume improvements.",
        ]))[:3],
    }

    return {
        "name": name,
        "target_role": jd.get("title", "Target Role"),
        "match_score": round(signal_score, 1),
        "ats_score": ats_score,
        "recruiter_confidence": recruiter_confidence,
        "interview_probability": interview_prob,
        "offer_probability": offer_prob,
        "expected_score_after_improvements": expected_score_after,
        "trust_label": result.get("trust_label", ""),
        "recommendation": result.get("recommendation", ""),
        "recruiter_likelihood": recruiter_likelihood,
        "skill_scores": skill_scores,
        "strengths": result.get("strengths", []),
        "concerns": result.get("concerns", []),
        "gaps": result.get("gaps", []),
        "missing_must_have": missing_must,
        "missing_nice_to_have": missing_nice,
        "missing_keywords": missing_keywords,
        "missing_technologies": missing_technologies,
        "weak_skills": weak_skills,
        "strong_skills": strong_skills,
        "resume_suggestions": suggestions,
        "suggested_certifications": suggested_certs,
        "suggested_projects": suggested_projects,
        "learning_roadmap": roadmap,
        "interview_prep_topics": interview_topics,
        "action_plan": action_plan,
        "interview_probes": result.get("interview_probes", []),
        "risk_flags": result.get("risk_flags", []),
        "parsed_skills": candidate.get("skills", []),
        "years_of_experience": candidate.get("years_of_experience"),
        "current_title": candidate.get("current_title", ""),
    }


# ── Compare candidates ───────────────────────────────────────────────────────

@router.post("/compare")
async def compare_candidates(
    candidate_ids: list[str],
) -> dict:
    """Compare 2-4 candidates side by side from the dataset."""
    settings = get_settings()
    jsonl_path = settings.data_dir / "candidates.jsonl"
    if not jsonl_path.exists():
        raise HTTPException(status_code=404, detail="Dataset not found")

    import json
    results = {}
    with jsonl_path.open() as f:
        for line in f:
            try:
                record = json.loads(line)
                cid = record.get("candidate_id")
                if cid in candidate_ids:
                    from backend.app.dataset_adapter import jsonl_to_internal
                    results[cid] = jsonl_to_internal(record)
                    if len(results) == len(candidate_ids):
                        break
            except Exception:
                continue
    return {"candidates": list(results.values())}

@router.get("/candidate/{candidate_id}")
def get_candidate(candidate_id: str) -> dict:
    """Fetch a single candidate from JSONL by ID."""
    settings = get_settings()
    jsonl_path = settings.data_dir / "candidates.jsonl"
    if not jsonl_path.exists():
        raise HTTPException(status_code=404, detail="Dataset not found")

    import json
    with jsonl_path.open() as f:
        for line in f:
            try:
                record = json.loads(line)
                if record.get("candidate_id") == candidate_id:
                    return jsonl_to_internal(record)
            except Exception:
                continue
    raise HTTPException(status_code=404, detail=f"Candidate {candidate_id} not found")
