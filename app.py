from pathlib import Path

import pandas as pd
import streamlit as st

from src.parsing.loaders import load_demo_dataset
from src.scoring.baseline_ranker import rank_by_naive_keyword_overlap
from src.scoring.signalrank import rank_by_signalrank
from src.explanation.interview_probes import build_interview_probes
from src.ui.styles import apply_visual_system, render_hero, render_metric_strip, render_rank_cards


st.set_page_config(page_title="SignalRank", page_icon="SR", layout="wide")


def score_badge(value: float) -> str:
    if value >= 80:
        return "Strong"
    if value >= 60:
        return "Moderate"
    if value >= 40:
        return "Weak"
    return "Risky"


def main() -> None:
    apply_visual_system(st)
    render_hero(st)

    jd, candidates = load_demo_dataset(Path("data"))
    naive_results = rank_by_naive_keyword_overlap(jd, candidates)
    signal_results = rank_by_signalrank(jd, candidates)

    st.markdown('<div class="sr-section-label">Role signal map</div>', unsafe_allow_html=True)
    render_metric_strip(
        st,
        [
            ("Must-have skills", str(len(jd["must_have_skills"]))),
            ("Nice-to-have skills", str(len(jd["nice_to_have_skills"]))),
            ("Critical domains", str(len(jd["domains"]))),
            ("Candidate profiles", str(len(candidates))),
        ],
    )
    st.write(jd["summary"])

    st.divider()
    st.markdown('<div class="sr-section-label">Ranking correction</div>', unsafe_allow_html=True)
    st.subheader("Naive Rank vs SignalRank")
    naive_df = pd.DataFrame(
        [
            {
                "Naive Rank": i + 1,
                "Candidate": result["name"],
                "Keyword Score": round(result["keyword_score"], 1),
            }
            for i, result in enumerate(naive_results)
        ]
    )
    signal_df = pd.DataFrame(
        [
            {
                "SignalRank": i + 1,
                "Candidate": result["name"],
                "Signal Score": round(result["signal_score"], 1),
                "SNR": round(result["snr"], 2),
                "Trust Label": result["trust_label"],
            }
            for i, result in enumerate(signal_results)
        ]
    )
    left, right = st.columns(2)
    left.dataframe(naive_df, hide_index=True, use_container_width=True)
    right.dataframe(signal_df, hide_index=True, use_container_width=True)

    top_naive = naive_results[0]["name"]
    top_signal = signal_results[0]["name"]
    if top_naive != top_signal:
        st.markdown(
            f"""
            <div class="sr-split-alert">
              Ranking corrected: naive screening picked {top_naive}, but SignalRank
              promotes {top_signal} because the evidence is stronger.
            </div>
            """,
            unsafe_allow_html=True,
        )
    else:
        st.info("SignalRank agrees with the naive top candidate for this demo set.")

    render_rank_cards(st, signal_results)

    st.divider()
    st.markdown('<div class="sr-section-label">Interactive candidate studio</div>', unsafe_allow_html=True)
    st.subheader("Candidate Evidence Review")

    selected_name = st.selectbox(
        "Focus candidate",
        [result["name"] for result in signal_results],
        index=0,
    )
    selected_result = next(result for result in signal_results if result["name"] == selected_name)

    tabs = st.tabs(["Studio", "All Candidates", "Evidence Heatmap"])

    with tabs[0]:
        metric_cols = st.columns(5)
        metric_cols[0].metric("SignalRank", f"{selected_result['signal_score']:.1f}")
        metric_cols[1].metric("Semantic Fit", f"{selected_result['semantic_fit']:.1f}")
        metric_cols[2].metric("Evidence", f"{selected_result['evidence_strength']:.1f}")
        metric_cols[3].metric("Recency", f"{selected_result['recency']:.1f}")
        metric_cols[4].metric("SNR", f"{selected_result['snr']:.2f}")

        st.write(selected_result["summary"])

        evidence_rows = []
        for item in selected_result["evidence"]:
            evidence_rows.append(
                {
                    "Claim": item["claim"],
                    "Evidence Level": item["level"],
                    "Last Used": item["last_used"],
                    "Role Relevant": "Yes" if item["role_relevant"] else "No",
                    "Source": item["source"],
                }
            )
        st.dataframe(pd.DataFrame(evidence_rows), hide_index=True, use_container_width=True)

        risk_col, gap_col, probe_col = st.columns(3)
        with risk_col:
            st.markdown("**Risk Flags**")
            for risk in selected_result["risk_flags"]:
                st.write(f"- {risk}")
        with gap_col:
            st.markdown("**Gaps**")
            for gap in selected_result["gaps"]:
                st.write(f"- {gap['type']}: {gap['skill']}")
        with probe_col:
            st.markdown("**Interview Probes**")
            for probe in build_interview_probes(selected_result):
                st.write(f"- {probe}")

    with tabs[1]:
        for result in signal_results:
            with st.expander(f"{result['name']} - {result['trust_label']}", expanded=result == signal_results[0]):
                metric_cols = st.columns(5)
                metric_cols[0].metric("SignalRank", f"{result['signal_score']:.1f}")
                metric_cols[1].metric("Semantic Fit", f"{result['semantic_fit']:.1f}")
                metric_cols[2].metric("Evidence", f"{result['evidence_strength']:.1f}")
                metric_cols[3].metric("Recency", f"{result['recency']:.1f}")
                metric_cols[4].metric("SNR", f"{result['snr']:.2f}")
                st.write(result["summary"])

    with tabs[2]:
        heatmap_rows = []
        for result in signal_results:
            row = {"Candidate": result["name"]}
            for skill in jd["must_have_skills"]:
                row[skill] = score_badge(result["skill_scores"].get(skill.lower(), 0))
            heatmap_rows.append(row)
        st.dataframe(pd.DataFrame(heatmap_rows), hide_index=True, use_container_width=True)


if __name__ == "__main__":
    main()
