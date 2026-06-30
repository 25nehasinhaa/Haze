import React, { useCallback, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  AlertTriangle, ArrowRight, Award, BookOpen, Brain, CheckCircle2,
  ChevronRight, Download, FileText, Gauge, Layers, Loader2,
  MapPin, Plus, Search, Shield, Sparkles, Star, Target, TrendingUp,
  Upload, Users, X, Zap, Clock, BarChart3, Lightbulb, Rocket
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, PolarAngleAxis,
  RadarChart, Radar, PolarGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { fetchDemoRanking, fetchDatasetRanking, uploadAndRank, runCareerCoach, downloadSubmissionCSV } from "./api";
import { fallbackRanking } from "./data/fallback";
import type { CandidateRank, RankingResponse, CareerCoachResult, AppMode, RankingTab } from "./types";

const ACCENT = "#FF6D29";
const BG = "#080608";

// ── 3D Tilt ──────────────────────────────────────────────────────────────────
function TiltCard({ children, className = "", onClick, intensity = 6 }: {
  children: React.ReactNode; className?: string; onClick?: () => void; intensity?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0); const y = useMotionValue(0);
  const rotX = useSpring(useTransform(y, [-0.5,0.5],[intensity,-intensity]),{stiffness:300,damping:30});
  const rotY = useSpring(useTransform(x, [-0.5,0.5],[-intensity,intensity]),{stiffness:300,damping:30});
  const gx = useTransform(x,[-0.5,0.5],[0,100]);
  const gy = useTransform(y,[-0.5,0.5],[0,100]);
  return (
    <motion.div ref={ref} className={`tilt-card ${className}`}
      style={{ rotateX:rotX, rotateY:rotY, transformPerspective:800 }}
      onMouseMove={e => {
        const r = ref.current?.getBoundingClientRect();
        if(!r) return;
        x.set((e.clientX-r.left)/r.width-0.5);
        y.set((e.clientY-r.top)/r.height-0.5);
      }}
      onMouseLeave={() => {x.set(0);y.set(0);}}
      onClick={onClick}
      whileHover={{scale:1.012}}
      transition={{scale:{type:"spring",stiffness:300,damping:25}}}>
      <motion.div className="pointer-events-none absolute inset-0 rounded-[20px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{background:useTransform([gx,gy],([a,b])=>`radial-gradient(circle at ${a}% ${b}%, rgba(255,255,255,0.055), transparent 60%)`)}} />
      {children}
    </motion.div>
  );
}

// ── Score Ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size=120, label="SCORE" }: { score: number; size?: number; label?: string }) {
  const r=(size/2)*0.78; const circ=2*Math.PI*r;
  const col = score>=70?"#4ADE80":score>=50?ACCENT:"#EF4444";
  const [n,setN]=useState(0);
  useEffect(()=>{
    let s:number; const D=900;
    const step=(t:number)=>{if(!s)s=t;const p=Math.min((t-s)/D,1);setN(Math.round(p*score));if(p<1)requestAnimationFrame(step);};
    requestAnimationFrame(step);
  },[score]);
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6"/>
      <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={circ} initial={{strokeDashoffset:circ}}
        animate={{strokeDashoffset:circ-(score/100)*circ}} transition={{duration:.9,ease:"easeOut"}}
        style={{filter:`drop-shadow(0 0 8px ${col}70)`}}/>
      <text x={size/2} y={size/2-2} textAnchor="middle" dominantBaseline="middle"
        style={{transform:`rotate(90deg)`,transformOrigin:`${size/2}px ${size/2}px`,fill:"#fff",fontSize:size*.25,fontWeight:800,fontFamily:"Inter"}}>{n}</text>
      <text x={size/2} y={size/2+size*.2} textAnchor="middle"
        style={{transform:`rotate(90deg)`,transformOrigin:`${size/2}px ${size/2}px`,fill:col,fontSize:size*.09,fontWeight:700,fontFamily:"Inter",letterSpacing:1}}>{label}</text>
    </svg>
  );
}

// ── Gauge Meter (semicircle) ──────────────────────────────────────────────────
function GaugeMeter({ value, label, size=100 }: { value: number; label: string; size?: number }) {
  const col = value>=70?"#4ADE80":value>=50?ACCENT:"#EF4444";
  const angle = -180 + (value/100)*180;
  const r=(size/2)*0.82; const cx=size/2; const cy=size*.55;
  // semicircle arc
  const startX=cx-r; const startY=cy;
  const endX=cx+r; const endY=cy;
  const pctX=cx+r*Math.cos((angle*Math.PI)/180); const pctY=cy+r*Math.sin((angle*Math.PI)/180);
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size*.6}>
        <path d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${endX} ${cy}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round"/>
        <motion.path d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${pctX} ${pctY}`} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round"
          initial={{pathLength:0}} animate={{pathLength:value/100}} transition={{duration:.9,ease:"easeOut"}}
          style={{filter:`drop-shadow(0 0 5px ${col}60)`}}/>
        <text x={cx} y={cy-4} textAnchor="middle" style={{fill:"#fff",fontSize:size*.22,fontWeight:800,fontFamily:"Inter"}}>{value}</text>
      </svg>
      <p className="text-xs font-semibold mt-1" style={{color:col}}>{label}</p>
    </div>
  );
}

// ── Score Bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ value, color=ACCENT, height=3 }: { value: number; color?: string; height?: number }) {
  return (
    <div className="score-track" style={{height}}>
      <motion.div className="h-full rounded-full" style={{background:`linear-gradient(90deg, ${color}80, ${color})`}}
        initial={{width:0}} animate={{width:`${Math.min(value,100)}%`}} transition={{duration:.7,ease:"easeOut"}}/>
    </div>
  );
}

// ── Trust Badge ───────────────────────────────────────────────────────────────
function TrustBadge({ label }: { label: string }) {
  const l=label.toLowerCase();
  const cls=l.includes("verified")?"trust-verified":l.includes("keyword")?"trust-risky":l.includes("potential")?"trust-potential":"trust-default";
  const icon=l.includes("verified")?"✓":l.includes("keyword")?"⚠":l.includes("potential")?"✦":"·";
  return <span className={`${cls} inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold`}>{icon} {label}</span>;
}

function Pill({ children, variant="default" }: { children: React.ReactNode; variant?: "default"|"accent"|"green"|"red"|"amber" }) {
  const m={default:"bg-white/5 border-white/10 text-neutral-400",accent:"bg-orange-500/10 border-orange-500/25 text-orange-400",
    green:"bg-emerald-500/10 border-emerald-500/25 text-emerald-400",red:"bg-red-500/10 border-red-500/20 text-red-400",
    amber:"bg-amber-500/10 border-amber-500/20 text-amber-400"};
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${m[variant]}`}>{children}</span>;
}

function Skeleton() {
  return <div className="card-editorial p-5 space-y-3">{[55,90,70].map(w=><div key={w} className="skeleton rounded-full" style={{height:10,width:`${w}%`}}/>)}</div>;
}

function DropZone({ label, accept, multiple=false, files, onChange, compact=false }: {
  label:string;accept:string;multiple?:boolean;files:File[];onChange:(f:File[])=>void;compact?:boolean;
}) {
  const ref=useRef<HTMLInputElement>(null); const [drag,setDrag]=useState(false);
  return (
    <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);const d=Array.from(e.dataTransfer.files);onChange(multiple?[...files,...d]:d.slice(0,1));}}
      onClick={()=>ref.current?.click()}
      className={`drop-zone cursor-pointer ${drag?"dragging":""} ${compact?"px-4 py-3":"px-5 py-7"}`}>
      <input ref={ref} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={e=>onChange(multiple?[...files,...Array.from(e.target.files||[])]:Array.from(e.target.files||[]).slice(0,1))}/>
      <div className={`flex items-center gap-3 ${compact?"":"flex-col text-center"}`}>
        <Upload size={compact?14:22} className={files.length?"text-orange-400":"text-neutral-600"}/>
        <div>
          <p className={`text-sm ${files.length?"text-white font-medium":"text-neutral-500"}`}>
            {files.length?files.map(f=>f.name).join(", "):label}
          </p>
          {!compact&&<p className="mt-1 text-xs text-neutral-700">PDF · TXT · DOCX</p>}
        </div>
        {files.length>0&&<button onClick={e=>{e.stopPropagation();onChange([]);}} className="ml-auto rounded-full p-1 text-neutral-600 hover:text-white hover:bg-white/10"><X size={12}/></button>}
      </div>
    </div>
  );
}

// ── Section card helper ───────────────────────────────────────────────────────
function SectionCard({ title, icon, accent, children }: { title:string;icon:React.ReactNode;accent?:string;children:React.ReactNode }) {
  const col=accent||ACCENT;
  return (
    <div className="card-editorial p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{background:`${col}18`,color:col}}>{icon}</div>
        <p className="section-label" style={{color:col}}>{title}</p>
      </div>
      {children}
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────────────────
function Home({ onMode }: { onMode:(m:AppMode)=>void }) {
  return (
    <div className="space-y-6">
      <section className="relative py-24 overflow-hidden text-center">
        <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full"
          style={{background:"radial-gradient(ellipse, rgba(255,109,41,0.13) 0%, transparent 70%)",filter:"blur(50px)"}}/>
        <div className="pointer-events-none absolute bottom-0 left-[5%] w-64 h-64 rounded-full"
          style={{background:"radial-gradient(circle, rgba(255,109,41,0.07) 0%, transparent 70%)",filter:"blur(60px)"}}/>
        <motion.div initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.5}} className="relative max-w-5xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold mb-7"
            style={{background:"rgba(255,109,41,0.1)",border:"1px solid rgba(255,109,41,0.22)",color:"#FF6D29"}}>
            <Zap size={11}/> SignalRank Engine · 100k Candidates · No Paid APIs
          </div>
          <h1 className="font-black leading-[0.9] tracking-tighter text-white"
            style={{fontSize:"clamp(2.8rem,8.5vw,7rem)",letterSpacing:"-0.045em"}}>
            Hire by<br/><span className="text-gradient">evidence.</span><br/>Not keywords.
          </h1>
          <p className="mt-6 text-lg leading-8 max-w-2xl mx-auto" style={{color:"#666"}}>
            HAZE's SignalRank engine validates claims, surfaces hidden gems, and explains every ranking decision — the way a great senior recruiter thinks.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <motion.button onClick={()=>onMode("ranking")} whileHover={{scale:1.03}} whileTap={{scale:.97}}
              className="btn-accent inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-bold">
              <Users size={16}/> Rank Candidates
            </motion.button>
            <motion.button onClick={()=>onMode("coach")} whileHover={{scale:1.03}} whileTap={{scale:.97}}
              className="btn-ghost inline-flex items-center gap-2 rounded-2xl px-7 py-3.5 text-sm font-semibold">
              <Target size={16}/> AI Career Coach
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Signal vs Noise */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          {color:"#ef4444",label:"❌ Naive ATS Pick",name:"Aarav Keyword",score:28,text:"437 keyword matches. Zero verified production claims. SNR: 0.42.",bar:12,ev:false},
          {color:"#4ade80",label:"✓ SignalRank Pick",name:"Ira Dalal",score:93,text:"Owns retrieval pipeline at 10M QPD. Verified evidence. Cross-validated. SNR: 3.1.",bar:93,ev:true},
        ].map((item,i)=>(
          <motion.div key={i} initial={{opacity:0,x:i===0?-16:16}} animate={{opacity:1,x:0}} transition={{delay:.1+i*.05}}
            className="card-editorial p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none"
              style={{background:`radial-gradient(circle, ${item.color}12 0%, transparent 70%)`,filter:"blur(24px)",transform:"translate(30%,-30%)"}}/>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full" style={{background:item.color}}/>
              <p className="text-xs font-black uppercase tracking-widest" style={{color:item.color}}>{item.label}</p>
            </div>
            <p className="text-xl font-black text-white mb-2">{item.name}</p>
            <p className="text-sm mb-4" style={{color:"#555"}}>{item.text}</p>
            <div className="flex items-center gap-4">
              <p className="text-4xl font-black" style={{color:item.color,letterSpacing:"-0.04em"}}>{item.score}</p>
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between text-xs" style={{color:"#444"}}><span>Evidence Strength</span><span>{item.bar}/100</span></div>
                <ScoreBar value={item.bar} color={item.color}/>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Features */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {icon:<Brain size={20}/>,title:"Evidence Validation",desc:"Detects unsupported claims, stale experience, and keyword inflation across 100k profiles."},
          {icon:<Sparkles size={20}/>,title:"Hidden Gem Detection",desc:"Transfer credit for adjacent skills. Surfaces candidates that ATS systems consistently miss."},
          {icon:<Target size={20}/>,title:"AI Career Coach",desc:"Full resume analysis: ATS score, recruiter confidence, skill gaps, roadmap, and action plan."},
          {icon:<BarChart3 size={20}/>,title:"8-Factor Scoring",desc:"Semantic fit, evidence strength, recency, domain, experience, growth, behavioral, confidence."},
          {icon:<Layers size={20}/>,title:"Candidate Compare",desc:"Side-by-side radar chart comparison of up to 4 candidates across all scoring dimensions."},
          {icon:<Download size={20}/>,title:"Validated CSV Export",desc:"One-click hackathon submission export — passes the official validator out of the box."},
        ].map(({icon,title,desc})=>(
          <TiltCard key={title} className="card-editorial p-6">
            <div className="mb-4 h-10 w-10 flex items-center justify-center rounded-xl" style={{background:"rgba(255,109,41,0.1)",color:ACCENT}}>{icon}</div>
            <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
            <p className="text-sm leading-6" style={{color:"#555"}}>{desc}</p>
          </TiltCard>
        ))}
      </div>
    </div>
  );
}

// ── Ranking Workspace ─────────────────────────────────────────────────────────
type RankingSource = "demo"|"dataset"|"upload";
function RankingWorkspace({ onSelect }: { onSelect:(c:CandidateRank,d:RankingResponse)=>void }) {
  const [src,setSrc]=useState<RankingSource>("demo");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [data,setData]=useState<RankingResponse|null>(null);
  const [jdText,setJdText]=useState(""); const [jdFiles,setJdFiles]=useState<File[]>([]);
  const [resumeFiles,setResumeFiles]=useState<File[]>([]); const [incDS,setIncDS]=useState(true);
  const [topK,setTopK]=useState(50); const [search,setSearch]=useState("");
  const [compareIds,setCompareIds]=useState<string[]>([]); const [showCompare,setShowCompare]=useState(false);
  const sc = (v:number)=>v>=70?"#4ade80":v>=50?ACCENT:"#ef4444";

  const run=useCallback(async()=>{
    setLoading(true);setError("");
    try {
      let res:RankingResponse;
      if(src==="demo") res=await fetchDemoRanking();
      else if(src==="dataset") res=await fetchDatasetRanking(topK);
      else {
        const jd=jdText||(jdFiles[0]?await jdFiles[0].text():"");
        res=await uploadAndRank(jd,resumeFiles,incDS,topK);
      }
      setData(res);
    } catch(e:any){setError(e.message||"Failed");setData(fallbackRanking);}
    finally{setLoading(false);}
  },[src,jdText,jdFiles,resumeFiles,incDS,topK]);

  const dl=async()=>{
    try{const b=await downloadSubmissionCSV();const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="haze_submission.csv";a.click();}
    catch{setError("Export failed");}
  };

  const filtered=(data?.candidates??[]).filter(c=>!search||c.name.toLowerCase().includes(search.toLowerCase())||(c.current_title||"").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="card-editorial p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)"}}>
            {(["demo","dataset","upload"] as RankingSource[]).map(s=>(
              <button key={s} onClick={()=>setSrc(s)}
                className={`px-4 py-2.5 text-sm font-bold capitalize transition ${s===src?"bg-orange-500 text-white":"text-neutral-500 hover:text-white"}`}>
                {s==="demo"?"Demo (4)":s==="dataset"?"Dataset 100k":"Upload Files"}
              </button>
            ))}
          </div>
          {src==="dataset"&&<select value={topK} onChange={e=>setTopK(Number(e.target.value))} className="input-field px-3 py-2.5 text-sm rounded-xl">
            {[20,50,100].map(n=><option key={n} value={n} style={{background:"#111"}}>Top {n}</option>)}</select>}
          <div className="flex-1"/>
          <button onClick={dl} className="btn-ghost inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"><Download size={14}/> Export CSV</button>
          <motion.button onClick={run} disabled={loading} whileHover={{scale:1.02}} whileTap={{scale:.97}}
            className="btn-accent inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-40">
            {loading?<Loader2 size={14} className="animate-spin"/>:<Zap size={14}/>}
            {loading?"Ranking…":"Run SignalRank"}
          </motion.button>
        </div>
        <AnimatePresence>
          {src==="upload"&&(
            <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}}
              className="grid gap-4 mt-4 pt-4 md:grid-cols-2 overflow-hidden" style={{borderTop:"1px solid rgba(255,255,255,0.06)"}}>
              <div className="space-y-2.5">
                <p className="section-label">Job Description</p>
                <DropZone label="Upload JD (PDF, DOCX, TXT)" accept=".pdf,.txt,.docx" files={jdFiles} onChange={setJdFiles} compact/>
                <textarea value={jdText} onChange={e=>setJdText(e.target.value)} rows={3} placeholder="Or paste JD text…"
                  className="input-field w-full resize-none px-3 py-2 text-sm" style={{borderRadius:14}}/>
              </div>
              <div className="space-y-2.5">
                <p className="section-label">Resumes</p>
                <DropZone label="Upload resumes (PDF, TXT)" accept=".pdf,.txt" multiple files={resumeFiles} onChange={setResumeFiles} compact/>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-neutral-500">
                  <input type="checkbox" checked={incDS} onChange={e=>setIncDS(e.target.checked)} className="h-4 w-4 rounded" style={{accentColor:ACCENT}}/>
                  Also rank vs full 100k dataset
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {error&&<div className="mt-3 flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-red-400" style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.15)"}}><AlertTriangle size={13}/>{error}</div>}
      </div>

      {loading&&<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{Array.from({length:6}).map((_,i)=><Skeleton key={i}/>)}</div>}

      {data&&!loading&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-4">
          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {l:"Candidates",v:data.candidates.length,icon:<Users size={13}/>},
              {l:"Avg Score",v:(data.metrics?.average_signal_score??0).toFixed(1),icon:<Gauge size={13}/>},
              {l:"Verified",v:data.metrics?.verified_matches??0,icon:<Shield size={13}/>},
              {l:"Corrected",v:data.ranking_corrected?"✓ Yes":"—",icon:<Zap size={13}/>},
            ].map(({l,v,icon})=>(
              <div key={l} className="card-editorial p-4">
                <div className="flex items-center gap-1.5 text-xs text-neutral-600 mb-1.5">{icon}{l}</div>
                <p className="text-2xl font-black text-white" style={{letterSpacing:"-0.03em"}}>{v}</p>
              </div>
            ))}
          </div>
          {/* Insights */}
          {(data.insights?.length>0)&&(
            <div className="card-editorial p-5">
              <p className="section-label mb-3">AI Recruiter Insights</p>
              <div className="grid gap-2 md:grid-cols-2">
                {data.insights.map((ins,i)=>(
                  <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3"
                    style={{background:"rgba(255,109,41,0.05)",border:"1px solid rgba(255,109,41,0.1)"}}>
                    <Brain size={12} className="mt-0.5 shrink-0 text-orange-400"/>
                    <p className="text-sm text-neutral-400">{ins}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
              <Search size={13} style={{color:"#444"}}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search candidates…"
                className="bg-transparent text-sm text-white outline-none w-40 placeholder-neutral-700"/>
            </div>
            <p className="text-xs text-neutral-600">{filtered.length} results</p>
            {compareIds.length>=2&&(
              <button onClick={()=>setShowCompare(true)} className="ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-orange-400"
                style={{background:"rgba(255,109,41,0.1)",border:"1px solid rgba(255,109,41,0.2)"}}>
                <Layers size={14}/> Compare ({compareIds.length})
              </button>
            )}
          </div>
          {/* Candidate list */}
          <div className="space-y-2.5">
            {filtered.map((c,i)=>(
              <TiltCard key={c.name+c.rank} className="card-editorial cursor-pointer p-5">
                <div className="flex items-center gap-4" onClick={()=>onSelect(c,data)}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-black"
                    style={{background:"rgba(255,109,41,0.1)",color:ACCENT,border:"1px solid rgba(255,109,41,0.18)"}}>
                    {c.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-base font-bold text-white">{c.name}</span>
                      <TrustBadge label={c.trust_label}/>
                      {c.current_title&&<span className="text-xs text-neutral-600">{c.current_title}</span>}
                    </div>
                    <p className="text-sm text-neutral-600 truncate">{c.summary?.slice(0,100)}</p>
                    <div className="mt-2.5"><ScoreBar value={c.signal_score}/></div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-3xl font-black" style={{color:sc(c.signal_score),letterSpacing:"-0.04em"}}>{c.signal_score.toFixed(1)}</div>
                    <p className="text-xs text-neutral-700">SignalRank</p>
                  </div>
                  <div className="hidden lg:block shrink-0 w-32 space-y-2">
                    {[["Semantic",c.semantic_fit],["Evidence",c.evidence_strength],["Recency",c.recency]].map(([l,v])=>(
                      <div key={l as string} className="flex items-center gap-2">
                        <span className="text-xs text-neutral-700 w-14 text-right">{l}</span>
                        <div className="flex-1"><ScoreBar value={v as number} height={2}/></div>
                      </div>
                    ))}
                  </div>
                  <button onClick={e=>{e.stopPropagation();setCompareIds(ids=>ids.includes(c.name)?ids.filter(x=>x!==c.name):ids.length<4?[...ids,c.name]:ids);}}
                    className={`hidden md:flex shrink-0 rounded-full p-1.5 transition ${compareIds.includes(c.name)?"bg-orange-500/20 text-orange-400":"text-neutral-700 hover:bg-white/10 hover:text-white"}`}>
                    <Plus size={13}/>
                  </button>
                  <ChevronRight size={15} className="text-neutral-700 shrink-0"/>
                </div>
              </TiltCard>
            ))}
          </div>
        </motion.div>
      )}
      <AnimatePresence>
        {showCompare&&data&&<CompareModal candidates={data.candidates.filter(c=>compareIds.includes(c.name))} onClose={()=>setShowCompare(false)}/>}
      </AnimatePresence>
    </div>
  );
}

// ── Compare Modal ──────────────────────────────────────────────────────────────
function CompareModal({ candidates, onClose }: { candidates:CandidateRank[];onClose:()=>void }) {
  const cols=["#FF6D29","#4ADE80","#F59E0B","#A78BFA"];
  const dims=["semantic_fit","evidence_strength","recency","domain_alignment","experience_match","behavioral_fit","confidence"];
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.82)",backdropFilter:"blur(10px)"}}
      onClick={onClose}>
      <motion.div initial={{scale:.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:.9,opacity:0}} onClick={e=>e.stopPropagation()}
        className="card-editorial w-full max-w-5xl rounded-3xl p-8 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-7">
          <h2 className="text-2xl font-black text-white">Candidate Comparison</h2>
          <button onClick={onClose} className="rounded-full p-2 text-neutral-600 hover:text-white hover:bg-white/10"><X size={16}/></button>
        </div>
        <div className="grid gap-4 mb-7" style={{gridTemplateColumns:`repeat(${candidates.length},1fr)`}}>
          {candidates.map((c,i)=>(
            <div key={c.name} className="rounded-2xl p-4 text-center"
              style={{background:`${cols[i]}0d`,border:`1px solid ${cols[i]}28`}}>
              <div className="flex justify-center mb-3"><ScoreRing score={c.signal_score} size={84}/></div>
              <p className="font-bold text-white text-sm">{c.name}</p>
              <p className="text-xs text-neutral-600 mt-0.5">{c.current_title}</p>
              <div className="mt-2"><TrustBadge label={c.trust_label}/></div>
            </div>
          ))}
        </div>
        <div className="h-60 mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={dims.map(d=>({dim:d.replace("_"," "),...Object.fromEntries(candidates.map(c=>[c.name,(c as any)[d]]))}))}> 
              <PolarGrid stroke="rgba(255,255,255,0.05)"/>
              <PolarAngleAxis dataKey="dim" tick={{fill:"#444",fontSize:10}}/>
              {candidates.map((c,i)=><Radar key={c.name} name={c.name} dataKey={c.name} stroke={cols[i]} fill={cols[i]} fillOpacity={0.1} strokeWidth={1.5}/>)}
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-4">
          {dims.map(d=>(
            <div key={d}>
              <p className="text-xs text-neutral-600 mb-2 capitalize">{d.replace("_"," ")}</p>
              <div className="space-y-1.5">
                {candidates.map((c,i)=>(
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="text-xs text-neutral-600 w-24 text-right truncate">{c.name}</span>
                    <div className="flex-1"><ScoreBar value={(c as any)[d]??0} color={cols[i]}/></div>
                    <span className="text-xs font-bold text-white w-8 text-right">{((c as any)[d]??0).toFixed(0)}</span>
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
function CandidateDetail({ candidate:c, ranking, onBack }: { candidate:CandidateRank;ranking:RankingResponse;onBack:()=>void }) {
  const [tab,setTab]=useState<RankingTab>("detail");
  const sc=(v:number)=>v>=70?"#4ade80":v>=50?ACCENT:"#ef4444";
  const skills=Object.entries(c.skill_scores||{});
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-ghost inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium">← Back</button>
        <div className="flex rounded-xl overflow-hidden" style={{border:"1px solid rgba(255,255,255,0.07)",background:"rgba(255,255,255,0.03)"}}>
          {(["detail","explain","analytics"] as RankingTab[]).map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={`px-4 py-2 text-sm font-bold capitalize transition ${t===tab?"bg-orange-500 text-white":"text-neutral-500 hover:text-white"}`}>
              {t==="detail"?"Profile":t==="explain"?"Explainability":"Analytics"}
            </button>
          ))}
        </div>
      </div>
      {/* Hero */}
      <div className="card-editorial p-6 relative overflow-hidden">
        <div className="pointer-events-none absolute top-0 right-0 w-80 h-80 rounded-full"
          style={{background:"radial-gradient(circle, rgba(255,109,41,0.07) 0%, transparent 70%)",filter:"blur(40px)",transform:"translate(30%,-30%)"}}/>
        <div className="flex items-start gap-5 relative">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black"
            style={{background:"rgba(255,109,41,0.12)",color:ACCENT,border:"1px solid rgba(255,109,41,0.2)"}}>
            {c.name.split(" ").map(w=>w[0]).join("").slice(0,2)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-black text-white">{c.name}</h1>
              <TrustBadge label={c.trust_label}/>
              <span className="text-xs text-neutral-600">Rank #{c.rank}</span>
            </div>
            {c.current_title&&<p className="text-sm text-neutral-500 mb-2">{c.current_title}{c.years_of_experience?` · ${c.years_of_experience}y`:""}</p>}
            <p className="text-sm text-neutral-500 leading-6">{c.summary}</p>
            <p className="mt-3 text-sm text-orange-400/80 italic">"{c.recommendation}"</p>
          </div>
          <div className="shrink-0"><ScoreRing score={c.signal_score} size={110}/></div>
        </div>
      </div>
      {tab==="detail"&&(
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {([["Semantic Fit",c.semantic_fit],["Evidence",c.evidence_strength],["Recency",c.recency],["Domain",c.domain_alignment],
                ["Experience",c.experience_match],["Growth",c.career_growth],["Behavioral",c.behavioral_fit],["Confidence",c.confidence]] as [string,number][]).map(([l,v])=>(
                <TiltCard key={l} className="card-editorial p-4" intensity={4}>
                  <p className="text-xs text-neutral-600 mb-1">{l}</p>
                  <p className="text-xl font-black mb-2" style={{color:sc(v),letterSpacing:"-0.03em"}}>{v.toFixed(0)}</p>
                  <ScoreBar value={v} color={sc(v)}/>
                </TiltCard>
              ))}
            </div>
            {c.strengths?.length>0&&(
              <SectionCard title="Strengths" icon={<CheckCircle2 size={14}/>} accent="#4ade80">
                <div className="space-y-2">
                  {c.strengths.map((s,i)=>(
                    <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3" style={{background:"rgba(74,222,128,0.05)",border:"1px solid rgba(74,222,128,0.12)"}}>
                      <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-400"/><p className="text-sm text-neutral-400">{s}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
            {c.concerns?.filter(x=>!x.includes("No major")).length>0&&(
              <SectionCard title="Concerns" icon={<AlertTriangle size={14}/>} accent="#ef4444">
                <div className="space-y-2">
                  {c.concerns.filter(x=>!x.includes("No major")).map((x,i)=>(
                    <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3" style={{background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.12)"}}>
                      <AlertTriangle size={12} className="mt-0.5 shrink-0 text-red-400"/><p className="text-sm text-neutral-400">{x}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>
          <div className="space-y-4">
            <SectionCard title="Signal-to-Noise Ratio" icon={<Gauge size={14}/>}>
              <p className="text-4xl font-black text-white mb-2" style={{letterSpacing:"-0.04em"}}>{c.snr.toFixed(2)}</p>
              <ScoreBar value={c.snr*100}/>
              <p className="mt-2 text-xs text-neutral-600">Good candidates: SNR &gt; 1.0</p>
            </SectionCard>
            {c.gaps?.length>0&&(
              <SectionCard title="Skill Gaps" icon={<Target size={14}/>} accent="#f59e0b">
                <div className="space-y-2">
                  {c.gaps.map((g,i)=>(
                    <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2" style={{background:"rgba(245,158,11,0.05)",border:"1px solid rgba(245,158,11,0.13)"}}>
                      <span className="text-sm text-white">{g.skill}</span>
                      <Pill variant={g.type.includes("critical")?"red":"default"}>{g.type}</Pill>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
            <SectionCard title="Interview Probes" icon={<FileText size={14}/>}>
              <div className="space-y-2">
                {c.interview_probes?.map((p,i)=>(
                  <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-3" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-xs font-black" style={{background:"rgba(255,109,41,0.15)",color:ACCENT}}>{i+1}</span>
                    <p className="text-xs text-neutral-400">{p}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      )}
      {tab==="explain"&&(
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Skill Match Breakdown" icon={<BarChart3 size={14}/>}>
            <div className="space-y-3">
              {skills.map(([skill,score])=>(
                <div key={skill} className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500 w-36 text-right capitalize truncate">{skill}</span>
                  <div className="flex-1"><ScoreBar value={score} color={sc(score)}/></div>
                  <span className="text-xs font-black text-white w-8 text-right">{score.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </SectionCard>
          <SectionCard title="Factor Comparison" icon={<TrendingUp size={14}/>}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  {n:"Semantic",v:c.semantic_fit},{n:"Evidence",v:c.evidence_strength},{n:"Recency",v:c.recency},
                  {n:"Domain",v:c.domain_alignment},{n:"Exp",v:c.experience_match},{n:"Growth",v:c.career_growth},
                ]} layout="vertical">
                  <XAxis type="number" domain={[0,100]} stroke="#222" tick={{fontSize:10,fill:"#444"}}/>
                  <YAxis type="category" dataKey="n" stroke="#222" tick={{fontSize:10,fill:"#555"}} width={52}/>
                  <Tooltip contentStyle={{background:"#0f0d10",border:"1px solid #1a1a1a",borderRadius:12,color:"#fff"}} formatter={(v:any)=>[v.toFixed(1),""]}/>
                  <Bar dataKey="v" radius={[0,8,8,0]}>
                    {[c.semantic_fit,c.evidence_strength,c.recency,c.domain_alignment,c.experience_match,c.career_growth].map((v,i)=>(
                      <Cell key={i} fill={sc(v)} fillOpacity={.75}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      )}
      {tab==="analytics"&&(
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Score Distribution" icon={<BarChart3 size={14}/>}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ranking.candidates.slice(0,30)}>
                  <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false}/>
                  <XAxis dataKey="name" stroke="#222" tick={false}/>
                  <YAxis stroke="#222" tick={{fontSize:10,fill:"#444"}}/>
                  <Tooltip contentStyle={{background:"#0f0d10",border:"1px solid #1a1a1a",borderRadius:12,color:"#fff"}} formatter={(v:any)=>[v.toFixed(1),"Score"]}/>
                  <Bar dataKey="signal_score" radius={[5,5,0,0]}>
                    {ranking.candidates.slice(0,30).map((cand,i)=>(
                      <Cell key={i} fill={cand.name===c.name?"#4ade80":ACCENT} fillOpacity={cand.name===c.name?1:.35}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <SectionCard title="8-Factor Radar" icon={<Target size={14}/>}>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={[
                  {d:"Semantic",v:c.semantic_fit},{d:"Evidence",v:c.evidence_strength},{d:"Recency",v:c.recency},
                  {d:"Domain",v:c.domain_alignment},{d:"Exp",v:c.experience_match},{d:"Growth",v:c.career_growth},
                  {d:"Behavioral",v:c.behavioral_fit},{d:"Confidence",v:c.confidence},
                ]}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)"/>
                  <PolarAngleAxis dataKey="d" tick={{fill:"#444",fontSize:10}}/>
                  <Radar dataKey="v" stroke={ACCENT} fill={ACCENT} fillOpacity={.15} strokeWidth={1.5}/>
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

// ── Career Coach ──────────────────────────────────────────────────────────────
function CareerCoach() {
  const [resumeFile,setResumeFile]=useState<File[]>([]);
  const [resumeText,setResumeText]=useState("");
  const [jdText,setJdText]=useState("");
  const [result,setResult]=useState<CareerCoachResult|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const run=async()=>{
    setLoading(true);setError("");setResult(null);
    try{setResult(await runCareerCoach(resumeFile[0]||null,resumeText,jdText));}
    catch(e:any){setError(e.message||"Analysis failed");}
    finally{setLoading(false);}
  };
  const sc=(v:number)=>v>=70?"#4ade80":v>=50?ACCENT:"#ef4444";

  return (
    <div className="space-y-6">
      <div className="card-editorial p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 flex items-center justify-center rounded-xl" style={{background:"rgba(255,109,41,0.12)",border:"1px solid rgba(255,109,41,0.2)"}}>
            <Target size={18} style={{color:ACCENT}}/>
          </div>
          <div>
            <h2 className="text-xl font-black text-white">AI Career Coach</h2>
            <p className="text-sm text-neutral-600">Recruiter-grade analysis: ATS score, skill gaps, roadmap, action plan</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2.5">
            <p className="section-label">Your Resume</p>
            <DropZone label="Upload PDF or TXT" accept=".pdf,.txt" files={resumeFile} onChange={setResumeFile} compact/>
            <textarea value={resumeText} onChange={e=>setResumeText(e.target.value)} rows={5} placeholder="Or paste your resume text here…"
              className="input-field w-full resize-none px-3 py-2.5 text-sm" style={{borderRadius:14}}/>
          </div>
          <div className="space-y-2.5">
            <p className="section-label">Target Job Description</p>
            <textarea value={jdText} onChange={e=>setJdText(e.target.value)} rows={9} placeholder="Paste the job description you're applying to…"
              className="input-field w-full resize-none px-3 py-2.5 text-sm" style={{borderRadius:14}}/>
          </div>
        </div>
        {error&&<div className="mt-3 rounded-xl px-4 py-3 text-sm text-red-400" style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.14)"}}>{error}</div>}
        <div className="mt-4 flex justify-end">
          <motion.button onClick={run} disabled={loading} whileHover={{scale:1.02}} whileTap={{scale:.97}}
            className="btn-accent inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold disabled:opacity-40">
            {loading?<Loader2 size={15} className="animate-spin"/>:<Brain size={15}/>}
            {loading?"Analysing…":"Analyse My Resume"}
          </motion.button>
        </div>
      </div>

      {loading&&<div className="grid gap-4 md:grid-cols-2">{Array.from({length:6}).map((_,i)=><Skeleton key={i}/>)}</div>}

      {result&&!loading&&(
        <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="space-y-5">
          {/* Hero scores */}
          <div className="card-editorial p-6 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0" style={{background:"radial-gradient(ellipse at 85% 50%, rgba(255,109,41,0.09) 0%, transparent 60%)"}}/>
            <div className="relative flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <p className="text-sm text-neutral-600 mb-1">{result.target_role}</p>
                <h2 className="text-3xl font-black text-white mb-1" style={{letterSpacing:"-0.04em"}}>{result.name}</h2>
                {result.current_title&&<p className="text-neutral-500 text-sm mb-3">{result.current_title}</p>}
                <TrustBadge label={result.trust_label}/>
                <p className="mt-3 text-sm text-neutral-400 leading-6 max-w-lg">{result.recruiter_likelihood}</p>
              </div>
              {/* 4 gauge meters */}
              <div className="flex flex-wrap gap-6 justify-center md:justify-end shrink-0">
                <GaugeMeter value={result.match_score} label="Match" size={100}/>
                <GaugeMeter value={result.ats_score} label="ATS" size={100}/>
                <GaugeMeter value={result.recruiter_confidence} label="Confidence" size={100}/>
                <GaugeMeter value={result.interview_probability} label="Interview %" size={100}/>
              </div>
            </div>
          </div>

          {/* Probability strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {l:"Match Score",v:result.match_score,suf:"/100"},
              {l:"ATS Score",v:result.ats_score,suf:"/100"},
              {l:"Interview Prob.",v:result.interview_probability,suf:"%"},
              {l:"Offer Prob.",v:result.offer_probability,suf:"%"},
            ].map(({l,v,suf})=>(
              <div key={l} className="card-editorial p-4">
                <p className="text-xs text-neutral-600 mb-1.5">{l}</p>
                <p className="text-2xl font-black" style={{color:sc(v),letterSpacing:"-0.03em"}}>{v}<span className="text-sm text-neutral-600 font-medium">{suf}</span></p>
                <div className="mt-2"><ScoreBar value={v} color={sc(v)}/></div>
              </div>
            ))}
          </div>

          {/* Expected improvement banner */}
          <div className="rounded-2xl p-4 flex items-center gap-4" style={{background:"rgba(255,109,41,0.08)",border:"1px solid rgba(255,109,41,0.18)"}}>
            <TrendingUp size={20} style={{color:ACCENT}} className="shrink-0"/>
            <div>
              <p className="text-sm font-bold text-white">Expected score after all improvements: <span style={{color:ACCENT}}>{result.expected_score_after_improvements}/100</span></p>
              <p className="text-xs text-neutral-500 mt-0.5">Follow the roadmap below to close skill gaps and improve your recruiter confidence score.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Parsed skills */}
            <SectionCard title="Detected Skills" icon={<Star size={14}/>}>
              {result.parsed_skills.length>0
                ?<div className="flex flex-wrap gap-2">{result.parsed_skills.map(s=><Pill key={s}>{s}</Pill>)}</div>
                :<p className="text-sm text-neutral-600">No skills detected. Add a dedicated "Skills" section.</p>}
            </SectionCard>
            {/* Skill scores */}
            <SectionCard title="Skill Match Scores" icon={<BarChart3 size={14}/>}>
              <div className="space-y-2.5">
                {Object.entries(result.skill_scores).slice(0,8).map(([skill,score])=>(
                  <div key={skill} className="flex items-center gap-3">
                    <span className="text-xs text-neutral-500 w-32 text-right truncate capitalize">{skill}</span>
                    <div className="flex-1"><ScoreBar value={score} color={sc(score)}/></div>
                    <span className="text-xs font-black text-white w-8 text-right">{score.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
            {/* Strengths */}
            <SectionCard title="Your Strengths" icon={<CheckCircle2 size={14}/>} accent="#4ade80">
              <div className="space-y-2">
                {result.strengths.map((s,i)=>(
                  <div key={i} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{background:"rgba(74,222,128,0.05)",border:"1px solid rgba(74,222,128,0.12)"}}>
                    <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-400"/><p className="text-sm text-neutral-400">{s}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
            {/* Missing skills */}
            <SectionCard title="Skill Gaps" icon={<AlertTriangle size={14}/>} accent="#ef4444">
              {result.missing_must_have.length>0
                ?<div className="space-y-2 mb-3"><p className="text-xs text-neutral-600 mb-2">Must-have missing:</p><div className="flex flex-wrap gap-2">{result.missing_must_have.map(s=><Pill key={s} variant="red">{s}</Pill>)}</div></div>
                :<p className="text-sm text-emerald-400 font-bold mb-3">✓ All must-have skills detected!</p>}
              {result.missing_nice_to_have.length>0&&<div><p className="text-xs text-neutral-600 mb-2">Nice-to-have:</p><div className="flex flex-wrap gap-2">{result.missing_nice_to_have.map(s=><Pill key={s}>{s}</Pill>)}</div></div>}
              {result.missing_keywords?.length>0&&<div className="mt-3"><p className="text-xs text-neutral-600 mb-2">Missing keywords from JD:</p><div className="flex flex-wrap gap-2">{result.missing_keywords.map(s=><Pill key={s} variant="amber">{s}</Pill>)}</div></div>}
            </SectionCard>
          </div>

          {/* Resume suggestions */}
          {result.resume_suggestions.length>0&&(
            <SectionCard title="Resume Improvement Suggestions" icon={<Lightbulb size={14}/>} accent="#f59e0b">
              <div className="space-y-2">
                {result.resume_suggestions.map((s,i)=>(
                  <div key={i} className="flex items-start gap-3 rounded-xl px-4 py-3" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black" style={{background:"rgba(255,109,41,0.15)",color:ACCENT}}>{i+1}</span>
                    <p className="text-sm text-neutral-400">{s}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Certifications + Projects */}
          <div className="grid gap-4 md:grid-cols-2">
            {result.suggested_certifications?.length>0&&(
              <SectionCard title="Suggested Certifications" icon={<Award size={14}/>} accent="#4ade80">
                <div className="space-y-2">
                  {result.suggested_certifications.map((cert,i)=>(
                    <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{background:"rgba(74,222,128,0.05)",border:"1px solid rgba(74,222,128,0.1)"}}>
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0"/>
                      <p className="text-sm text-neutral-300">{cert}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
            {result.suggested_projects?.length>0&&(
              <SectionCard title="Suggested Projects" icon={<Rocket size={14}/>} accent="#a78bfa">
                <div className="space-y-2">
                  {result.suggested_projects.map((proj,i)=>(
                    <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-2.5" style={{background:"rgba(167,139,250,0.05)",border:"1px solid rgba(167,139,250,0.12)"}}>
                      <div className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0 mt-1.5"/>
                      <p className="text-sm text-neutral-400">{proj}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </div>

          {/* Learning roadmap */}
          {result.learning_roadmap.length>0&&(
            <SectionCard title="Learning Roadmap" icon={<MapPin size={14}/>}>
              <div className="space-y-3">
                {result.learning_roadmap.map(item=>(
                  <TiltCard key={item.priority} className="card-editorial p-4" intensity={3}>
                    <div className="flex items-start gap-4">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black" style={{background:"rgba(255,109,41,0.15)",color:ACCENT}}>{item.priority}</span>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-bold text-white capitalize">{item.skill}</span>
                          <Pill variant={item.impact.includes("High")?"accent":"default"}>{item.impact}</Pill>
                        </div>
                        <p className="text-sm text-neutral-500">{item.action}</p>
                      </div>
                      <span className="text-xs text-neutral-600 shrink-0">{item.timeline}</span>
                    </div>
                  </TiltCard>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Action plan */}
          {result.action_plan&&(
            <SectionCard title="Your Action Plan" icon={<Clock size={14}/>} accent="#f59e0b">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {label:"This Week",items:result.action_plan.immediate,col:"#ef4444",icon:<Zap size={13}/>},
                  {label:"Next 30 Days",items:result.action_plan.next_30_days,col:ACCENT,icon:<TrendingUp size={13}/>},
                  {label:"Next 90 Days",items:result.action_plan.next_90_days,col:"#4ade80",icon:<Rocket size={13}/>},
                ].map(({label,items,col,icon})=>(
                  <div key={label} className="rounded-2xl p-4" style={{background:`${col}08`,border:`1px solid ${col}18`}}>
                    <div className="flex items-center gap-2 mb-3" style={{color:col}}>{icon}<p className="text-xs font-black uppercase tracking-wide">{label}</p></div>
                    <div className="space-y-2">
                      {(items||[]).map((item,i)=>(
                        <div key={i} className="flex items-start gap-2">
                          <div className="h-1 w-1 rounded-full mt-2 shrink-0" style={{background:col}}/>
                          <p className="text-xs text-neutral-400 leading-5">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Interview prep */}
          {result.interview_prep_topics?.length>0&&(
            <SectionCard title="Interview Preparation Topics" icon={<BookOpen size={14}/>}>
              <div className="grid gap-2 md:grid-cols-2">
                {result.interview_prep_topics.map((t,i)=>(
                  <div key={i} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)"}}>
                    <span className="text-xs font-black text-orange-400 shrink-0 mt-0.5">{i+1}.</span>
                    <p className="text-xs text-neutral-400 leading-5">{t}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </motion.div>
      )}
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export function App() {
  const [mode,setMode]=useState<AppMode>("home");
  const [selected,setSelected]=useState<{c:CandidateRank;data:RankingResponse}|null>(null);
  const nav=[{id:"home" as AppMode,label:"Home",icon:<Zap size={15}/>},{id:"ranking" as AppMode,label:"Rank Candidates",icon:<Users size={15}/>},{id:"coach" as AppMode,label:"Career Coach",icon:<Target size={15}/>}];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40" style={{background:"rgba(8,6,8,0.88)",borderBottom:"1px solid rgba(255,255,255,0.06)",backdropFilter:"blur(20px)"}}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <button onClick={()=>{setMode("home");setSelected(null);}} className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black text-white" style={{background:"linear-gradient(135deg,#FF6D29,#c94a14)"}}>H</div>
            <span className="text-base font-black tracking-tight text-white">HAZE</span>
            <span className="hidden text-xs text-neutral-700 sm:block">· SignalRank</span>
          </button>
          <nav className="hidden items-center gap-1 rounded-2xl p-1 md:flex" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>
            {nav.map(item=>(
              <button key={item.id} onClick={()=>{setMode(item.id);setSelected(null);}}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${mode===item.id?"bg-white text-black":"text-neutral-500 hover:text-white"}`}>
                {item.label}
              </button>
            ))}
          </nav>
          <motion.button onClick={()=>setMode("coach")} whileHover={{scale:1.02}} whileTap={{scale:.97}}
            className="btn-accent hidden items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold md:flex">
            <Sparkles size={14}/> Get Coaching
          </motion.button>
          <div className="flex gap-1 md:hidden">
            {nav.map(item=>(
              <button key={item.id} onClick={()=>{setMode(item.id);setSelected(null);}}
                className={`rounded-xl p-2 transition ${mode===item.id?"bg-orange-500 text-white":"text-neutral-600 hover:bg-white/10"}`}>
                {item.icon}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <AnimatePresence mode="wait">
          <motion.div key={mode+(selected?.c.name??"")} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}} transition={{duration:.18}}>
            {mode==="home"&&<Home onMode={setMode}/>}
            {mode==="ranking"&&!selected&&<RankingWorkspace onSelect={(c,data)=>setSelected({c,data})}/>}
            {mode==="ranking"&&selected&&<CandidateDetail candidate={selected.c} ranking={selected.data} onBack={()=>setSelected(null)}/>}
            {mode==="coach"&&<CareerCoach/>}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="mt-20 py-6 text-center text-xs text-neutral-700" style={{borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        HAZE · Evidence-Based AI Hiring Intelligence · SignalRank Engine · No Paid APIs
      </footer>
    </div>
  );
}
