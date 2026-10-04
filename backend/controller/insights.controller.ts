import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { analyzeEntry } from "../ai/analyzeEntry";
import { askJournal } from "../ai/ask";
import { AINotConfiguredError } from "../ai/provider";
import { LOOP_STATUSES, OpenLoop } from "../models/OpenLoop";
import type { LoopStatus } from "../models/OpenLoop";
import { Memory } from "../models/Memory";
import { isValidDayKey } from "../utility/dayKey";

function isLoopStatus(value: unknown): value is LoopStatus {
  return typeof value === "string" && (LOOP_STATUSES as readonly string[]).includes(value);
}

// POST /api/insights/analyze/2026-09-23
export async function analyzeDay(req: Request, res: Response): Promise<void> {
  const date = req.params.date;
  if (!isValidDayKey(date)) {
    res.status(400).json({ message: "date must look like 2026-09-23" });
    return;
  }

  try {
    res.status(200).json(await analyzeEntry(date));
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      res.status(503).json({ message: "AI is not configured" });
      return;
    }
    // Message only: never log entry text.
    console.error(`Analysis failed for ${date}:`, error instanceof Error ? error.message : "unknown error");
    res.status(502).json({ message: "Analysis failed" });
  }
}

// POST /api/insights/ask   { question: "..." }
export async function askQuestion(req: Request, res: Response): Promise<void> {
  const question: unknown = req.body?.question;
  if (typeof question !== "string" || question.trim().length < 3 || question.trim().length > 400) {
    res.status(400).json({ message: "Ask a question between 3 and 400 characters" });
    return;
  }

  try {
    res.status(200).json(await askJournal(question.trim()));
  } catch (error) {
    if (error instanceof AINotConfiguredError) {
      res.status(503).json({ message: "AI is not configured" });
      return;
    }
    console.error("Ask failed:", error instanceof Error ? error.message : "unknown error");
    res.status(502).json({ message: "Could not answer right now" });
  }
}

// GET /api/insights/memory
export async function listMemory(_req: Request, res: Response): Promise<void> {
  const docs = await Memory.find().sort({ mentionCount: -1, lastMentionedAt: -1 }).limit(200).lean();
  res.status(200).json({
    memories: docs.map((doc) => ({
      id: String(doc._id),
      title: doc.title,
      type: doc.type,
      firstMentionedAt: doc.firstMentionedAt,
      lastMentionedAt: doc.lastMentionedAt,
      mentionCount: doc.mentionCount,
      sourceDates: [...doc.sourceDates].sort(),
      evidence: doc.evidence,
    })),
  });
}

// GET /api/insights/open-loops?status=open
export async function listOpenLoops(req: Request, res: Response): Promise<void> {
  const requested = req.query.status;
  const filter = isLoopStatus(requested) ? { status: requested } : {};

  const docs = await OpenLoop.find(filter).sort({ lastMentionedAt: -1 }).limit(200).lean();
  res.status(200).json({
    loops: docs.map((doc) => ({
      id: String(doc._id),
      title: doc.title,
      kind: doc.kind,
      status: doc.status,
      confidence: doc.confidence,
      firstMentionedAt: doc.firstMentionedAt,
      lastMentionedAt: doc.lastMentionedAt,
      mentionCount: doc.mentionCount,
      sourceDates: [...doc.sourceDates].sort(),
      evidence: doc.evidence,
      resolvedAt: doc.resolvedAt,
      resolvedQuote: doc.resolvedQuote,
      resolvedBy: doc.resolvedBy,
    })),
  });
}

// PATCH /api/insights/open-loops/:id   { status: "open" | "resolved" | "dismissed" }
// Nothing is ever deleted: a loop only moves between the three states.
export async function setLoopStatus(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  const status: unknown = req.body?.status;
  if (typeof id !== "string" || !isValidObjectId(id) || !isLoopStatus(status)) {
    res.status(400).json({ message: "Send a valid id and a status of open, resolved or dismissed" });
    return;
  }

  const update =
    status === "resolved"
      ? { $set: { status, resolvedBy: "user" as const }, $unset: { resolvedAt: "", resolvedQuote: "" } }
      : status === "open"
        ? { $set: { status }, $unset: { resolvedAt: "", resolvedQuote: "", resolvedBy: "" } }
        : { $set: { status } };

  const doc = await OpenLoop.findByIdAndUpdate(id, update, { returnDocument: "after" });
  if (!doc) {
    res.status(404).json({ message: "Open loop not found" });
    return;
  }
  res.status(200).json({ id: String(doc._id), status: doc.status });
}