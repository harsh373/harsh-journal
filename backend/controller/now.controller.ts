import type { Request, Response } from "express";
import type { HydratedDocument } from "mongoose";
import { TimeTravelEntry } from "../models/TimeTravelEntry";
import type { TimeTravelEntryFields } from "../models/TimeTravelEntry";
import { isValidDayKey } from "../utility/dayKey";

const THOUGHT_LIMIT = 2000;
const PRESENT_LIMIT = 1000;
const RECENT_DAYS = 14;

interface EntryResponse {
  id: string;
  date: string;
  futureThought: string;
  presentState?: string;
  createdAt: Date;
}

function toResponse(doc: HydratedDocument<TimeTravelEntryFields>): EntryResponse {
  return {
    id: doc.id as string,
    date: doc.date,
    futureThought: doc.futureThought,
    presentState: doc.presentState,
    createdAt: doc.createdAt,
  };
}

// POST /api/now/entries  ->  records one ENTER FUTURE moment. This is the ONLY
// action that creates a row, and therefore the only thing that affects the count.
// Opening the Time Travel screen never calls this — so a refresh, a rerender, or
// backing out of the screen without pressing ENTER FUTURE can never add a count.
export async function createEntry(req: Request, res: Response): Promise<void> {
  const date = req.body?.date;
  if (!isValidDayKey(date)) {
    res.status(400).json({ message: "date must look like 2026-10-08" });
    return;
  }

  const futureThought = typeof req.body?.futureThought === "string" ? req.body.futureThought.trim() : "";
  if (!futureThought) {
    res.status(400).json({ message: "futureThought is required" });
    return;
  }
  if (futureThought.length > THOUGHT_LIMIT) {
    res.status(400).json({ message: "futureThought is too long" });
    return;
  }

  const doc = await TimeTravelEntry.create({ date, futureThought });
  res.status(201).json({ entry: toResponse(doc) });
}

// PATCH /api/now/entries/:id  ->  attaches the optional "what are you doing now"
// text written after RETURN TO NOW onto the escape it followed.
export async function updatePresentState(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const presentState = typeof req.body?.presentState === "string" ? req.body.presentState.trim() : "";
  if (!presentState) {
    res.status(400).json({ message: "presentState is required" });
    return;
  }
  if (presentState.length > PRESENT_LIMIT) {
    res.status(400).json({ message: "presentState is too long" });
    return;
  }

  const doc = await TimeTravelEntry.findByIdAndUpdate(
    id,
    { $set: { presentState } },
    { new: true, runValidators: true },
  );

  if (!doc) {
    res.status(404).json({ message: "No such entry" });
    return;
  }
  res.status(200).json({ entry: toResponse(doc) });
}

// GET /api/now/today?date=2026-10-08  ->  the count for that date, counted fresh
// from the actual stored entries every single time — never a separately maintained
// counter field, so there is nothing that can drift out of sync or double-count.
export async function getTodayCount(req: Request, res: Response): Promise<void> {
  const date = req.query.date;
  if (!isValidDayKey(date)) {
    res.status(400).json({ message: "date must look like 2026-10-08" });
    return;
  }

  const count = await TimeTravelEntry.countDocuments({ date });
  res.status(200).json({ date, count });
}

// GET /api/now/recent  ->  escape counts per day, most recent first, for the
// small RECENT list on the page.
export async function getRecent(_req: Request, res: Response): Promise<void> {
  const results = await TimeTravelEntry.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$date", count: { $sum: 1 } } },
    { $sort: { _id: -1 } },
    { $limit: RECENT_DAYS },
  ]);

  res.status(200).json({
    days: results.map((row) => ({ date: row._id, count: row.count })),
  });
}