def apply_visual_system(st) -> None:
    st.markdown(
        """
        <style>
        :root {
          --sr-ink: #161316;
          --sr-panel: #161316;
          --sr-panel-2: #1b1b1b;
          --sr-paper: #FFFFFF;
          --sr-muted: #BABABA;
          --sr-line: rgba(255,255,255,0.13);
          --sr-lime: #FF6D29;
          --sr-coral: #FF6D29;
          --sr-cyan: #BABABA;
          --sr-blue: #453027;
          --sr-yellow: #F59E0B;
        }

        .stApp {
          background:
            linear-gradient(90deg, rgba(255,109,41,0.04) 1px, transparent 1px),
            linear-gradient(180deg, rgba(255,255,255,0.04) 1px, transparent 1px),
            radial-gradient(circle at 12% 8%, rgba(255,109,41,0.18), transparent 26%),
            linear-gradient(135deg, #161316 0%, #2A1A15 50%, #453027 100%);
          background-size: 56px 56px, 56px 56px, auto, auto;
          color: var(--sr-paper);
        }

        .block-container {
          max-width: 1260px;
          padding-top: 2rem;
          padding-bottom: 4rem;
        }

        header[data-testid="stHeader"] {
          background: transparent;
        }

        h1, h2, h3, h4, p, li, label, span, div {
          letter-spacing: 0 !important;
        }

        h1, h2, h3 {
          color: var(--sr-paper) !important;
        }

        .sr-shell {
          border: 1px solid var(--sr-line);
          background: rgba(22, 19, 22, 0.88);
          box-shadow: 0 22px 90px rgba(0,0,0,0.38);
          padding: 22px;
          border-radius: 8px;
          position: relative;
          overflow: hidden;
        }

        .sr-hero {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.9fr);
          gap: 22px;
          align-items: stretch;
          margin-bottom: 22px;
        }

        .sr-title {
          font-size: clamp(44px, 7vw, 92px);
          line-height: 0.9;
          font-weight: 850;
          color: var(--sr-paper);
          margin: 0;
          text-transform: uppercase;
        }

        .sr-kicker {
          color: var(--sr-lime);
          font-size: 13px;
          text-transform: uppercase;
          font-weight: 800;
          margin-bottom: 16px;
        }

        .sr-copy {
          max-width: 640px;
          color: #d7d6cf;
          font-size: 17px;
          line-height: 1.55;
          margin-top: 18px;
        }

        .sr-hero-panel {
          min-height: 360px;
          background:
            linear-gradient(140deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01)),
            #161316;
          border: 1px solid var(--sr-line);
          border-radius: 8px;
          position: relative;
          overflow: hidden;
        }

        .sr-hero-panel::before {
          content: "";
          position: absolute;
          inset: 20px;
          border: 1px solid rgba(255,255,255,0.12);
          transform: rotate(-4deg);
        }

        .sr-floating-card {
          position: absolute;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.18);
          box-shadow: 0 18px 48px rgba(0,0,0,0.4);
          overflow: hidden;
        }

        .sr-card-a {
          width: 58%;
          height: 45%;
          left: 8%;
          top: 16%;
          background: var(--sr-paper);
          color: #111;
          transform: rotate(-5deg);
          padding: 18px;
        }

        .sr-card-b {
          width: 43%;
          height: 38%;
          right: 5%;
          top: 40%;
          background: #161316;
          color: var(--sr-paper);
          transform: rotate(4deg);
          padding: 18px;
        }

        .sr-card-c {
          width: 28%;
          height: 24%;
          left: 18%;
          bottom: 8%;
          background: var(--sr-lime);
          color: #090909;
          transform: rotate(2deg);
          padding: 16px;
        }

        .sr-dots {
          width: 86px;
          height: 86px;
          background-image: radial-gradient(#FFFFFF 4px, transparent 5px);
          background-size: 22px 22px;
        }

        .sr-pill-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 22px;
        }

        .sr-pill {
          border: 1px solid rgba(255,255,255,0.16);
          color: var(--sr-paper);
          background: rgba(255,255,255,0.07);
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 700;
        }

        .sr-pill.hot {
          color: #080808;
          background: var(--sr-lime);
          border-color: var(--sr-lime);
        }

        .sr-section-label {
          color: var(--sr-muted);
          text-transform: uppercase;
          font-size: 12px;
          font-weight: 800;
          margin: 28px 0 10px;
        }

        .sr-metric-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin: 18px 0;
        }

        .sr-metric-card {
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--sr-line);
          border-radius: 8px;
          padding: 14px;
        }

        .sr-metric-card strong {
          color: var(--sr-paper);
          display: block;
          font-size: 28px;
          line-height: 1;
        }

        .sr-metric-card span {
          color: var(--sr-muted);
          font-size: 12px;
          text-transform: uppercase;
          font-weight: 800;
        }

        .sr-rank-card {
          border: 1px solid var(--sr-line);
          background: rgba(255,255,255,0.045);
          border-radius: 8px;
          padding: 16px;
          min-height: 136px;
          position: relative;
        }

        .sr-rank-card::after {
          content: "";
          position: absolute;
          right: 14px;
          top: 14px;
          width: 42px;
          height: 42px;
          background-image: radial-gradient(var(--sr-lime) 3px, transparent 4px);
          background-size: 14px 14px;
          opacity: 0.85;
        }

        .sr-rank-number {
          color: var(--sr-lime);
          font-size: 12px;
          text-transform: uppercase;
          font-weight: 900;
        }

        .sr-candidate-name {
          color: var(--sr-paper);
          font-size: 22px;
          font-weight: 850;
          margin: 4px 0;
        }

        .sr-trust {
          color: #c8c8c0;
          font-size: 13px;
          max-width: 72%;
        }

        .sr-score {
          color: var(--sr-paper);
          font-size: 38px;
          font-weight: 900;
          margin-top: 12px;
        }

        .sr-split-alert {
          background: linear-gradient(90deg, #FF6D29, #453027);
          color: #FFFFFF;
          border-radius: 8px;
          padding: 15px 18px;
          font-weight: 850;
          margin: 14px 0 22px;
        }

        div[data-testid="stDataFrame"] {
          border: 1px solid var(--sr-line);
          border-radius: 8px;
          overflow: hidden;
        }

        div[data-testid="stMetric"] {
          background: rgba(255,255,255,0.06);
          border: 1px solid var(--sr-line);
          border-radius: 8px;
          padding: 12px 14px;
        }

        div[data-testid="stMetric"] label {
          color: var(--sr-muted) !important;
        }

        div[data-testid="stMetricValue"] {
          color: var(--sr-paper) !important;
        }

        .stTabs [data-baseweb="tab-list"] {
          gap: 8px;
        }

        .stTabs [data-baseweb="tab"] {
          border: 1px solid var(--sr-line);
          background: rgba(255,255,255,0.06);
          border-radius: 8px;
          color: var(--sr-paper);
          padding: 8px 14px;
        }

        .stTabs [aria-selected="true"] {
          background: var(--sr-lime) !important;
          color: #050505 !important;
        }

        .stExpander {
          border: 1px solid var(--sr-line) !important;
          border-radius: 8px !important;
          background: rgba(255,255,255,0.045) !important;
        }

        @media (max-width: 900px) {
          .sr-hero {
            grid-template-columns: 1fr;
          }
          .sr-metric-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .sr-title {
            font-size: 46px;
          }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_hero(st) -> None:
    st.markdown(
        """
        <div class="sr-shell">
          <div class="sr-hero">
            <div>
              <div class="sr-kicker">Evidence intelligence for hiring</div>
              <h1 class="sr-title">Signal<br/>Rank</h1>
              <p class="sr-copy">
                A recruiter-facing studio that separates candidate signal from
                resume noise. Compare the naive keyword winner against an
                evidence-corrected ranking and see exactly why the shortlist changed.
              </p>
              <div class="sr-pill-row">
                <span class="sr-pill hot">Signal-to-noise scoring</span>
                <span class="sr-pill">Resume inflation detection</span>
                <span class="sr-pill">Hidden gem discovery</span>
                <span class="sr-pill">Evidence heatmap</span>
              </div>
            </div>
            <div class="sr-hero-panel">
              <div class="sr-floating-card sr-card-a">
                <div style="font-size:12px;font-weight:900;text-transform:uppercase;">Naive AI Pick</div>
              <div style="font-size:25px;font-weight:900;line-height:1.02;margin-top:18px;max-width:150px;">87.5<br/>keyword score</div>
              <div style="margin-top:18px;color:#555;max-width:160px;">High overlap, low proof.</div>
              </div>
              <div class="sr-floating-card sr-card-b">
                <div style="font-size:12px;color:#aaa;font-weight:900;text-transform:uppercase;">SignalRank Pick</div>
                <div style="font-size:25px;font-weight:900;line-height:1.05;margin-top:16px;max-width:190px;">Verified<br/>strong match</div>
                <div style="margin-top:16px;color:#bbb;max-width:210px;">Recent production evidence wins.</div>
              </div>
              <div class="sr-floating-card sr-card-c">
                <div class="sr-dots"></div>
              </div>
            </div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_metric_strip(st, metrics: list[tuple[str, str]]) -> None:
    cards = "".join(
        f'<div class="sr-metric-card"><span>{label}</span><strong>{value}</strong></div>'
        for label, value in metrics
    )
    st.markdown(f'<div class="sr-metric-strip">{cards}</div>', unsafe_allow_html=True)


def render_rank_cards(st, results: list[dict]) -> None:
    cols = st.columns(min(len(results), 4))
    for index, result in enumerate(results[:4]):
        with cols[index]:
            st.markdown(
                f"""
                <div class="sr-rank-card">
                  <div class="sr-rank-number">Rank {index + 1}</div>
                  <div class="sr-candidate-name">{result["name"]}</div>
                  <div class="sr-trust">{result["trust_label"]}</div>
                  <div class="sr-score">{result["signal_score"]:.1f}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )
