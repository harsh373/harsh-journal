import { Memory } from "../models/Memory";
import { OpenLoop } from "../models/OpenLoop";
import type { Extraction } from "./extraction";
import { toKey } from "./textUtils";

const EVIDENCE_LIMIT = 12;

// Only titles are shared with the model (so it reuses wording), never entry text.
export async function getKnownTitles(): Promise<{ topics: string[]; loops: string[] }> {
  const [topics, loops] = await Promise.all([
    Memory.find().sort({ lastMentionedAt: -1 }).limit(80).select("title").lean(),
    OpenLoop.find({ status: "open" }).sort({ lastMentionedAt: -1 }).limit(40).select("title").lean(),
  ]);
  return { topics: topics.map((t) => t.title), loops: loops.map((l) => l.title) };
}

// Removes everything a previous analysis of this day contributed.
export async function detachDate(date: string): Promise<void> {
  await Promise.all([
    Memory.updateMany({ sourceDates: date }, { $pull: { sourceDates: date, evidence: { date } } }),
    OpenLoop.updateMany({ sourceDates: date }, { $pull: { sourceDates: date, evidence: { date } } }),
    // A loop this day marked as finished goes back to open until the day is re-read.
    OpenLoop.updateMany(
      { resolvedAt: date, resolvedBy: "journal" },
      { $set: { status: "open" }, $unset: { resolvedAt: "", resolvedQuote: "", resolvedBy: "" } },
    ),
  ]);
}

export async function saveExtraction(date: string, extraction: Extraction): Promise<void> {
  for (const topic of extraction.topics) {
    await Memory.updateOne(
      { key: toKey(topic.title) },
      {
        $setOnInsert: { title: topic.title, type: topic.type, firstMentionedAt: date, lastMentionedAt: date, mentionCount: 0 },
        $addToSet: { sourceDates: date },
        $push: { evidence: { $each: [{ date, quote: topic.quote }], $slice: -EVIDENCE_LIMIT } },
      },
      { upsert: true },
    );
  }

  for (const loop of extraction.intentions) {
    await OpenLoop.updateOne(
      { key: toKey(loop.title) },
      {
        $setOnInsert: {
          title: loop.title,
          kind: loop.kind,
          status: "open",
          firstMentionedAt: date,
          lastMentionedAt: date,
          mentionCount: 0,
        },
        $max: { confidence: loop.confidence },
        $addToSet: { sourceDates: date },
        $push: { evidence: { $each: [{ date, quote: loop.quote }], $slice: -EVIDENCE_LIMIT } },
      },
      { upsert: true },
    );
  }

  for (const done of extraction.completions) {
    await OpenLoop.updateOne(
      { key: toKey(done.title), status: "open" },
      { $set: { status: "resolved", resolvedAt: date, resolvedQuote: done.quote, resolvedBy: "journal" } },
    );
  }
}

// Mention counts and first/last dates are always derived from the source dates,
// so they can never drift out of sync with the evidence.
export async function refreshStats(): Promise<void> {
  const pipeline = [
    {
      $set: {
        mentionCount: { $size: "$sourceDates" },
        firstMentionedAt: { $min: "$sourceDates" },
        lastMentionedAt: { $max: "$sourceDates" },
      },
    },
  ];
  await Promise.all([
    Memory.updateMany({}, pipeline, { updatePipeline: true }),
    OpenLoop.updateMany({}, pipeline, { updatePipeline: true }),
  ]);
  await Promise.all([Memory.deleteMany({ mentionCount: 0 }), OpenLoop.deleteMany({ mentionCount: 0 })]);
}