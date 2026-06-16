import type { RankingResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000/api";

export async function fetchDemoRanking(): Promise<RankingResponse> {
  const response = await fetch(`${API_BASE}/demo`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  return response.json();
}

