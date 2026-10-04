import { Schema, model } from "mongoose";
import { detachDate, refreshStats } from "../ai/memoryStore";

export const MOODS = ["good", "neutral", "tough", "special"] as const;
export type Mood = (typeof MOODS)[number];

export interface JournalPhoto {
  url: string;
  publicId: string;
  caption?: string;
}

export interface JournalEntryFields {
  // A plain "YYYY-MM-DD" string: one entry per journal day, immune to time zones.
  date: string;
  whatIDidToday: string;
  whatDrainedMe: string;
  tomorrowDifferent: string;
  dailySummary: string;
  mood: Mood;
  location: string;
  photos: JournalPhoto[];
  tags: string[];
  // Set by the insights pipeline, never by the journal editor.
  analyzedHash?: string;
  analyzedAt?: Date;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const photoSchema = new Schema<JournalPhoto>({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  caption: { type: String, maxlength: 500 },
});

const journalEntrySchema = new Schema<JournalEntryFields>(
  {
    date: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    whatIDidToday: { type: String, default: "", maxlength: 20_000 },
    whatDrainedMe: { type: String, default: "", maxlength: 20_000 },
    tomorrowDifferent: { type: String, default: "", maxlength: 20_000 },
    dailySummary: { type: String, default: "", maxlength: 50_000 },
    mood: { type: String, enum: MOODS, default: "neutral" },
    location: { type: String, default: "", maxlength: 120 },
    photos: { type: [photoSchema], default: [] },
    tags: { type: [String], default: [] },
    analyzedHash: { type: String },
    analyzedAt: { type: Date },
    embedding: { type: [Number], select: false, default: undefined },
  },
  { timestamps: true },
);

// A deleted day must stop counting as evidence for any memory or open loop.
journalEntrySchema.post("findOneAndDelete", async function (doc: JournalEntryFields | null) {
  if (!doc) return;
  try {
    await detachDate(doc.date);
    await refreshStats();
  } catch (error) {
    console.warn("Could not clean insights after delete:", error instanceof Error ? error.message : "unknown error");
  }
});

export const JournalEntry = model<JournalEntryFields>("JournalEntry", journalEntrySchema);