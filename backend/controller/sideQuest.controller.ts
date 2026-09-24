import type { Request, Response } from "express";
import type { HydratedDocument } from "mongoose";
import streamifier from "streamifier";
import cloudinary from "../config/cloudinary";
import { QUEST_STATUSES, SideQuest } from "../models/SideQuest";
import type { QuestStatus, SideQuestFields } from "../models/SideQuest";
import { SideQuestPost } from "../models/SideQuestPost";
import { isValidDayKey } from "../utility/dayKey";

const TEXT_LIMITS = {
  title: 120,
  subtitle: 160,
  challenge: 5_000,
  approach: 5_000,
} as const;

type TextField = keyof typeof TEXT_LIMITS;
const TEXT_FIELDS = Object.keys(TEXT_LIMITS) as TextField[];

type QuestPatch = Partial<Record<TextField, string>> & {
  status?: QuestStatus;
  startDate?: string;
  endDate?: string;
};

function isStatus(value: string): value is QuestStatus {
  return (QUEST_STATUSES as readonly string[]).includes(value);
}

function isDayKeyOrEmpty(value: unknown): value is string {
  return value === "" || isValidDayKey(value);
}

function parseQuestPatch(body: unknown): { patch: QuestPatch } | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "Send the quest as a JSON object" };
  const input = body as Record<string, unknown>;
  const patch: QuestPatch = {};

  for (const field of TEXT_FIELDS) {
    const value = input[field];
    if (value === undefined) continue;
    if (typeof value !== "string") return { error: `${field} must be text` };
    if (field === "title" && value.trim() === "") return { error: "Title can't be empty" };
    if (value.length > TEXT_LIMITS[field]) return { error: `${field} is too long` };
    patch[field] = field === "title" ? value.trim() : value;
  }

  if (input.status !== undefined) {
    if (typeof input.status !== "string" || !isStatus(input.status)) return { error: "status is not valid" };
    patch.status = input.status;
  }

  for (const field of ["startDate", "endDate"] as const) {
    const value = input[field];
    if (value === undefined) continue;
    if (!isDayKeyOrEmpty(value)) return { error: `${field} must look like 2026-09-23, or be empty` };
    patch[field] = value as string;
  }

  if (Object.keys(patch).length === 0) return { error: "Nothing to save" };
  return { patch };
}

function toResponse(doc: HydratedDocument<SideQuestFields>) {
  return {
    id: doc.id as string,
    title: doc.title,
    subtitle: doc.subtitle,
    challenge: doc.challenge,
    approach: doc.approach,
    coverImage: doc.coverImage ?? null,
    status: doc.status,
    startDate: doc.startDate,
    endDate: doc.endDate,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// GET /api/side-quests
export async function listSideQuests(_req: Request, res: Response): Promise<void> {
  const docs = await SideQuest.find().sort({ createdAt: -1 });
  res.status(200).json({ quests: docs.map(toResponse) });
}

// GET /api/side-quests/:id
export async function getSideQuest(req: Request, res: Response): Promise<void> {
  const doc = await SideQuest.findById(req.params.id);
  if (!doc) {
    res.status(404).json({ message: "Quest not found" });
    return;
  }
  res.status(200).json({ quest: toResponse(doc) });
}

// POST /api/side-quests  body: { startDate?: "2026-09-23" }
export async function createSideQuest(req: Request, res: Response): Promise<void> {
  const body = (req.body ?? {}) as { startDate?: unknown };
  const startDate = typeof body.startDate === "string" && isDayKeyOrEmpty(body.startDate) ? body.startDate : "";

  const doc = await SideQuest.create({ startDate });
  res.status(201).json({ quest: toResponse(doc) });
}

// PUT /api/side-quests/:id
export async function updateSideQuest(req: Request, res: Response): Promise<void> {
  const parsed = parseQuestPatch(req.body);
  if ("error" in parsed) {
    res.status(400).json({ message: parsed.error });
    return;
  }

  const doc = await SideQuest.findByIdAndUpdate(
    req.params.id,
    { $set: parsed.patch },
    { new: true, runValidators: true },
  );
  if (!doc) {
    res.status(404).json({ message: "Quest not found" });
    return;
  }
  res.status(200).json({ quest: toResponse(doc) });
}

// DELETE /api/side-quests/:id  -> also removes its posts and Cloudinary assets, best-effort.
export async function deleteSideQuest(req: Request, res: Response): Promise<void> {
  const doc = await SideQuest.findById(req.params.id);
  if (!doc) {
    res.status(404).json({ message: "Quest not found" });
    return;
  }

  const posts = await SideQuestPost.find({ sideQuestId: doc._id });
  const publicIds = posts.flatMap((post) => post.photos.map((photo) => photo.publicId));
  if (doc.coverImage) publicIds.push(doc.coverImage.publicId);

  await Promise.allSettled(publicIds.map((publicId) => cloudinary.uploader.destroy(publicId)));
  await SideQuestPost.deleteMany({ sideQuestId: doc._id });
  await doc.deleteOne();

  res.status(200).json({ deleted: true });
}

function uploadBuffer(buffer: Buffer, folder: string): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image", quality: "auto", fetch_format: "auto" },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

// POST /api/side-quests/:id/cover  (multipart, field name "photo")
export async function uploadQuestCover(req: Request, res: Response): Promise<void> {
  const doc = await SideQuest.findById(req.params.id);
  if (!doc) {
    res.status(404).json({ message: "Quest not found" });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ message: "No image was sent" });
    return;
  }

  let uploaded: { url: string; publicId: string };
  try {
    uploaded = await uploadBuffer(file.buffer, `harshs-journal/side-quests/${doc.id}`);
  } catch {
    res.status(502).json({ message: "Could not upload the image. Try again." });
    return;
  }

  const previousPublicId = doc.coverImage?.publicId;
  doc.coverImage = { url: uploaded.url, publicId: uploaded.publicId };
  await doc.save();

  if (previousPublicId) cloudinary.uploader.destroy(previousPublicId).catch(() => undefined);

  res.status(200).json({ quest: toResponse(doc) });
}

// DELETE /api/side-quests/:id/cover
export async function deleteQuestCover(req: Request, res: Response): Promise<void> {
  const doc = await SideQuest.findById(req.params.id);
  if (!doc) {
    res.status(404).json({ message: "Quest not found" });
    return;
  }

  if (doc.coverImage) {
    await cloudinary.uploader.destroy(doc.coverImage.publicId).catch(() => undefined);
    doc.coverImage = undefined;
    await doc.save();
  }

  res.status(200).json({ quest: toResponse(doc) });
}