"""
SignalRank scoring engine.
Handles both demo (internal schema) and real dataset (converted via dataset_adapter).
"""
from datetime import datetime


EVIDENCE_WEIGHTS = {
    "strong": 1.0,
    "partial": 0.65,
    "weak": 0.3,
    "unsupported": 0.08,
}

# Skills critical for the challenge JD (Senior AI Engineer)
CRITICAL_SKILLS = {
    "embeddings", "retrieval", "ranking", "vector database",
    "semantic search", "evaluation framework",
    # Legacy fraud detection JD
    "fraud detection", "anomaly detection", "model deployment", "model monitoring",
}

TRANSFER_MAP = {
    # Embeddings ↔ related
    "embeddings": {
        "sentence transformers": 0.9, "nlp": 0.5, "machine learning": 0.35,
        "vector search": 0.7, "semantic search": 0.8, "hugging face transformers": 0.7,
    },
    # Semantic search ↔ retrieval
    "semantic search": {
        "information retrieval": 0.8, "vector search": 0.7,
        "elasticsearch": 0.5, "embeddings": 0.7,
    },
    # Vector search ↔ stores
    "vector search": {
        "faiss": 0.9, "embeddings": 0.7, "semantic search": 0.7,
        "information retrieval": 0.6, "elasticsearch": 0.5,
    },
    # Information retrieval ↔ search tech
    "information retrieval": {
        "semantic search": 0.7, "vector search": 0.6, "elasticsearch": 0.5,
        "recommendation systems": 0.4, "nlp": 0.35,
    },
    # Recommendation ↔ ranking
    "recommendation systems": {
        "information retrieval": 0.5, "learning to rank": 0.6,
        "machine learning": 0.35, "collaborative filtering": 0.6,
    },
    # Learning to rank ↔ eval
    "learning to rank": {
        "recommendation systems": 0.6, "information retrieval": 0.5,
        "machine learning": 0.4, "a/b testing": 0.4,
    },
    # Fine-tuning ↔ ML
    "fine-tuning llms": {
        "llms": 0.6, "nlp": 0.5, "machine learning": 0.4,
        "hugging face transformers": 0.7,
    },
    # Legacy fraud detection
    "fraud detection": {
        "anomaly detection": 0.35, "risk analytics": 0.25,
        "pattern recognition": 0.2, "stream processing": 0.1,
    },
    "model monitoring": {
        "stream processing": 0.15, "pattern recognition": 0.1,
    },
}

# Skills that are effectively synonyms / very closely related
SKILL_ALIASES = {
    # Machine learning
    "ml": "machine learning", "deep learning": "machine learning",
    "tensorflow": "machine learning", "pytorch": "machine learning",
    # NLP
    "transformers": "nlp", "bert": "nlp", "natural language processing": "nlp",
    # LLMs
    "gpt": "llms", "openai": "llms", "llm": "llms", "large language model": "llms",
    # RAG / retrieval
    "rag": "information retrieval", "dense retrieval": "information retrieval",
    "hybrid search": "information retrieval", "bm25": "information retrieval",
    "retrieval": "information retrieval",
    # Vector stores — all map to "vector search" (most common in dataset)
    "ann": "vector search", "approximate nearest neighbor": "vector search",
    "vector database": "vector search", "vector db": "vector search",
    "faiss": "vector search", "pinecone": "vector search", "qdrant": "vector search",
    "weaviate": "vector search", "milvus": "vector search", "pgvector": "vector search",
    "opensearch": "vector search",
    # Embeddings
    "sentence-transformers": "sentence transformers", "bge": "sentence transformers",
    "e5": "sentence transformers", "embedding": "embeddings",
    "hugging face": "hugging face transformers", "huggingface": "hugging face transformers",
    "transformers library": "hugging face transformers",
    # Ranking/recommendation
    "ranking": "recommendation systems", "reranking": "recommendation systems",
    "recommendation": "recommendation systems", "learning-to-rank": "learning to rank",
    "ltr": "learning to rank",
    # Evaluation
    "ndcg": "learning to rank", "mrr": "learning to rank",
    "offline evaluation": "learning to rank", "online evaluation": "a/b testing",
    "evaluation framework": "learning to rank",
    # Fine-tuning
    "fine-tuning": "fine-tuning llms", "fine tuning": "fine-tuning llms",
    "finetuning": "fine-tuning llms", "lora": "fine-tuning llms",
    "qlora": "fine-tuning llms", "peft": "fine-tuning llms",
    # LangChain / frameworks
    "langchain": "langchain",
    # A/B testing
    "a/b test": "a/b testing", "ab testing": "a/b testing",
}


def recency_factor(last_used: int, current_year: int | None = None) -> float:
    year = current_year or datetime.now().year
    age = max(year - last_used, 0)
    if age <= 1:
        return 1.0
    if age <= 3:
        return 0.75
    if age <= 5:
        return 0.45
    return 0.2


def normalize_skill(skill: str) -> str:
    lower = skill.lower().strip()
    return SKILL_ALIASES.get(lower, lower)


def evidence_for_claim(candidate: dict, claim: str) -> dict | None:
    claim_lower = normalize_skill(claim)
    for item in candidate.get("evidence", []):
        item_claim = normalize_skill(item.get("claim", ""))
        if item_claim == claim_lower:
            return item
    return None


def compute_skill_scores(jd: dict, candidate: dict) -> dict[str, float]:
    scores = {}
    candidate_skills_normalized = {normalize_skill(s) for s in candidate.get("skills", [])}

    for skill in jd.get("must_have_skills", []):
        skill_lower = normalize_skill(skill)
        evidence = evidence_for_claim(candidate, skill_lower)
        if evidence:
            base = EVIDENCE_WEIGHTS[evidence["level"]]
            scores[skill_lower] = 100 * base * recency_factor(evidence.get("last_used", datetime.now().year - 1))
            continue

        # Partial credit from skill list (no evidence)
        if skill_lower in candidate_skills_normalized:
            scores[skill_lower] = 25.0  # listed but no evidence
            continue

        # Transfer credit
        transfer_score = 0.0
        for adjacent_skill, weight in TRANSFER_MAP.get(skill_lower, {}).items():
            adj_norm = normalize_skill(adjacent_skill)
            if adj_norm in candidate_skills_normalized:
                transfer_score = max(transfer_score, weight * 100)
            # Also check evidence
            ev = evidence_for_claim(candidate, adj_norm)
            if ev:
                ev_weight = EVIDENCE_WEIGHTS[ev["level"]]
                transfer_score = max(transfer_score, weight * 100 * ev_weight)
        scores[skill_lower] = transfer_score

    return scores


def classify_gaps(jd: dict, skill_scores: dict[str, float]) -> list[dict[str, str]]:
    gaps = []
    for skill in jd.get("must_have_skills", []):
        score = skill_scores.get(normalize_skill(skill), 0)
        if score >= 40:
            continue
        gap_type = "critical gap" if normalize_skill(skill) in CRITICAL_SKILLS else "correctable gap"
        gaps.append({"skill": skill, "type": gap_type})
    return gaps


def compute_snr(candidate: dict, jd: dict) -> float:
    role_terms = {
        normalize_skill(term)
        for term in jd.get("must_have_skills", []) + jd.get("nice_to_have_skills", []) + jd.get("domains", [])
    }
    signal = 0.0
    noise = 1.0

    for item in candidate.get("evidence", []):
        claim = normalize_skill(item.get("claim", ""))
        role_relevant = claim in role_terms or item.get("role_relevant", False)
        evidence_weight = EVIDENCE_WEIGHTS.get(item.get("level", "weak"), 0.3)
        recency = recency_factor(item.get("last_used", datetime.now().year - 2))
        if role_relevant and evidence_weight > 0:
            signal += evidence_weight * recency
        else:
            noise += 1 - evidence_weight

        if item.get("level") == "unsupported":
            noise += 1.0
        elif recency < 0.5:
            noise += 0.4

    return signal / noise


def build_risk_flags(candidate: dict, gaps: list[dict[str, str]]) -> list[str]:
    flags = []
    evidence = candidate.get("evidence", [])
    unsupported = [item["claim"] for item in evidence if item.get("level") == "unsupported"]
    stale = [item["claim"] for item in evidence if recency_factor(item.get("last_used", 2020)) < 0.5]
    critical_gaps = [gap["skill"] for gap in gaps if gap["type"] == "critical gap"]

    if unsupported:
        flags.append(f"Unsupported claims: {', '.join(unsupported[:3])}")
    if stale:
        flags.append(f"Stale evidence: {', '.join(stale[:3])}")
    if critical_gaps:
        flags.append(f"Critical gaps to validate: {', '.join(critical_gaps[:3])}")
    if len(candidate.get("skills", [])) > len(evidence) + 4:
        flags.append("Skills list broader than supporting evidence — possible inflation.")
    return flags or ["No major evidence risks found."]


def compute_experience_match(candidate: dict) -> float:
    # Prefer years_of_experience from dataset if available
    yoe = candidate.get("years_of_experience")
    if yoe is not None:
        yoe = float(yoe)
        if yoe < 2:
            return 20.0
        if yoe < 5:
            return 50.0 + yoe * 5
        if yoe <= 9:
            return 70.0 + (yoe - 5) * 5
        return min(100.0, 90.0 + (yoe - 9) * 1)

    events = sorted(candidate.get("career_events", []), key=lambda e: e.get("year", 0))
    if not events:
        return 35.0
    years = max(datetime.now().year - events[0]["year"], 0)
    return min(100.0, 30 + years * 10)


def compute_career_growth(candidate: dict) -> float:
    events = candidate.get("career_events", [])
    if len(events) <= 1:
        return 45.0
    text = " ".join(e.get("event", "").lower() for e in events)
    # Also check career history descriptions
    for role in candidate.get("career_history", []):
        text += " " + role.get("description", "").lower()[:200]
    growth_terms = ["senior", "led", "owned", "manager", "promoted", "lead", "principal", "staff", "head", "director"]
    growth_bonus = 10 * sum(1 for term in growth_terms if term in text)
    event_density = min(40, len(events) * 12)
    return min(100.0, 35 + event_density + growth_bonus)


def compute_behavioral_fit(candidate: dict, jd: dict) -> float:
    text_parts = [
        candidate.get("headline", ""),
        candidate.get("summary", ""),
        " ".join(item.get("source", "") for item in candidate.get("evidence", [])),
        " ".join(e.get("event", "") for e in candidate.get("career_events", [])),
    ]
    text = " ".join(text_parts).lower()
    signals = [s.lower() for s in jd.get("seniority_signals", [])]
    if not signals:
        signals = ["owned", "led", "mentoring", "collaboration", "stakeholder", "incident", "shipped", "production"]
    matched = sum(1 for signal in signals if signal in text)
    return min(100.0, 35 + matched * 15)


def compute_confidence(evidence_items: list[dict], gaps: list[dict[str, str]]) -> float:
    if not evidence_items:
        return 20.0
    supported = sum(1 for item in evidence_items if item.get("level") in {"strong", "partial"})
    unsupported = sum(1 for item in evidence_items if item.get("level") == "unsupported")
    critical_gaps = sum(1 for gap in gaps if gap["type"] == "critical gap")
    score = 35 + 55 * (supported / len(evidence_items)) - unsupported * 6 - critical_gaps * 7
    return max(0.0, min(100.0, score))


def build_strengths(result: dict) -> list[str]:
    strengths = []
    if result["evidence_strength"] >= 60:
        strengths.append("Evidence-backed skills with concrete project or production signals.")
    if result["recency"] >= 60:
        strengths.append("Recent experience aligns with the role requirements.")
    if result["domain_alignment"] >= 40:
        strengths.append("Domain exposure matches the hiring context.")
    if result["career_growth"] >= 55:
        strengths.append("Career trajectory shows progression and expanding responsibility.")
    if result["behavioral_fit"] >= 50:
        strengths.append("Behavioral signals indicate ownership, collaboration, or leadership.")
    if result.get("semantic_fit", 0) >= 45:
        strengths.append("Strong skill coverage of the must-have requirements.")
    return strengths or ["Some relevant signals exist, but evidence should be validated."]


def build_concerns(result: dict) -> list[str]:
    concerns = []
    if result["confidence"] < 50:
        concerns.append("Confidence is limited because the evidence coverage is thin.")
    if result["snr"] < 0.4:
        concerns.append("Signal-to-noise ratio is low; profile may contain broad or unsupported claims.")
    critical = [gap["skill"] for gap in result["gaps"] if gap["type"] == "critical gap"]
    if critical:
        concerns.append(f"Critical gaps require validation: {', '.join(critical[:3])}.")
    if result["experience_match"] < 40:
        concerns.append("Years of experience may be below the role's requirements.")
    return concerns or ["No major concerns found in the available evidence."]


def build_recommendation(result: dict) -> str:
    if result["signal_score"] >= 60 and result["confidence"] >= 60:
        return "Prioritize for recruiter screen and prepare role-specific technical probes."
    if result["signal_score"] >= 45:
        return "Shortlist as a credible candidate; validate gaps in the first interview."
    if result["confidence"] < 40:
        return "Do not reject automatically; request more evidence or portfolio details before deciding."
    return "Keep as backup unless the hiring team values the transferable skills strongly."


def trust_label(score: float, snr: float, gaps: list[dict[str, str]], unsupported_count: int) -> str:
    has_critical_gap = any(gap["type"] == "critical gap" for gap in gaps)
    # Thresholds calibrated for real dataset score distribution (typically 30-70 range)
    if score >= 60 and not has_critical_gap and unsupported_count < 3:
        return "Verified strong match"
    if score >= 50 and has_critical_gap:
        return "High potential, needs validation"
    if unsupported_count >= 5:
        return "Keyword-heavy, weak evidence"
    if score >= 45:
        return "Reliable match"
    return "Risky or incomplete fit"


def rank_by_signalrank(jd: dict, candidates: list[dict]) -> list[dict]:
    results = []
    role_domains = {d.lower() for d in jd.get("domains", [])}

    for candidate in candidates:
        skill_scores = compute_skill_scores(jd, candidate)
        semantic_fit = sum(skill_scores.values()) / max(len(skill_scores), 1)

        evidence_items = []
        role_terms = {
            normalize_skill(t)
            for t in jd.get("must_have_skills", []) + jd.get("nice_to_have_skills", []) + jd.get("domains", [])
        }
        for item in candidate.get("evidence", []):
            enriched = dict(item)
            enriched["role_relevant"] = normalize_skill(item.get("claim", "")) in role_terms
            evidence_items.append(enriched)

        if evidence_items:
            evidence_strength = 100 * sum(
                EVIDENCE_WEIGHTS.get(item.get("level", "weak"), 0.3) for item in evidence_items
            ) / len(evidence_items)
            recency = 100 * sum(
                recency_factor(item.get("last_used", datetime.now().year - 2)) for item in evidence_items
            ) / len(evidence_items)
        else:
            evidence_strength = 20.0
            recency = 50.0

        candidate_domains = {d.lower() for d in candidate.get("domains", [])}
        domain_alignment = (
            100 * len(role_domains.intersection(candidate_domains)) / max(len(role_domains), 1)
            if role_domains else 50.0
        )

        transfer_score = 0
        if semantic_fit >= 65 and domain_alignment < 50:
            transfer_score = 15

        snr = compute_snr(candidate, jd)
        unsupported_count = sum(1 for item in evidence_items if item.get("level") == "unsupported")
        stale_count = sum(1 for item in evidence_items if recency_factor(item.get("last_used", 2020)) < 0.5)
        gaps = classify_gaps(jd, skill_scores)
        critical_gap_penalty = 4 * sum(1 for gap in gaps if gap["type"] == "critical gap")
        experience_match = compute_experience_match(candidate)
        career_growth = compute_career_growth(candidate)
        behavioral_fit = compute_behavioral_fit(candidate, jd)
        confidence = compute_confidence(evidence_items, gaps)

        signal_score = (
            0.24 * semantic_fit
            + 0.22 * evidence_strength
            + 0.13 * recency
            + 0.12 * domain_alignment
            + 0.10 * experience_match
            + 0.08 * career_growth
            + 0.06 * behavioral_fit
            + 0.05 * confidence
            + transfer_score
            - 3 * unsupported_count
            - 1.5 * stale_count
            - critical_gap_penalty
        )
        signal_score = max(min(signal_score, 100), 0)

        result = {
            "name": candidate.get("name", ""),
            "summary": candidate.get("summary", "")[:300],
            "candidate": candidate,
            "signal_score": signal_score,
            "semantic_fit": semantic_fit,
            "evidence_strength": evidence_strength,
            "recency": recency,
            "domain_alignment": domain_alignment,
            "experience_match": experience_match,
            "career_growth": career_growth,
            "behavioral_fit": behavioral_fit,
            "confidence": confidence,
            "snr": snr,
            "skill_scores": skill_scores,
            "evidence": evidence_items,
            "gaps": gaps,
            "risk_flags": build_risk_flags(candidate, gaps),
            "trust_label": trust_label(signal_score, snr, gaps, unsupported_count),
        }
        result["strengths"] = build_strengths(result)
        result["concerns"] = build_concerns(result)
        result["recommendation"] = build_recommendation(result)
        results.append(result)

    return sorted(results, key=lambda item: item["signal_score"], reverse=True)
