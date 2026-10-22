import { Schema, model } from "mongoose";

export const THOUGHT_TITLE_LIMIT = 200;
export const THOUGHT_BODY_LIMIT = 100_000;

export interface ThoughtFields {
  title: string;
  body: string;
  // Lower comes first. New thoughts are placed above the current first one.
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const thoughtSchema = new Schema<ThoughtFields>(
  {
    // Both may be empty while a thought is being written. The list hides thoughts where both are empty.
    title: { type: String, default: "", trim: true, maxlength: THOUGHT_TITLE_LIMIT },
    body: { type: String, default: "", maxlength: THOUGHT_BODY_LIMIT },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

thoughtSchema.index({ order: 1 });

export const Thought = model<ThoughtFields>("Thought", thoughtSchema);