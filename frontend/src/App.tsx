import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ArrowDown, ArrowRight, Award, BarChart3, BookOpen,
  Brain, CheckCircle2, ChevronDown, ChevronRight, Download,
  FileText, Gauge, Layers, Loader2, MapPin, Plus, Search, Shield,
  Sparkles, Target, TrendingUp, Upload, Users, X, Zap
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, PolarAngleAxis,
  RadarChart, Radar, PolarGrid, RadialBar, RadialBarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import {
  fetchDemoRanking, fetchDatasetRanking, uploadAndRank,
  runCareerCoach, downloadSubmissionCSV
} from "./api";
import { fallbackRanking } from "./data/fallback";
import type { CandidateRank, RankingResponse, CareerCoachResult, AppMode, RankingTab } from "./types";

// ── Design tokens ──────────────────────────────────────────────────────────
const ACCENT = "#FF6D29";
const BG = "#161316";

// ── Utility components ─────────────────────────────────────────────────────

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

function Pill({ children, color = "orange" }: { children: React.ReactNode; color?: "orange" | "green" | "red" | "gray" }) {
  const map = {
    orange: "bg-accent/15 text-accent border-accent/30",
    green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    red: "bg-red-500/15 text-red-400 border-red-500/30",
    gray: "bg-white/5 text-neutral border-white/10",
  };
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", map[color])}>
      {children}
    </span>
  );
}

function ScoreBar({ value, max = 100, color = ACCENT }: { value: number; max?: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
    </div>
  );
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size / 2) * 0.75;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const hue = score >= 70 ? "#4ADE80" : score >= 50 ? ACCENT : "#EF4444";
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={hue} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      <text
        x={size / 2} y={size / 2 + 2}
        textAnchor="middle" dominantBaseline="middle"
        className="rotate-90"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size / 2}px ${size / 2}px`, fill: "#fff", fontSize: size * 0.22, fontWeight: 700 }}
      >
        {score.toFixed(0)}
      </text>
    </svg>
  );
}

function Card({ children, className = "", glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={cx(
      "glass rounded-[24px] p-6",
      glow && "orange-glow",
      className
    )}>
      {children}
    </div>
  );
}

function Spinner() {
  return <Loader2 className="animate-spin" size={20} />;
}

function SkeletonCard() {
  return (
    <div className="glass rounded-[24px] p-6 space-y-3 animate-pulse">
      <div className="h-3 w-1/3 rounded-full bg-white/10" />
      <div className="h-6 w-2/3 rounded-full bg-white/10" />
      <div className="h-3 w-full rounded-full bg-white/10" />
      <div className="h-3 w-4/5 rounded-full bg-white/10" />
    </div>
  );
}

function TrustBadge({ label }: { label: string }) {
  const lower = label.toLowerCase();
  if (lower.includes("verified")) return <Pill color="green"><CheckCircle2 size={10} className="mr-1" />{label}</Pill>;
  if (lower.includes("keyword")) return <Pill color="red"><AlertTriangle size={10} className="mr-1" />{label}</Pill>;
  if (lower.includes("high potential")) return <Pill color="orange"><Sparkles size={10} className="mr-1" />{label}</Pill>;
  return <Pill color="gray">{label}</Pill>;
}

// ── File drop zone ─────────────────────────────────────────────────────────

function DropZone({
  label, accept, multiple = false, files, onChange, compact = false
}: {
  label: string; accept: string; multiple?: boolean;
  files: File[]; onChange: (f: File[]) => void; compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.match(/\.(pdf|txt|docx)$/i));
    onChange(multiple ? [...files, ...dropped] : dropped.slice(0, 1));
  };
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => ref.current?.click()}
      className={cx(
        "cursor-pointer rounded-[20px] border-2 border-dashed transition-all duration-200",
        drag ? "border-accent bg-accent/10" : "border-white/15 hover:border-white/30 hover:bg-white/5",
        compact ? "px-4 py-3" : "px-6 py-8"
      )}
    >
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={e => onChange(multiple ? [...files, ...Array.from(e.target.files || [])] : Array.from(e.target.files || []).slice(0, 1))}
      />
      <div className={cx("flex items-center gap-3 text-neutral", compact ? "" : "flex-col text-center")}>
        <Upload size={compact ? 16 : 28} className={files.length ? "text-accent" : ""} />
        <div>
          <p className={cx("font-medium", compact ? "text-sm" : "text-base", files.length ? "text-white" : "")}>
            {files.length ? files.map(f => f.name).join(", ") : label}
          </p>
          {!compact && <p className="mt-1 text-xs">PDF, TXT, DOCX · drag or click</p>}
        </div>
        {files.length > 0 && (
          <button onClick={e => { e.stopPropagation(); onChange([]); }}
            className="ml-auto rounded-full p-1 hover:bg-white/10">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Landing / Home ─────────────────────────────────────────────────────────

function Home({ onMode }: { onMode: (m: AppMode) => void }) {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative pb-24 pt-20 text-center">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute left-1/2 top-0 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-4 py-2 text-sm text-accent">
            <Zap size={14} /> AI hiring intelligence · No paid APIs
          </div>

          <h1 className="mx-auto max-w-4xl text-6xl font-bold leading-[0.95] tracking-tight text-white md:text-8xl">
            Rank candidates<br />
            <span className="text-accent">by evidence.</span><br />
            Not resume polish.
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-neutral">
            HAZE uses SignalRank — evidence-based hiring intelligence that validates claims,
            detects hidden gems, and explains every decision like a great recruiter would.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <motion.button
              onClick={() => onMode("ranking")}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 rounded-[22px] bg-accent px-7 py-4 text-base font-semibold text-white shadow-glow transition hover:bg-[#ff7f45]"
            >
              <Users size={18} /> Rank Candidates
            </motion.button>
            <motion.button
              onClick={() => onMode("coach")}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 rounded-[22px] border border-white/15 px-7 py-4 text-base font-semibold text-white transition hover:bg-white/10"
            >
              <Target size={18} /> AI Career Coach
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Feature grid */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: <Brain size={24} />, title: "Evidence Validation", desc: "Detects unsupported claims, stale experience, and keyword inflation that fool naive keyword search." },
          { icon: <Sparkles size={24} />, title: "Hidden Gem Detection", desc: "Surfaces high-potential candidates with transferable skills that traditional ATS systems miss." },
          { icon: <Shield size={24} />, title: "Trust Labels", desc: "Every candidate gets a trust label — Verified Strong Match, High Potential, or Risky — with full reasoning." },
          { icon: <BarChart3 size={24} />, title: "8-Factor Scoring", desc: "Semantic fit, evidence strength, recency, domain alignment, experience, growth, behavioral fit, confidence." },
          { icon: <Target size={24} />, title: "Career Coach", desc: "Upload your resume and get a match score, skill gap analysis, learning roadmap, and resume suggestions." },
          { icon: <Download size={24} />, title: "Submission Export", desc: "One-click CSV export in the official challenge format, validated and ready to submit." },
        ].map(({ icon, title, desc }) => (
          <motion.div key={title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="glass rounded-[24px] p-6 transition duration-300 hover:-translate-y-1"
          >
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">{icon}</div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-neutral">{desc}</p>
          </motion.div>
        ))}
      </section>

      {/* Ranking correction preview */}
      <section className="mt-8">
        <Card glow className="relative overflow-hidden">
          <div className="absolute right-[-80px] top-[-80px] h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-2">
            <div>
              <Pill color="orange"><Zap size={10} className="mr-1" />Live example</Pill>
              <h2 className="mt-4 text-3xl font-bold text-white">SignalRank corrects naive rankings</h2>
              <p className="mt-3 text-neutral">A keyword-heavy resume ranks #1 naively. SignalRank demotes it, promoting the evidence-backed hidden gem.</p>
              <button onClick={() => onMode("ranking")} className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-white transition">
                See it live <ArrowRight size={14} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="rounded-[20px] bg-red-500/10 border border-red-500/20 p-4">
                <p className="text-xs font-bold uppercase text-red-400">❌ Naive ATS Pick</p>
                <p className="mt-2 text-lg font-semibold text-white">Keyword-heavy profile</p>
                <p className="text-sm text-neutral">High term overlap. Weak evidence density. No verified production claims.</p>
              </div>
              <div className="rounded-[20px] bg-emerald-500/15 border border-emerald-500/20 p-4">
                <p className="text-xs font-bold uppercase text-emerald-400">✓ SignalRank Pick</p>
                <p className="mt-2 text-lg font-semibold text-white">Evidence-backed engineer</p>
                <p className="text-sm text-neutral">Lower keyword density. Strong evidence: production ownership, measurable outcomes, verified skills.</p>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

// ── Ranking Workspace ──────────────────────────────────────────────────────

type RankingSource = "dataset" | "upload" | "demo";

function RankingWorkspace({ onSelect }: { onSelect: (c: CandidateRank, data: RankingResponse) => void }) {
  const [source, setSource] = useState<RankingSource>("demo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<RankingResponse | null>(null);

  // Upload form state
  const [jdText, setJdText] = useState("");
  const [jdFiles, setJdFiles] = useState<File[]>([]);
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [includeDataset, setIncludeDataset] = useState(true);
  const [topK, setTopK] = useState(50);
  const [search, setSearch] = useState("");
  const [filterTrust, setFilterTrust] = useState("all");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const run = useCallback(async () => {
    setLoading(true); setError("");
    try {
      let result: RankingResponse;
      if (source === "demo") result = await fetchDemoRanking();
      else if (source === "dataset") result = await fetchDatasetRanking(topK);
      else {
        const jdContent = jdText || (jdFiles[0] ? await jdFiles[0].text() : "");
        if (!jdContent && resumeFiles.length === 0) throw new Error("Provide a JD or at least one resume.");
        result = await uploadAndRank(jdContent, resumeFiles, includeDataset, topK);
      }
      setData(result);
    } catch (e: any) {
      setError(e.message || "Request failed");
      setData(fallbackRanking);
    } finally { setLoading(false); }
  }, [source, jdText, jdFiles, resumeFiles, includeDataset, topK]);

  const handleDownload = async () => {
    try {
      const blob = await downloadSubmissionCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "haze_submission.csv"; a.click();
    } catch { setError("CSV export failed"); }
  };

  const filtered = (data?.candidates ?? []).filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.current_title || "").toLowerCase().includes(search.toLowerCase());
    const matchTrust = filterTrust === "all" || c.trust_label.toLowerCase().includes(filterTrust.toLowerCase());
    return matchSearch && matchTrust;
  });

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-[16px] border border-white/10 bg-white/5">
            {(["demo", "dataset", "upload"] as RankingSource[]).map(s => (
              <button key={s} onClick={() => setSource(s)}
                className={cx("px-4 py-2.5 text-sm font-medium capitalize transition", s === source ? "bg-accent text-white" : "text-neutral hover:text-white")}>
                {s === "demo" ? "Demo (4)" : s === "dataset" ? "Dataset (100k)" : "Upload Files"}
              </button>
            ))}
          </div>

          {source === "dataset" && (
            <select value={topK} onChange={e => setTopK(Number(e.target.value))}
              className="rounded-[14px] border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white">
              {[20, 50, 100].map(n => <option key={n} value={n}>Top {n}</option>)}
            </select>
          )}

          <div className="flex-1" />

          <button onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-[16px] border border-white/15 px-4 py-2.5 text-sm text-neutral hover:text-white transition">
            <Download size={15} /> Export CSV
          </button>

          <motion.button onClick={run} disabled={loading}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 rounded-[16px] bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-glow disabled:opacity-50">
            {loading ? <Spinner /> : <Zap size={15} />}
            {loading ? "Ranking…" : "Run SignalRank"}
          </motion.button>
        </div>

        {/* Upload form */}
        {source === "upload" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            className="mt-5 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral">Job Description</p>
              <DropZone label="Upload JD (PDF, DOCX, TXT)" accept=".pdf,.txt,.docx" files={jdFiles} onChange={setJdFiles} compact />
              <textarea
                value={jdText} onChange={e => setJdText(e.target.value)} rows={3}
                placeholder="Or paste job description text here…"
                className="w-full resize-none rounded-[14px] border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral focus:border-accent/50 focus:outline-none"
              />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral">Resumes</p>
              <DropZone label="Upload resumes (PDF, TXT)" accept=".pdf,.txt" multiple files={resumeFiles} onChange={setResumeFiles} compact />
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral">
                <input type="checkbox" checked={includeDataset} onChange={e => setIncludeDataset(e.target.checked)}
                  className="h-4 w-4 rounded accent-orange-500" />
                Also rank against the 100k dataset
              </label>
              <select value={topK} onChange={e => setTopK(Number(e.target.value))}
                className="w-full rounded-[14px] border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                {[20, 50, 100].map(n => <option key={n} value={n}>Return top {n}</option>)}
              </select>
            </div>
          </motion.div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-[14px] bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            <AlertTriangle size={14} /> {error}
          </div>
        )}
      </Card>

      {/* Results */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Candidates", value: data.candidates.length, icon: <Users size={14} /> },
              { label: "Avg Score", value: data.metrics.average_signal_score?.toFixed(1) ?? "—", icon: <Gauge size={14} /> },
              { label: "Verified", value: data.metrics.verified_matches, icon: <CheckCircle2 size={14} /> },
              { label: "Ranking Corrected", value: data.ranking_corrected ? "Yes" : "No", icon: <Zap size={14} /> },
            ].map(({ label, value, icon }) => (
              <Card key={label} className="!p-4">
                <div className="flex items-center gap-1.5 text-xs text-neutral">{icon} {label}</div>
                <p className="mt-1.5 text-2xl font-bold text-white">{value}</p>
              </Card>
            ))}
          </div>

          {/* Insights */}
          {data.insights?.length > 0 && (
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">AI Insights</p>
              <div className="grid gap-2 md:grid-cols-2">
                {data.insights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-[16px] bg-white/5 border border-white/10 p-3.5">
                    <Brain size={13} className="mt-0.5 shrink-0 text-accent" />
                    <p className="text-sm text-neutral">{ins}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-[16px] border border-white/10 bg-white/5 px-3 py-2">
              <Search size={14} className="text-neutral" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or title…"
                className="w-48 bg-transparent text-sm text-white placeholder-neutral outline-none" />
            </div>
            <select value={filterTrust} onChange={e => setFilterTrust(e.target.value)}
              className="rounded-[16px] border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
              <option value="all">All trust levels</option>
              <option value="verified">Verified match</option>
              <option value="potential">High potential</option>
              <option value="risky">Risky</option>
            </select>
            <p className="text-sm text-neutral">{filtered.length} candidates</p>
            {compareIds.length >= 2 && (
              <button onClick={() => setShowCompare(true)}
                className="ml-auto inline-flex items-center gap-2 rounded-[16px] border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent">
                <Layers size={14} /> Compare {compareIds.length}
              </button>
            )}
          </div>

          {/* Candidate list */}
          <div className="space-y-3">
            {filtered.map((candidate, idx) => (
              <motion.div
                key={candidate.name + candidate.rank}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.025, duration: 0.2 }}
                className={cx(
                  "glass rounded-[24px] border p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5",
                  compareIds.includes(candidate.name) ? "border-accent bg-accent/10" : "border-white/10 hover:border-white/20"
                )}
                onClick={() => onSelect(candidate, data)}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-lg font-bold text-accent">
                    {candidate.rank}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-white">{candidate.name}</h3>
                      <TrustBadge label={candidate.trust_label} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-neutral">
                      {candidate.current_title && <span className="text-white/70">{candidate.current_title} · </span>}
                      {candidate.years_of_experience ? `${candidate.years_of_experience} yrs exp · ` : ""}
                      {candidate.summary?.slice(0, 80)}…
                    </p>
                    <div className="mt-2">
                      <ScoreBar value={candidate.signal_score} />
                    </div>
                  </div>

                  {/* Score */}
                  <div className="shrink-0 text-right">
                    <p className="text-3xl font-bold text-accent">{candidate.signal_score.toFixed(1)}</p>
                    <p className="text-xs text-neutral">SignalRank</p>
                  </div>

                  {/* Sub-scores */}
                  <div className="hidden shrink-0 space-y-1.5 lg:block w-36">
                    {[
                      ["Semantic", candidate.semantic_fit],
                      ["Evidence", candidate.evidence_strength],
                      ["Recency", candidate.recency],
                    ].map(([l, v]) => (
                      <div key={l as string} className="flex items-center gap-2">
                        <span className="w-16 text-right text-xs text-neutral">{l}</span>
                        <div className="flex-1">
                          <ScoreBar value={v as number} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Compare toggle */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setCompareIds(ids => ids.includes(candidate.name)
                        ? ids.filter(i => i !== candidate.name)
                        : ids.length < 4 ? [...ids, candidate.name] : ids
                      );
                    }}
                    className={cx(
                      "hidden shrink-0 rounded-full p-1.5 transition md:flex",
                      compareIds.includes(candidate.name) ? "bg-accent/20 text-accent" : "text-neutral hover:bg-white/10"
                    )}
                    title="Add to compare"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Compare modal */}
      <AnimatePresence>
        {showCompare && data && (
          <CompareModal
            candidates={data.candidates.filter(c => compareIds.includes(c.name))}
            onClose={() => setShowCompare(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Compare Modal ──────────────────────────────────────────────────────────

function CompareModal({ candidates, onClose }: { candidates: CandidateRank[]; onClose: () => void }) {
  const dims = ["semantic_fit", "evidence_strength", "recency", "domain_alignment", "experience_match", "behavioral_fit"];
  const colors = ["#FF6D29", "#4ADE80", "#F59E0B", "#A78BFA"];
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="glass w-full max-w-5xl rounded-[28px] p-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Candidate Comparison</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10 text-neutral"><X size={18} /></button>
        </div>

        {/* Score overview */}
        <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: `repeat(${candidates.length}, 1fr)` }}>
          {candidates.map((c, i) => (
            <div key={c.name} className="rounded-[20px] border border-white/10 bg-white/5 p-4 text-center">
              <div className="flex justify-center mb-3">
                <ScoreRing score={c.signal_score} size={90} />
              </div>
              <h3 className="font-semibold text-white">{c.name}</h3>
              <p className="text-xs text-neutral mt-1">{c.current_title}</p>
              <div className="mt-2"><TrustBadge label={c.trust_label} /></div>
            </div>
          ))}
        </div>

        {/* Radar chart */}
        <div className="h-72 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={dims.map(dim => ({
              dim: dim.replace("_", " "),
              ...Object.fromEntries(candidates.map(c => [c.name, (c as any)[dim]]))
            }))}>
              <PolarGrid stroke="rgba(255,255,255,0.1)" />
              <PolarAngleAxis dataKey="dim" tick={{ fill: "#BABABA", fontSize: 11 }} />
              {candidates.map((c, i) => (
                <Radar key={c.name} name={c.name} dataKey={c.name}
                  stroke={colors[i]} fill={colors[i]} fillOpacity={0.15} />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Dimension breakdown */}
        <div className="space-y-4">
          {dims.map(dim => (
            <div key={dim}>
              <p className="mb-2 text-xs font-medium text-neutral capitalize">{dim.replace("_", " ")}</p>
              <div className="space-y-1.5">
                {candidates.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="w-28 truncate text-right text-xs text-neutral">{c.name}</span>
                    <div className="flex-1"><ScoreBar value={(c as any)[dim]} color={colors[i]} /></div>
                    <span className="w-10 text-right text-xs text-white">{((c as any)[dim] ?? 0).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Candidate Detail ───────────────────────────────────────────────────────

function CandidateDetail({ candidate, ranking, onBack }: { candidate: CandidateRank; ranking: RankingResponse; onBack: () => void }) {
  const [tab, setTab] = useState<RankingTab>("detail");
  const skills = Object.entries(candidate.skill_scores).map(([skill, score]) => ({ skill, score }));

  const scoreColor = (v: number) => v >= 70 ? "#4ADE80" : v >= 50 ? ACCENT : "#EF4444";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="flex items-center gap-2 rounded-[14px] border border-white/10 px-3 py-2 text-sm text-neutral hover:text-white transition">
          <ArrowDown size={14} className="rotate-90" /> Back
        </button>
        <div className="flex overflow-hidden rounded-[16px] border border-white/10 bg-white/5">
          {(["detail", "explain", "analytics"] as RankingTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cx("px-4 py-2 text-sm font-medium capitalize transition", t === tab ? "bg-accent text-white" : "text-neutral hover:text-white")}>
              {t === "detail" ? "Profile" : t === "explain" ? "Explainability" : "Analytics"}
            </button>
          ))}
        </div>
      </div>

      {tab === "detail" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          {/* Left: Profile */}
          <div className="space-y-5">
            <Card glow>
              <div className="flex items-start gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-2xl font-bold text-accent">
                  {candidate.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-white">{candidate.name}</h1>
                    <TrustBadge label={candidate.trust_label} />
                    <Pill color="gray">Rank #{candidate.rank}</Pill>
                  </div>
                  {candidate.current_title && <p className="mt-1 text-sm text-neutral">{candidate.current_title}</p>}
                  <p className="mt-3 text-sm leading-6 text-neutral">{candidate.summary}</p>
                </div>
                <div className="shrink-0"><ScoreRing score={candidate.signal_score} /></div>
              </div>
            </Card>

            {/* 8-factor grid */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["Semantic Fit", candidate.semantic_fit],
                ["Evidence", candidate.evidence_strength],
                ["Recency", candidate.recency],
                ["Domain Align", candidate.domain_alignment],
                ["Experience", candidate.experience_match],
                ["Career Growth", candidate.career_growth],
                ["Behavioral", candidate.behavioral_fit],
                ["Confidence", candidate.confidence],
              ].map(([label, value]) => (
                <Card key={label as string} className="!p-4">
                  <p className="text-xs text-neutral">{label}</p>
                  <p className="mt-1 text-xl font-bold" style={{ color: scoreColor(value as number) }}>
                    {(value as number).toFixed(0)}
                  </p>
                  <div className="mt-2"><ScoreBar value={value as number} color={scoreColor(value as number)} /></div>
                </Card>
              ))}
            </div>

            {/* Strengths */}
            {candidate.strengths?.length > 0 && (
              <Card>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-400">Strengths</p>
                <div className="space-y-2">
                  {candidate.strengths.map((s, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-[14px] bg-emerald-500/15 border border-emerald-500/15 px-3.5 py-2.5">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-400" />
                      <p className="text-sm text-neutral">{s}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Concerns */}
            {candidate.concerns?.length > 0 && !candidate.concerns[0].includes("No major") && (
              <Card>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-400">Concerns</p>
                <div className="space-y-2">
                  {candidate.concerns.map((c, i) => (
                    <div key={i} className="flex items-start gap-2.5 rounded-[14px] bg-red-500/10 border border-red-500/15 px-3.5 py-2.5">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-400" />
                      <p className="text-sm text-neutral">{c}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right: Quick facts */}
          <div className="space-y-5">
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">Recruiter Recommendation</p>
              <p className="text-sm leading-6 text-neutral">{candidate.recommendation}</p>
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="mb-2 text-xs text-neutral">Signal-to-Noise Ratio</p>
                <p className="text-2xl font-bold text-white">{candidate.snr.toFixed(2)}</p>
                <ScoreBar value={candidate.snr * 100} />
              </div>
            </Card>

            {candidate.gaps?.length > 0 && (
              <Card>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-400">Skill Gaps</p>
                <div className="space-y-2">
                  {candidate.gaps.map((g, i) => (
                    <div key={i} className="flex items-center justify-between rounded-[12px] bg-amber-500/15 border border-amber-500/15 px-3 py-2">
                      <span className="text-sm text-white">{g.skill}</span>
                      <Pill color={g.type.includes("critical") ? "red" : "gray"}>{g.type}</Pill>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {candidate.risk_flags?.filter(f => !f.includes("No major")).length > 0 && (
              <Card>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-400">Risk Flags</p>
                <div className="space-y-2">
                  {candidate.risk_flags.filter(f => !f.includes("No major")).map((r, i) => (
                    <div key={i} className="rounded-[12px] bg-red-500/10 border border-red-500/15 px-3 py-2 text-sm text-neutral">{r}</div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "explain" && (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">AI Explanation</p>
            <h2 className="text-2xl font-bold text-white">Why #{candidate.rank} — {candidate.name}</h2>
            <p className="mt-3 text-sm leading-6 text-neutral">{candidate.summary}</p>
            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold uppercase text-neutral">Interview Probes</p>
              {candidate.interview_probes?.map((probe, i) => (
                <div key={i} className="flex items-start gap-3 rounded-[16px] bg-white/5 border border-white/10 p-4">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">{i + 1}</span>
                  <p className="text-sm text-neutral">{probe}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-5">
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">Skill Match Scores</p>
              <div className="space-y-3">
                {skills.map(({ skill, score }) => (
                  <div key={skill} className="flex items-center gap-3">
                    <span className="w-32 truncate text-right text-xs text-neutral capitalize">{skill}</span>
                    <div className="flex-1"><ScoreBar value={score} color={scoreColor(score)} /></div>
                    <span className="w-8 text-right text-xs font-bold text-white">{score.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral">Scoring Breakdown</p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { n: "Semantic", v: candidate.semantic_fit },
                    { n: "Evidence", v: candidate.evidence_strength },
                    { n: "Recency", v: candidate.recency },
                    { n: "Domain", v: candidate.domain_alignment },
                    { n: "Exp", v: candidate.experience_match },
                    { n: "Growth", v: candidate.career_growth },
                  ]} layout="vertical">
                    <XAxis type="number" domain={[0, 100]} stroke="#BABABA" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="n" stroke="#BABABA" tick={{ fontSize: 10 }} width={52} />
                    <Bar dataKey="v" radius={[0, 8, 8, 0]} fill={ACCENT} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "analytics" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">Score Distribution (all candidates)</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ranking.candidates.slice(0, 30)}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" stroke="#BABABA" tick={false} />
                  <YAxis stroke="#BABABA" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: BG, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14 }}
                    formatter={(v: any) => [v.toFixed(1), "Score"]} />
                  <Bar dataKey="signal_score" radius={[6, 6, 0, 0]}>
                    {ranking.candidates.slice(0, 30).map((c, i) => (
                      <Cell key={c.name} fill={c.name === candidate.name ? "#4ADE80" : ACCENT} fillOpacity={c.name === candidate.name ? 1 : 0.5} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">8-Factor Radar</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={[
                  { dim: "Semantic", v: candidate.semantic_fit },
                  { dim: "Evidence", v: candidate.evidence_strength },
                  { dim: "Recency", v: candidate.recency },
                  { dim: "Domain", v: candidate.domain_alignment },
                  { dim: "Experience", v: candidate.experience_match },
                  { dim: "Growth", v: candidate.career_growth },
                  { dim: "Behavioral", v: candidate.behavioral_fit },
                  { dim: "Confidence", v: candidate.confidence },
                ]}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="dim" tick={{ fill: "#BABABA", fontSize: 10 }} />
                  <Radar dataKey="v" stroke={ACCENT} fill={ACCENT} fillOpacity={0.25} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Career Coach ───────────────────────────────────────────────────────────

function CareerCoach() {
  const [resumeFile, setResumeFile] = useState<File[]>([]);
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [result, setResult] = useState<CareerCoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const res = await runCareerCoach(resumeFile[0] || null, resumeText, jdText);
      setResult(res);
    } catch (e: any) {
      setError(e.message || "Analysis failed");
    } finally { setLoading(false); }
  };

  const scoreColor = (v: number) => v >= 70 ? "#4ADE80" : v >= 50 ? ACCENT : "#EF4444";

  return (
    <div className="space-y-6">
      {/* Input */}
      <Card>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15">
            <Target size={18} className="text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">AI Career Coach</h2>
            <p className="text-sm text-neutral">Upload your resume + job description for a full match analysis</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral">Your Resume</p>
            <DropZone label="Upload resume (PDF or TXT)" accept=".pdf,.txt" files={resumeFile}
              onChange={setResumeFile} compact />
            <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} rows={4}
              placeholder="Or paste your resume text here…"
              className="w-full resize-none rounded-[14px] border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral focus:border-accent/50 focus:outline-none" />
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral">Target Job Description</p>
            <textarea value={jdText} onChange={e => setJdText(e.target.value)} rows={8}
              placeholder="Paste the job description you're applying to…"
              className="w-full resize-none rounded-[14px] border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-neutral focus:border-accent/50 focus:outline-none" />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-[14px] bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <motion.button onClick={run} disabled={loading}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 rounded-[16px] bg-accent px-6 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-50">
            {loading ? <Spinner /> : <Brain size={16} />}
            {loading ? "Analysing resume…" : "Analyse My Resume"}
          </motion.button>
        </div>
      </Card>

      {/* Results */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {result && !loading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Hero score */}
          <Card glow>
            <div className="flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
              <ScoreRing score={result.match_score} size={130} />
              <div>
                <p className="text-sm text-neutral">Match Score — {result.target_role}</p>
                <h2 className="mt-1 text-3xl font-bold text-white">{result.name}</h2>
                {result.current_title && <p className="text-neutral">{result.current_title}</p>}
                <div className="mt-3"><TrustBadge label={result.trust_label} /></div>
                <p className="mt-3 text-sm leading-6 text-neutral">{result.recruiter_likelihood}</p>
              </div>
            </div>
          </Card>

          {/* Grid */}
          <div className="grid gap-5 md:grid-cols-2">
            {/* Parsed skills */}
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">Detected Skills</p>
              <div className="flex flex-wrap gap-2">
                {result.parsed_skills.map(s => <Pill key={s} color="gray">{s}</Pill>)}
                {result.parsed_skills.length === 0 && <p className="text-sm text-neutral">No skills detected — try adding a skills section to your resume.</p>}
              </div>
            </Card>

            {/* Skill scores */}
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">Skill Match Scores</p>
              <div className="space-y-2.5">
                {Object.entries(result.skill_scores).slice(0, 8).map(([skill, score]) => (
                  <div key={skill} className="flex items-center gap-3">
                    <span className="w-32 truncate text-right text-xs text-neutral capitalize">{skill}</span>
                    <div className="flex-1"><ScoreBar value={score} color={scoreColor(score)} /></div>
                    <span className="w-8 text-right text-xs font-bold text-white">{score.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Strengths */}
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-400">Your Strengths</p>
              <div className="space-y-2">
                {result.strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-[12px] bg-emerald-500/15 border border-emerald-500/15 px-3 py-2.5">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-400" />
                    <p className="text-sm text-neutral">{s}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Missing skills */}
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-red-400">Missing Must-Have Skills</p>
              {result.missing_must_have.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {result.missing_must_have.map(s => <Pill key={s} color="red">{s}</Pill>)}
                </div>
              ) : (
                <p className="text-sm text-emerald-400">✓ All must-have skills detected!</p>
              )}
              {result.missing_nice_to_have.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-neutral">Nice-to-have gaps:</p>
                  <div className="flex flex-wrap gap-2">
                    {result.missing_nice_to_have.map(s => <Pill key={s} color="gray">{s}</Pill>)}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Resume improvement suggestions */}
          {result.resume_suggestions.length > 0 && (
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">Resume Improvement Suggestions</p>
              <div className="space-y-2">
                {result.resume_suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-[16px] bg-white/5 border border-white/10 p-4">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">{i + 1}</span>
                    <p className="text-sm text-neutral">{s}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Learning roadmap */}
          {result.learning_roadmap.length > 0 && (
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">Learning Roadmap</p>
              <div className="space-y-3">
                {result.learning_roadmap.map((item) => (
                  <div key={item.priority} className="flex items-start gap-4 rounded-[16px] border border-white/10 bg-white/5 p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                      {item.priority}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white capitalize">{item.skill}</span>
                        <Pill color={item.impact.includes("High") ? "orange" : "gray"}>{item.impact}</Pill>
                      </div>
                      <p className="mt-1 text-sm text-neutral">{item.action}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-neutral">{item.timeline}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Interview probes */}
          {result.interview_probes?.length > 0 && (
            <Card>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral">Likely Interview Questions</p>
              <div className="space-y-2">
                {result.interview_probes.map((p, i) => (
                  <div key={i} className="rounded-[14px] bg-white/5 border border-white/10 px-4 py-3 text-sm text-neutral">{p}</div>
                ))}
              </div>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────

export function App() {
  const [mode, setMode] = useState<AppMode>("home");
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRank | null>(null);
  const [selectedRanking, setSelectedRanking] = useState<RankingResponse | null>(null);

  const navItems: { id: AppMode; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <Zap size={15} /> },
    { id: "ranking", label: "Rank Candidates", icon: <Users size={15} /> },
    { id: "coach", label: "Career Coach", icon: <Target size={15} /> },
  ];

  const handleSelectCandidate = (c: CandidateRank, data: RankingResponse) => {
    setSelectedCandidate(c);
    setSelectedRanking(data);
    setMode("ranking"); // stays in ranking but shows detail
  };

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <button onClick={() => { setMode("home"); setSelectedCandidate(null); }}
            className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-xs font-bold text-white">H</div>
            <span className="text-base font-bold tracking-tight text-white">HAZE</span>
            <span className="hidden text-xs text-neutral sm:block">by SignalRank</span>
          </button>

          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 md:flex">
            {navItems.map(item => (
              <button key={item.id} onClick={() => { setMode(item.id); setSelectedCandidate(null); }}
                className={cx(
                  "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition",
                  mode === item.id ? "bg-white text-background" : "text-neutral hover:text-white"
                )}>
                {item.icon} {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <motion.button onClick={() => setMode("coach")}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="hidden items-center gap-2 rounded-[14px] bg-accent px-4 py-2 text-sm font-semibold text-white shadow-glow md:flex">
              <Sparkles size={14} /> Get Coaching
            </motion.button>
            {/* Mobile menu */}
            <div className="flex gap-1 md:hidden">
              {navItems.map(item => (
                <button key={item.id} onClick={() => { setMode(item.id); setSelectedCandidate(null); }}
                  className={cx("rounded-[12px] p-2 transition", mode === item.id ? "bg-accent text-white" : "text-neutral hover:bg-white/10")}>
                  {item.icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <AnimatePresence mode="wait">
          <motion.div key={mode + (selectedCandidate?.name ?? "")}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}>

            {mode === "home" && <Home onMode={setMode} />}

            {mode === "ranking" && !selectedCandidate && (
              <RankingWorkspace onSelect={handleSelectCandidate} />
            )}

            {mode === "ranking" && selectedCandidate && selectedRanking && (
              <CandidateDetail
                candidate={selectedCandidate}
                ranking={selectedRanking}
                onBack={() => setSelectedCandidate(null)}
              />
            )}

            {mode === "coach" && <CareerCoach />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-white/10 py-6 text-center text-xs text-neutral">
        HAZE · AI Hiring Intelligence · Powered by SignalRank · No paid APIs
      </footer>
    </div>
  );
}
