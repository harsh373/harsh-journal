// A day is always a plain "YYYY-MM-DD" string, never a Date object.
// That keeps a journal entry pinned to one day no matter which time zone the browser is in.
export type DayKey = string;

export interface DayParts {
  year: number;
  month: number; // 1-12
  day: number;
}

const TIME_ZONE = "Asia/Kolkata";
const ROLLOVER_HOUR = 4;
const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const istDateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const weekdayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });
const longDateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayMonthFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const monthNameFormat = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toDayKey(year: number, month: number, day: number): DayKey {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// The journal day is the Indian calendar date, but it only changes at 4 AM.
// At 2 AM on the 24th you are still writing the 23rd.
export function getJournalToday(now: Date = new Date()): DayKey {
  const shifted = new Date(now.getTime() - ROLLOVER_HOUR * 60 * 60 * 1000);
  const parts = istDateFormat.formatToParts(shifted);
  const pick = (type: string): string => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

// Returns null for anything that is not a real calendar date (like 2026-02-31).
export function parseDayKey(key: string): DayParts | null {
  const match = DAY_KEY_PATTERN.exec(key);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  return isRealDate ? { year, month, day } : null;
}

function toUtcDate(key: DayKey): Date | null {
  const parts = parseDayKey(key);
  return parts ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day)) : null;
}

export function addDays(key: DayKey, delta: number): DayKey {
  const date = toUtcDate(key);
  if (!date) return key;
  date.setUTCDate(date.getUTCDate() + delta);
  return toDayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function formatWeekday(key: DayKey): string {
  const date = toUtcDate(key);
  return date ? weekdayFormat.format(date) : "";
}

export function formatLongDate(key: DayKey): string {
  const date = toUtcDate(key);
  return date ? longDateFormat.format(date) : "";
}

export function formatDayMonth(key: DayKey): string {
  const date = toUtcDate(key);
  return date ? dayMonthFormat.format(date) : "";
}

export function formatMonthName(month: number): string {
  return monthNameFormat.format(new Date(Date.UTC(2000, month - 1, 1)));
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

// Always 42 cells (6 weeks, Sunday first) so the calendar never changes height between months.
export function buildMonthGrid(year: number, month: number): (DayKey | null)[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (DayKey | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(toDayKey(year, month, day));
  while (cells.length < 42) cells.push(null);
  return cells;
}