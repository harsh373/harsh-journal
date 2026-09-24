import type { Request, Response } from "express";
import { Settings, SINGLETON_KEY } from "../models/Settings";
import { isValidDayKey } from "../utility/dayKey";

interface SettingsResponse {
  countdownDate: string;
  countdownLabel: string;
}

function toResponse(doc: { countdownDate: string; countdownLabel: string }): SettingsResponse {
  return { countdownDate: doc.countdownDate, countdownLabel: doc.countdownLabel };
}

// GET /api/settings
export async function getSettings(_req: Request, res: Response): Promise<void> {
  const doc = await Settings.findOne({ key: SINGLETON_KEY });
  res.status(200).json({ settings: doc ? toResponse(doc) : { countdownDate: "", countdownLabel: "" } });
}

// PUT /api/settings
export async function saveSettings(req: Request, res: Response): Promise<void> {
  const body = req.body as { countdownDate?: unknown; countdownLabel?: unknown };
  const patch: Partial<SettingsResponse> = {};

  if (body.countdownDate !== undefined) {
    if (typeof body.countdownDate !== "string" || (body.countdownDate !== "" && !isValidDayKey(body.countdownDate))) {
      res.status(400).json({ message: "countdownDate must look like 2026-09-23, or be empty" });
      return;
    }
    patch.countdownDate = body.countdownDate;
  }

  if (body.countdownLabel !== undefined) {
    if (typeof body.countdownLabel !== "string" || body.countdownLabel.length > 120) {
      res.status(400).json({ message: "countdownLabel is invalid" });
      return;
    }
    patch.countdownLabel = body.countdownLabel.trim();
  }

  const doc = await Settings.findOneAndUpdate(
    { key: SINGLETON_KEY },
    { $set: patch },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
  );

  if (!doc) {
    res.status(500).json({ message: "Could not save settings" });
    return;
  }
  res.status(200).json({ settings: toResponse(doc) });
}