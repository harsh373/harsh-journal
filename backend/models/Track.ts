import { Schema, model } from "mongoose";

export const TRACK_STATUSES = ["active", "paused", "archived"] as const;
export type TrackStatus = (typeof TRACK_STATUSES)[number];

export const TRACK_ICONS = [
  "code",
  "brain",
  "leaf",
  "dumbbell",
  "book",
  "music",
  "rocket",
  "pen",
  "target",
  "heart",
  "briefcase",
  "camera",
  "languages",
  "timer",
  "sparkles",
  "coffee",
] as const;
export type TrackIcon = (typeof TRACK_ICONS)[number];

// A Track is something you keep doing, with no ending: DSA practice, meditation, your startup.
export interface TrackFields {
  title: string;
  subtitle: string;
  icon: TrackIcon;
  // What the numbers on this track mean ("problems", "min", "hours"). Empty means no amounts.
  unit: string;
  status: TrackStatus;
  createdAt: Date;
  updatedAt: Date;
}

const trackSchema = new Schema<TrackFields>(
  {
    title: { type: String, required: true, trim: true, maxlength: 60, default: "Untitled track" },
    subtitle: { type: String, default: "", trim: true, maxlength: 160 },
    icon: { type: String, enum: TRACK_ICONS, default: "target" },
    unit: { type: String, default: "", trim: true, maxlength: 20 },
    status: { type: String, enum: TRACK_STATUSES, default: "active" },
  },
  { timestamps: true },
);

export const Track = model<TrackFields>("Track", trackSchema);