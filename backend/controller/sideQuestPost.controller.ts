import type { Request, Response } from "express";
import type { HydratedDocument } from "mongoose";
import streamifier from "streamifier";
import cloudinary from "../config/cloudinary";
import { SideQuest } from "../models/SideQuest";
import { SideQuestPost } from "../models/SideQuestPost";
import type { SideQuestPostFields } from "../models/SideQuestPost";
import { isValidDayKey } from "../utility/dayKey";

const MAX_PHOTOS_PER_POST = 6;
const TITLE_LIMIT = 200;
const CONTENT_LIMIT = 20_000;

type PhotoDoc = { _id: { toString(): string }; url: string; publicId: string; caption?: string };

function toResponse(doc: HydratedDocument<SideQuestPostFields>) {
  return {
    id: doc.id as string,
    sideQuestId: String(doc.sideQuestId),
    date: doc.date,
    title: doc.title,
    content: doc.content,
    photos: doc.photos.map((photo) => {
      const p = photo as PhotoDoc;
      return { id: p._id.toString(), url: p.url, publicId: p.publicId, caption: p.caption };
    }),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function questExists(sideQuestId: string): Promise<boolean> {
  return (await SideQuest.exists({ _id: sideQuestId })) !== null;
}

// GET /api/side-quests/:id/posts  ->  chronological forward, oldest first, like a story unfolding.
export async function listPosts(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };

  if (!(await questExists(id))) {
    res.status(404).json({ message: "Quest not found" });
    return;
  }
  const docs = await SideQuestPost.find({ sideQuestId: id }).sort({ date: 1, createdAt: 1 });
  res.status(200).json({ posts: docs.map(toResponse) });
}

// POST /api/side-quests/:id/posts  body: { date: "2026-09-23" }
export async function createPost(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };

  if (!(await questExists(id))) {
    res.status(404).json({ message: "Quest not found" });
    return;
  }

  const date = (req.body as { date?: unknown } | undefined)?.date;
  if (!isValidDayKey(date)) {
    res.status(400).json({ message: "date must look like 2026-09-23" });
    return;
  }

  const doc = await SideQuestPost.create({ sideQuestId: id, date });
  res.status(201).json({ post: toResponse(doc) });
}

// PUT /api/side-quests/:id/posts/:postId
export async function updatePost(req: Request, res: Response): Promise<void> {
  const { id, postId } = req.params as { id: string; postId: string };
  const body = req.body as { title?: unknown; content?: unknown; date?: unknown } | null;
  if (typeof body !== "object" || body === null) {
    res.status(400).json({ message: "Send the post as a JSON object" });
    return;
  }

  const patch: Partial<Pick<SideQuestPostFields, "title" | "content" | "date">> = {};

  if (body.title !== undefined) {
    if (typeof body.title !== "string" || body.title.trim() === "") {
      res.status(400).json({ message: "Title can't be empty" });
      return;
    }
    if (body.title.length > TITLE_LIMIT) {
      res.status(400).json({ message: "Title is too long" });
      return;
    }
    patch.title = body.title.trim();
  }

  if (body.content !== undefined) {
    if (typeof body.content !== "string" || body.content.length > CONTENT_LIMIT) {
      res.status(400).json({ message: "content must be text within the length limit" });
      return;
    }
    patch.content = body.content;
  }

  if (body.date !== undefined) {
    if (!isValidDayKey(body.date)) {
      res.status(400).json({ message: "date must look like 2026-09-23" });
      return;
    }
    patch.date = body.date;
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ message: "Nothing to save" });
    return;
  }

  const doc = await SideQuestPost.findOneAndUpdate(
    { _id: postId, sideQuestId: id },
    { $set: patch },
    { new: true, runValidators: true },
  );
  if (!doc) {
    res.status(404).json({ message: "Post not found" });
    return;
  }
  res.status(200).json({ post: toResponse(doc) });
}

// DELETE /api/side-quests/:id/posts/:postId
export async function deletePost(req: Request, res: Response): Promise<void> {
  const { id, postId } = req.params as { id: string; postId: string };

  const doc = await SideQuestPost.findOneAndDelete({ _id: postId, sideQuestId: id });
  if (!doc) {
    res.status(404).json({ message: "Post not found" });
    return;
  }

  await Promise.allSettled(doc.photos.map((photo) => cloudinary.uploader.destroy(photo.publicId)));
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

// POST /api/side-quests/:id/posts/:postId/photos  (multipart, field name "photo")
export async function uploadPostPhoto(req: Request, res: Response): Promise<void> {
  const { id, postId } = req.params as { id: string; postId: string };

  const doc = await SideQuestPost.findOne({ _id: postId, sideQuestId: id });
  if (!doc) {
    res.status(404).json({ message: "Post not found" });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ message: "No photo was sent" });
    return;
  }

  if (doc.photos.length >= MAX_PHOTOS_PER_POST) {
    res.status(400).json({ message: `A post can hold at most ${MAX_PHOTOS_PER_POST} photos` });
    return;
  }

  let uploaded: { url: string; publicId: string };
  try {
    uploaded = await uploadBuffer(file.buffer, `harshs-journal/side-quests/${id}/${doc.id}`);
  } catch {
    res.status(502).json({ message: "Could not upload the photo. Try again." });
    return;
  }

  doc.photos.push({ url: uploaded.url, publicId: uploaded.publicId });
  await doc.save();

  const saved = doc.photos[doc.photos.length - 1] as PhotoDoc;
  res.status(201).json({
    photo: { id: saved._id.toString(), url: saved.url, publicId: saved.publicId, caption: saved.caption },
  });
}

// DELETE /api/side-quests/:id/posts/:postId/photos/:photoId
export async function deletePostPhoto(req: Request, res: Response): Promise<void> {
  const { id, postId, photoId } = req.params as { id: string; postId: string; photoId: string };

  const doc = await SideQuestPost.findOne({ _id: postId, sideQuestId: id });
  const photo = doc?.photos.find((item) => (item as PhotoDoc)._id.toString() === photoId);
  if (!doc || !photo) {
    res.status(404).json({ message: "Photo not found" });
    return;
  }

  await cloudinary.uploader.destroy(photo.publicId).catch(() => undefined);
  await SideQuestPost.updateOne({ _id: postId }, { $pull: { photos: { _id: photoId } } });

  res.status(200).json({ deleted: true });
}