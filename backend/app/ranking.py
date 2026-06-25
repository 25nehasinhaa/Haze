from src.explanation.interview_probes import build_interview_probes
from src.scoring.baseline_ranker import rank_by_naive_keyword_overlap
from src.scoring.signalrank import rank_by_signalrank


def rank_candidates(jd: dict, candidates: list[dict]) -> dict:
    naive_results = rank_by_naive_keyword_overlap(jd, candidates)
    signal_results = rank_by_signalrank(jd, candidates)

    ranked = []
    for index, result in enumerate(signal_results, start=1):
        ranked.append(
            {
                "name": result["name"],
                "rank": index,
                "signal_score": round(result["signal_score"], 2),
                "semantic_fit": round(result["semantic_fit"], 2),
                "evidence_strength": round(result["evidence_strength"], 2),
                "recency": round(result["recency"], 2),
                "domain_alignment": round(result["domain_alignment"], 2),
                "experience_match": round(result["experience_match"], 2),
                "career_growth": round(result["career_growth"], 2),
                "behavioral_fit": round(result["behavioral_fit"], 2),
                "confidence": round(result["confidence"], 2),
                "snr": round(result["snr"], 2),
                "trust_label": result["trust_label"],
                "summary": result["summary"],
                "risk_flags": result["risk_flags"],
                "gaps": result["gaps"],
                "interview_probes": build_interview_probes(result),
                "skill_scores": {key: round(value, 2) for key, value in result["skill_scores"].items()},
                "strengths": result["strengths"],
                "concerns": result["concerns"],
                "recommendation": result["recommendation"],
            }
        )

    naive_top = naive_results[0]["name"] if naive_results else (signal_results[0]["name"] if signal_results else "")
    signal_top = signal_results[0]["name"] if signal_results else ""

    return {
        "job_title": jd["title"],
        "naive_top": naive_top,
        "signalrank_top": signal_top,
        "ranking_corrected": naive_top != signal_top,
        "candidates": ranked,
    }

