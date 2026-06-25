# PROJECT_STATE.md
> Haze / SignalRank — Technical Audit
> Generated: 2026-06-17

---

## 1. Current Architecture

### Two parallel entry points (not unified)

| Entry point | Stack | Status |
|---|---|---|
| `app.py` | Streamlit | Runnable |
| `backend/app/main.py` + `frontend/` | FastAPI + React/Vite | Backend runnable; frontend **not built** |

### Backend (FastAPI) — `backend/app/`

```
main.py          FastAPI app, CORS, router mount
api.py           Routes: GET /health, GET /demo, POST /rank, GET /evaluate
config.py        Settings via env vars (pydantic, lru_cache)
schemas.py       Pydantic models: CandidateProfile, JobDescription, RankingRequest/Response
ingestion.py     Loads & validates JSON files into pydantic models
pipeline.py      Orchestrator: index → retrieve → rank → explain → metrics
retrieval.py     CandidateRetriever (TF-IDF index + cosine similarity)
embeddings.py    LocalTfidfEmbedder (sklearn TF-IDF, ngram 1-2, zero-download)
preprocessing.py candidate_document() / jd_document() — text serialisation for TF-IDF
ranking.py       Calls baseline_ranker + signalrank, assembles ranked output dict
explainability.py build_platform_insights() + aggregate_metrics()
evaluation.py    Hardcoded demo-only evaluator (checks named candidates by name)
features.py      Utility fns: evidence_density, unsupported_claim_count, career_velocity
text_parser.py   parse_candidate_text() / parse_job_description_text() — free-text → schema
logging_config.py Standard Python logging setup
```

### src/ (shared scoring & parsing — used by both entry points)

```
src/parsing/loaders.py            load_demo_dataset() — raw JSON load (no validation)
src/scoring/baseline_ranker.py    rank_by_naive_keyword_overlap()
src/scoring/signalrank.py         rank_by_signalrank() — full scoring engine (see §3)
src/explanation/interview_probes.py build_interview_probes()
src/ui/styles.py                  Streamlit CSS + render helpers
```

### Frontend (React/Vite) — `frontend/src/`

```
App.tsx     5 views: Workspace, Ranking, Candidate, Explainability, Analytics
api.ts      fetchDemoRanking() → GET /api/demo only
types.ts    CandidateRank, RankingResponse TypeScript types
data/fallback.ts  Static fallback if API unreachable
```

### Data — `data/`

```
candidates.json       4 synthetic demo candidates (Aarav Keyword, Meera Evidence, Kabir Stale, Riya HiddenGem)
job_description.json  Single hardcoded JD: Senior ML Engineer - Fraud Detection
```

### Tests — `tests/`

```
test_signalrank.py     2 unit tests on src/ scoring (pass on demo data)
test_backend_api.py    3 integration tests against FastAPI (pass on demo data)
```

---

## 2. Existing Functionality

### Ranking engine (`src/scoring/signalrank.py`)
- **Signal score** = weighted sum of 8 sub-scores − penalties:
  - `semantic_fit` (0.24) — avg skill score from evidence/transfer map
  - `evidence_strength` (0.22) — avg EVIDENCE_WEIGHTS across evidence items
  - `recency` (0.13) — avg recency_factor (decay: 1y→1.0, 3y→0.75, 5y→0.45, >5y→0.2)
  - `domain_alignment` (0.12) — domain intersection %
  - `experience_match` (0.10) — years since first career event
  - `career_growth` (0.08) — growth keywords + event density
  - `behavioral_fit` (0.06) — seniority signal keyword matching
  - `confidence` (0.05) — evidence coverage vs gaps
  - Transfer bonus (+15) for cross-domain hidden gems
  - Penalties: −3×unsupported, −1.5×stale, −4×critical_gap
- **TRANSFER_MAP** — partial credit for adjacent skills (e.g. anomaly_detection → fraud_detection: 0.35)
- **SNR** — signal-to-noise ratio across evidence items
- **trust_label** — 5-level categorical label
- **Gaps** — critical vs correctable, keyed to CRITICAL_SKILLS set
- **Risk flags** — unsupported claims, stale evidence, critical gaps, skill inflation
- **Strengths / Concerns / Recommendation** — rule-based natural language

### Retrieval (`backend/app/retrieval.py`)
- TF-IDF (unigram+bigram) cosine similarity pre-filter
- `retrieve(jd, top_k=None)` — returns all candidates ranked by retrieval score
- Retrieval result currently passed directly to ranking (no actual top-k truncation in pipeline)

### Explainability
- `build_platform_insights()` — 2–4 narrative strings (ranking correction, top candidate, inflation risk, hidden gems)
- `aggregate_metrics()` — avg signal_score, avg SNR, verified count, risk profile count
- `build_interview_probes()` — gap-driven and SNR-driven interview questions

### Text ingestion (`backend/app/text_parser.py`)
- `parse_candidate_text()` — keyword extraction → EvidenceItem list → CandidateProfile
- `parse_job_description_text()` — keyword extraction → JobDescription
- Fixed SKILL_KEYWORDS (26), DOMAIN_KEYWORDS (13), BEHAVIORAL_KEYWORDS (9)
- Evidence level inferred from proximity window (140 chars before, 220 after)

### Evaluation (`backend/app/evaluation.py`)
- Checks 3 boolean conditions against **hardcoded candidate names**
- Returns score 0–100 (100 if all 3 pass on demo data)

### Frontend
- 5 rendered views (all functional with fallback data)
- Falls back to `fallback.ts` static data if API unreachable
- Framer Motion animations, Recharts bar + pie charts

---

## 3. Missing Functionality

### Critical missing — blocks hackathon dataset integration

| Missing | Location | Impact |
|---|---|---|
| **JSONL ingestion** — `candidates.jsonl` (475 MB, ~50k+ records) is never loaded | `ingestion.py`, `pipeline.py` | Cannot run on real dataset |
| **Batch/streaming processing** — no chunked loader for large JSONL | `ingestion.py` | OOM on full file |
| **CSV submission output** — no export to `sample_submission.csv` format | Not implemented | Required deliverable |
| **`/rank` POST endpoint wired in frontend** | `api.ts` | Upload JD button is UI-only, no handler |
| **Text upload flow** | `App.tsx` | "Upload JD" button renders but has no onClick |
| **`TextRankingRequest` / `/text-rank` endpoint** | `api.py` | `text_parser.py` exists but no route exposes it |

### Secondary missing

| Missing | Notes |
|---|---|
| **`top_k` retrieval truncation** in pipeline | `retrieve()` always returns all candidates; `top_k` param unused in `pipeline.py` |
| **Real semantic embeddings** | TF-IDF used as placeholder; BGE/E5 mentioned in docs but not wired |
| **Redrob behavioral signals** | `redrob_signals_doc` dataset not mapped into scoring |
| **`candidate_schema.json` validation** | Schema file not used in ingestion; pydantic schema is independent |
| **`validate_submission.py`** | Competition validator not integrated into build/CI |
| **`submission_metadata_template.yaml`** | Not consumed anywhere |
| **Frontend nav routing is decorative** | Sidebar `<a>` tags have no `onClick`; only top nav and mobile buttons change `active` state |
| **Search bar in Ranking view** | Renders as static UI, no filter logic |
| **"Generate brief" button** | Renders, no handler |

---

## 4. Bugs / Broken Integrations

### Type mismatch — backend schema vs frontend types

Backend `CandidateRank` (pydantic, `schemas.py`) exposes:
```
strengths: list[str]
concerns: list[str]
recommendation: str
experience_match: float
career_growth: float
behavioral_fit: float
confidence: float
```
Frontend `CandidateRank` (`types.ts`) is **missing all 7 fields**.
`CandidateDetail` renders `experience_match`, `career_growth`, `behavioral_fit`, `confidence` via the `Metric` component — these will be `undefined` at runtime when API responds.

### Evaluation module is hardcoded to demo data names
`evaluation.py` checks for literal strings `"Meera Evidence"`, `"Riya HiddenGem"`, `"Aarav Keyword"`.
Running `/api/evaluate` against real candidates will always return `score: 0.0`.

### Dual loader inconsistency
`src/parsing/loaders.py::load_demo_dataset()` returns raw `dict` (no validation).
`backend/app/ingestion.py::load_demo_data()` returns validated pydantic models.
`pipeline.py` calls backend ingestion (pydantic), then immediately calls `.model_dump()` — round-trips to dict. `ranking.py` calls `src/scoring/signalrank.py` which expects plain dicts. This works but is fragile.

### Stray build artifacts in repo root
`index.CSzAT3_b.css`, `index.D2ZqaFuW.js.download`, `katex.DB-ngbxj.css` are committed to root — appear to be a partial prior frontend build, not from the current Vite project. Should be in `.gitignore`.

### Frontend not installed / not built
`frontend/node_modules/` does not exist. `npm install` + `npm run build` have not been run. The React frontend cannot serve.

---

## 5. Dataset Integration Points

The hackathon dataset must be wired at these locations:

| File | Integration point | Action needed |
|---|---|---|
| `candidates.jsonl` | `backend/app/ingestion.py` | Add `load_candidates_jsonl(path)` with streaming/chunked reads |
| `candidate_schema.json` | `backend/app/schemas.py` | Reconcile pydantic schema against competition schema fields |
| `job_description.docx` | `backend/app/ingestion.py` or `text_parser.py` | Parse DOCX → `JobDescription` |
| `redrob_signals_doc.docx` | `src/scoring/signalrank.py` | Map behavioral signal definitions into scoring weights |
| `sample_submission.csv` | New export module | Implement ranked output → CSV in submission format |
| `validate_submission.py` | CI / pipeline end | Run post-ranking to verify output format |
| `submission_metadata_template.yaml` | Submission step | Fill and attach to output |

The current `data/candidates.json` (4 records) and `data/job_description.json` are **demo-only** and are not replaced by the real dataset in any existing code path.

---

## 6. Build Status

| Component | Status |
|---|---|
| FastAPI backend | ✅ Importable and runnable (`uvicorn backend.app.main:app`) |
| Streamlit app | ✅ Runnable (`streamlit run app.py`) |
| Python dependencies | ⚠️ Not installed in this environment (`requirements.txt` present) |
| Frontend (`npm install`) | ❌ Not run — `node_modules` absent |
| Frontend (`npm run build`) | ❌ Not run — no `dist/` output |
| Unit tests | ✅ Pass (against 4-candidate demo data only) |
| API integration tests | ✅ Pass (against 4-candidate demo data only) |
| Real dataset pipeline | ❌ Not implemented |
| Submission CSV export | ❌ Not implemented |
