import { Schema, model } from "mongoose";

export interface TimeTravelEntryFields {
  // The journal day key (same 4 AM rollover rule as the rest of the app), not a
  // raw timestamp — this is what "today's count" and the recent-days history
  // group by.
  date: string;
  futureThought: string;
  // Written after RETURN TO NOW, if at all. Optional and secondary per the spec.
  presentState?: string;
  createdAt: Date;
  updatedAt: Date;
}

const timeTravelEntrySchema = new Schema<TimeTravelEntryFields>(
  {
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    futureThought: { type: String, required: true, trim: true, maxlength: 2000 },
    presentState: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

// One escape per day is normal, many are expected — index for fast per-day counting
// and the recent-days aggregation, not for uniqueness.
timeTravelEntrySchema.index({ date: 1 });

export const TimeTravelEntry = model<TimeTravelEntryFields>("TimeTravelEntry", timeTravelEntrySchema);