import { Schema, model } from "mongoose";

export const MEMORY_TYPES = ["idea", "project", "person", "goal", "interest", "topic"] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface Evidence {
  date: string;
  quote: string;
}

export interface MemoryFields {
  key: string;
  title: string;
  type: MemoryType;
  firstMentionedAt: string;
  lastMentionedAt: string;
  mentionCount: number;
  sourceDates: string[];
  evidence: Evidence[];
  createdAt: Date;
  updatedAt: Date;
}

const evidenceSchema = new Schema<Evidence>(
  { date: { type: String, required: true }, quote: { type: String, required: true, maxlength: 400 } },
  { _id: false },
);

const memorySchema = new Schema<MemoryFields>(
  {
    key: { type: String, required: true, unique: true },
    title: { type: String, required: true, maxlength: 80 },
    type: { type: String, enum: MEMORY_TYPES, default: "topic" },
    firstMentionedAt: { type: String, default: "" },
    lastMentionedAt: { type: String, default: "" },
    mentionCount: { type: Number, default: 0 },
    sourceDates: { type: [String], default: [] },
    evidence: { type: [evidenceSchema], default: [] },
  },
  { timestamps: true },
);

export const Memory = model<MemoryFields>("Memory", memorySchema);