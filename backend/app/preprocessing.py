import re

TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9+#./]+")


def normalize_text(value: str) -> str:
    return " ".join(TOKEN_PATTERN.findall(value.lower()))


def candidate_document(candidate: dict) -> str:
    """Build a single text document from a candidate for TF-IDF indexing."""
    parts = [
        candidate.get("headline", ""),
        candidate.get("summary", ""),
        " ".join(candidate.get("skills", [])),
        " ".join(candidate.get("domains", [])),
    ]
    # Evidence sources
    for item in candidate.get("evidence", []):
        parts.append(item.get("source", ""))
        parts.append(item.get("claim", ""))
    # Career events
    for event in candidate.get("career_events", []):
        parts.append(event.get("event", ""))
    # Current title
    parts.append(candidate.get("current_title", ""))
    return " ".join(p for p in parts if p)


def jd_document(jd: dict) -> str:
    """Build a single text document from a JD for TF-IDF retrieval."""
    return " ".join([
        jd.get("title", ""),
        jd.get("summary", ""),
        " ".join(jd.get("must_have_skills", [])),
        " ".join(jd.get("nice_to_have_skills", [])),
        " ".join(jd.get("domains", [])),
        " ".join(jd.get("seniority_signals", [])),
    ])
