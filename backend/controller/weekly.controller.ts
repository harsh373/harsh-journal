import type { Request, Response } from "express";
import type { HydratedDocument } from "mongoose";
import { WeeklyPlan } from "../models/WeeklyPlan";
import type { WeeklyPlanFields } from "../models/WeeklyPlan";
import { addDays, isValidWeekStart } from "../utility/dayKey";

const ITEM_TEXT_LIMIT = 500;

interface WeeklyItemResponse {
  id: string;
  text: string;
  completed: boolean;
}

interface WeeklyPlanResponse {
  weekStart: string;
  weekEnd: string;
  items: WeeklyItemResponse[];
  createdAt: Date;
  updatedAt: Date;
}

function toResponse(doc: HydratedDocument<WeeklyPlanFields>): WeeklyPlanResponse {
  return {
    weekStart: doc.weekStart,
    weekEnd: addDays(doc.weekStart, 6),
    items: doc.items.map((item) => ({
      id: String((item as { _id?: unknown })._id ?? ""),
      text: item.text,
      completed: item.completed,
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function requireWeekStart(req: Request, res: Response): string | null {
  const weekStart = req.params.weekStart;
  if (!isValidWeekStart(weekStart)) {
    res.status(400).json({ message: "weekStart must be a Monday, like 2026-09-28" });
    return null;
  }
  return weekStart;
}

// GET /api/weekly/:weekStart  ->  the plan, or { plan: null } if nothing's been added yet.
export async function getWeeklyPlan(req: Request, res: Response): Promise<void> {
  const weekStart = requireWeekStart(req, res);
  if (!weekStart) return;

  const doc = await WeeklyPlan.findOne({ weekStart });
  res.status(200).json({ plan: doc ? toResponse(doc) : null });
}

// POST /api/weekly/:weekStart/items  ->  add one item. Creates the week's plan
// on the first item (upsert), same pattern journal entries use for autosave.
export async function addWeeklyItem(req: Request, res: Response): Promise<void> {
  const weekStart = requireWeekStart(req, res);
  if (!weekStart) return;

  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    res.status(400).json({ message: "text is required" });
    return;
  }
  if (text.length > ITEM_TEXT_LIMIT) {
    res.status(400).json({ message: "text is too long" });
    return;
  }

  const doc = await WeeklyPlan.findOneAndUpdate(
    { weekStart },
    { $push: { items: { text, completed: false } } },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
  );

  if (!doc) {
    res.status(500).json({ message: "Could not add the item" });
    return;
  }
  res.status(200).json({ plan: toResponse(doc) });
}

// PUT /api/weekly/:weekStart/items/:itemId  ->  edit text and/or toggle completed.
// Either field alone is fine; at least one is required.
export async function updateWeeklyItem(req: Request, res: Response): Promise<void> {
  const weekStart = requireWeekStart(req, res);
  if (!weekStart) return;
  const { itemId } = req.params;

  const set: Record<string, unknown> = {};

  if (req.body?.text !== undefined) {
    const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
    if (!text) {
      res.status(400).json({ message: "text must be non-empty text" });
      return;
    }
    if (text.length > ITEM_TEXT_LIMIT) {
      res.status(400).json({ message: "text is too long" });
      return;
    }
    set["items.$.text"] = text;
  }

  if (req.body?.completed !== undefined) {
    if (typeof req.body.completed !== "boolean") {
      res.status(400).json({ message: "completed must be true or false" });
      return;
    }
    set["items.$.completed"] = req.body.completed;
  }

  if (Object.keys(set).length === 0) {
    res.status(400).json({ message: "Nothing to update" });
    return;
  }

  const doc = await WeeklyPlan.findOneAndUpdate(
    { weekStart, "items._id": itemId },
    { $set: set },
    { returnDocument: "after", runValidators: true },
  );

  if (!doc) {
    res.status(404).json({ message: "No such item" });
    return;
  }
  res.status(200).json({ plan: toResponse(doc) });
}

// DELETE /api/weekly/:weekStart/items/:itemId
export async function deleteWeeklyItem(req: Request, res: Response): Promise<void> {
  const weekStart = requireWeekStart(req, res);
  if (!weekStart) return;
  const { itemId } = req.params;

  const doc = await WeeklyPlan.findOneAndUpdate(
    { weekStart },
    { $pull: { items: { _id: itemId } } },
    { returnDocument: "after" },
  );

  if (!doc) {
    res.status(404).json({ message: "No plan for that week" });
    return;
  }
  res.status(200).json({ plan: toResponse(doc) });
}

// PUT /api/weekly/:weekStart/reorder  ->  body: { itemIds: string[] }, the full set
// of this week's item ids in their new order. Rejects anything that doesn't match
// the current item set exactly, so a stale client can never silently drop an item
// mid-reorder.
export async function reorderWeeklyItems(req: Request, res: Response): Promise<void> {
  const weekStart = requireWeekStart(req, res);
  if (!weekStart) return;

  const itemIds = req.body?.itemIds;
  if (!Array.isArray(itemIds) || !itemIds.every((id) => typeof id === "string")) {
    res.status(400).json({ message: "itemIds must be an array of strings" });
    return;
  }

  const doc = await WeeklyPlan.findOne({ weekStart });
  if (!doc) {
    res.status(404).json({ message: "No plan for that week" });
    return;
  }

  const currentIds = doc.items.map((item) => String((item as { _id?: unknown })._id ?? ""));
  const sameSet = currentIds.length === itemIds.length && currentIds.every((id) => itemIds.includes(id));
  if (!sameSet) {
    res.status(400).json({ message: "itemIds must match the week's current items exactly" });
    return;
  }

  const byId = new Map(doc.items.map((item) => [String((item as { _id?: unknown })._id ?? ""), item]));
  doc.items = itemIds.map((id) => byId.get(id)!) as typeof doc.items;
  await doc.save();

  res.status(200).json({ plan: toResponse(doc) });
}