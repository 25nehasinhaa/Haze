from dataclasses import dataclass


@dataclass
class EvaluationResult:
    top_candidate_correct: bool
    hidden_gem_promoted: bool
    keyword_stuffer_demoted: bool
    score: float


def evaluate_demo_ranking(ranking: dict) -> EvaluationResult:
    positions = {candidate["name"]: candidate["rank"] for candidate in ranking["candidates"]}
    top_candidate_correct = ranking["signalrank_top"] == "Meera Evidence"
    hidden_gem_promoted = positions["Riya HiddenGem"] < positions["Aarav Keyword"]
    keyword_stuffer_demoted = positions["Aarav Keyword"] > 2
    score = 100 * sum([top_candidate_correct, hidden_gem_promoted, keyword_stuffer_demoted]) / 3
    return EvaluationResult(
        top_candidate_correct=top_candidate_correct,
        hidden_gem_promoted=hidden_gem_promoted,
        keyword_stuffer_demoted=keyword_stuffer_demoted,
        score=round(score, 2),
    )

