import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import type { HydratedDocument } from "mongoose";
import { TRACK_ICONS, TRACK_STATUSES, Track } from "../models/Track";
import type { TrackFields, TrackIcon, TrackStatus } from "../models/Track";
import { TrackLog } from "../models/TrackLog";
import type { TrackLogFields } from "../models/TrackLog";
import { isValidDayKey, isValidMonthKey } from "../utility/dayKey";

const TEXT_LIMITS = { title: 60, subtitle: 160, unit: 20 } as const;
type TextField = keyof typeof TEXT_LIMITS;
const TEXT_FIELDS = Object.keys(TEXT_LIMITS) as TextField[];

const NOTE_LIMIT = 5_000;
const AMOUNT_MAX = 1_000_000;

type TrackPatch = Partial<Record<TextField, string>> & { icon?: TrackIcon; status?: TrackStatus };
type LogPatch = { date?: string; note?: string; amount?: number | null };

function isIcon(value: string): value is TrackIcon {
  return (TRACK_ICONS as readonly string[]).includes(value);
}

function isStatus(value: string): value is TrackStatus {
  return (TRACK_STATUSES as readonly string[]).includes(value);
}

function monthRange(month: string) {
  return { $gte: `${month}-01`, $lte: `${month}-31` };
}

function parseTrackPatch(body: unknown): { patch: TrackPatch } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Send the track as a JSON object" };
  const input = body as Record<string, unknown>;
  const patch: TrackPatch = {};

  for (const field of TEXT_FIELDS) {
    const value = input[field];
    if (value === undefined) continue;
    if (typeof value !== "string") return { error: `${field} must be text` };
    const trimmed = value.trim();
    if (field === "title" && trimmed === "") return { error: "Title can't be empty" };
    if (trimmed.length > TEXT_LIMITS[field]) return { error: `${field} is too long` };
    patch[field] = trimmed;
  }

  if (input.icon !== undefined) {
    if (typeof input.icon !== "string" || !isIcon(input.icon)) return { error: "icon is not valid" };
    patch.icon = input.icon;
  }

  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !isStatus(input.status)) return { error: "status is not valid" };
    patch.status = input.status;
  }

  if (Object.keys(patch).length === 0) return { error: "Nothing to save" };
  return { patch };
}

function parseLogPatch(body: unknown): { patch: LogPatch } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Send the log as a JSON object" };
  const input = body as Record<string, unknown>;
  const patch: LogPatch = {};

  if (input.date !== undefined) {
    if (!isValidDayKey(input.date)) return { error: "date must look like 2026-09-23" };
    patch.date = input.date;
  }

  if (input.note !== undefined) {
    if (typeof input.note !== "string") return { error: "note must be text" };
    if (input.note.length > NOTE_LIMIT) return { error: "note is too long" };
    patch.note = input.note;
  }

  if (input.amount !== undefined) {
    if (input.amount === null) {
      patch.amount = null;
    } else if (typeof input.amount === "number" && Number.isFinite(input.amount)) {
      if (input.amount < 0 || input.amount > AMOUNT_MAX) return { error: "amount is out of range" };
      patch.amount = input.amount;
    } else {
      return { error: "amount must be a number" };
    }
  }

  if (Object.keys(patch).length === 0) return { error: "Nothing to save" };
  return { patch };
}

function toTrackResponse(doc: HydratedDocument<TrackFields>) {
  return {
    id: doc.id as string,
    title: doc.title,
    subtitle: doc.subtitle,
    icon: doc.icon,
    unit: doc.unit,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function toLogResponse(doc: HydratedDocument<TrackLogFields>) {
  return {
    id: doc.id as string,
    trackId: String(doc.trackId),
    date: doc.date,
    note: doc.note,
    amount: doc.amount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function findTrack(id: string) {
  return isValidObjectId(id) ? Track.findById(id) : null;
}

// GET /api/tracks?month=2026-09  ->  every track, with the days you showed up that month.
export async function listTracks(req: Request, res: Response): Promise<void> {
  const month = req.query.month;
  if (!isValidMonthKey(month)) {
    res.status(400).json({ message: "month is required, like 2026-09" });
    return;
  }

  const [tracks, logs] = await Promise.all([
    Track.find(),
    TrackLog.find({ date: monthRange(month) }).select("trackId date amount"),
  ]);

  const stats = new Map<string, { days: Set<string>; total: number }>();
  for (const log of logs) {
    const key = String(log.trackId);
    const entry = stats.get(key) ?? { days: new Set<string>(), total: 0 };
    entry.days.add(log.date);
    entry.total += log.amount ?? 0;
    stats.set(key, entry);
  }

  const order: Record<TrackStatus, number> = { active: 0, paused: 1, archived: 2 };
  const sorted = [...tracks].sort(
    (a, b) => order[a.status] - order[b.status] || a.createdAt.getTime() - b.createdAt.getTime(),
  );

  res.status(200).json({
    tracks: sorted.map((track) => {
      const stat = stats.get(track.id as string);
      return {
        ...toTrackResponse(track),
        monthDays: stat ? [...stat.days].sort() : [],
        monthTotal: stat ? stat.total : 0,
      };
    }),
  });
}

// POST /api/tracks  ->  a fresh "Untitled track" you then rename.
export async function createTrack(_req: Request, res: Response): Promise<void> {
  const doc = await Track.create({});
  res.status(201).json({ track: toTrackResponse(doc) });
}

// GET /api/tracks/:id
export async function getTrack(req: Request, res: Response): Promise<void> {
  const doc = await findTrack(req.params.id as string);
  if (!doc) {
    res.status(404).json({ message: "Track not found" });
    return;
  }
  res.status(200).json({ track: toTrackResponse(doc) });
}

// PUT /api/tracks/:id
export async function updateTrack(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  if (!isValidObjectId(id)) {
    res.status(404).json({ message: "Track not found" });
    return;
  }

  const parsed = parseTrackPatch(req.body);
  if ("error" in parsed) {
    res.status(400).json({ message: parsed.error });
    return;
  }

  const doc = await Track.findByIdAndUpdate(
    id,
    { $set: parsed.patch },
    { returnDocument: "after", runValidators: true },
  );
  if (!doc) {
    res.status(404).json({ message: "Track not found" });
    return;
  }
  res.status(200).json({ track: toTrackResponse(doc) });
}

// DELETE /api/tracks/:id  ->  removes the track and every log inside it.
export async function deleteTrack(req: Request, res: Response): Promise<void> {
  const doc = await findTrack(req.params.id as string);
  if (!doc) {
    res.status(404).json({ message: "Track not found" });
    return;
  }

  await TrackLog.deleteMany({ trackId: doc._id });
  await doc.deleteOne();
  res.status(200).json({ deleted: true });
}

// GET /api/tracks/:id/logs?month=2026-09  ->  that month's logs, newest first.
export async function listLogs(req: Request, res: Response): Promise<void> {
  const month = req.query.month;
  if (!isValidMonthKey(month)) {
    res.status(400).json({ message: "month is required, like 2026-09" });
    return;
  }

  const track = await findTrack(req.params.id as string);
  if (!track) {
    res.status(404).json({ message: "Track not found" });
    return;
  }

  const logs = await TrackLog.find({ trackId: track._id, date: monthRange(month) }).sort({
    date: -1,
    createdAt: -1,
  });
  res.status(200).json({ logs: logs.map(toLogResponse) });
}

// POST /api/tracks/:id/logs  body: { date, note?, amount? }
export async function createLog(req: Request, res: Response): Promise<void> {
  const track = await findTrack(req.params.id as string);
  if (!track) {
    res.status(404).json({ message: "Track not found" });
    return;
  }

  const parsed = parseLogPatch(req.body);
  if ("error" in parsed) {
    res.status(400).json({ message: parsed.error });
    return;
  }
  if (!parsed.patch.date) {
    res.status(400).json({ message: "date is required" });
    return;
  }

  const doc = await TrackLog.create({
    trackId: track._id,
    date: parsed.patch.date,
    note: parsed.patch.note ?? "",
    amount: parsed.patch.amount ?? null,
  });
  res.status(201).json({ log: toLogResponse(doc) });
}

// PUT /api/tracks/:id/logs/:logId
export async function updateLog(req: Request, res: Response): Promise<void> {
  const trackId = req.params.id as string;
  const logId = req.params.logId as string;
  if (!isValidObjectId(trackId) || !isValidObjectId(logId)) {
    res.status(404).json({ message: "Log not found" });
    return;
  }

  const parsed = parseLogPatch(req.body);
  if ("error" in parsed) {
    res.status(400).json({ message: parsed.error });
    return;
  }

  const doc = await TrackLog.findOneAndUpdate(
    { _id: logId, trackId },
    { $set: parsed.patch },
    { returnDocument: "after", runValidators: true },
  );
  if (!doc) {
    res.status(404).json({ message: "Log not found" });
    return;
  }
  res.status(200).json({ log: toLogResponse(doc) });
}

// DELETE /api/tracks/:id/logs/:logId
export async function deleteLog(req: Request, res: Response): Promise<void> {
  const trackId = req.params.id as string;
  const logId = req.params.logId as string;
  if (!isValidObjectId(trackId) || !isValidObjectId(logId)) {
    res.status(404).json({ message: "Log not found" });
    return;
  }

  const doc = await TrackLog.findOneAndDelete({ _id: logId, trackId });
  if (!doc) {
    res.status(404).json({ message: "Log not found" });
    return;
  }
  res.status(200).json({ deleted: true });
}

// GET /api/tracks/logs?date=2026-09-23  ->  everything logged on one day, across all tracks.
// The journal page uses this to show "what I did on my tracks today".
export async function listLogsForDay(req: Request, res: Response): Promise<void> {
  const date = req.query.date;
  if (!isValidDayKey(date)) {
    res.status(400).json({ message: "date must look like 2026-09-23" });
    return;
  }

  const logs = await TrackLog.find({ date }).sort({ createdAt: 1 });
  const trackIds = [...new Set(logs.map((log) => String(log.trackId)))];
  const tracks = await Track.find({ _id: { $in: trackIds } });
  const byId = new Map(tracks.map((track) => [track.id as string, track]));

  const result = logs.flatMap((log) => {
    const track = byId.get(String(log.trackId));
    if (!track) return [];
    return [
      {
        ...toLogResponse(log),
        track: { id: track.id as string, title: track.title, icon: track.icon, unit: track.unit },
      },
    ];
  });

  res.status(200).json({ logs: result });
}