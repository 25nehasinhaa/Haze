from backend.app.explainability import aggregate_metrics, build_platform_insights
from backend.app.ranking import rank_candidates
from backend.app.retrieval import CandidateRetriever, get_cached_retriever
from backend.app.dataset_adapter import compute_availability_score


def run_hiring_pipeline(
    jd: dict,
    candidates: list[dict],
    top_k: int | None = None,
    apply_availability_modifier: bool = True,
    use_cache: bool = False,
) -> dict:
    """
    Full ranking pipeline:
    1. TF-IDF retrieval pre-filter
    2. SignalRank scoring
    3. Availability modifier (redrob signals)
    4. Explainability + metrics

    use_cache=True reuses a process-level cached TF-IDF index when the same
    `candidates` list object is passed repeatedly (e.g. the full dataset
    loaded once via load_jsonl_candidates_cached). This avoids rebuilding
    the ~100k-document TF-IDF index (~20s) on every request.
    """
    if use_cache:
        retriever = get_cached_retriever(candidates)
    else:
        retriever = CandidateRetriever()
        retriever.index(candidates)

    retrieved = retriever.retrieve(jd, top_k=top_k)
    ordered_candidates = [item["candidate"] for item in retrieved]

    ranking = rank_candidates(jd, ordered_candidates)

    # Build index by position (not name, since names can duplicate in real dataset)
    # We tag each candidate with its index in ordered_candidates before ranking
    # and use that to look up redrob_signals safely.
    candidate_by_id: dict[str, dict] = {}
    for c in ordered_candidates:
        cid = c.get("candidate_id") or c.get("name", "")
        if cid and cid not in candidate_by_id:
            candidate_by_id[cid] = c

    # Apply availability modifier for JSONL dataset candidates
    if apply_availability_modifier:
        for candidate_result in ranking["candidates"]:
            name = candidate_result["name"]
            # Find the original candidate: try by matching name + dedup safely
            orig = None
            for c in ordered_candidates:
                if c.get("name") == name and c.get("redrob_signals"):
                    orig = c
                    break

            if orig and orig.get("redrob_signals"):
                availability = compute_availability_score(orig["redrob_signals"])
                raw = candidate_result["signal_score"]
                candidate_result["signal_score"] = round(
                    0.80 * raw + 0.20 * availability * 100, 2
                )
                candidate_result["availability_score"] = round(availability, 3)

            if orig:
                candidate_result["candidate_id"] = orig.get("candidate_id", "")
                candidate_result["current_title"] = orig.get("current_title", "")
                candidate_result["years_of_experience"] = orig.get("years_of_experience", 0)

        # Re-sort after availability adjustment
        ranking["candidates"].sort(key=lambda c: c["signal_score"], reverse=True)

        # Deduplicate by candidate_id (keep highest scored occurrence)
        seen_ids: set[str] = set()
        deduped = []
        for c in ranking["candidates"]:
            cid = c.get("candidate_id") or c["name"]
            if cid not in seen_ids:
                seen_ids.add(cid)
                deduped.append(c)
        ranking["candidates"] = deduped

        # Re-assign ranks after dedup
        for i, c in enumerate(ranking["candidates"], start=1):
            c["rank"] = i

        if ranking["candidates"]:
            ranking["signalrank_top"] = ranking["candidates"][0]["name"]

    ranking["insights"] = build_platform_insights(ranking)
    ranking["metrics"] = aggregate_metrics(ranking)
    return ranking
