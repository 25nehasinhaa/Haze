import React, { useCallback, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  AlertTriangle, ArrowRight, Brain, CheckCircle2,
  Download, Layers, Loader2, Plus, Search,
  Sparkles, Target, Upload, Users, X, Zap, ChevronRight
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, PolarAngleAxis,
  RadarChart, Radar, PolarGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import {
  fetchDemoRanking, fetchDatasetRanking, uploadAndRank,
  runCareerCoach, downloadSubmissionCSV
} from "./api";
import { fallbackRanking } from "./data/fallback";
import type { CandidateRank, RankingResponse, CareerCoachResult, AppMode, RankingTab } from "./types";

const ACCENT = "#FF6D29";

// ── 3D Tilt Card ────────────────────────────────────────────────────────────
function TiltCard({ children, className = "", onClick }: {
  children: React.ReactNode; className?: string; onClick?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotX = useSpring(useTransform(y, [-0.5, 0.5], [6, -6]), { stiffness: 300, damping: 30 });
  const rotY = useSpring(useTransform(x, [-0.5, 0.5], [-6, 6]), { stiffness: 300, damping: 30 });
  const glareX = useTransform(x, [-0.5, 0.5], [0, 100]);
  const glareY = useTransform(y, [-0.5, 0.5], [0, 100]);

  const handleMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      ref={ref}
      className={`tilt-card ${className}`}
      style={{ rotateX: rotX, rotateY: rotY, transformPerspective: 800 }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      onClick={onClick}
      whileHover={{ scale: 1.015 }}
      transition={{ scale: { type: "spring", stiffness: 300, damping: 25 } }}
    >
      {/* Glare overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-[20px] opacity-0 transition-opacity duration-300 hover:opacity-100"
        style={{
          background: useTransform(
            [glareX, glareY],
            ([gx, gy]) => `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.06), transparent 60%)`
          ),
        }}
      />
      {children}
    </motion.div>
  );
}

// ── Score Ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 120, animate = true }: { score: number; size?: number; animate?: boolean }) {
  const r = (size / 2) * 0.78;
  const circ = 2 * Math.PI * r;
  const color = score >= 70 ? "#4ADE80" : score >= 50 ? ACCENT : "#EF4444";
  const [displayed, setDisplayed] = useState(animate ? 0 : score);

  useEffect(() => {
    if (!animate) return;
    let start: number;
    const duration = 900;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setDisplayed(Math.round(p * score));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [score, animate]);

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6"/>
      <motion.circle
        cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth="6" strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - (score / 100) * circ }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
      />
      <text
        x={size/2} y={size/2 + 2} textAnchor="middle" dominantBaseline="middle"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px`,
          fill: "#fff", fontSize: size * 0.24, fontWeight: 800, fontFamily: "Inter" }}
      >{displayed}</text>
      <text
        x={size/2} y={size/2 + size * 0.19} textAnchor="middle"
        style={{ transform: `rotate(90deg)`, transformOrigin: `${size/2}px ${size/2}px`,
          fill: color, fontSize: size * 0.1, fontWeight: 600, fontFamily: "Inter", letterSpacing: 1 }}
      >SCORE</text>
    </svg>
  );
}

// ── Score Bar ────────────────────────────────────────────────────────────────
function ScoreBar({ value, color = ACCENT, height = 3 }: { value: number; color?: string; height?: number }) {
  return (
    <div className="score-track" style={{ height }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}99, ${color})` }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      />
    </div>
  );
}

// ── Trust Badge ──────────────────────────────────────────────────────────────
function TrustBadge({ label }: { label: string }) {
  const l = label.toLowerCase();
  const cls = l.includes("verified") ? "trust-verified" : l.includes("keyword") ? "trust-risky" : l.includes("potential") ? "trust-potential" : "trust-default";
  const icon = l.includes("verified") ? "✓" : l.includes("keyword") ? "⚠" : l.includes("potential") ? "✦" : "·";
  return (
    <span className={`${cls} inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold`}>
      <span>{icon}</span> {label}
    </span>
  );
}

// ── Pill ─────────────────────────────────────────────────────────────────────
function Pill({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "accent" | "green" | "red" }) {
  const map = {
    default: "bg-white/5 border-white/10 text-neutral-400",
    accent: "bg-orange-500/10 border-orange-500/25 text-orange-400",
    green: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
    red: "bg-red-500/10 border-red-500/20 text-red-400",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${map[variant]}`}>{children}</span>;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="card-editorial p-5 space-y-3">
      {[1,2,3].map(i => <div key={i} className="skeleton rounded-full" style={{ height: 12, width: `${[55,90,70][i-1]}%` }} />)}
    </div>
  );
}

// ── Drop Zone ─────────────────────────────────────────────────────────────────
function DropZone({ label, accept, multiple = false, files, onChange, compact = false }: {
  label: string; accept: string; multiple?: boolean;
  files: File[]; onChange: (f: File[]) => void; compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault(); setDrag(false);
        const dropped = Array.from(e.dataTransfer.files);
        onChange(multiple ? [...files, ...dropped] : dropped.slice(0, 1));
      }}
      onClick={() => ref.current?.click()}
      className={`drop-zone cursor-pointer ${drag ? "dragging" : ""} ${compact ? "px-4 py-3" : "px-5 py-7"}`}
    >
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={e => onChange(multiple ? [...files, ...Array.from(e.target.files||[])] : Array.from(e.target.files||[]).slice(0,1))}
      />
      <div className={`flex items-center gap-3 ${compact ? "" : "flex-col text-center"}`}>
        <Upload size={compact?14:24} className={files.length ? "text-orange-400" : "text-neutral-500"} />
        <div>
          <p className={`${compact?"text-sm":"text-sm"} ${files.length?"text-white font-medium":"text-neutral-400"}`}>
            {files.length ? files.map(f => f.name).join(", ") : label}
          </p>
          {!compact && <p className="mt-1 text-xs text-neutral-600">PDF, TXT, DOCX · drag or click</p>}
        </div>
        {files.length > 0 && (
          <button onClick={e => { e.stopPropagation(); onChange([]); }}
            className="ml-auto rounded-full p-1 text-neutral-500 hover:text-white hover:bg-white/10">
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Home ─────────────────────────────────────────────────────────────────────
function Home({ onMode }: { onMode: (m: AppMode) => void }) {
  return (
    <div>
      {/* Hero */}
      <section className="relative py-28 overflow-hidden">
        {/* Ambient orbs */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(255,109,41,0.12) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div className="pointer-events-none absolute top-20 left-[10%] w-80 h-80 rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(255,109,41,0.06) 0%, transparent 70%)", filter: "blur(60px)" }} />

        <div className="relative text-center max-w-5xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-8"
              style={{ background: "rgba(255,109,41,0.1)", border: "1px solid rgba(255,109,41,0.2)", color: "#FF6D29" }}>
              <Zap size={11} /> AI Hiring Intelligence · SignalRank Engine · No paid APIs
            </div>

            <h1 className="font-black leading-[0.92] tracking-tighter"
              style={{ fontSize: "clamp(3rem, 9vw, 7rem)", letterSpacing: "-0.04em" }}>
              <span className="text-white">Hire by</span>{" "}
              <span className="text-gradient">evidence.</span><br />
              <span className="text-white">Not keywords.</span>
            </h1>

            <p className="mt-7 text-lg leading-8 max-w-2xl mx-auto" style={{ color: "#777" }}>
              HAZE surfaces hidden gems, exposes keyword stuffers, and explains every
              ranking decision — the way a great recruiter thinks.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <motion.button onClick={() => onMode("ranking")}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="btn-accent inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold">
                <Users size={16} /> Rank Candidates
              </motion.button>
              <motion.button onClick={() => onMode("coach")}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="btn-ghost inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-semibold">
                <Target size={16} /> AI Career Coach
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Signal vs Noise demo */}
      <section className="grid gap-4 lg:grid-cols-2 mb-8">
        <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.1 }}
          className="card-editorial p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)", filter:"blur(20px)" }} />
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-red-400">Naive ATS Pick</p>
          </div>
          <p className="text-xl font-bold text-white mb-2">Aarav Keyword</p>
          <p className="text-sm" style={{ color:"#666" }}>437 keyword matches. Zero production evidence. Pattern consistent with ATS gaming.</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="text-3xl font-black" style={{ color:"#ef4444" }}>28</div>
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between text-xs" style={{ color:"#555" }}><span>Evidence</span><span>12/100</span></div>
              <ScoreBar value={12} color="#ef4444" />
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} transition={{ delay:0.15 }}
          className="card-editorial p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full"
            style={{ background:"radial-gradient(circle, rgba(74,222,128,0.08) 0%, transparent 70%)", filter:"blur(20px)" }} />
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">SignalRank Pick</p>
          </div>
          <p className="text-xl font-bold text-white mb-2">Ira Dalal</p>
          <p className="text-sm" style={{ color:"#666" }}>Lower keyword count. Production ownership of retrieval pipeline at 10M QPD. Verified.</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="text-3xl font-black text-emerald-400">93</div>
            <div className="flex-1 space-y-1.5">
              <div className="flex justify-between text-xs" style={{ color:"#555" }}><span>Evidence</span><span>93/100</span></div>
              <ScoreBar value={93} color="#4ade80" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Feature grid */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: <Brain size={20} />, title: "Evidence Validation", desc: "Detects unsupported claims, stale experience, and keyword inflation." },
          { icon: <Sparkles size={20} />, title: "Hidden Gem Detection", desc: "Transfers credit for adjacent skills. Finds candidates ATS systems miss." },
          { icon: <Target size={20} />, title: "Career Coach", desc: "Upload your resume. Get match score, skill gaps, and a learning roadmap." },
        ].map(({ icon, title, desc }, i) => (
          <TiltCard key={title} className="card-editorial p-6">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: "rgba(255,109,41,0.12)", color: "#FF6D29" }}>{icon}</div>
            <h3 className="text-base font-bold text-white mb-2">{title}</h3>
            <p className="text-sm leading-6" style={{ color: "#666" }}>{desc}</p>
          </TiltCard>
        ))}
      </section>
    </div>
  );
}

// ── Ranking Workspace ─────────────────────────────────────────────────────────
type RankingSource = "demo" | "dataset" | "upload";

function RankingWorkspace({ onSelect }: { onSelect: (c: CandidateRank, data: RankingResponse) => void }) {
  const [source, setSource] = useState<RankingSource>("demo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<RankingResponse | null>(null);
  const [jdText, setJdText] = useState("");
  const [jdFiles, setJdFiles] = useState<File[]>([]);
  const [resumeFiles, setResumeFiles] = useState<File[]>([]);
  const [includeDataset, setIncludeDataset] = useState(true);
  const [topK, setTopK] = useState(50);
  const [search, setSearch] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const run = useCallback(async () => {
    setLoading(true); setError("");
    try {
      let result: RankingResponse;
      if (source === "demo") result = await fetchDemoRanking();
      else if (source === "dataset") result = await fetchDatasetRanking(topK);
      else {
        const jd = jdText || (jdFiles[0] ? await jdFiles[0].text() : "");
        result = await uploadAndRank(jd, resumeFiles, includeDataset, topK);
      }
      setData(result);
    } catch (e: any) {
      setError(e.message || "Failed");
      setData(fallbackRanking);
    } finally { setLoading(false); }
  }, [source, jdText, jdFiles, resumeFiles, includeDataset, topK]);

  const handleDownload = async () => {
    try {
      const blob = await downloadSubmissionCSV();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "haze_submission.csv"; a.click();
    } catch { setError("Export failed"); }
  };

  const filtered = (data?.candidates ?? []).filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.current_title || "").toLowerCase().includes(search.toLowerCase())
  );

  const scoreColor = (v: number) => v >= 70 ? "#4ade80" : v >= 50 ? ACCENT : "#ef4444";

  return (
    <div className="space-y-5">
      {/* Control bar */}
      <div className="card-editorial p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Source tabs */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
            {(["demo","dataset","upload"] as RankingSource[]).map(s => (
              <button key={s} onClick={() => setSource(s)}
                className={`px-4 py-2 text-sm font-semibold transition capitalize ${s === source ? "bg-orange-500 text-white" : "text-neutral-400 hover:text-white"}`}>
                {s === "demo" ? "Demo" : s === "dataset" ? "Dataset 100k" : "Upload Files"}
              </button>
            ))}
          </div>

          {source === "dataset" && (
            <select value={topK} onChange={e => setTopK(Number(e.target.value))}
              className="input-field px-3 py-2 text-sm rounded-xl">
              {[20,50,100].map(n => <option key={n} value={n} style={{ background:"#111" }}>Top {n}</option>)}
            </select>
          )}

          <div className="flex-1" />
          <button onClick={handleDownload} className="btn-ghost inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium">
            <Download size={14} /> Export CSV
          </button>
          <motion.button onClick={run} disabled={loading} whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
            className="btn-accent inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-40">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {loading ? "Ranking…" : "Run SignalRank"}
          </motion.button>
        </div>

        {/* Upload form */}
        <AnimatePresence>
          {source === "upload" && (
            <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
              className="grid gap-4 mt-4 pt-4 md:grid-cols-2 overflow-hidden"
              style={{ borderTop:"1px solid rgba(255,255,255,0.07)" }}>
              <div className="space-y-2.5">
                <p className="section-label">Job Description</p>
                <DropZone label="Upload JD (PDF, DOCX, TXT)" accept=".pdf,.txt,.docx" files={jdFiles} onChange={setJdFiles} compact />
                <textarea value={jdText} onChange={e => setJdText(e.target.value)} rows={3}
                  placeholder="Or paste JD text here…"
                  className="input-field w-full resize-none px-3 py-2 text-sm" style={{ borderRadius:14 }} />
              </div>
              <div className="space-y-2.5">
                <p className="section-label">Resumes</p>
                <DropZone label="Upload resumes (PDF, TXT)" accept=".pdf,.txt" multiple files={resumeFiles} onChange={setResumeFiles} compact />
                <label className="flex items-center gap-2 cursor-pointer text-sm text-neutral-400">
                  <input type="checkbox" checked={includeDataset} onChange={e => setIncludeDataset(e.target.checked)}
                    className="h-4 w-4 rounded" style={{ accentColor: "#FF6D29" }} />
                  Also rank vs full dataset
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-red-400"
            style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.18)" }}>
            <AlertTriangle size={13} /> {error}
          </div>
        )}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({length:6}).map((_,i) => <Skeleton key={i} />)}
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="space-y-5">
          {/* Metrics strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label:"Candidates", value:data.candidates.length },
              { label:"Avg Score", value:(data.metrics?.average_signal_score ?? 0).toFixed(1) },
              { label:"Verified", value:data.metrics?.verified_matches ?? 0 },
              { label:"Corrected", value:data.ranking_corrected ? "✓ Yes" : "No" },
            ].map(({ label, value }) => (
              <div key={label} className="card-editorial p-4">
                <p className="text-xs text-neutral-600 mb-1">{label}</p>
                <p className="text-2xl font-black text-white" style={{ letterSpacing:"-0.03em" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Insights */}
          {data.insights?.length > 0 && (
            <div className="card-editorial p-5">
              <p className="section-label mb-3">AI Insights</p>
              <div className="grid gap-2 md:grid-cols-2">
                {data.insights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3"
                    style={{ background:"rgba(255,109,41,0.05)", border:"1px solid rgba(255,109,41,0.12)" }}>
                    <Brain size={12} className="mt-0.5 shrink-0 text-orange-400" />
                    <p className="text-sm text-neutral-400">{ins}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}>
              <Search size={13} style={{ color:"#555" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search candidates…"
                className="bg-transparent text-sm text-white outline-none w-44 placeholder-neutral-600" />
            </div>
            <p className="text-sm text-neutral-600">{filtered.length} results</p>
            {compareIds.length >= 2 && (
              <button onClick={() => setShowCompare(true)}
                className="ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-orange-400"
                style={{ background:"rgba(255,109,41,0.1)", border:"1px solid rgba(255,109,41,0.2)" }}>
                <Layers size={14} /> Compare ({compareIds.length})
              </button>
            )}
          </div>

          {/* Candidate cards */}
          <div className="space-y-2.5">
            {filtered.map((c, i) => (
              <TiltCard key={c.name+c.rank} className="card-editorial cursor-pointer p-5">
                <div className="flex items-center gap-4" onClick={() => onSelect(c, data)}>
                  {/* Rank */}
                  <div className="rank-badge flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black"
                    style={{ background:"rgba(255,109,41,0.1)", color:"#FF6D29", border:"1px solid rgba(255,109,41,0.2)" }}>
                    {c.rank}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-base font-bold text-white">{c.name}</span>
                      <TrustBadge label={c.trust_label} />
                      {c.current_title && <span className="text-xs text-neutral-500">{c.current_title}</span>}
                    </div>
                    <p className="text-sm text-neutral-600 truncate">{c.summary?.slice(0,100)}</p>
                    <div className="mt-2.5">
                      <ScoreBar value={c.signal_score} />
                    </div>
                  </div>

                  {/* Score */}
                  <div className="shrink-0 text-right">
                    <div className="text-3xl font-black" style={{ color: scoreColor(c.signal_score), letterSpacing:"-0.04em" }}>
                      {c.signal_score.toFixed(1)}
                    </div>
                    <p className="text-xs text-neutral-600">SignalRank</p>
                  </div>

                  {/* Mini bars */}
                  <div className="hidden lg:block shrink-0 w-32 space-y-2">
                    {[["Semantic", c.semantic_fit],["Evidence", c.evidence_strength],["Recency", c.recency]].map(([l,v]) => (
                      <div key={l as string} className="flex items-center gap-2">
                        <span className="text-xs text-neutral-600 w-14 text-right">{l}</span>
                        <div className="flex-1"><ScoreBar value={v as number} height={2} /></div>
                      </div>
                    ))}
                  </div>

                  {/* Compare toggle */}
                  <button onClick={e => {
                    e.stopPropagation();
                    setCompareIds(ids => ids.includes(c.name) ? ids.filter(i=>i!==c.name) : ids.length<4 ? [...ids,c.name] : ids);
                  }} className={`hidden md:flex shrink-0 rounded-full p-1.5 transition ${compareIds.includes(c.name) ? "bg-orange-500/20 text-orange-400" : "text-neutral-600 hover:bg-white/10 hover:text-white"}`}>
                    <Plus size={13} />
                  </button>

                  <ChevronRight size={16} className="text-neutral-700 shrink-0" />
                </div>
              </TiltCard>
            ))}
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {showCompare && data && (
          <CompareModal candidates={data.candidates.filter(c=>compareIds.includes(c.name))} onClose={() => setShowCompare(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Compare Modal ──────────────────────────────────────────────────────────────
function CompareModal({ candidates, onClose }: { candidates: CandidateRank[]; onClose: () => void }) {
  const colors = ["#FF6D29","#4ADE80","#F59E0B","#A78BFA"];
  const dims = ["semantic_fit","evidence_strength","recency","domain_alignment","experience_match","behavioral_fit"];

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)" }}
      onClick={onClose}>
      <motion.div initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.9, opacity:0 }}
        onClick={e=>e.stopPropagation()}
        className="card-editorial w-full max-w-5xl rounded-3xl p-8 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-7">
          <h2 className="text-2xl font-black text-white">Side-by-Side Comparison</h2>
          <button onClick={onClose} className="rounded-full p-2 text-neutral-500 hover:text-white hover:bg-white/10"><X size={16} /></button>
        </div>

        {/* Score cards */}
        <div className="grid gap-4 mb-8" style={{ gridTemplateColumns:`repeat(${candidates.length},1fr)` }}>
          {candidates.map((c, i) => (
            <div key={c.name} className="rounded-2xl p-5 text-center"
              style={{ background:`rgba(${i===0?"255,109,41":i===1?"74,222,128":i===2?"245,158,11":"167,139,250"},0.06)`, border:`1px solid rgba(${i===0?"255,109,41":i===1?"74,222,128":i===2?"245,158,11":"167,139,250"},0.18)` }}>
              <div className="flex justify-center mb-3">
                <ScoreRing score={c.signal_score} size={88} />
              </div>
              <p className="font-bold text-white">{c.name}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{c.current_title}</p>
              <div className="mt-2"><TrustBadge label={c.trust_label} /></div>
            </div>
          ))}
        </div>

        {/* Radar */}
        <div className="h-64 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={dims.map(d => ({ dim: d.replace("_"," "), ...Object.fromEntries(candidates.map(c => [c.name, (c as any)[d]])) }))}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis dataKey="dim" tick={{ fill:"#555", fontSize:10 }} />
              {candidates.map((c,i) => (
                <Radar key={c.name} name={c.name} dataKey={c.name} stroke={colors[i]} fill={colors[i]} fillOpacity={0.12} strokeWidth={1.5} />
              ))}
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Dimension bars */}
        <div className="space-y-4">
          {dims.map(dim => (
            <div key={dim}>
              <p className="text-xs text-neutral-600 mb-2 capitalize">{dim.replace("_"," ")}</p>
              <div className="space-y-1.5">
                {candidates.map((c,i) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="text-xs text-neutral-600 w-24 text-right truncate">{c.name}</span>
                    <div className="flex-1"><ScoreBar value={(c as any)[dim] ?? 0} color={colors[i]} /></div>
                    <span className="text-xs text-white font-bold w-8 text-right">{((c as any)[dim]??0).toFixed(0)}</span>
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

// ── Candidate Detail ──────────────────────────────────────────────────────────
function CandidateDetail({ candidate: c, ranking, onBack }: { candidate: CandidateRank; ranking: RankingResponse; onBack: () => void }) {
  const [tab, setTab] = useState<RankingTab>("detail");
  const scoreColor = (v: number) => v >= 70 ? "#4ade80" : v >= 50 ? ACCENT : "#ef4444";
  const skills = Object.entries(c.skill_scores || {});

  return (
    <div className="space-y-5">
      {/* Back + tabs */}
      <div className="flex items-center gap-3">
        <button onClick={onBack}
          className="btn-ghost inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium">
          ← Back
        </button>
        <div className="flex rounded-xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.03)" }}>
          {(["detail","explain","analytics"] as RankingTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold capitalize transition ${t===tab ? "bg-orange-500 text-white" : "text-neutral-400 hover:text-white"}`}>
              {t === "detail" ? "Profile" : t === "explain" ? "Explainability" : "Analytics"}
            </button>
          ))}
        </div>
      </div>

      {/* Hero card */}
      <div className="card-editorial p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none"
          style={{ background:"radial-gradient(circle, rgba(255,109,41,0.06) 0%, transparent 70%)", filter:"blur(40px)", transform:"translate(30%,-30%)" }} />
        <div className="flex items-start gap-5 relative">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black"
            style={{ background:"rgba(255,109,41,0.12)", color:"#FF6D29", border:"1px solid rgba(255,109,41,0.2)" }}>
            {c.name.split(" ").map(w=>w[0]).join("").slice(0,2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-white">{c.name}</h1>
              <TrustBadge label={c.trust_label} />
              <span className="text-xs text-neutral-600">Rank #{c.rank}</span>
            </div>
            {c.current_title && <p className="text-sm text-neutral-500 mb-2">{c.current_title}{c.years_of_experience ? ` · ${c.years_of_experience}y exp` : ""}</p>}
            <p className="text-sm text-neutral-500 leading-6">{c.summary}</p>
            <p className="mt-3 text-sm text-neutral-400 font-medium italic">"{c.recommendation}"</p>
          </div>
          <div className="shrink-0"><ScoreRing score={c.signal_score} size={110} /></div>
        </div>
      </div>

      {tab === "detail" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {/* 8-factor grid */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {([
                ["Semantic Fit", c.semantic_fit], ["Evidence", c.evidence_strength],
                ["Recency", c.recency], ["Domain Align", c.domain_alignment],
                ["Experience", c.experience_match], ["Growth", c.career_growth],
                ["Behavioral", c.behavioral_fit], ["Confidence", c.confidence],
              ] as [string, number][]).map(([label, value]) => (
                <TiltCard key={label} className="card-editorial p-4">
                  <p className="text-xs text-neutral-600 mb-1">{label}</p>
                  <p className="text-xl font-black mb-2" style={{ color: scoreColor(value), letterSpacing:"-0.03em" }}>{value.toFixed(0)}</p>
                  <ScoreBar value={value} color={scoreColor(value)} />
                </TiltCard>
              ))}
            </div>

            {/* Strengths */}
            {c.strengths?.length > 0 && (
              <div className="card-editorial p-5">
                <p className="section-label mb-3" style={{ color:"#4ade80" }}>Strengths</p>
                <div className="space-y-2">
                  {c.strengths.map((s,i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3"
                      style={{ background:"rgba(74,222,128,0.06)", border:"1px solid rgba(74,222,128,0.14)" }}>
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0" style={{ color:"#4ade80" }} />
                      <p className="text-sm text-neutral-400">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Concerns */}
            {c.concerns?.filter(x => !x.includes("No major")).length > 0 && (
              <div className="card-editorial p-5">
                <p className="section-label mb-3" style={{ color:"#ef4444" }}>Concerns</p>
                <div className="space-y-2">
                  {c.concerns.filter(x=>!x.includes("No major")).map((x,i) => (
                    <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3"
                      style={{ background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.14)" }}>
                      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-400" />
                      <p className="text-sm text-neutral-400">{x}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-5">
            {/* SNR */}
            <div className="card-editorial p-5">
              <p className="section-label mb-3">Signal-to-Noise Ratio</p>
              <p className="text-4xl font-black text-white mb-3" style={{ letterSpacing:"-0.04em" }}>{c.snr.toFixed(2)}</p>
              <ScoreBar value={c.snr * 100} />
              <p className="mt-3 text-xs text-neutral-600">Higher SNR = more evidence, less noise. Good candidates have SNR &gt; 1.0</p>
            </div>

            {/* Gaps */}
            {c.gaps?.length > 0 && (
              <div className="card-editorial p-5">
                <p className="section-label mb-3" style={{ color:"#f59e0b" }}>Skill Gaps</p>
                <div className="space-y-2">
                  {c.gaps.map((g,i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2"
                      style={{ background:"rgba(245,158,11,0.06)", border:"1px solid rgba(245,158,11,0.15)" }}>
                      <span className="text-sm text-white">{g.skill}</span>
                      <Pill variant={g.type.includes("critical") ? "red" : "default"}>{g.type}</Pill>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interview probes */}
            <div className="card-editorial p-5">
              <p className="section-label mb-3">Interview Probes</p>
              <div className="space-y-2">
                {c.interview_probes?.map((p,i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-3"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background:"rgba(255,109,41,0.15)", color:"#FF6D29" }}>{i+1}</span>
                    <p className="text-sm text-neutral-400">{p}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "explain" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card-editorial p-6">
            <p className="section-label mb-4">Skill Match Breakdown</p>
            <div className="space-y-3">
              {skills.map(([skill, score]) => (
                <div key={skill} className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500 w-36 text-right capitalize truncate">{skill}</span>
                  <div className="flex-1"><ScoreBar value={score} color={scoreColor(score)} /></div>
                  <span className="text-xs font-bold text-white w-8 text-right">{score.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card-editorial p-6">
            <p className="section-label mb-4">Factor Comparison</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  {n:"Semantic",v:c.semantic_fit},{n:"Evidence",v:c.evidence_strength},
                  {n:"Recency",v:c.recency},{n:"Domain",v:c.domain_alignment},
                  {n:"Exp",v:c.experience_match},{n:"Growth",v:c.career_growth},
                ]} layout="vertical">
                  <XAxis type="number" domain={[0,100]} stroke="#333" tick={{ fontSize:10, fill:"#555" }} />
                  <YAxis type="category" dataKey="n" stroke="#333" tick={{ fontSize:10, fill:"#555" }} width={52} />
                  <Tooltip contentStyle={{ background:"#111", border:"1px solid #222", borderRadius:12, color:"#fff" }}
                    formatter={(v: any) => [`${v.toFixed(1)}`, ""]} />
                  <Bar dataKey="v" radius={[0,8,8,0]}>
                    {[c.semantic_fit,c.evidence_strength,c.recency,c.domain_alignment,c.experience_match,c.career_growth].map((v,i) => (
                      <Cell key={i} fill={scoreColor(v)} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {tab === "analytics" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card-editorial p-6">
            <p className="section-label mb-4">Score Distribution (top 30)</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ranking.candidates.slice(0,30)}>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="name" stroke="#333" tick={false} />
                  <YAxis stroke="#333" tick={{ fontSize:10, fill:"#555" }} />
                  <Tooltip contentStyle={{ background:"#111", border:"1px solid #222", borderRadius:12, color:"#fff" }}
                    formatter={(v: any) => [v.toFixed(1), "Score"]} />
                  <Bar dataKey="signal_score" radius={[5,5,0,0]}>
                    {ranking.candidates.slice(0,30).map((cand,i) => (
                      <Cell key={i} fill={cand.name===c.name?"#4ade80":ACCENT} fillOpacity={cand.name===c.name?1:0.4} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card-editorial p-6">
            <p className="section-label mb-4">8-Factor Radar</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={[
                  {d:"Semantic",v:c.semantic_fit},{d:"Evidence",v:c.evidence_strength},
                  {d:"Recency",v:c.recency},{d:"Domain",v:c.domain_alignment},
                  {d:"Experience",v:c.experience_match},{d:"Growth",v:c.career_growth},
                  {d:"Behavioral",v:c.behavioral_fit},{d:"Confidence",v:c.confidence},
                ]}>
                  <PolarGrid stroke="rgba(255,255,255,0.06)" />
                  <PolarAngleAxis dataKey="d" tick={{ fill:"#555", fontSize:10 }} />
                  <Radar dataKey="v" stroke={ACCENT} fill={ACCENT} fillOpacity={0.18} strokeWidth={1.5} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Career Coach ──────────────────────────────────────────────────────────────
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
      setResult(await runCareerCoach(resumeFile[0]||null, resumeText, jdText));
    } catch (e: any) { setError(e.message || "Analysis failed"); }
    finally { setLoading(false); }
  };

  const scoreColor = (v: number) => v >= 70 ? "#4ade80" : v >= 50 ? ACCENT : "#ef4444";

  return (
    <div className="space-y-6">
      {/* Input panel */}
      <div className="card-editorial p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 flex items-center justify-center rounded-xl" style={{ background:"rgba(255,109,41,0.12)", border:"1px solid rgba(255,109,41,0.2)" }}>
            <Target size={18} style={{ color:"#FF6D29" }} />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">AI Career Coach</h2>
            <p className="text-sm text-neutral-600">Get a recruiter-grade analysis of your resume vs any job description</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2.5">
            <p className="section-label">Your Resume</p>
            <DropZone label="Upload PDF or TXT" accept=".pdf,.txt" files={resumeFile} onChange={setResumeFile} compact />
            <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} rows={5}
              placeholder="Or paste your resume text here…"
              className="input-field w-full resize-none px-3 py-2.5 text-sm" style={{ borderRadius:14 }} />
          </div>
          <div className="space-y-2.5">
            <p className="section-label">Target Job Description</p>
            <textarea value={jdText} onChange={e => setJdText(e.target.value)} rows={9}
              placeholder="Paste the job description you're applying to…"
              className="input-field w-full resize-none px-3 py-2.5 text-sm" style={{ borderRadius:14 }} />
          </div>
        </div>

        {error && <div className="mt-3 rounded-xl px-4 py-3 text-sm text-red-400" style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.16)" }}>{error}</div>}

        <div className="mt-4 flex justify-end">
          <motion.button onClick={run} disabled={loading} whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
            className="btn-accent inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold disabled:opacity-40">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Brain size={15} />}
            {loading ? "Analysing…" : "Analyse My Resume"}
          </motion.button>
        </div>
      </div>

      {loading && <div className="grid gap-4 md:grid-cols-2">{Array.from({length:4}).map((_,i)=><Skeleton key={i}/>)}</div>}

      {result && !loading && (
        <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} className="space-y-5">
          {/* Hero */}
          <div className="card-editorial p-6 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none"
              style={{ background:`radial-gradient(ellipse at 80% 50%, rgba(255,109,41,0.08) 0%, transparent 60%)` }} />
            <div className="flex flex-col gap-4 md:flex-row items-center md:items-start relative">
              <ScoreRing score={result.match_score} size={130} />
              <div>
                <p className="text-sm text-neutral-600 mb-1">{result.target_role}</p>
                <h2 className="text-3xl font-black text-white mb-1" style={{ letterSpacing:"-0.04em" }}>{result.name}</h2>
                {result.current_title && <p className="text-neutral-500 text-sm mb-2">{result.current_title}</p>}
                <TrustBadge label={result.trust_label} />
                <p className="mt-3 text-sm text-neutral-400 leading-6">{result.recruiter_likelihood}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {/* Skills detected */}
            <div className="card-editorial p-5">
              <p className="section-label mb-3">Detected Skills</p>
              <div className="flex flex-wrap gap-2">
                {result.parsed_skills.length > 0 ? result.parsed_skills.map(s => <Pill key={s}>{s}</Pill>) :
                  <p className="text-sm text-neutral-600">No skills detected. Add a dedicated skills section.</p>}
              </div>
            </div>

            {/* Skill scores */}
            <div className="card-editorial p-5">
              <p className="section-label mb-3">Skill Match Scores</p>
              <div className="space-y-2.5">
                {Object.entries(result.skill_scores).slice(0,8).map(([skill, score]) => (
                  <div key={skill} className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500 w-32 text-right truncate capitalize">{skill}</span>
                    <div className="flex-1"><ScoreBar value={score} color={scoreColor(score)} /></div>
                    <span className="text-xs font-bold text-white w-8 text-right">{score.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Strengths */}
            <div className="card-editorial p-5">
              <p className="section-label mb-3" style={{ color:"#4ade80" }}>Your Strengths</p>
              <div className="space-y-2">
                {result.strengths.map((s,i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5"
                    style={{ background:"rgba(74,222,128,0.06)", border:"1px solid rgba(74,222,128,0.14)" }}>
                    <CheckCircle2 size={12} className="mt-0.5 shrink-0" style={{ color:"#4ade80" }} />
                    <p className="text-sm text-neutral-400">{s}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Missing skills */}
            <div className="card-editorial p-5">
              <p className="section-label mb-3" style={{ color:"#ef4444" }}>Missing Must-Have Skills</p>
              {result.missing_must_have.length > 0 ? (
                <div className="flex flex-wrap gap-2">{result.missing_must_have.map(s => <Pill key={s} variant="red">{s}</Pill>)}</div>
              ) : (
                <p className="text-sm text-emerald-400 font-semibold">✓ All must-have skills detected!</p>
              )}
              {result.missing_nice_to_have.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-neutral-600 mb-2">Nice-to-have gaps:</p>
                  <div className="flex flex-wrap gap-2">{result.missing_nice_to_have.map(s => <Pill key={s}>{s}</Pill>)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Resume suggestions */}
          {result.resume_suggestions.length > 0 && (
            <div className="card-editorial p-5">
              <p className="section-label mb-3">Resume Improvement Suggestions</p>
              <div className="space-y-2">
                {result.resume_suggestions.map((s,i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3"
                    style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background:"rgba(255,109,41,0.15)", color:"#FF6D29" }}>{i+1}</span>
                    <p className="text-sm text-neutral-400">{s}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Learning roadmap */}
          {result.learning_roadmap.length > 0 && (
            <div className="card-editorial p-5">
              <p className="section-label mb-4">Learning Roadmap</p>
              <div className="space-y-3">
                {result.learning_roadmap.map(item => (
                  <TiltCard key={item.priority} className="card-editorial p-4">
                    <div className="flex items-start gap-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black"
                        style={{ background:"rgba(255,109,41,0.15)", color:"#FF6D29" }}>{item.priority}</span>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-white capitalize">{item.skill}</span>
                          <Pill variant={item.impact.includes("High") ? "accent" : "default"}>{item.impact}</Pill>
                        </div>
                        <p className="text-sm text-neutral-500">{item.action}</p>
                      </div>
                      <span className="text-xs text-neutral-600 shrink-0">{item.timeline}</span>
                    </div>
                  </TiltCard>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export function App() {
  const [mode, setMode] = useState<AppMode>("home");
  const [selected, setSelected] = useState<{ c: CandidateRank; data: RankingResponse } | null>(null);

  const nav = [
    { id: "home" as AppMode, label: "Home" },
    { id: "ranking" as AppMode, label: "Rank Candidates" },
    { id: "coach" as AppMode, label: "Career Coach" },
  ];

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-40"
        style={{ background:"rgba(8,6,8,0.85)", borderBottom:"1px solid rgba(255,255,255,0.06)", backdropFilter:"blur(20px)" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <button onClick={() => { setMode("home"); setSelected(null); }}
            className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black text-white"
              style={{ background:"linear-gradient(135deg, #FF6D29, #c94a14)" }}>H</div>
            <span className="text-base font-black tracking-tight text-white">HAZE</span>
            <span className="hidden text-xs text-neutral-600 sm:block">· SignalRank</span>
          </button>

          <nav className="hidden items-center gap-1 rounded-2xl p-1 md:flex"
            style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)" }}>
            {nav.map(item => (
              <button key={item.id} onClick={() => { setMode(item.id); setSelected(null); }}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${mode === item.id ? "bg-white text-black" : "text-neutral-400 hover:text-white"}`}>
                {item.label}
              </button>
            ))}
          </nav>

          <motion.button onClick={() => setMode("coach")}
            whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
            className="btn-accent hidden items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold md:flex">
            <Sparkles size={14} /> Get Coaching
          </motion.button>

          {/* Mobile */}
          <div className="flex gap-1 md:hidden">
            {nav.map(item => (
              <button key={item.id} onClick={() => { setMode(item.id); setSelected(null); }}
                className={`rounded-xl p-2 transition ${mode===item.id ? "bg-orange-500 text-white" : "text-neutral-500 hover:bg-white/10"}`}>
                {item.id==="home" ? <Zap size={16}/> : item.id==="ranking" ? <Users size={16}/> : <Target size={16}/>}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <AnimatePresence mode="wait">
          <motion.div key={mode + (selected?.c.name ?? "")}
            initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}
            transition={{ duration:0.18 }}>
            {mode==="home" && <Home onMode={setMode} />}
            {mode==="ranking" && !selected && (
              <RankingWorkspace onSelect={(c, data) => setSelected({ c, data })} />
            )}
            {mode==="ranking" && selected && (
              <CandidateDetail candidate={selected.c} ranking={selected.data} onBack={() => setSelected(null)} />
            )}
            {mode==="coach" && <CareerCoach />}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mt-20 py-6 text-center text-xs text-neutral-700"
        style={{ borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        HAZE · Evidence-Based Hiring Intelligence · SignalRank Engine · No Paid APIs
      </footer>
    </div>
  );
}
