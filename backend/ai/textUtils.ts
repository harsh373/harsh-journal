import { createHash } from "node:crypto";
import type { JournalEntryFields } from "../models/JournalEntry";

type TextSource = Pick<
  JournalEntryFields,
  "whatIDidToday" | "whatDrainedMe" | "tomorrowDifferent" | "dailySummary" | "mood"
>;

// Photos and location are left out on purpose: only written text goes to the model.
export function entryToText(entry: TextSource): string {
  const parts: string[] = [];
  if (entry.whatIDidToday.trim()) parts.push(`One line about the day: ${entry.whatIDidToday.trim()}`);
  if (entry.dailySummary.trim()) parts.push(`Daily summary: ${entry.dailySummary.trim()}`);
  if (entry.whatDrainedMe.trim()) parts.push(`What drained me: ${entry.whatDrainedMe.trim()}`);
  if (entry.tomorrowDifferent.trim()) parts.push(`Tomorrow I want to do differently: ${entry.tomorrowDifferent.trim()}`);
  if (parts.length === 0) return "";
  parts.push(`Mood: ${entry.mood}`);
  return parts.join("\n\n");
}

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// "Call Rahul" and "call  rahul" are the same thing.
export function toKey(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteAppearsIn(text: string, quote: string): boolean {
  const needle = normalizeForMatch(quote);
  return needle.length >= 8 && normalizeForMatch(text).includes(needle);
}