import type { Request, Response } from "express";
import streamifier from "streamifier";
import cloudinary from "../config/cloudinary";
import { JournalEntry } from "../models/JournalEntry";
import type { JournalPhoto } from "../models/JournalEntry";
import { isValidDayKey } from "../utility/dayKey";

const MAX_PHOTOS_PER_DAY = 8;

type PhotoDoc = JournalPhoto & { _id: { toString(): string } };

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

// POST /api/journal/:date/photos  (multipart form, field name "photo")
// Creates the day's entry on the first photo, exactly like the text autosave does.
export async function uploadJournalPhoto(req: Request, res: Response): Promise<void> {
  const date = req.params.date;
  if (!isValidDayKey(date)) {
    res.status(400).json({ message: "date must look like 2026-09-23" });
    return;
  }

  const file = req.file;
  if (!file) {
    res.status(400).json({ message: "No photo was sent" });
    return;
  }

  const existing = await JournalEntry.findOneAndUpdate(
    { date },
    { $setOnInsert: { date } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  if (existing.photos.length >= MAX_PHOTOS_PER_DAY) {
    res.status(400).json({ message: `A day can hold at most ${MAX_PHOTOS_PER_DAY} photos` });
    return;
  }

  let uploaded: { url: string; publicId: string };
  try {
    uploaded = await uploadBuffer(file.buffer, `harshs-journal/${date}`);
  } catch {
    res.status(502).json({ message: "Could not upload the photo. Try again." });
    return;
  }

  const doc = await JournalEntry.findOneAndUpdate(
    { date },
    { $push: { photos: { url: uploaded.url, publicId: uploaded.publicId } } },
    { returnDocument: "after", runValidators: true },
  );

  if (!doc) {
    res.status(500).json({ message: "Could not attach the photo" });
    return;
  }

  const saved = doc.photos[doc.photos.length - 1] as PhotoDoc;
  res.status(201).json({
    photo: { id: saved._id.toString(), url: saved.url, publicId: saved.publicId, caption: saved.caption },
  });
}

// DELETE /api/journal/:date/photos/:photoId
// Removes from Cloudinary first-effort, but the database record is removed either way —
// an orphaned Cloudinary asset is harmless; a stuck "can't delete" UI is not.
export async function deleteJournalPhoto(req: Request, res: Response): Promise<void> {
  const { date, photoId } = req.params;
  if (!isValidDayKey(date)) {
    res.status(400).json({ message: "date must look like 2026-09-23" });
    return;
  }

  const doc = await JournalEntry.findOne({ date });
  const photo = doc?.photos.find((item) => (item as PhotoDoc)._id.toString() === photoId);
  if (!doc || !photo) {
    res.status(404).json({ message: "Photo not found" });
    return;
  }

  try {
    await cloudinary.uploader.destroy(photo.publicId);
  } catch {
    // See comment above — swallow and continue.
  }

  await JournalEntry.updateOne({ date }, { $pull: { photos: { _id: photoId } } });

  res.status(200).json({ deleted: true });
}