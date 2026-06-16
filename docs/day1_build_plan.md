# Day 1 Build Plan

## Goal

Create a working proof that SignalRank can correct a naive resume ranking by
using evidence quality, recency, and signal-to-noise scoring.

## Day 1 Deliverables

- Runnable Streamlit app.
- Sample job description.
- Four candidate profiles designed for a ranking-reversal demo.
- Naive keyword baseline.
- SignalRank evidence scorer.
- Candidate evidence review.
- Risk flags, gaps, and interview probes.

## Demo Moment

The naive ranker promotes `Aarav Keyword` because the profile contains almost
every role keyword. SignalRank promotes `Meera Evidence` because her claims are
recent, role-relevant, and supported by concrete project evidence.

`Riya HiddenGem` becomes the visible hidden-gem candidate: she lacks direct
fraud keywords, but her anomaly detection, streaming, monitoring, and signal
processing evidence transfers well to the role.

## Day 2 Targets

- Add upload support for custom JD and candidate JSON files.
- Add a better evidence heatmap visualization.
- Add optional local embedding model support with sentence-transformers.
- Add lightweight NetworkX evidence graph view.
- Add exportable recruiter brief.

