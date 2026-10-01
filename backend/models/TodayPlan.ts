import { Schema, model } from "mongoose";

export interface TodayItemFields {
  text: string;
  completed: boolean;
}

export interface TodayPlanFields {
  // A plain "YYYY-MM-DD" journal day key — same 4 AM rollover rule as JournalEntry.
  date: string;
  items: TodayItemFields[];
  createdAt: Date;
  updatedAt: Date;
}

const todayItemSchema = new Schema<TodayItemFields>({
  text: { type: String, required: true, trim: true, maxlength: 500 },
  completed: { type: Boolean, default: false },
});

const todayPlanSchema = new Schema<TodayPlanFields>(
  {
    date: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    items: { type: [todayItemSchema], default: [] },
  },
  { timestamps: true },
);

export const TodayPlan = model<TodayPlanFields>("TodayPlan", todayPlanSchema);