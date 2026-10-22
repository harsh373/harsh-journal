import type { Request, Response } from "express";
import type { HydratedDocument } from "mongoose";
import { isValidObjectId } from "mongoose";
import { THOUGHT_BODY_LIMIT, THOUGHT_TITLE_LIMIT, Thought } from "../models/Thought";
import type { ThoughtFields } from "../models/Thought";

const MAX_REORDER = 5000;

function parseTitle(value: unknown): { title: string } | { error: string } {
  if (typeof value !== "string") return { error: "title must be text" };
  const title = value.replace(/\s+/g, " ").trim();
  if (title.length > THOUGHT_TITLE_LIMIT) return { error: "title is too long" };
  return { title };
}

function parseBody(value: unknown): { body: string } | { error: string } {
  if (typeof value !== "string") return { error: "body must be text" };
  if (value.length > THOUGHT_BODY_LIMIT) return { error: "body is too long" };
  return { body: value };
}

function toFull(doc: HydratedDocument<ThoughtFields>) {
  return { id: doc.id as string, title: doc.title, body: doc.body };
}

// New thoughts go to the top of the collection.
async function topOrder(): Promise<number> {
  const first = await Thought.findOne().sort({ order: 1 }).select("order");
  return first ? first.order - 1 : 0;
}

// GET /api/thoughts  ->  titles only, in order. Bodies are loaded one at a time, when a thought is opened.
// Thoughts that are completely empty (an abandoned draft) are left out.
export async function listThoughts(_req: Request, res: Response): Promise<void> {
  const docs = await Thought.find({ $or: [{ title: { $ne: "" } }, { body: { $ne: "" } }] })
    .sort({ order: 1, createdAt: -1 })
    .select("title");
  res.status(200).json({ thoughts: docs.map((doc) => ({ id: doc.id as string, title: doc.title })) });
}

// POST /api/thoughts  ->  an empty thought, ready to be written in.
export async function createThought(_req: Request, res: Response): Promise<void> {
  const doc = await Thought.create({ title: "", body: "", order: await topOrder() });
  res.status(201).json({ thought: toFull(doc) });
}

// GET /api/thoughts/:id
export async function getThought(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (!isValidObjectId(id)) {
    res.status(400).json({ message: "Not a valid id" });
    return;
  }
  const doc = await Thought.findById(id);
  if (!doc) {
    res.status(404).json({ message: "That thought no longer exists" });
    return;
  }
  res.status(200).json({ thought: toFull(doc) });
}

// PATCH /api/thoughts/:id  { title?, body? }
export async function updateThought(req: Request, res: Response): Promise<void> {
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

  const changes: Partial<Pick<ThoughtFields, "title" | "body">> = {};
  if (input.title !== undefined) {
    const parsed = parseTitle(input.title);
    if ("error" in parsed) {
      res.status(400).json({ message: parsed.error });
      return;
    }
    changes.title = parsed.title;
  }
  if (input.body !== undefined) {
    const parsed = parseBody(input.body);
    if ("error" in parsed) {
      res.status(400).json({ message: parsed.error });
      return;
    }
    changes.body = parsed.body;
  }
  if (changes.title === undefined && changes.body === undefined) {
    res.status(400).json({ message: "Nothing to save" });
    return;
  }

  const doc = await Thought.findByIdAndUpdate(id, { $set: changes }, { new: true }).select("title");
  if (!doc) {
    res.status(404).json({ message: "That thought no longer exists" });
    return;
  }
  res.status(200).json({ thought: { id: doc.id as string, title: doc.title } });
}

// PUT /api/thoughts/order  { ids: string[] }  ->  the collection in exactly this order.
export async function reorderThoughts(req: Request, res: Response): Promise<void> {
  const ids: unknown =
    typeof req.body === "object" && req.body !== null ? (req.body as Record<string, unknown>).ids : undefined;

  if (
    !Array.isArray(ids) ||
    ids.length > MAX_REORDER ||
    !ids.every((value) => typeof value === "string" && isValidObjectId(value)) ||
    new Set(ids).size !== ids.length
  ) {
    res.status(400).json({ message: "ids must be a list of unique thought ids" });
    return;
  }

  const list = ids as string[];
  if (list.length > 0) {
    await Thought.bulkWrite(
      list.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } })),
    );
  }
  res.status(200).json({ ok: true });
}

// DELETE /api/thoughts/:id
export async function deleteThought(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (!isValidObjectId(id)) {
    res.status(400).json({ message: "Not a valid id" });
    return;
  }
  const doc = await Thought.findByIdAndDelete(id);
  if (!doc) {
    res.status(404).json({ message: "That thought no longer exists" });
    return;
  }
  res.status(200).json({ deleted: true });
}