import { MEMORY_TYPES } from "../models/Memory";
import type { MemoryType } from "../models/Memory";
import type { LoopKind } from "../models/OpenLoop";
import { ai } from "./index";
import { quoteAppearsIn, toKey } from "./textUtils";

const MIN_CONFIDENCE = 0.6;
const MAX_TOPICS = 6;
const MAX_INTENTIONS = 5;
const MAX_COMPLETIONS = 5;

export interface ExtractedTopic {
  title: string;
  type: MemoryType;
  quote: string;
}
export interface ExtractedIntention {
  title: string;
  kind: LoopKind;
  confidence: number;
  quote: string;
}
export interface ExtractedCompletion {
  title: string;
  quote: string;
}
export interface Extraction {
  topics: ExtractedTopic[];
  intentions: ExtractedIntention[];
  completions: ExtractedCompletion[];
}

const SYSTEM_PROMPT = `You analyse ONE private journal entry and return structured notes as a single JSON object. Return JSON only.

Be conservative. Returning nothing is far better than inventing something.

Shape:
{
  "topics": [{ "title": string, "type": "idea" | "project" | "person" | "goal" | "interest" | "topic", "quote": string }],
  "intentions": [{ "title": string, "kind": "intention" | "ongoing_goal", "confidence": number, "quote": string }],
  "completions": [{ "title": string, "quote": string }]
}

Rules:
- "quote" must be copied EXACTLY, word for word, from the entry (at most 25 words). If you cannot quote it, leave the item out.
- topics: specific, nameable things the writer cares about or spends attention on: a project, an idea they might build, a person, a goal, an interest, a recurring subject. Use a short neutral title (2 to 6 words). Never list moods, generic words like "work" or "day", or things mentioned only in passing. At most 6.
- intentions: things the writer says they still intend to do and have NOT done yet. "intention" is a concrete action (for example "call Rahul", "update my resume"). "ongoing_goal" is a long-running aim (for example "get an internship"). Skip anything already done, vague wishes, and sentences that merely contain "need" or "should" without a real commitment. "confidence" from 0 to 1 is how sure you are that this is a real, unfinished intention. At most 5.
- completions: ONLY when the entry clearly says the writer finished something that matches one of the KNOWN OPEN ITEMS. "title" must be copied exactly from that list.
- If something is the same thing as an entry in KNOWN TOPICS or KNOWN OPEN ITEMS, reuse that exact title instead of inventing a new wording.
- Do not diagnose, interpret feelings, or comment on mental health. Record only what is written.`;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function cleanTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.replace(/\s+/g, " ").trim();
  return title.length >= 2 && title.length <= 80 ? title : null;
}

function cleanQuote(value: unknown, entryText: string): string | null {
  if (typeof value !== "string") return null;
  const quote = value.replace(/\s+/g, " ").trim();
  if (quote.length === 0 || quote.length > 300) return null;
  return quoteAppearsIn(entryText, quote) ? quote : null;
}

function items(raw: Record<string, unknown>, field: string): Record<string, unknown>[] {
  const value = raw[field];
  if (!Array.isArray(value)) return [];
  return value.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
}

function parseExtraction(raw: unknown, entryText: string, knownLoops: string[]): Extraction {
  const root = asRecord(raw);
  const result: Extraction = { topics: [], intentions: [], completions: [] };
  if (!root) return result;

  const seen = new Set<string>();

  for (const item of items(root, "topics")) {
    const title = cleanTitle(item.title);
    const quote = cleanQuote(item.quote, entryText);
    if (!title || !quote || seen.has(toKey(title))) continue;
    const type = (MEMORY_TYPES as readonly string[]).includes(String(item.type)) ? (item.type as MemoryType) : "topic";
    seen.add(toKey(title));
    result.topics.push({ title, type, quote });
  }

  const seenLoops = new Set<string>();
  for (const item of items(root, "intentions")) {
    const title = cleanTitle(item.title);
    const quote = cleanQuote(item.quote, entryText);
    const confidence = typeof item.confidence === "number" ? Math.min(1, Math.max(0, item.confidence)) : 0;
    if (!title || !quote || confidence < MIN_CONFIDENCE || seenLoops.has(toKey(title))) continue;
    seenLoops.add(toKey(title));
    result.intentions.push({ title, kind: item.kind === "ongoing_goal" ? "ongoing_goal" : "intention", confidence, quote });
  }

  const knownKeys = new Set(knownLoops.map(toKey));
  for (const item of items(root, "completions")) {
    const title = cleanTitle(item.title);
    const quote = cleanQuote(item.quote, entryText);
    if (!title || !quote || !knownKeys.has(toKey(title))) continue;
    result.completions.push({ title, quote });
  }

  result.topics = result.topics.slice(0, MAX_TOPICS);
  result.intentions = result.intentions.slice(0, MAX_INTENTIONS);
  result.completions = result.completions.slice(0, MAX_COMPLETIONS);
  return result;
}

export async function extractFromEntry(input: {
  date: string;
  text: string;
  knownTopics: string[];
  knownLoops: string[];
}): Promise<Extraction> {
  const list = (titles: string[]) => (titles.length > 0 ? titles.map((t) => `- ${t}`).join("\n") : "(none yet)");

  const user = `KNOWN TOPICS:
${list(input.knownTopics)}

KNOWN OPEN ITEMS:
${list(input.knownLoops)}

ENTRY DATE: ${input.date}
ENTRY:
${input.text}`;

  const raw = await ai.completeJson({ tier: "fast", system: SYSTEM_PROMPT, user, maxTokens: 3000 });
  return parseExtraction(raw, input.text, input.knownLoops);
}