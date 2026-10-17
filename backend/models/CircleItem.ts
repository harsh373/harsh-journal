import { Schema, model } from "mongoose";

export const CIRCLES = ["concern", "influence"] as const;
export type Circle = (typeof CIRCLES)[number];

export interface CircleItemFields {
  text: string;
  circle: Circle;
  // Position within its circle. Lower comes first. Moving to another circle puts the item last there.
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const circleItemSchema = new Schema<CircleItemFields>(
  {
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    circle: { type: String, enum: CIRCLES, required: true },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

circleItemSchema.index({ circle: 1, order: 1 });

export const CircleItem = model<CircleItemFields>("CircleItem", circleItemSchema);