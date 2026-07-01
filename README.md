# HAZE — AI Hiring Intelligence Platform

> **India Runs Data & AI Challenge 2026** · Track 01: Intelligent Candidate Discovery

HAZE is an evidence-based AI hiring intelligence platform that ranks candidates the way a great recruiter would — not by matching keywords, but by validating claims, detecting hidden gems, and explaining every decision.

**Live at:** `http://localhost:8000` after setup

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- The official challenge dataset (`candidates.jsonl`, `job_description.docx`)

### 1. Clone
```bash
git clone https://github.com/25nehasinhaa/Haze.git
cd Haze
```

### 2. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 3. Add the dataset
Copy these files into `data/`:
```
data/
├── candidates.jsonl          # 100k candidate dataset (~475 MB)
├── job_description.docx      # Official challenge JD
├── candidate_schema.json
└── sample_candidates.json
```

### 4. Build the frontend
```bash
cd frontend
npm install
npm run build
cd ..
```

### 5. Start the server
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

### 6. Open HAZE
```
http://localhost:8000
```

> **Note:** The first dataset ranking call takes ~35s (cold cache — loading 100k candidates + building TF-IDF index). All subsequent calls are ~1s. The cache pre-warms automatically in the background at startup.

---

## 🎯 What HAZE Does

| Problem | HAZE's Solution |
|---|---|
| Keyword stuffers rank #1 in ATS | SignalRank demotes them after evidence validation |
| Hidden gems buried below page 3 | Transfer-credit scoring surfaces adjacent skill matches |
| No explanation for rankings | Full explainability: SNR, evidence scores, interview probes |
| Resume analysis takes hours | AI Career Coach: instant ATS score, gap analysis, roadmap |

---

## ✨ Features

### Recruiter Mode
- **Demo Mode** — 4 synthetic candidates showing ranking correction live
- **Dataset Mode** — Rank all 100k challenge candidates, return top N
- **Upload Mode** — Upload your own JDs + resumes (PDF/TXT), blend with dataset
- **Candidate Compare** — Side-by-side radar chart for 2–4 candidates
- **Explainability** — 8-factor breakdown, SNR, skill scores, interview probes
- **CSV Export** — One-click submission file, passes `validate_submission.py`

### AI Career Coach
- **Match Score** — SignalRank score vs target JD
- **ATS Score** — Keyword overlap with JD must-haves
- **Recruiter Confidence** — Composite of evidence strength + SNR
- **Interview & Offer Probability** — Heuristic based on score + gap count
- **Hire / Consider / Reject** — Explicit recruiter recommendation
- **Skill Gap Analysis** — Missing must-haves, weak skills, missing keywords
- **Resume Improvements** — Specific, actionable suggestions
- **Learning Roadmap** — Prioritised with timelines + impact ratings
- **Suggested Certifications** — 30+ mapped to specific skills
- **Suggested Projects** — Hands-on portfolio projects per gap
- **Action Plan** — Immediate / 30-day / 90-day steps

---

## 🏗️ Architecture

```
HAZE/
├── backend/
│   └── app/
│       ├── main.py              # FastAPI app + SPA serving
│       ├── api.py               # All API endpoints
│       ├── pipeline.py          # Ranking orchestrator
│       ├── dataset_adapter.py   # JSONL converter + caching
│       ├── retrieval.py         # TF-IDF retriever (cached)
│       ├── schemas.py           # Pydantic models
│       ├── text_parser.py       # Resume + JD text extraction
│       └── evaluation.py        # Ranking evaluator
├── src/
│   └── scoring/
│       └── signalrank.py        # 8-factor scoring engine ← core IP
├── frontend/
│   └── src/
│       ├── App.tsx              # Full React app
│       ├── api.ts               # API client
│       └── types.ts             # TypeScript types
├── data/                        # Dataset files (gitignored)
├── tests/                       # 5 pytest tests
└── validate_submission.py       # Official challenge validator
```

---

## 🔬 SignalRank Scoring Engine

8-factor weighted scoring formula:

| Factor | Weight | What it measures |
|---|---|---|
| Semantic Fit | 24% | Skill-level evidence match against JD must-haves |
| Evidence Strength | 22% | Quality of proof: strong / partial / weak / unsupported |
| Recency | 13% | How recent the evidence is (decay: 1yr=100%, 5yr=45%) |
| Domain Alignment | 12% | Industry/domain overlap with JD |
| Experience Match | 10% | Years of experience vs role requirements |
| Career Growth | 8% | Role progression, leadership signals |
| Behavioral Fit | 6% | Ownership, production, cross-functional signals |
| Confidence | 5% | Evidence coverage vs critical gaps |

**Plus:**
- Transfer credit for adjacent skills (e.g. Spark → PySpark: 0.9)
- Availability modifier (redrob signals: open-to-work, response rate, notice period)
- Deduplication by `candidate_id` with deterministic tie-breaking

---

## 📡 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/demo` | Demo ranking (4 synthetic candidates) |
| `POST` | `/api/rank-dataset` | Rank from 100k dataset |
| `POST` | `/api/upload/rank` | Upload JD + resumes + blend |
| `POST` | `/api/career-coach` | Full career analysis report |
| `GET` | `/api/export/submission` | Download validated CSV |
| `GET` | `/api/candidate/{id}` | Candidate detail from dataset |
| `GET` | `/api/evaluate` | Evaluate ranking quality |

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend | FastAPI | Async, fast, OpenAPI docs auto-generated |
| Scoring | Custom SignalRank (Python) | No paid APIs, full control, explainable |
| Retrieval | TF-IDF + cosine similarity | Zero-download, fast pre-filter over 100k |
| PDF Parsing | pdfminer.six | Reliable text extraction, no cloud dependency |
| Frontend | React + Vite + Tailwind | Fast build, type-safe, component-level performance |
| Animations | Framer Motion | 3D tilt cards, score ring animations |
| Charts | Recharts | Radar, bar charts for explainability |
| Caching | Process-level (Python dict) | ~1s warm response vs ~35s cold |

---

## 📊 Performance

| Metric | Value |
|---|---|
| Cold start (100k candidates) | ~35s |
| Warm request (cached index) | ~1s |
| Demo mode | Instant |
| validate_submission.py | ✅ Submission is valid |
| pytest | 5/5 pass |
| End-to-end QA | 26/26 pass |

---

## 🧪 Testing

```bash
# Run test suite
python3 -m pytest tests/ -v

# Validate submission CSV
python3 validate_submission.py path/to/submission.csv

# Generate and validate in one step
curl -o submission.csv http://localhost:8000/api/export/submission
python3 validate_submission.py submission.csv
```

---

## 👤 Author

**Neha Sinha** — Data Engineer & AI Builder  
[LinkedIn](https://www.linkedin.com/in/nehasinhaa/) · [GitHub](https://github.com/25nehasinhaa)  
Core Contributor, CYPHER 2025 — India's Largest AI Summit

---

## 📄 Submission

This project is submitted to the **India Runs Data & AI Challenge 2026**, Track 01: Intelligent Candidate Discovery.

| Deliverable | Status |
|---|---|
| GitHub Repository | ✅ Public |
| Ranked Output CSV | ✅ Generated via `/api/export/submission` |
| Presentation | ✅ Included |
| Working Demo | ✅ `uvicorn backend.app.main:app --host 0.0.0.0 --port 8000` |
