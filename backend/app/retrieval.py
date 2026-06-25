from backend.app.embeddings import LocalTfidfEmbedder
from backend.app.preprocessing import candidate_document, jd_document


class CandidateRetriever:
    def __init__(self) -> None:
        self.embedder = LocalTfidfEmbedder()
        self.candidates: list[dict] = []

    def index(self, candidates: list[dict]) -> None:
        self.candidates = candidates
        self.embedder.fit([candidate_document(candidate) for candidate in candidates])

    def retrieve(self, jd: dict, top_k: int | None = None) -> list[dict]:
        scores = self.embedder.similarities(jd_document(jd))
        ranked = sorted(
            [
                {
                    "candidate": candidate,
                    "retrieval_score": score,
                }
                for candidate, score in zip(self.candidates, scores)
            ],
            key=lambda item: item["retrieval_score"],
            reverse=True,
        )
        return ranked[:top_k] if top_k else ranked


# ---------------------------------------------------------------------------
# Process-level cache: building the TF-IDF index over 100k candidate
# documents costs ~20s. Cache the fitted retriever keyed by the identity of
# the candidate list object (id()) plus its length, so repeated calls with
# the same (cached) candidate list reuse the index instead of rebuilding it.
# ---------------------------------------------------------------------------

_RETRIEVER_CACHE: dict[tuple, "CandidateRetriever"] = {}


def get_cached_retriever(candidates: list[dict]) -> CandidateRetriever:
    key = (id(candidates), len(candidates))
    if key not in _RETRIEVER_CACHE:
        retriever = CandidateRetriever()
        retriever.index(candidates)
        _RETRIEVER_CACHE[key] = retriever
    return _RETRIEVER_CACHE[key]


def clear_retriever_cache() -> None:
    _RETRIEVER_CACHE.clear()

