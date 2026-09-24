import { Schema, model } from "mongoose";

export const QUEST_STATUSES = ["active", "completed", "paused", "abandoned"] as const;
export type QuestStatus = (typeof QUEST_STATUSES)[number];

export interface QuestCoverImage {
  url: string;
  publicId: string;
}

export interface SideQuestFields {
  title: string;
  subtitle: string;
  challenge: string;
  approach: string;
  coverImage?: QuestCoverImage;
  status: QuestStatus;
  startDate: string;
  endDate: string;
  createdAt: Date;
  updatedAt: Date;
}

const coverImageSchema = new Schema<QuestCoverImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false },
);

const sideQuestSchema = new Schema<SideQuestFields>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120, default: "Untitled quest" },
    subtitle: { type: String, default: "", maxlength: 160 },
    challenge: { type: String, default: "", maxlength: 5_000 },
    approach: { type: String, default: "", maxlength: 5_000 },
    coverImage: { type: coverImageSchema, default: undefined },
    status: { type: String, enum: QUEST_STATUSES, default: "active" },
    startDate: { type: String, default: "", match: /^(\d{4}-\d{2}-\d{2})?$/ },
    endDate: { type: String, default: "", match: /^(\d{4}-\d{2}-\d{2})?$/ },
  },
  { timestamps: true },
);

export const SideQuest = model<SideQuestFields>("SideQuest", sideQuestSchema);