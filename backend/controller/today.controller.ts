import type { Request, Response } from "express";
import type { HydratedDocument } from "mongoose";
import { TodayPlan } from "../models/TodayPlan";
import type { TodayPlanFields } from "../models/TodayPlan";
import { isValidDayKey } from "../utility/dayKey";

const ITEM_TEXT_LIMIT = 500;

interface TodayItemResponse {
  id: string;
  text: string;
  completed: boolean;
}

interface TodayPlanResponse {
  date: string;
  items: TodayItemResponse[];
  createdAt: Date;
  updatedAt: Date;
}

function toResponse(doc: HydratedDocument<TodayPlanFields>): TodayPlanResponse {
  return {
    date: doc.date,
    items: doc.items.map((item) => ({
      id: String((item as { _id?: unknown })._id ?? ""),
      text: item.text,
      completed: item.completed,
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function requireDate(req: Request, res: Response): string | null {
  const date = req.params.date;
  if (!isValidDayKey(date)) {
    res.status(400).json({ message: "date must look like 2026-10-01" });
    return null;
  }
  return date;
}

// GET /api/today/:date  ->  the plan, or { plan: null } if nothing's been added yet.
// No "list past Today plans" endpoint exists. The frontend only ever calls this with
// the current journal day, so a previous day's plan simply becomes unreachable through
// the UI once the day rolls over.
export async function getTodayPlan(req: Request, res: Response): Promise<void> {
  const date = requireDate(req, res);
  if (!date) return;

  const doc = await TodayPlan.findOne({ date });
  res.status(200).json({ plan: doc ? toResponse(doc) : null });
}

// POST /api/today/:date/items  ->  add one item.
export async function addTodayItem(req: Request, res: Response): Promise<void> {
  const date = requireDate(req, res);
  if (!date) return;

  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text) {
    res.status(400).json({ message: "text is required" });
    return;
  }
  if (text.length > ITEM_TEXT_LIMIT) {
    res.status(400).json({ message: "text is too long" });
    return;
  }

  const doc = await TodayPlan.findOneAndUpdate(
    { date },
    { $push: { items: { text, completed: false } } },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
  );

  if (!doc) {
    res.status(500).json({ message: "Could not add the item" });
    return;
  }
  res.status(200).json({ plan: toResponse(doc) });
}

// PUT /api/today/:date/items/:itemId  ->  edit text and/or toggle completed.
export async function updateTodayItem(req: Request, res: Response): Promise<void> {
  const date = requireDate(req, res);
  if (!date) return;
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

  const doc = await TodayPlan.findOneAndUpdate(
    { date, "items._id": itemId },
    { $set: set },
    { returnDocument: "after", runValidators: true },
  );

  if (!doc) {
    res.status(404).json({ message: "No such item" });
    return;
  }
  res.status(200).json({ plan: toResponse(doc) });
}

// DELETE /api/today/:date/items/:itemId
export async function deleteTodayItem(req: Request, res: Response): Promise<void> {
  const date = requireDate(req, res);
  if (!date) return;
  const { itemId } = req.params;

  const doc = await TodayPlan.findOneAndUpdate(
    { date },
    { $pull: { items: { _id: itemId } } },
    { returnDocument: "after" },
  );

  if (!doc) {
    res.status(404).json({ message: "No plan for that day" });
    return;
  }
  res.status(200).json({ plan: toResponse(doc) });
}