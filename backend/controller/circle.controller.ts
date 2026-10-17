import type { Request, Response } from "express";
import type { HydratedDocument } from "mongoose";
import { isValidObjectId } from "mongoose";
import { CIRCLES, CircleItem } from "../models/CircleItem";
import type { Circle, CircleItemFields } from "../models/CircleItem";

const TEXT_LIMIT = 120;

function isCircle(value: unknown): value is Circle {
  return typeof value === "string" && (CIRCLES as readonly string[]).includes(value);
}

function parseText(value: unknown): { text: string } | { error: string } {
  if (typeof value !== "string") return { error: "text must be text" };
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return { error: "text can't be empty" };
  if (text.length > TEXT_LIMIT) return { error: "text is too long" };
  return { text };
}

function toResponse(doc: HydratedDocument<CircleItemFields>) {
  return { id: doc.id as string, text: doc.text, circle: doc.circle, order: doc.order };
}

// New items, and items moved into a circle, go to the end of that circle.
async function nextOrder(circle: Circle): Promise<number> {
  const last = await CircleItem.findOne({ circle }).sort({ order: -1 }).select("order");
  return last ? last.order + 1 : 0;
}

// GET /api/circle  ->  every item, in order.
export async function listItems(_req: Request, res: Response): Promise<void> {
  const docs = await CircleItem.find().sort({ order: 1, createdAt: 1 });
  res.status(200).json({ items: docs.map(toResponse) });
}

// POST /api/circle  { text, circle }
export async function createItem(req: Request, res: Response): Promise<void> {
  if (typeof req.body !== "object" || req.body === null) {
    res.status(400).json({ message: "Send the item as a JSON object" });
    return;
  }
  const input = req.body as Record<string, unknown>;

  const parsed = parseText(input.text);
  if ("error" in parsed) {
    res.status(400).json({ message: parsed.error });
    return;
  }

  const circle = input.circle;
  if (!isCircle(circle)) {
    res.status(400).json({ message: "circle must be concern or influence" });
    return;
  }

  const doc = await CircleItem.create({ text: parsed.text, circle, order: await nextOrder(circle) });
  res.status(201).json({ item: toResponse(doc) });
}

// PATCH /api/circle/:id  { text?, circle? }  ->  edit the text, move between circles, or both.
export async function updateItem(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (!isValidObjectId(id)) {
    res.status(400).json({ message: "Not a valid id" });
    return;
  }
  if (typeof req.body !== "object" || req.body === null) {
    res.status(400).json({ message: "Send the changes as a JSON object" });
    return;
  }
  const input = req.body as Record<string, unknown>;

  let text: string | undefined;
  if (input.text !== undefined) {
    const parsed = parseText(input.text);
    if ("error" in parsed) {
      res.status(400).json({ message: parsed.error });
      return;
    }
    text = parsed.text;
  }

  let circle: Circle | undefined;
  if (input.circle !== undefined) {
    if (!isCircle(input.circle)) {
      res.status(400).json({ message: "circle must be concern or influence" });
      return;
    }
    circle = input.circle;
  }

  if (text === undefined && circle === undefined) {
    res.status(400).json({ message: "Nothing to save" });
    return;
  }

  const doc = await CircleItem.findById(id);
  if (!doc) {
    res.status(404).json({ message: "That item no longer exists" });
    return;
  }

  if (text !== undefined) doc.text = text;
  if (circle !== undefined && circle !== doc.circle) {
    doc.circle = circle;
    doc.order = await nextOrder(circle);
  }
  await doc.save();

  res.status(200).json({ item: toResponse(doc) });
}

// DELETE /api/circle/:id
export async function deleteItem(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (!isValidObjectId(id)) {
    res.status(400).json({ message: "Not a valid id" });
    return;
  }

  const doc = await CircleItem.findByIdAndDelete(id);
  if (!doc) {
    res.status(404).json({ message: "That item no longer exists" });
    return;
  }
  res.status(200).json({ deleted: true });
}