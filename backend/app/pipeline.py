from backend.app.explainability import aggregate_metrics, build_platform_insights
from backend.app.ranking import rank_candidates
from backend.app.retrieval import CandidateRetriever


def run_hiring_pipeline(jd: dict, candidates: list[dict]) -> dict:
    retriever = CandidateRetriever()
    retriever.index(candidates)
    retrieved = retriever.retrieve(jd)
    ordered_candidates = [item["candidate"] for item in retrieved]
    ranking = rank_candidates(jd, ordered_candidates)
    ranking["insights"] = build_platform_insights(ranking)
    ranking["metrics"] = aggregate_metrics(ranking)
    return ranking

