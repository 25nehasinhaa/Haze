from src.scoring.signalrank import EVIDENCE_WEIGHTS, recency_factor


def evidence_density(candidate: dict) -> float:
    if not candidate.get("evidence"):
        return 0.0
    return sum(EVIDENCE_WEIGHTS[item["level"]] for item in candidate["evidence"]) / len(candidate["evidence"])


def unsupported_claim_count(candidate: dict) -> int:
    return sum(1 for item in candidate.get("evidence", []) if item["level"] == "unsupported")


def stale_claim_count(candidate: dict) -> int:
    return sum(1 for item in candidate.get("evidence", []) if recency_factor(item["last_used"]) < 0.5)


def career_velocity(candidate: dict) -> float:
    events = sorted(candidate.get("career_events", []), key=lambda item: item["year"])
    if len(events) < 2:
        return 0.5
    span = max(events[-1]["year"] - events[0]["year"], 1)
    return min(len(events) / span, 1.0)

