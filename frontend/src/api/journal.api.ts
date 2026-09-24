import type { DayKey } from "../config/dates";
import { api } from "./api";

export type Mood = "good" | "neutral" | "tough" | "special";

export interface JournalPhoto {
  id: string;
  url: string;
  publicId: string;
  caption?: string;
}
export interface ArchiveEntry {
  date: DayKey;
  mood: Mood;
  dailySummary: string;
  whatIDidToday: string;
  whatDrainedMe: string;
  tomorrowDifferent: string;
  photos: JournalPhoto[];
}

export async function fetchArchivePage(
  cursor: DayKey | null,
): Promise<{ entries: ArchiveEntry[]; nextCursor: DayKey | null }> {
  const { data } = await api.get<{ entries: ArchiveEntry[]; nextCursor: DayKey | null }>("/journal/archive", {
    params: cursor ? { cursor } : undefined,
  });
  return data;
}

// The parts of a day that you write. The editor saves exactly these.
export interface EntryFields {
  whatIDidToday: string;
  whatDrainedMe: string;
  tomorrowDifferent: string;
  dailySummary: string;
  mood: Mood;
  location: string;
}

export interface JournalEntry extends EntryFields {
  id: string;
  date: DayKey;
  photos: JournalPhoto[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// null means nothing has been written for that day yet.
export async function fetchEntry(date: DayKey): Promise<JournalEntry | null> {
  const { data } = await api.get<{ entry: JournalEntry | null }>(`/journal/${date}`);
  return data.entry;
}

export async function saveEntry(date: DayKey, fields: EntryFields): Promise<JournalEntry> {
  const { data } = await api.put<{ entry: JournalEntry }>(`/journal/${date}`, fields);
  return data.entry;
}

// The mood of every written day in one month, for the calendar dots.
export async function fetchMonthMoods(year: number, month: number): Promise<Record<DayKey, Mood>> {
  const key = `${year}-${String(month).padStart(2, "0")}`;
  const { data } = await api.get<{ entries: { date: DayKey; mood: Mood }[] }>("/journal", {
    params: { month: key },
  });

  const moods: Record<DayKey, Mood> = {};
  for (const entry of data.entries) moods[entry.date] = entry.mood;
  return moods;
}