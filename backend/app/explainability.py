def build_platform_insights(ranking: dict) -> list[str]:
    insights = []
    if ranking["ranking_corrected"]:
        insights.append(
            f"SignalRank corrected the naive shortlist: {ranking['naive_top']} was replaced by {ranking['signalrank_top']} after evidence validation."
        )

    top = ranking["candidates"][0]
    insights.append(
        f"{top['name']} is the strongest current match with {top['signal_score']} SignalRank score and {top['snr']} SNR."
    )

    weak_profiles = [candidate["name"] for candidate in ranking["candidates"] if "weak evidence" in candidate["trust_label"].lower()]
    if weak_profiles:
        insights.append(f"Resume inflation risk detected for: {', '.join(weak_profiles)}.")

    hidden_gems = [
        candidate["name"]
        for candidate in ranking["candidates"]
        if candidate["domain_alignment"] < 50 and candidate["semantic_fit"] >= 65
    ]
    if hidden_gems:
        insights.append(f"Hidden-gem candidates with transferable evidence: {', '.join(hidden_gems)}.")

    return insights


def aggregate_metrics(ranking: dict) -> dict[str, float]:
    candidates = ranking["candidates"]
    count = max(len(candidates), 1)
    return {
        "average_signal_score": round(sum(item["signal_score"] for item in candidates) / count, 2),
        "average_snr": round(sum(item["snr"] for item in candidates) / count, 2),
        "verified_matches": float(sum(1 for item in candidates if "verified" in item["trust_label"].lower())),
        "risk_profiles": float(sum(1 for item in candidates if "risky" in item["trust_label"].lower() or "weak evidence" in item["trust_label"].lower())),
    }

