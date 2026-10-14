import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import type { HydratedDocument } from "mongoose";
import { Quote, QUOTE_LIMITS, WORLD_H, WORLD_W } from "../models/Quote";
import type { QuoteFields } from "../models/Quote";

function toResponse(doc: HydratedDocument<QuoteFields>) {
  return {
    id: doc.id as string,
    text: doc.text,
    author: doc.author,
    note: doc.note,
    x: doc.x,
    y: doc.y,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

type TextFields = { text: string; author: string; note: string };

// Quote text keeps its line breaks and punctuation; only the outer whitespace is trimmed.
function parseText(body: unknown): { fields: TextFields } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Send the quote as a JSON object" };
  const input = body as Record<string, unknown>;

  if (typeof input.text !== "string") return { error: "text must be text" };
  const text = input.text.replace(/\r\n/g, "\n").trim();
  if (!text) return { error: "The quote can't be empty" };
  if (text.length > QUOTE_LIMITS.text) return { error: "The quote is too long" };

  const author = input.author === undefined ? "" : input.author;
  const note = input.note === undefined ? "" : input.note;
  if (typeof author !== "string") return { error: "author must be text" };
  if (typeof note !== "string") return { error: "note must be text" };
  if (author.trim().length > QUOTE_LIMITS.author) return { error: "The author is too long" };
  if (note.trim().length > QUOTE_LIMITS.note) return { error: "The note is too long" };

  return { fields: { text, author: author.trim(), note: note.trim() } };
}

// GET /api/quotes  ->  every quote, oldest first, so landmarks appear in the order they were added.
export async function listQuotes(_req: Request, res: Response): Promise<void> {
  const docs = await Quote.find().sort({ createdAt: 1 });
  res.status(200).json({ quotes: docs.map(toResponse) });
}

async function createOnce(clientKey: string, data: TextFields & { x: number; y: number }) {
  return Quote.findOneAndUpdate(
    { clientKey },
    { $setOnInsert: data },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
  );
}

// POST /api/quotes  ->  add a quote. Position is validated here but never re-chosen:
// the client picks a spot on land and the server stores it exactly as given.
export async function createQuote(req: Request, res: Response): Promise<void> {
  const parsed = parseText(req.body);
  if ("error" in parsed) {
    res.status(400).json({ message: parsed.error });
    return;
  }

  const { x, y, clientKey } = req.body as { x?: unknown; y?: unknown; clientKey?: unknown };
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
    res.status(400).json({ message: "x and y must be numbers" });
    return;
  }
  if (x < 0 || x > WORLD_W || y < 0 || y > WORLD_H) {
    res.status(400).json({ message: "That spot is outside the map" });
    return;
  }
  if (clientKey !== undefined && (typeof clientKey !== "string" || clientKey.length < 8 || clientKey.length > 64)) {
    res.status(400).json({ message: "clientKey is not valid" });
    return;
  }

  const data = { ...parsed.fields, x, y };

  if (typeof clientKey !== "string") {
    const doc = await Quote.create(data);
    res.status(201).json({ quote: toResponse(doc) });
    return;
  }

  // Same key twice means the same quote: repeating a save can never create a duplicate.
  let doc;
  try {
    doc = await createOnce(clientKey, data);
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    doc = await createOnce(clientKey, data);
  }
  if (!doc) {
    res.status(500).json({ message: "Could not save the quote" });
    return;
  }
  res.status(201).json({ quote: toResponse(doc) });
}

// PUT /api/quotes/:id  ->  edit the words. The landmark's position is never changed here.
export async function updateQuote(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (!isValidObjectId(id)) {
    res.status(400).json({ message: "Not a valid quote id" });
    return;
  }

  const parsed = parseText(req.body);
  if ("error" in parsed) {
    res.status(400).json({ message: parsed.error });
    return;
  }

  const doc = await Quote.findByIdAndUpdate(id, { $set: parsed.fields }, { returnDocument: "after", runValidators: true });
  if (!doc) {
    res.status(404).json({ message: "Quote not found" });
    return;
  }
  res.status(200).json({ quote: toResponse(doc) });
}

// DELETE /api/quotes/:id
export async function deleteQuote(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (!isValidObjectId(id)) {
    res.status(400).json({ message: "Not a valid quote id" });
    return;
  }

  const doc = await Quote.findByIdAndDelete(id);
  if (!doc) {
    res.status(404).json({ message: "Quote not found" });
    return;
  }
  res.status(200).json({ deleted: true });
}