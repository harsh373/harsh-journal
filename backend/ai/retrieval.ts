import { JournalEntry } from "../models/JournalEntry";
import { ai } from "./index";
import { entryToText } from "./textUtils";

const TOP_K = 8;
const RECENT_COUNT = 5;
const ENTRY_CHAR_LIMIT = 1500;
const RECENCY_WORDS = /\b(lately|recent|recently|these days|this week|last week|this month|right now|currently|nowadays)\b/i;

export interface RetrievedEntry {
  date: string;
  text: string;
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) sum += (a[i] ?? 0) * (b[i] ?? 0);
  return sum;
}

export async function retrieveEntries(question: string): Promise<{ entries: RetrievedEntry[]; indexedCount: number }> {
  const docs = await JournalEntry.find({ "embedding.0": { $exists: true } })
    .select("+embedding date whatIDidToday whatDrainedMe tomorrowDifferent dailySummary mood")
    .lean();

  if (docs.length === 0) return { entries: [], indexedCount: 0 };

  const vectors = await ai.embed([question]);
  const queryVector = vectors[0];
  if (!queryVector) throw new Error("No embedding came back for the question");

  const ranked = docs
    .map((doc) => ({ doc, score: dot(doc.embedding ?? [], queryVector) }))
    .sort((a, b) => b.score - a.score);

  const chosen = new Map<string, (typeof docs)[number]>();
  for (const { doc } of ranked.slice(0, TOP_K)) chosen.set(doc.date, doc);

  if (RECENCY_WORDS.test(question)) {
    const newest = [...docs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, RECENT_COUNT);
    for (const doc of newest) chosen.set(doc.date, doc);
  }

  const entries: RetrievedEntry[] = [];
  for (const doc of chosen.values()) {
    const text = entryToText(doc).slice(0, ENTRY_CHAR_LIMIT);
    if (text) entries.push({ date: doc.date, text });
  }
  entries.sort((a, b) => a.date.localeCompare(b.date));

  return { entries, indexedCount: docs.length };
}