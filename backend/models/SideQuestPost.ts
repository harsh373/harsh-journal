import { Schema, Types, model } from "mongoose";

export interface QuestPostPhoto {
  url: string;
  publicId: string;
  caption?: string;
}

export interface SideQuestPostFields {
  sideQuestId: Types.ObjectId;
  date: string;
  title: string;
  content: string;
  photos: QuestPostPhoto[];
  createdAt: Date;
  updatedAt: Date;
}

const photoSchema = new Schema<QuestPostPhoto>({
  url: { type: String, required: true },
  publicId: { type: String, required: true },
  caption: { type: String, maxlength: 500 },
});

const sideQuestPostSchema = new Schema<SideQuestPostFields>(
  {
    sideQuestId: { type: Schema.Types.ObjectId, ref: "SideQuest", required: true, index: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    title: { type: String, default: "New entry", trim: true, maxlength: 200 },
    content: { type: String, default: "", maxlength: 20_000 },
    photos: { type: [photoSchema], default: [] },
  },
  { timestamps: true },
);

export const SideQuestPost = model<SideQuestPostFields>("SideQuestPost", sideQuestPostSchema);