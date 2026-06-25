"""
Evaluation module.
- evaluate_ranking(): generic evaluation for any ranking result
- evaluate_demo_ranking(): legacy demo-specific evaluation (4 synthetic candidates)
"""
from dataclasses import dataclass


@dataclass
class EvaluationResult:
    top_candidate_correct: bool
    hidden_gem_promoted: bool
    keyword_stuffer_demoted: bool
    score: float
    notes: list[str]


def evaluate_ranking(ranking: dict) -> EvaluationResult:
    """
    Generic evaluation that works with both demo and real dataset.
    Checks structural properties of a good ranking:
    1. Top candidate has trust_label indicating quality
    2. Ranking correction happened (SignalRank ≠ naive)
    3. No keyword-heavy/weak-evidence candidates in top 3
    """
    candidates = ranking.get("candidates", [])
    notes = []

    if not candidates:
        return EvaluationResult(False, False, False, 0.0, ["No candidates to evaluate"])

    top = candidates[0]

    # Check 1: top candidate is a quality match
    top_label = top.get("trust_label", "").lower()
    top_candidate_correct = (
        "verified" in top_label
        or "reliable" in top_label
        or top.get("signal_score", 0) >= 65
    )
    notes.append(
        f"Top candidate '{top['name']}' has trust_label '{top.get('trust_label')}' "
        f"and signal_score {top.get('signal_score')}"
    )

    # Check 2: ranking correction (SignalRank vs naive differ)
    hidden_gem_promoted = ranking.get("ranking_corrected", False)
    notes.append(
        f"Ranking {'was' if hidden_gem_promoted else 'was NOT'} corrected by SignalRank"
    )

    # Check 3: keyword stuffers not in top 3
    top3 = candidates[:3]
    keyword_stuffers_in_top3 = [
        c["name"] for c in top3
        if "keyword" in c.get("trust_label", "").lower()
        or "weak evidence" in c.get("trust_label", "").lower()
    ]
    keyword_stuffer_demoted = len(keyword_stuffers_in_top3) == 0
    if keyword_stuffers_in_top3:
        notes.append(f"Keyword-heavy profiles in top 3: {keyword_stuffers_in_top3}")
    else:
        notes.append("No keyword-heavy profiles in top 3")

    score = 100 * sum([top_candidate_correct, hidden_gem_promoted, keyword_stuffer_demoted]) / 3
    return EvaluationResult(
        top_candidate_correct=top_candidate_correct,
        hidden_gem_promoted=hidden_gem_promoted,
        keyword_stuffer_demoted=keyword_stuffer_demoted,
        score=round(score, 2),
        notes=notes,
    )


def evaluate_demo_ranking(ranking: dict) -> EvaluationResult:
    """Legacy: evaluate against the 4 demo synthetic candidates by name."""
    candidates = ranking.get("candidates", [])
    positions = {c["name"]: c["rank"] for c in candidates}
    notes = []

    top_candidate_correct = ranking.get("signalrank_top") == "Meera Evidence"
    notes.append(f"Top candidate: {ranking.get('signalrank_top')} (expected: Meera Evidence)")

    riya_pos = positions.get("Riya HiddenGem", 99)
    aarav_pos = positions.get("Aarav Keyword", 99)
    hidden_gem_promoted = riya_pos < aarav_pos
    notes.append(f"Riya rank={riya_pos}, Aarav rank={aarav_pos}")

    keyword_stuffer_demoted = aarav_pos > 2
    notes.append(f"Aarav Keyword rank={aarav_pos} (expected > 2)")

    score = 100 * sum([top_candidate_correct, hidden_gem_promoted, keyword_stuffer_demoted]) / 3
    return EvaluationResult(
        top_candidate_correct=top_candidate_correct,
        hidden_gem_promoted=hidden_gem_promoted,
        keyword_stuffer_demoted=keyword_stuffer_demoted,
        score=round(score, 2),
        notes=notes,
    )
