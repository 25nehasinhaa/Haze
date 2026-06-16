# SignalRank

SignalRank is an AI-powered hiring intelligence platform that ranks candidates
by evidence quality, not resume polish. It detects keyword-heavy profiles,
stale skills, unsupported claims, transferable strengths, and hidden-gem
candidates.

The project is built for a zero-budget hackathon setup using only free and
open-source tools.

## What Is Implemented

- Data ingestion and validation with Pydantic.
- Preprocessing and feature extraction.
- Free local TF-IDF embedding fallback with scikit-learn.
- Retrieval pipeline.
- Naive keyword baseline.
- Evidence-based SignalRank ranking.
- Re-ranking through evidence, recency, SNR, domain fit, and gap penalties.
- Explainability pipeline with recruiter insights and interview probes.
- Evaluation framework.
- FastAPI backend.
- Premium React/Tailwind frontend structure.
- Streamlit prototype/demo app.
- Unit and API tests.

## Free Technology Stack

- Backend: Python, FastAPI, Pydantic
- ML: pandas, NumPy, scikit-learn
- Embeddings: local TF-IDF fallback, ready for BGE/E5 extension
- Frontend: React, Vite, Tailwind CSS, Framer Motion, Recharts
- Demo UI: Streamlit
- Deployment options: Hugging Face Spaces, Render free tier, GitHub Pages for static frontend

## Backend Run

```powershell
pip install -r requirements.txt
python -m uvicorn backend.app.main:app --reload --port 8000
```

API endpoints:

- `GET /api/health`
- `GET /api/demo`
- `POST /api/rank`
- `GET /api/evaluate`

## Frontend Run

```powershell
cd frontend
npm install
npm run dev
```

The frontend defaults to:

```text
http://127.0.0.1:8000/api
```

## Streamlit Demo Run

```powershell
streamlit run app.py
```

## Tests

```powershell
python -m unittest discover -s tests
```

## Core Demo Moment

The naive keyword ranker promotes `Aarav Keyword`. SignalRank promotes
`Meera Evidence` because her profile has stronger, fresher, role-relevant
evidence. `Riya HiddenGem` beats the keyword-stuffed candidate because her
anomaly detection and monitoring evidence transfers well to fraud detection.

