from collections import Counter


def tokenize(text: str) -> list[str]:
    cleaned = "".join(char.lower() if char.isalnum() else " " for char in text)
    return [token for token in cleaned.split() if len(token) > 2]


def rank_by_naive_keyword_overlap(jd: dict, candidates: list[dict]) -> list[dict]:
    jd_terms = set(jd["must_have_skills"] + jd["nice_to_have_skills"] + jd["domains"])
    jd_tokens = Counter(token for term in jd_terms for token in tokenize(term))

    results = []
    for candidate in candidates:
        text = " ".join(
            [
                candidate["headline"],
                candidate["summary"],
                " ".join(candidate["skills"]),
                " ".join(candidate["domains"]),
            ]
        )
        candidate_tokens = Counter(tokenize(text))
        overlap = sum(min(count, candidate_tokens[token]) for token, count in jd_tokens.items())
        score = 100 * overlap / max(sum(jd_tokens.values()), 1)
        results.append(
            {
                "name": candidate["name"],
                "keyword_score": score,
                "candidate": candidate,
            }
        )

    return sorted(results, key=lambda item: item["keyword_score"], reverse=True)

