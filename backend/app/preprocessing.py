import re


TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9+#.]+")


def normalize_text(value: str) -> str:
    return " ".join(TOKEN_PATTERN.findall(value.lower()))


def candidate_document(candidate: dict) -> str:
    evidence_text = " ".join(item["source"] for item in candidate.get("evidence", []))
    events = " ".join(item["event"] for item in candidate.get("career_events", []))
    return " ".join(
        [
            candidate.get("headline", ""),
            candidate.get("summary", ""),
            " ".join(candidate.get("skills", [])),
            " ".join(candidate.get("domains", [])),
            evidence_text,
            events,
        ]
    )


def jd_document(jd: dict) -> str:
    return " ".join(
        [
            jd.get("title", ""),
            jd.get("summary", ""),
            " ".join(jd.get("must_have_skills", [])),
            " ".join(jd.get("nice_to_have_skills", [])),
            " ".join(jd.get("domains", [])),
            " ".join(jd.get("seniority_signals", [])),
        ]
    )

