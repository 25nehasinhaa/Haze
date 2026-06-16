from datetime import datetime


EVIDENCE_WEIGHTS = {
    "strong": 1.0,
    "partial": 0.65,
    "weak": 0.3,
    "unsupported": 0.08,
}

CRITICAL_SKILLS = {
    "fraud detection",
    "anomaly detection",
    "model deployment",
    "model monitoring",
}

TRANSFER_MAP = {
    "fraud detection": {
        "anomaly detection": 0.35,
        "risk analytics": 0.25,
        "pattern recognition": 0.2,
        "stream processing": 0.1,
    },
    "model monitoring": {
        "stream processing": 0.15,
        "pattern recognition": 0.1,
    },
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


def evidence_for_claim(candidate: dict, claim: str) -> dict | None:
    claim_lower = claim.lower()
    for item in candidate["evidence"]:
        if item["claim"].lower() == claim_lower:
            return item
    return None


def compute_skill_scores(jd: dict, candidate: dict) -> dict[str, float]:
    scores = {}
    candidate_skills = {skill.lower() for skill in candidate["skills"]}
    for skill in jd["must_have_skills"]:
        skill_lower = skill.lower()
        evidence = evidence_for_claim(candidate, skill_lower)
        if evidence:
            base = EVIDENCE_WEIGHTS[evidence["level"]]
            scores[skill_lower] = 100 * base * recency_factor(evidence["last_used"])
            continue

        transfer_score = 0.0
        for adjacent_skill, weight in TRANSFER_MAP.get(skill_lower, {}).items():
            if adjacent_skill in candidate_skills:
                transfer_score = max(transfer_score, weight * 100)
        scores[skill_lower] = transfer_score
    return scores


def classify_gaps(jd: dict, skill_scores: dict[str, float]) -> list[dict[str, str]]:
    gaps = []
    for skill in jd["must_have_skills"]:
        score = skill_scores.get(skill.lower(), 0)
        if score >= 50:
            continue
        gap_type = "critical gap" if skill.lower() in CRITICAL_SKILLS else "correctable gap"
        gaps.append({"skill": skill, "type": gap_type})
    return gaps


def compute_snr(candidate: dict, jd: dict) -> float:
    role_terms = {term.lower() for term in jd["must_have_skills"] + jd["nice_to_have_skills"] + jd["domains"]}
    signal = 0.0
    noise = 1.0

    for item in candidate["evidence"]:
        claim = item["claim"].lower()
        role_relevant = claim in role_terms or item.get("role_relevant", False)
        evidence_weight = EVIDENCE_WEIGHTS[item["level"]]
        recency = recency_factor(item["last_used"])
        if role_relevant and evidence_weight > 0:
            signal += evidence_weight * recency
        else:
            noise += 1 - evidence_weight

        if item["level"] == "unsupported":
            noise += 1.0
        elif recency < 0.5:
            noise += 0.4

    return signal / noise


def build_risk_flags(candidate: dict, gaps: list[dict[str, str]]) -> list[str]:
    flags = []
    unsupported = [item["claim"] for item in candidate["evidence"] if item["level"] == "unsupported"]
    stale = [item["claim"] for item in candidate["evidence"] if recency_factor(item["last_used"]) < 0.5]
    critical_gaps = [gap["skill"] for gap in gaps if gap["type"] == "critical gap"]

    if unsupported:
        flags.append(f"Unsupported claims: {', '.join(unsupported[:3])}")
    if stale:
        flags.append(f"Stale evidence: {', '.join(stale[:3])}")
    if critical_gaps:
        flags.append(f"Critical gaps to validate: {', '.join(critical_gaps[:3])}")
    if len(candidate["skills"]) > len(candidate["evidence"]) + 2:
        flags.append("Skills list is broader than supporting evidence.")
    return flags or ["No major evidence risks found."]


def compute_experience_match(candidate: dict) -> float:
    events = sorted(candidate.get("career_events", []), key=lambda item: item["year"])
    if not events:
        return 35.0
    years = max(datetime.now().year - events[0]["year"], 0)
    return min(100.0, 30 + years * 10)


def compute_career_growth(candidate: dict) -> float:
    events = candidate.get("career_events", [])
    if len(events) <= 1:
        return 45.0
    text = " ".join(event["event"].lower() for event in events)
    growth_terms = ["senior", "led", "owned", "manager", "promoted", "lead", "principal", "staff"]
    growth_bonus = 10 * sum(1 for term in growth_terms if term in text)
    event_density = min(40, len(events) * 12)
    return min(100.0, 35 + event_density + growth_bonus)


def compute_behavioral_fit(candidate: dict, jd: dict) -> float:
    text = " ".join(
        [
            candidate.get("headline", ""),
            candidate.get("summary", ""),
            " ".join(item.get("source", "") for item in candidate.get("evidence", [])),
            " ".join(event.get("event", "") for event in candidate.get("career_events", [])),
        ]
    ).lower()
    signals = [signal.lower() for signal in jd.get("seniority_signals", [])]
    if not signals:
        signals = ["owned", "led", "mentoring", "collaboration", "stakeholder", "incident"]
    matched = sum(1 for signal in signals if signal in text)
    return min(100.0, 35 + matched * 18)


def compute_confidence(evidence_items: list[dict], gaps: list[dict[str, str]]) -> float:
    if not evidence_items:
        return 20.0
    supported = sum(1 for item in evidence_items if item["level"] in {"strong", "partial"})
    unsupported = sum(1 for item in evidence_items if item["level"] == "unsupported")
    critical_gaps = sum(1 for gap in gaps if gap["type"] == "critical gap")
    score = 35 + 55 * (supported / len(evidence_items)) - unsupported * 6 - critical_gaps * 7
    return max(0.0, min(100.0, score))


def build_strengths(result: dict) -> list[str]:
    strengths = []
    if result["evidence_strength"] >= 75:
        strengths.append("Evidence-backed skills with concrete project or production signals.")
    if result["recency"] >= 75:
        strengths.append("Recent experience aligns with the role requirements.")
    if result["domain_alignment"] >= 60:
        strengths.append("Domain exposure matches the hiring context.")
    if result["career_growth"] >= 70:
        strengths.append("Career trajectory shows progression and expanding responsibility.")
    if result["behavioral_fit"] >= 65:
        strengths.append("Behavioral signals indicate ownership, collaboration, or leadership.")
    return strengths or ["Some relevant signals exist, but evidence should be validated."]


def build_concerns(result: dict) -> list[str]:
    concerns = []
    if result["confidence"] < 55:
        concerns.append("Confidence is limited because the evidence coverage is thin.")
    if result["snr"] < 0.7:
        concerns.append("Signal-to-noise ratio is low; profile may contain broad or unsupported claims.")
    critical = [gap["skill"] for gap in result["gaps"] if gap["type"] == "critical gap"]
    if critical:
        concerns.append(f"Critical gaps require validation: {', '.join(critical[:3])}.")
    return concerns or ["No major concerns found in the available evidence."]


def build_recommendation(result: dict) -> str:
    if result["signal_score"] >= 80 and result["confidence"] >= 70:
        return "Prioritize for recruiter screen and prepare role-specific technical probes."
    if result["signal_score"] >= 65:
        return "Shortlist as a credible candidate; validate gaps in the first interview."
    if result["confidence"] < 45:
        return "Do not reject automatically; request more evidence or portfolio details before deciding."
    return "Keep as backup unless the hiring team values the transferable skills strongly."


def trust_label(score: float, snr: float, gaps: list[dict[str, str]], unsupported_count: int) -> str:
    has_critical_gap = any(gap["type"] == "critical gap" for gap in gaps)
    if score >= 80 and snr >= 0.8 and not has_critical_gap:
        return "Verified strong match"
    if score >= 70 and has_critical_gap:
        return "High potential, needs validation"
    if unsupported_count >= 3:
        return "Keyword-heavy, weak evidence"
    if score >= 65:
        return "Reliable match"
    return "Risky or incomplete fit"


def rank_by_signalrank(jd: dict, candidates: list[dict]) -> list[dict]:
    results = []
    role_domains = {domain.lower() for domain in jd["domains"]}

    for candidate in candidates:
        skill_scores = compute_skill_scores(jd, candidate)
        semantic_fit = sum(skill_scores.values()) / max(len(skill_scores), 1)
        evidence_items = []
        role_terms = {term.lower() for term in jd["must_have_skills"] + jd["nice_to_have_skills"] + jd["domains"]}
        for item in candidate["evidence"]:
            enriched = dict(item)
            enriched["role_relevant"] = item["claim"].lower() in role_terms
            evidence_items.append(enriched)

        evidence_strength = 100 * sum(EVIDENCE_WEIGHTS[item["level"]] for item in evidence_items) / max(len(evidence_items), 1)
        recency = 100 * sum(recency_factor(item["last_used"]) for item in evidence_items) / max(len(evidence_items), 1)
        domain_alignment = 100 * len(role_domains.intersection({domain.lower() for domain in candidate["domains"]})) / max(len(role_domains), 1)
        transfer_score = 0
        if semantic_fit >= 65 and domain_alignment < 50:
            transfer_score = 15
        snr = compute_snr(candidate, jd)
        unsupported_count = sum(1 for item in evidence_items if item["level"] == "unsupported")
        stale_count = sum(1 for item in evidence_items if recency_factor(item["last_used"]) < 0.5)
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
            "name": candidate["name"],
            "summary": candidate["summary"],
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
