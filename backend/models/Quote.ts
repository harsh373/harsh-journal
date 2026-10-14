import { Schema, model } from "mongoose";

// Must match the world size in client/src/components/map/world.ts.
export const WORLD_W = 1600;
export const WORLD_H = 1000;

export const QUOTE_LIMITS = { text: 2000, author: 120, note: 500 } as const;

export interface QuoteFields {
  // Sent by the client once per "add" session so a retried save can't create a duplicate.
  clientKey?: string;
  text: string;
  author: string;
  note: string;
  // Where the landmark sits in the fictional world. Chosen once, never recalculated.
  x: number;
  y: number;
  createdAt: Date;
  updatedAt: Date;
}

const quoteSchema = new Schema<QuoteFields>(
  {
    clientKey: { type: String, maxlength: 64, unique: true, sparse: true },
    text: { type: String, required: true, maxlength: QUOTE_LIMITS.text },
    author: { type: String, default: "", maxlength: QUOTE_LIMITS.author },
    note: { type: String, default: "", maxlength: QUOTE_LIMITS.note },
    x: { type: Number, required: true, min: 0, max: WORLD_W },
    y: { type: Number, required: true, min: 0, max: WORLD_H },
  },
  { timestamps: true },
);

export const Quote = model<QuoteFields>("Quote", quoteSchema);