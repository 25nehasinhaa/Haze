import type { RankingResponse, CareerCoachResult } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000/api";

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${text.slice(0, 200)}`);
  }
  return res;
}

export async function fetchDemoRanking(): Promise<RankingResponse> {
  return (await apiFetch("/demo")).json();
}

export async function fetchDatasetRanking(topK = 50): Promise<RankingResponse> {
  return (await apiFetch(`/rank-dataset?top_k=${topK}`, { method: "POST" })).json();
}

export async function uploadAndRank(
  jdText: string,
  resumeFiles: File[],
  includeDataset: boolean,
  topK = 50
): Promise<RankingResponse> {
  const form = new FormData();
  form.append("jd_text", jdText);
  form.append("include_dataset", String(includeDataset));
  form.append("top_k", String(topK));
  resumeFiles.forEach((f) => form.append("resume_files", f));
  return (await apiFetch("/upload/rank", { method: "POST", body: form })).json();
}

export async function runCareerCoach(
  resumeFile: File | null,
  resumeText: string,
  jdText: string
): Promise<CareerCoachResult> {
  const form = new FormData();
  if (resumeFile) form.append("resume_file", resumeFile);
  if (resumeText) form.append("resume_text", resumeText);
  if (jdText) form.append("jd_text", jdText);
  return (await apiFetch("/career-coach", { method: "POST", body: form })).json();
}

export async function downloadSubmissionCSV(): Promise<Blob> {
  const res = await apiFetch("/export/submission?top_n=100");
  return res.blob();
}
