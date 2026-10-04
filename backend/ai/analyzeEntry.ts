import { JournalEntry } from "../models/JournalEntry";
import { extractFromEntry } from "./extraction";
import { ai } from "./index";
import { detachDate, getKnownTitles, refreshStats, saveExtraction } from "./memoryStore";
import { entryToText, hashText } from "./textUtils";

const EMBED_TEXT_LIMIT = 1800;

// Stops two near-simultaneous requests for the same day from doing the work twice.
const inFlight = new Set<string>();

export type AnalyzeResult = { status: "analyzed" | "unchanged" | "empty" | "busy"; embedded: boolean };

export async function analyzeEntry(date: string): Promise<AnalyzeResult> {
  if (inFlight.has(date)) return { status: "busy", embedded: false };
  inFlight.add(date);

  try {
    const entry = await JournalEntry.findOne({ date }).select("+embedding");
    if (!entry) return { status: "empty", embedded: false };

    const text = entryToText(entry);
    if (!text) {
      // The day was emptied: remove what it used to contribute.
      await detachDate(date);
      await refreshStats();
      return { status: "empty", embedded: false };
    }

    const hash = hashText(text);
    const needsAnalysis = entry.analyzedHash !== hash;
    let embedding: number[] | null = entry.embedding && entry.embedding.length > 0 ? entry.embedding : null;

    if (!needsAnalysis && embedding) return { status: "unchanged", embedded: true };

    if (needsAnalysis) {
      const known = await getKnownTitles();
      // If this throws, nothing has been changed yet and the old data stays intact.
      const extraction = await extractFromEntry({ date, text, knownTopics: known.topics, knownLoops: known.loops });
      await detachDate(date);
      await saveExtraction(date, extraction);
      await refreshStats();
      console.log(
        `Analyzed ${date}: ${extraction.topics.length} topics, ${extraction.intentions.length} intentions, ${extraction.completions.length} completions`,
      );
    }

    // Embedding trouble must never undo a successful analysis.
    if (needsAnalysis || !embedding) {
      try {
        const vectors = await ai.embed([text.slice(0, EMBED_TEXT_LIMIT)]);
        embedding = vectors[0] ?? null;
      } catch (error) {
        console.warn(`Embedding failed for ${date}:`, error instanceof Error ? error.message : "unknown error");
      }
    }

    await JournalEntry.updateOne(
      { date },
      { $set: { analyzedHash: hash, analyzedAt: new Date(), ...(embedding ? { embedding } : {}) } },
      { timestamps: false },
    );

    return { status: needsAnalysis ? "analyzed" : "unchanged", embedded: embedding !== null };
  } finally {
    inFlight.delete(date);
  }
}