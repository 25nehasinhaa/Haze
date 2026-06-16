# Architecture Audit

## Backend

The backend is modular and production-shaped:

- `ingestion.py`: loads and validates job/candidate data.
- `preprocessing.py`: normalizes candidate and JD documents.
- `embeddings.py`: provides a zero-download embedding fallback.
- `retrieval.py`: performs candidate retrieval.
- `ranking.py`: combines naive rank and SignalRank rank.
- `explainability.py`: generates recruiter-facing insights and metrics.
- `evaluation.py`: validates the demo behavior.
- `api.py`: exposes health, demo, rank, and evaluation endpoints.

## AI/ML Pipeline

The current implementation avoids paid APIs and heavyweight model downloads.
It uses TF-IDF embeddings for retrieval and deterministic explainable ranking.
This is intentional for hackathon reliability. The embedding layer can later be
swapped with BGE/E5 sentence-transformers and FAISS without changing API
contracts.

## Frontend

The React frontend follows the fixed luxury palette:

- Primary Accent: `#FF6D29`
- Secondary: `#453027`
- Background: `#161316`
- Neutral Gray: `#BABABA`
- White: `#FFFFFF`

It includes landing, dashboard, ranking, candidate detail, explainability, and
analytics screens.

## Remaining Deployment Work

- Install frontend npm packages.
- Run `npm run build`.
- Deploy backend to Render free tier or Hugging Face Spaces.
- Deploy frontend to GitHub Pages, Vercel free tier, or Render static site.

