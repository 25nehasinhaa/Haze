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

