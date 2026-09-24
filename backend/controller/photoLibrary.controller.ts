import type { Request, Response } from "express";
import type { HydratedDocument, Types } from "mongoose";
import { JournalEntry } from "../models/JournalEntry";
import type { JournalEntryFields } from "../models/JournalEntry";
import { SideQuestPost } from "../models/SideQuestPost";
import type { SideQuestPostFields } from "../models/SideQuestPost";
import { isValidDayKey } from "../utility/dayKey";

const PHOTOS_PAGE_TARGET = 60;
const BUCKET_FETCH_LIMIT = 40;

export type PhotoSource = "journal" | "side-quest";

interface LibraryPhoto {
  id: string;
  url: string;
  caption?: string;
  date: string;
  source: PhotoSource;
  // Where this photo lives, so the frontend can link back to "edit from here."
  sourceHref: string;
  sourceLabel: string;
}

interface Bucket {
  date: string;
  sourceId: string;
  photos: LibraryPhoto[];
}

function journalPhotoBucket(doc: HydratedDocument<JournalEntryFields>): Bucket {
  const date = doc.date;
  return {
    date,
    sourceId: String(doc._id),
    photos: doc.photos.map((photo) => ({
      id: String((photo as { _id?: unknown })._id ?? ""),
      url: photo.url,
      caption: photo.caption,
      date,
      source: "journal",
      sourceHref: `/day/${date}`,
      sourceLabel: "Journal",
    })),
  };
}

// After .populate("sideQuestId", "title"), the ref field holds the populated object
// at runtime even though the model's static type says Types.ObjectId — same kind of
// Mongoose/TS mismatch as the Express-handler params issue noted for Side Quests, so
// it's cast locally here rather than fighting the generic.
type PopulatedQuestPost = HydratedDocument<Omit<SideQuestPostFields, "sideQuestId">> & {
  sideQuestId: { _id: Types.ObjectId; title?: string } | Types.ObjectId | null;
};

function sideQuestPhotoBucket(doc: PopulatedQuestPost): Bucket {
  const date = doc.date;
  const ref = doc.sideQuestId;
  const isPopulated = ref !== null && typeof ref === "object" && "title" in ref;
  const questId = ref === null ? "" : isPopulated ? String((ref as { _id: Types.ObjectId })._id) : String(ref);
  const questTitle =
    isPopulated && (ref as { title?: string }).title ? (ref as { title: string }).title : "Side Quest";

  return {
    date,
    sourceId: String(doc._id),
    photos: doc.photos.map((photo) => ({
      id: String((photo as { _id?: unknown })._id ?? ""),
      url: photo.url,
      caption: photo.caption,
      date,
      source: "side-quest",
      sourceHref: `/side-quests/${questId}`,
      sourceLabel: questTitle,
    })),
  };
}

// GET /api/photo-library?cursor=2026-09-10&source=journal|side-quest
//
// Merges photos from JournalEntry and SideQuestPost into one feed, newest first.
// Pagination is bucketed by day (like /api/journal/archive is bucketed by entry):
// a page always includes every photo from every day it touches, so a day's photos
// are never split across two pages. Tradeoff: a page can run a little over
// PHOTOS_PAGE_TARGET on a heavy photo day. Fine at personal-journal scale — if this
// ever needs strict per-photo pagination, this is the place to change it.
export async function listPhotoLibrary(req: Request, res: Response): Promise<void> {
  const cursorParam = req.query.cursor;
  const cursor = typeof cursorParam === "string" && isValidDayKey(cursorParam) ? cursorParam : null;

  const sourceParam = req.query.source;
  const source: PhotoSource | "all" =
    sourceParam === "journal" || sourceParam === "side-quest" ? sourceParam : "all";

  const dateFilter = cursor ? { date: { $lt: cursor } } : {};
  const hasPhotos = { "photos.0": { $exists: true } };

  const journalDocs =
    source === "side-quest"
      ? []
      : await JournalEntry.find({ ...dateFilter, ...hasPhotos })
          .select("date photos")
          .sort({ date: -1 })
          .limit(BUCKET_FETCH_LIMIT);

  const questPostDocs =
    source === "journal"
      ? []
      : ((await SideQuestPost.find({ ...dateFilter, ...hasPhotos })
          .select("date photos sideQuestId")
          .populate("sideQuestId", "title")
          .sort({ date: -1 })
          .limit(BUCKET_FETCH_LIMIT)) as unknown as PopulatedQuestPost[]);

  const buckets = [...journalDocs.map(journalPhotoBucket), ...questPostDocs.map(sideQuestPhotoBucket)].sort(
    (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.sourceId < b.sourceId ? 1 : -1),
  );

  const exhausted = journalDocs.length < BUCKET_FETCH_LIMIT && questPostDocs.length < BUCKET_FETCH_LIMIT;

  const page: LibraryPhoto[] = [];
  let lastDate: string | null = null;
  for (const bucket of buckets) {
    if (!exhausted && page.length >= PHOTOS_PAGE_TARGET && bucket.date !== lastDate) break;
    page.push(...bucket.photos);
    lastDate = bucket.date;
  }

  res.status(200).json({ photos: page, nextCursor: exhausted ? null : lastDate });
}