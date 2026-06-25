# FINAL_READINESS_REPORT.md
> HAZE / SignalRank — End-to-End Validation & Readiness
> Generated: 2026-06-20

---

## 1. Workflow Traced

```
JD upload (DOCX/text) ──┐
                         ├──> dataset_adapter / text_parser ──> canonical JD dict
Resume upload (text)  ──┘                                            │
                                                                       ▼
Dataset candidates (JSONL, 100k) ──> dataset_adapter ──> canonical candidate dicts
                                                                       │
                                                                       ▼
                                                CandidateRetriever (TF-IDF pre-filter)
                                                                       │
                                                                       ▼
                                                  SignalRank (src/scoring/signalrank.py)
                                                                       │
                                                                       ▼
                                          Availability modifier (redrob signals, real data only)
                                                                       │
                                                                       ▼
                                              Dedup by candidate_id + re-rank
                                                                       │
                                                                       ▼
                                    Explainability (insights, strengths, concerns, probes)
                                                                       │
                                                                       ▼
                                  RankingResponse JSON  ──or──  CSV submission export
```

All 8 stages verified working end-to-end with real dataset, uploaded resumes, and uploaded job descriptions.

---

## 2. Completed Features

| Feature | Status |
|---|---|
| JSONL streaming ingestion (100k candidates) | ✅ |
| Real dataset → internal schema converter (`dataset_adapter.py`) | ✅ |
| DOCX job description parsing | ✅ |
| Free-text JD parsing (`/text-rank`, `/upload/rank`) | ✅ |
| Free-text resume parsing with skill/evidence/years-of-experience extraction | ✅ |
| Candidate name extraction from resume content (not filename) | ✅ |
| Shared canonical skill vocabulary across all 4 entry points (dataset JD, dataset candidates, uploaded JD, uploaded resume) | ✅ |
| SignalRank scoring (8-factor weighted, transfer credit, evidence levels, SNR) | ✅ |
| Redrob behavioral signals → availability modifier | ✅ |
| Candidate dedup by `candidate_id` (fixes duplicate-name collisions) | ✅ |
| Explainability: strengths, concerns, recommendation, interview probes, platform insights | ✅ |
| Evaluation module — generic (works on any ranking) + legacy demo-specific | ✅ |
| CSV submission export with correct tie-breaking and dedup | ✅ |
| Official `validate_submission.py` — **passes** | ✅ |
| `/candidate/{id}` lookup endpoint | ✅ |
| Process-level caching (dataset load + TF-IDF index) | ✅ |
| Startup cache pre-warming (`lifespan` handler) | ✅ |
| All 5 original pytest tests pass | ✅ |

---

## 3. Issues Found and Fixed (this session)

| # | Issue | Fix |
|---|---|---|
| 1 | `CandidateRank` schema had 7 fields (`strengths`, `concerns`, `recommendation`, `experience_match`, `career_growth`, `behavioral_fit`, `confidence`) never populated by `ranking.py` | Rewrote `ranking.py` to emit all schema fields |
| 2 | No JSONL ingestion existed | Built `dataset_adapter.py`: streaming loader, full record→schema converter, evidence synthesis from skills/career history/certifications/GitHub/redrob signals |
| 3 | JD must-have skills (`embeddings`, `vector database`, `python`...) didn't match actual dataset skill vocabulary (`vector search`, `sentence transformers`...) | Rebuilt `SKILL_ALIASES` and `TRANSFER_MAP` in `signalrank.py` against real dataset skill-name frequency analysis; rebuilt JD skill extraction in `dataset_adapter._extract_jd_from_text` |
| 4 | `trust_label`/`recommendation`/`strengths`/`concerns` thresholds calibrated for demo data (signal_score 70-95) caused every real candidate to show "Risky or incomplete fit" (real scores cluster 30-70) | Recalibrated all thresholds against real dataset score distribution |
| 5 | Duplicate `candidate_id`s in ranked output (validator failure) — caused by name-based lookup colliding when dataset has non-unique names | Pipeline now dedups by `candidate_id`, re-ranks after dedup |
| 6 | CSV export had no deterministic tie-breaking — validator failed on duplicate IDs and out-of-order ties | Rewrote `export_submission_csv`: sorts by `(-score, candidate_id)`, guarantees uniqueness, exact `top_n` rows |
| 7 | `/api/rank-dataset` took **71s** per request — unusable interactively | Removed wasteful `top_k * 3` over-retrieval (→34s); added process-level cache for loaded dataset + TF-IDF index (→1.1s on cache hit, 31x speedup); added FastAPI `lifespan` startup hook to pre-warm cache so first real user request is fast (~1.2s) |
| 8 | `evaluation.py` hardcoded to 4 demo candidate names — always scored 0 on real data | Added generic `evaluate_ranking()` (structural checks) alongside preserved `evaluate_demo_ranking()` (legacy) |
| 9 | `text_parser.py` had a separate, stale skill/domain keyword list disconnected from `dataset_adapter.py`'s vocabulary — uploaded resumes and uploaded JDs couldn't match dataset candidates or each other | Rebuilt `SKILL_KEYWORDS`/`DOMAIN_KEYWORDS` aligned to canonical vocabulary; `extract_skills()` now normalizes through `signalrank.normalize_skill()`; `parse_job_description_text()` now delegates to `dataset_adapter._extract_jd_from_text()` so all 4 JD/resume entry points share one skill taxonomy |
| 10 | Uploaded resume candidates had no `years_of_experience`, causing `experience_match` to fall back to sparse career-event counting and score artificially low vs. dataset candidates | Added `extract_years_of_experience()` (regex on "N years experience" patterns) + `years_of_experience`/`current_title` fields added to `CandidateProfile` schema |
| 11 | `/api/upload/rank` used the **uploaded filename** as the candidate's display name (`resume.txt` → `"resume"`) instead of the name written in the resume | Added `_extract_name_from_resume()` — parses first line of resume text for a plausible name pattern, falls back to filename only if no name detected |
| 12 | `python-multipart` not declared in `requirements.txt` (required for FastAPI file uploads) | Added to `requirements.txt` |
| 13 | `@app.on_event("startup")` deprecated in current FastAPI | Migrated to `lifespan` async context manager |

---

## 4. Validation Results

### Recruiter simulation (1 JD, multiple dataset candidates, `top_k=15`)
```
Top match: Ira Dalal — Senior AI Engineer — score 93.3 — Verified strong match
  Evidence-backed, recent, strong career growth, behavioral fit, full skill coverage
  No critical gaps. Risk flag: 2 stale (non-blocking) evidence items.
Insights generated:
  - "SignalRank corrected the naive shortlist: Anika Rao was replaced by Ira Dalal after evidence validation."
  - "Ira Dalal is the strongest current match with 93.3 SignalRank score and 3.08 SNR."
  - "Hidden-gem candidates with transferable evidence: Ira Dalal, Myra Krishnan, Aarav Agarwal, Suresh Subramanian."
Metrics: avg_signal_score=35.19, avg_snr=0.46, verified_matches=7, risk_profiles=33
```

### Submission CSV validator
```
$ python3 validate_submission.py /tmp/final2.csv
Submission is valid.
```

### Performance (100k candidates)
| Call | Time |
|---|---|
| Cold (first request, no pre-warm) | 34s |
| Cached (subsequent requests) | **1.1–1.8s** |
| Cold with `lifespan` pre-warm at server startup | first user request: **1.2s** |

### Test suite
```
5 passed, 1 warning (deprecation, unrelated to HAZE code) in 1.26s
```

### Edge cases verified
- Resume upload blended with 3000 dataset candidates → correctly ranked by name (not filename) ✅
- Job description provided as DOCX, as raw text, or omitted (falls back to challenge JD) ✅
- `/candidate/{id}` — valid ID returns full profile; invalid ID returns 404 ✅
- Duplicate-name dataset candidates no longer collapse into one output row ✅

---

## 5. Remaining Issues

| Issue | Severity | Notes |
|---|---|---|
| Frontend (`frontend/`) not rebuilt against the new 7-field `CandidateRank` schema | Medium | `frontend/src/types.ts` and `App.tsx` predate this session's schema fixes; needs a pass to render `strengths`/`concerns`/`recommendation`/etc. and wire `/upload/rank` to the Upload JD button |
| `frontend/node_modules` not installed, no `npm run build` run | Medium | Out of scope per this session's "backend only" instruction |
| TF-IDF retrieval (not true semantic embeddings) | Low | Functional and fast; real sentence-transformer embeddings would improve recall but add latency/dependency weight — acceptable tradeoff for hackathon scope |
| `years_of_experience` extraction from resume text is regex-based (pattern: "N years experience") | Low | Works for common phrasing; resumes that state experience differently (e.g. just listing job date ranges) fall back to career-event-based estimate, which is less precise |
| Cache (`_CANDIDATE_CACHE`, `_RETRIEVER_CACHE`) is process-local, in-memory only | Low | Fine for a single-process demo/hackathon deployment; would need Redis or similar for multi-worker production deployment |
| `filter_open_to_work=True` creates a separate cache entry, doubling memory if both filters are used in the same session | Low | Acceptable for demo; monitor memory if used at scale |

---

## 6. Readiness Scores

### Hackathon readiness: **9.5 / 10**
- All 3 required deliverables functional: working code, ranking logic with documented methodology, valid submission CSV.
- End-to-end demo path proven: dataset ranking, resume upload, JD upload, explainability, evaluation — all tested live.
- Official validator passes cleanly.
- Remaining 0.5: frontend needs a short pass to surface the new explainability fields before a live demo.

### Production readiness: **6 / 10**
- Backend logic, scoring, and data pipeline are solid and tested.
- Missing for production: persistent caching layer, authentication, rate limiting, structured logging/monitoring, frontend rebuild, async/streaming for very large uploads, automated CI running `tests/` + `validate_submission.py` on every change.

---

## 7. Files Modified This Session

```
backend/app/schemas.py          (+years_of_experience, +current_title fields)
backend/app/ranking.py          (emit all 7 missing CandidateRank fields)
backend/app/pipeline.py         (availability modifier, dedup, caching, re-rank)
backend/app/api.py              (rank-dataset, upload/rank, export/submission,
                                  candidate detail, name-from-resume extraction)
backend/app/evaluation.py       (generic evaluate_ranking + legacy demo eval)
backend/app/preprocessing.py    (handle real dataset fields in TF-IDF documents)
backend/app/text_parser.py      (canonical skill vocabulary, years-of-experience
                                  extraction, delegates JD parsing to dataset_adapter)
backend/app/retrieval.py        (cached retriever)
backend/app/main.py             (lifespan startup cache warm-up)
backend/app/dataset_adapter.py  (NEW — JSONL loader, schema converter, JD DOCX
                                  parser, CSV exporter, availability scorer, caching)
src/scoring/signalrank.py       (dataset-aligned SKILL_ALIASES/TRANSFER_MAP,
                                  recalibrated trust_label/recommendation thresholds)
requirements.txt                (+python-docx, +python-multipart)
data/                            (challenge dataset files copied in)
validate_submission.py          (copied from challenge package)
submission_metadata_template.yaml (copied from challenge package)
```
