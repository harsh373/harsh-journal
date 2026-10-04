import { Schema, model } from "mongoose";
import type { Evidence } from "./Memory";

export const LOOP_KINDS = ["intention", "ongoing_goal"] as const;
export type LoopKind = (typeof LOOP_KINDS)[number];

export const LOOP_STATUSES = ["open", "resolved", "dismissed"] as const;
export type LoopStatus = (typeof LOOP_STATUSES)[number];

export interface OpenLoopFields {
  key: string;
  title: string;
  kind: LoopKind;
  status: LoopStatus;
  confidence: number;
  firstMentionedAt: string;
  lastMentionedAt: string;
  mentionCount: number;
  sourceDates: string[];
  evidence: Evidence[];
  resolvedAt?: string;
  resolvedQuote?: string;
  resolvedBy?: "journal" | "user";
  createdAt: Date;
  updatedAt: Date;
}

const evidenceSchema = new Schema<Evidence>(
  { date: { type: String, required: true }, quote: { type: String, required: true, maxlength: 400 } },
  { _id: false },
);

const openLoopSchema = new Schema<OpenLoopFields>(
  {
    key: { type: String, required: true, unique: true },
    title: { type: String, required: true, maxlength: 80 },
    kind: { type: String, enum: LOOP_KINDS, default: "intention" },
    status: { type: String, enum: LOOP_STATUSES, default: "open" },
    confidence: { type: Number, default: 0 },
    firstMentionedAt: { type: String, default: "" },
    lastMentionedAt: { type: String, default: "" },
    mentionCount: { type: Number, default: 0 },
    sourceDates: { type: [String], default: [] },
    evidence: { type: [evidenceSchema], default: [] },
    resolvedAt: { type: String },
    resolvedQuote: { type: String, maxlength: 400 },
    resolvedBy: { type: String, enum: ["journal", "user"] },
  },
  { timestamps: true },
);

export const OpenLoop = model<OpenLoopFields>("OpenLoop", openLoopSchema);