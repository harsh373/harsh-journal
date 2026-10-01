import { Schema, model } from "mongoose";

export interface WeeklyItemFields {
  text: string;
  completed: boolean;
}

export interface WeeklyPlanFields {
  // The Monday of the week, as "YYYY-MM-DD". This IS the week's identity —
  // one plan per Monday, enforced by the unique index below.
  weekStart: string;
  items: WeeklyItemFields[];
  createdAt: Date;
  updatedAt: Date;
}

const weeklyItemSchema = new Schema<WeeklyItemFields>({
  text: { type: String, required: true, trim: true, maxlength: 500 },
  completed: { type: Boolean, default: false },
});

const weeklyPlanSchema = new Schema<WeeklyPlanFields>(
  {
    weekStart: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    items: { type: [weeklyItemSchema], default: [] },
  },
  { timestamps: true },
);

export const WeeklyPlan = model<WeeklyPlanFields>("WeeklyPlan", weeklyPlanSchema);