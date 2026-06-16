import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Brain, CheckCircle2, Gauge, Search, ShieldAlert, Sparkles, Upload } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchDemoRanking } from "./api";
import { fallbackRanking } from "./data/fallback";
import type { CandidateRank, RankingResponse } from "./types";

const navItems = ["Workspace", "Ranking", "Candidate", "Explainability", "Analytics"];

function Button({ children }: { children: React.ReactNode }) {
  return (
    <button className="rounded-[22px] bg-accent px-5 py-3 text-sm font-semibold text-white shadow-glow transition duration-300 hover:-translate-y-0.5 hover:bg-[#ff7f45]">
      {children}
    </button>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass rounded-[24px] p-6 ${className}`}>{children}</div>;
}

function ScoreRing({ score }: { score: number }) {
  const gradient = `conic-gradient(#FF6D29 ${score * 3.6}deg, rgba(255,255,255,0.12) 0deg)`;
  return (
    <div className="grid h-32 w-32 place-items-center rounded-full" style={{ background: gradient }}>
      <div className="grid h-24 w-24 place-items-center rounded-full bg-background">
        <span className="text-3xl font-bold">{score.toFixed(0)}</span>
      </div>
    </div>
  );
}

function Landing({ data }: { data: RankingResponse }) {
  return (
    <section className="grid gap-8 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-14">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral">
          AI hiring intelligence, without paid APIs
        </div>
        <h1 className="max-w-4xl text-6xl font-semibold leading-[0.95] tracking-tight text-white md:text-8xl">
          Rank candidates by evidence, not resume polish.
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-neutral">
          SignalRank behaves like an exceptional recruiter: it detects noisy profiles, validates evidence, finds hidden gems, and explains every ranking decision.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button>
            <span className="inline-flex items-center gap-2"><Upload size={17} /> Upload JD</span>
          </Button>
          <button className="rounded-[22px] border border-white/15 px-5 py-3 text-sm font-semibold text-white transition duration-300 hover:bg-white/10">
            View demo ranking
          </button>
        </div>
      </motion.div>
      <Card className="orange-glow relative overflow-hidden">
        <div className="absolute right-[-70px] top-[-70px] h-48 w-48 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Ranking corrected</p>
          <div className="mt-6 grid gap-4">
            <div className="rounded-[22px] bg-white p-5 text-background">
              <p className="text-xs font-bold uppercase text-secondary">Naive AI Pick</p>
              <p className="mt-3 text-3xl font-bold">{data.naive_top}</p>
              <p className="mt-2 text-sm text-secondary">High keyword overlap. Weak proof density.</p>
            </div>
            <div className="ml-8 rounded-[22px] border border-accent/35 bg-background/90 p-5">
              <p className="text-xs font-bold uppercase text-accent">SignalRank Pick</p>
              <p className="mt-3 text-3xl font-bold text-white">{data.signalrank_top}</p>
              <p className="mt-2 text-sm text-neutral">Evidence-backed production capability.</p>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
}

function Dashboard({ data }: { data: RankingResponse }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[260px_1fr]">
      <aside className="glass rounded-[24px] p-4">
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-accent font-bold">SR</div>
          <div>
            <p className="font-semibold">SignalRank</p>
            <p className="text-xs text-neutral">Recruiter workspace</p>
          </div>
        </div>
        <nav className="space-y-2">
          {navItems.map((item, index) => (
            <a key={item} className={`flex items-center gap-3 rounded-[20px] px-4 py-3 text-sm ${index === 0 ? "bg-accent text-white" : "text-neutral hover:bg-white/10"}`}>
              {item}
            </a>
          ))}
        </nav>
      </aside>
      <div className="grid gap-5">
        <div className="grid gap-5 md:grid-cols-4">
          {[
            ["Avg Signal", data.metrics.average_signal_score],
            ["Avg SNR", data.metrics.average_snr],
            ["Verified", data.metrics.verified_matches],
            ["Risk Profiles", data.metrics.risk_profiles]
          ].map(([label, value]) => (
            <Card key={label as string}>
              <p className="text-sm text-neutral">{label}</p>
              <p className="mt-2 text-3xl font-semibold">{value}</p>
            </Card>
          ))}
        </div>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-wide text-accent">AI insights</p>
              <h2 className="mt-2 text-3xl font-semibold">{data.job_title}</h2>
            </div>
            <Button><span className="inline-flex items-center gap-2"><Brain size={17} /> Generate brief</span></Button>
          </div>
          <div className="mt-6 grid gap-3">
            {data.insights.map((insight) => (
              <div key={insight} className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-neutral">{insight}</div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

function CandidateRanking({ data, selected, onSelect }: { data: RankingResponse; selected: CandidateRank; onSelect: (c: CandidateRank) => void }) {
  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Card>
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-accent">Candidate ranking</p>
            <h2 className="text-3xl font-semibold">Evidence-corrected shortlist</h2>
          </div>
          <div className="flex items-center gap-2 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-neutral">
            <Search size={17} /> Search
          </div>
        </div>
        <div className="grid gap-3">
          {data.candidates.map((candidate) => (
            <motion.button
              key={candidate.name}
              onClick={() => onSelect(candidate)}
              className={`rounded-[24px] border p-4 text-left transition duration-300 hover:-translate-y-0.5 ${selected.name === candidate.name ? "border-accent bg-accent/10" : "border-white/10 bg-white/5"}`}
              whileHover={{ scale: 1.01 }}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-neutral">Rank {candidate.rank}</p>
                  <h3 className="mt-1 text-2xl font-semibold">{candidate.name}</h3>
                  <p className="mt-1 text-sm text-neutral">{candidate.trust_label}</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-accent">{candidate.signal_score.toFixed(1)}</p>
                  <p className="text-xs text-neutral">match score</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-sm uppercase tracking-wide text-accent">Selected candidate</p>
        <h3 className="mt-2 text-3xl font-semibold">{selected.name}</h3>
        <div className="mt-6 flex justify-center"><ScoreRing score={selected.signal_score} /></div>
        <p className="mt-6 text-neutral">{selected.summary}</p>
      </Card>
    </section>
  );
}

function CandidateDetail({ candidate }: { candidate: CandidateRank }) {
  const skills = Object.entries(candidate.skill_scores).map(([skill, score]) => ({ skill, score }));
  return (
    <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <p className="text-sm uppercase tracking-wide text-accent">Candidate profile</p>
        <h2 className="mt-2 text-4xl font-semibold">{candidate.name}</h2>
        <p className="mt-4 text-neutral">{candidate.summary}</p>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <Metric icon={<Gauge />} label="SNR" value={candidate.snr} />
          <Metric icon={<CheckCircle2 />} label="Evidence" value={candidate.evidence_strength} />
          <Metric icon={<Sparkles />} label="Recency" value={candidate.recency} />
          <Metric icon={<ShieldAlert />} label="Risks" value={candidate.risk_flags.length} />
        </div>
      </Card>
      <Card>
        <p className="text-sm uppercase tracking-wide text-accent">Skills analysis</p>
        <div className="mt-5 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={skills}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="skill" stroke="#BABABA" tick={{ fontSize: 11 }} />
              <YAxis stroke="#BABABA" />
              <Tooltip contentStyle={{ background: "#161316", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 16 }} />
              <Bar dataKey="score" radius={[12, 12, 0, 0]} fill="#FF6D29" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
      <div className="mb-3 text-accent">{icon}</div>
      <p className="text-sm text-neutral">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{typeof value === "number" ? value.toFixed(value > 10 ? 0 : 2) : value}</p>
    </div>
  );
}

function Explainability({ candidate }: { candidate: CandidateRank }) {
  return (
    <section className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <p className="text-sm uppercase tracking-wide text-accent">AI explanation report</p>
        <h2 className="mt-2 text-3xl font-semibold">Why {candidate.name} is ranked #{candidate.rank}</h2>
        <div className="mt-6 grid gap-4">
          {candidate.interview_probes.map((probe) => (
            <div key={probe} className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-neutral">{probe}</div>
          ))}
        </div>
      </Card>
      <Card>
        <p className="text-sm uppercase tracking-wide text-accent">Risk indicators</p>
        <div className="mt-5 space-y-3">
          {candidate.risk_flags.map((risk) => (
            <div key={risk} className="rounded-[20px] bg-[#EF4444]/10 p-4 text-sm text-neutral">{risk}</div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function Analytics({ data }: { data: RankingResponse }) {
  const pie = [
    { name: "Verified", value: data.metrics.verified_matches },
    { name: "Risk", value: data.metrics.risk_profiles },
    { name: "Review", value: Math.max(data.candidates.length - data.metrics.verified_matches - data.metrics.risk_profiles, 0) }
  ];
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <Card>
        <p className="text-sm uppercase tracking-wide text-accent">Match score distribution</p>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.candidates}>
              <XAxis dataKey="name" stroke="#BABABA" tick={{ fontSize: 11 }} />
              <YAxis stroke="#BABABA" />
              <Tooltip contentStyle={{ background: "#161316", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 16 }} />
              <Bar dataKey="signal_score" radius={[12, 12, 0, 0]} fill="#FF6D29" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <p className="text-sm uppercase tracking-wide text-accent">Candidate distribution</p>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={5}>
                {pie.map((_, index) => <Cell key={index} fill={["#4ADE80", "#EF4444", "#F59E0B"][index]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#161316", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 16 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </section>
  );
}

export function App() {
  const [data, setData] = useState<RankingResponse>(fallbackRanking);
  const [active, setActive] = useState("Workspace");
  const [selectedName, setSelectedName] = useState(fallbackRanking.candidates[0].name);

  useEffect(() => {
    fetchDemoRanking().then((ranking) => {
      setData(ranking);
      setSelectedName(ranking.candidates[0].name);
    }).catch(() => setData(fallbackRanking));
  }, []);

  const selected = useMemo(
    () => data.candidates.find((candidate) => candidate.name === selectedName) ?? data.candidates[0],
    [data, selectedName]
  );

  return (
    <main className="mx-auto max-w-7xl px-5 py-6 md:px-8">
      <header className="flex items-center justify-between py-4">
        <div className="text-xl font-semibold">SignalRank</div>
        <nav className="hidden gap-2 rounded-full border border-white/10 bg-white/5 p-1 md:flex">
          {navItems.map((item) => (
            <button key={item} onClick={() => setActive(item)} className={`rounded-full px-4 py-2 text-sm transition ${active === item ? "bg-white text-background" : "text-neutral hover:text-white"}`}>
              {item}
            </button>
          ))}
        </nav>
      </header>
      <Landing data={data} />
      <div className="my-8 flex flex-wrap gap-2 md:hidden">
        {navItems.map((item) => (
          <button key={item} onClick={() => setActive(item)} className={`rounded-full px-4 py-2 text-sm ${active === item ? "bg-accent" : "bg-white/10 text-neutral"}`}>{item}</button>
        ))}
      </div>
      <motion.div key={active} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {active === "Workspace" && <Dashboard data={data} />}
        {active === "Ranking" && <CandidateRanking data={data} selected={selected} onSelect={(candidate) => setSelectedName(candidate.name)} />}
        {active === "Candidate" && <CandidateDetail candidate={selected} />}
        {active === "Explainability" && <Explainability candidate={selected} />}
        {active === "Analytics" && <Analytics data={data} />}
      </motion.div>
      <footer className="mt-16 border-t border-white/10 py-8 text-sm text-neutral">
        SignalRank uses local/free AI components: FastAPI, scikit-learn TF-IDF embeddings, interpretable ranking, and evidence-backed explanations.
      </footer>
    </main>
  );
}
