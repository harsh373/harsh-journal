import type { Request, Response } from "express";
import type { HydratedDocument } from "mongoose";
import { JournalEntry, MOODS } from "../models/JournalEntry";
import type { JournalEntryFields, Mood } from "../models/JournalEntry";
import { isValidDayKey, isValidMonthKey } from "../utility/dayKey";

const ARCHIVE_PAGE_SIZE = 10;

interface ArchiveEntryResponse {
  date: string;
  mood: Mood;
  dailySummary: string;
  whatIDidToday: string;
  whatDrainedMe: string;
  tomorrowDifferent: string;
  photos: { id: string; url: string; caption?: string }[];
}

function toArchiveResponse(doc: HydratedDocument<JournalEntryFields>): ArchiveEntryResponse {
  return {
    date: doc.date,
    mood: doc.mood,
    dailySummary: doc.dailySummary,
    whatIDidToday: doc.whatIDidToday,
    whatDrainedMe: doc.whatDrainedMe,
    tomorrowDifferent: doc.tomorrowDifferent,
    photos: doc.photos.map((photo) => ({
      id: String((photo as { _id?: unknown })._id ?? ""),
      url: photo.url,
      caption: photo.caption,
    })),
  };
}

// GET /api/journal/archive?cursor=2026-09-10  ->  10 days at a time, newest first,
// skipping any day that's completely empty (no text, no photos).
export async function listArchive(req: Request, res: Response): Promise<void> {
  const cursor = req.query.cursor;
  const hasContent = {
    $or: [
      { dailySummary: { $ne: "" } },
      { whatIDidToday: { $ne: "" } },
      { whatDrainedMe: { $ne: "" } },
      { tomorrowDifferent: { $ne: "" } },
      { "photos.0": { $exists: true } },
    ],
  };
  const filter =
    typeof cursor === "string" && isValidDayKey(cursor) ? { ...hasContent, date: { $lt: cursor } } : hasContent;

  const docs = await JournalEntry.find(filter).sort({ date: -1 }).limit(ARCHIVE_PAGE_SIZE + 1);
  const hasMore = docs.length > ARCHIVE_PAGE_SIZE;
  const page = hasMore ? docs.slice(0, ARCHIVE_PAGE_SIZE) : docs;

  res.status(200).json({
    entries: page.map(toArchiveResponse),
    nextCursor: hasMore ? (page.at(-1)?.date ?? null) : null,
  });
}

const TEXT_LIMITS = {
  whatIDidToday: 20_000,
  whatDrainedMe: 20_000,
  tomorrowDifferent: 20_000,
  dailySummary: 50_000,
  location: 120,
} as const;

type TextField = keyof typeof TEXT_LIMITS;
const TEXT_FIELDS = Object.keys(TEXT_LIMITS) as TextField[];

type EntryPatch = Partial<Record<TextField, string>> & { mood?: Mood };

function isMood(value: string): value is Mood {
  return (MOODS as readonly string[]).includes(value);
}

// Only these fields can be changed through the save route. Photos, dates and ids are ignored here.
function parseEntryPatch(body: unknown): { patch: EntryPatch } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Send the entry as a JSON object" };
  const input = body as Record<string, unknown>;
  const patch: EntryPatch = {};

  for (const field of TEXT_FIELDS) {
    const value = input[field];
    if (value === undefined) continue;
    if (typeof value !== "string") return { error: `${field} must be text` };
    if (value.length > TEXT_LIMITS[field]) return { error: `${field} is too long` };
    patch[field] = field === "location" ? value.trim() : value;
  }

  if (input.mood !== undefined) {
    if (typeof input.mood !== "string" || !isMood(input.mood)) return { error: "mood is not valid" };
    patch.mood = input.mood;
  }

  if (Object.keys(patch).length === 0) return { error: "Nothing to save" };
  return { patch };
}

function toResponse(doc: HydratedDocument<JournalEntryFields>) {
  return {
    id: doc.id as string,
    date: doc.date,
    whatIDidToday: doc.whatIDidToday,
    whatDrainedMe: doc.whatDrainedMe,
    tomorrowDifferent: doc.tomorrowDifferent,
    dailySummary: doc.dailySummary,
    mood: doc.mood,
    location: doc.location,
    photos: doc.photos.map((photo) => ({
      id: String((photo as { _id?: unknown })._id ?? ""),
      url: photo.url,
      publicId: photo.publicId,
      caption: photo.caption,
    })),
    tags: doc.tags,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// GET /api/journal?month=2026-09  ->  the days of that month that have an entry, with their mood.
export async function listEntries(req: Request, res: Response): Promise<void> {
  const month = req.query.month;
  if (!isValidMonthKey(month)) {
    res.status(400).json({ message: "month is required, like 2026-09" });
    return;
  }

  const docs = await JournalEntry.find({ date: { $gte: `${month}-01`, $lte: `${month}-31` } })
    .select("date mood")
    .sort({ date: 1 });

  res.status(200).json({ entries: docs.map((doc) => ({ date: doc.date, mood: doc.mood })) });
}

// GET /api/journal/2026-09-23  ->  the entry, or { entry: null } if that day is still empty.
export async function getEntry(req: Request, res: Response): Promise<void> {
  const date = req.params.date;
  if (!isValidDayKey(date)) {
    res.status(400).json({ message: "date must look like 2026-09-23" });
    return;
  }

  const doc = await JournalEntry.findOne({ date });
  res.status(200).json({ entry: doc ? toResponse(doc) : null });
}

async function upsertEntry(date: string, patch: EntryPatch) {
  return JournalEntry.findOneAndUpdate(
    { date },
    { $set: patch },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
  );
}

// PUT /api/journal/2026-09-23  ->  create the day on the first save, update it after that.
// One route for both keeps autosave safe: repeating a save can never create a duplicate.
export async function saveEntry(req: Request, res: Response): Promise<void> {
  const date = req.params.date;
  if (!isValidDayKey(date)) {
    res.status(400).json({ message: "date must look like 2026-09-23" });
    return;
  }

  const parsed = parseEntryPatch(req.body);
  if ("error" in parsed) {
    res.status(400).json({ message: parsed.error });
    return;
  }

  let doc;
  try {
    doc = await upsertEntry(date, parsed.patch);
  } catch (error) {
    // Two saves for a brand-new day can collide on the unique date; trying once more resolves it.
    if ((error as { code?: number }).code !== 11000) throw error;
    doc = await upsertEntry(date, parsed.patch);
  }

  if (!doc) {
    res.status(500).json({ message: "Could not save the entry" });
    return;
  }
  res.status(200).json({ entry: toResponse(doc) });
}

// DELETE /api/journal/2026-09-23
export async function deleteEntry(req: Request, res: Response): Promise<void> {
  const date = req.params.date;
  if (!isValidDayKey(date)) {
    res.status(400).json({ message: "date must look like 2026-09-23" });
    return;
  }

  const doc = await JournalEntry.findOneAndDelete({ date });
  if (!doc) {
    res.status(404).json({ message: "No entry for that day" });
    return;
  }
  res.status(200).json({ deleted: true });
}