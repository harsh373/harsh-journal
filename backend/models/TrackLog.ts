import { Schema, Types, model } from "mongoose";

// One time you showed up for a track: a date, an optional note, an optional amount.
export interface TrackLogFields {
  trackId: Types.ObjectId;
  // A plain "YYYY-MM-DD" journal day.
  date: string;
  note: string;
  amount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const trackLogSchema = new Schema<TrackLogFields>(
  {
    trackId: { type: Schema.Types.ObjectId, ref: "Track", required: true, index: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    note: { type: String, default: "", maxlength: 5_000 },
    amount: { type: Number, min: 0, max: 1_000_000, default: null },
  },
  { timestamps: true },
);

// Month views and "what did I log on this day" both filter by date.
trackLogSchema.index({ trackId: 1, date: 1 });
trackLogSchema.index({ date: 1 });

export const TrackLog = model<TrackLogFields>("TrackLog", trackLogSchema);