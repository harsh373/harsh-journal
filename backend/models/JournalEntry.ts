import { Schema, model } from "mongoose";

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
  },
  { timestamps: true },
);

export const JournalEntry = model<JournalEntryFields>("JournalEntry", journalEntrySchema);