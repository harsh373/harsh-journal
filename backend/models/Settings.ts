import { Schema, model } from "mongoose";

// One document, always. Holds small app-wide preferences that aren't tied to a
// specific day, quest, or photo — currently just the home-screen countdown.
export interface SettingsFields {
  key: string;
  countdownDate: string; // "YYYY-MM-DD" or "" for none set
  countdownLabel: string;
  createdAt: Date;
  updatedAt: Date;
}

const SINGLETON_KEY = "singleton";

const settingsSchema = new Schema<SettingsFields>(
  {
    key: { type: String, required: true, unique: true, default: SINGLETON_KEY },
    countdownDate: { type: String, default: "", match: /^(\d{4}-\d{2}-\d{2})?$/ },
    countdownLabel: { type: String, default: "", maxlength: 120 },
  },
  { timestamps: true },
);

export const Settings = model<SettingsFields>("Settings", settingsSchema);
export { SINGLETON_KEY };