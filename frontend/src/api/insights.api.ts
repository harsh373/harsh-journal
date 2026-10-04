import { api } from "./api";

export type Strength = "limited" | "moderate" | "strong";

export interface AskObservation {
  text: string;
  sourceDates: string[];
  strength: Strength;
}

export interface AskResult {
  answer: string;
  enoughEvidence: boolean;
  observations: AskObservation[];
  sources: { date: string; snippet: string }[];
  searchedCount: number;
  indexedCount: number;
  from: string | null;
  to: string | null;
}

export interface EvidenceItem {
  date: string;
  quote: string;
}

export interface MemoryItem {
  id: string;
  title: string;
  type: string;
  firstMentionedAt: string;
  lastMentionedAt: string;
  mentionCount: number;
  sourceDates: string[];
  evidence: EvidenceItem[];
}

export type LoopStatus = "open" | "resolved" | "dismissed";

export interface OpenLoopItem {
  id: string;
  title: string;
  kind: "intention" | "ongoing_goal";
  status: LoopStatus;
  confidence: number;
  firstMentionedAt: string;
  lastMentionedAt: string;
  mentionCount: number;
  sourceDates: string[];
  evidence: EvidenceItem[];
  resolvedAt?: string;
  resolvedQuote?: string;
  resolvedBy?: "journal" | "user";
}

// Fire-and-forget after a day is saved. The server skips it if nothing changed.
export async function analyzeDay(date: string): Promise<void> {
  await api.post(`/insights/analyze/${date}`);
}

export async function askJournal(question: string): Promise<AskResult> {
  const { data } = await api.post<AskResult>("/insights/ask", { question });
  return data;
}

export async function fetchMemory(): Promise<MemoryItem[]> {
  const { data } = await api.get<{ memories: MemoryItem[] }>("/insights/memory");
  return data.memories;
}

export async function fetchOpenLoops(status: LoopStatus): Promise<OpenLoopItem[]> {
  const { data } = await api.get<{ loops: OpenLoopItem[] }>("/insights/open-loops", { params: { status } });
  return data.loops;
}

export async function updateLoopStatus(id: string, status: LoopStatus): Promise<void> {
  await api.patch(`/insights/open-loops/${id}`, { status });
}