from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class LocalTfidfEmbedder:
    """Zero-download embedding fallback for hackathon environments."""

    def __init__(self) -> None:
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
        self.matrix = None

    def fit(self, documents: list[str]) -> None:
        self.matrix = self.vectorizer.fit_transform(documents)

    def query(self, text: str):
        return self.vectorizer.transform([text])

    def similarities(self, text: str) -> list[float]:
        if self.matrix is None:
            raise RuntimeError("Embedder must be fit before querying.")
        scores = cosine_similarity(self.query(text), self.matrix)[0]
        return [float(score) for score in scores]

