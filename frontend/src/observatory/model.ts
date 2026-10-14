import type { ArchiveEntry } from "../api/journal.api";
import { parseDayKey } from "../config/dates";
import type { DayKey } from "../config/dates";

// ---------------------------------------------------------------------------
// Data: One Memory per distinct calendar date that has at least one entry.
// ---------------------------------------------------------------------------

export type Level = "overview" | "year" | "month";

export interface Memory {
  date: DayKey;
  year: number;
  month: number;
  day: number;
  entries: ArchiveEntry[];
  title: string;
  photoCount: number;
  /** Deterministic visual weight, derived only from the date. */
  radius: number;
  brightness: number;
}

export function entryTitle(entry: ArchiveEntry): string {
  return entry.whatIDidToday.trim();
}

export function entrySummary(entry: ArchiveEntry): string {
  return (
    entry.dailySummary ||
    entry.whatDrainedMe ||
    entry.tomorrowDifferent ||
    ""
  ).trim();
}

export function buildMemories(entries: ArchiveEntry[]): Memory[] {
  const byDate = new Map<DayKey, ArchiveEntry[]>();

  for (const entry of entries) {
    const list = byDate.get(entry.date);

    if (list) {
      list.push(entry);
    } else {
      byDate.set(entry.date, [entry]);
    }
  }

  const memories: Memory[] = [];

  for (const [date, list] of byDate) {
    const parts = parseDayKey(date);

    if (!parts) continue;

    const title = list.map(entryTitle).find((value) => value.length > 0) ?? "";

    memories.push({
      date,
      year: parts.year,
      month: parts.month,
      day: parts.day,
      entries: list,
      title,
      photoCount: list.reduce(
        (sum, entry) => sum + entry.photos.length,
        0
      ),
      radius: 2.5 + unit(date, "r") * 1.5,
      brightness: 0.74 + unit(date, "b") * 0.26,
    });
  }

  return memories.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );
}

// ---------------------------------------------------------------------------
// Calendar math: Pure integers, never Date objects, so a date can never slip
// into the neighbouring day through a UTC conversion.
// ---------------------------------------------------------------------------

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** 0 = Sunday … 6 = Saturday (Sakamoto's method). */
export function weekdayOf(
  year: number,
  month: number,
  day: number
): number {
  const table: number[] = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];

  const y = month < 3 ? year - 1 : year;

  // Prevent TS2532 when noUncheckedIndexedAccess is enabled.
  const monthOffset = table[month - 1] ?? 0;

  return (
    y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) +
    monthOffset +
    day
  ) % 7;
}

export function dayOfYear(
  year: number,
  month: number,
  day: number
): number {
  let total = day;

  for (let m = 1; m < month; m += 1) {
    total += daysInMonth(year, m);
  }

  return total;
}

export function makeDayKey(
  year: number,
  month: number,
  day: number
): DayKey {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${year}-${pad(month)}-${pad(day)}`;
}

// ---------------------------------------------------------------------------
// Deterministic randomness: The same date always produces the same numbers.
// ---------------------------------------------------------------------------

function hash(text: string): number {
  let h = 2166136261;

  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return h >>> 0;
}

/** A stable number in [0, 1) for a given key + salt. */
export function unit(key: string, salt: string): number {
  let t = (hash(key + "|" + salt) + 0x6d2b79f5) | 0;

  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GOLDEN_ANGLE = 2.399963229728653;

/**
 * Fixed slot on a disc (Vogel spiral). Slot i of n is always the same point,
 * so a date keeps its place no matter how many other dates exist.
 */
export function discSlot(
  index: number,
  total: number,
  radius: number,
  rotation = 0
): Pt {
  const distance = radius * Math.sqrt((index + 0.5) / total);
  const angle = index * GOLDEN_ANGLE + rotation;

  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  };
}

export interface YearCluster {
  year: number;
  cx: number;
  cy: number;
  radius: number;
}

export function layoutYears(years: number[], area: Rect): YearCluster[] {
  const count = years.length;

  if (count === 0) return [];

  const columns = Math.min(count, area.w < 560 ? 2 : area.w < 900 ? 3 : 4);
  const rows = Math.ceil(count / columns);
  const cellW = area.w / columns;
  const cellH = area.h / rows;

  const radius = Math.max(
    46,
    Math.min(150, Math.min(cellW, cellH) * 0.34)
  );

  return years.map((year, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    // The last row is centred so an odd number of years still looks composed.
    const inRow = row === rows - 1 ? count - row * columns : columns;
    const rowOffset = ((columns - inRow) * cellW) / 2;

    const jitterX = (unit(String(year), "jx") - 0.5) * cellW * 0.08;
    const jitterY = (unit(String(year), "jy") - 0.5) * cellH * 0.08;

    return {
      year,
      cx: area.x + rowOffset + cellW * (column + 0.5) + jitterX,
      cy: area.y + cellH * (row + 0.46) + jitterY,
      radius,
    };
  });
}

export interface MonthCell {
  month: number;
  cx: number;
  cy: number;
  rect: Rect;
  radius: number;
}

export function layoutMonths(area: Rect): MonthCell[] {
  const columns = area.w >= area.h * 0.95 && area.w >= 640 ? 4 : 3;
  const rows = 12 / columns;
  const cellW = area.w / columns;
  const cellH = area.h / rows;

  const radius = Math.max(
    18,
    Math.min(52, Math.min(cellW, cellH) * 0.22)
  );

  return Array.from({ length: 12 }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    const rect = {
      x: area.x + cellW * column,
      y: area.y + cellH * row,
      w: cellW,
      h: cellH,
    };

    return {
      month: index + 1,
      cx: rect.x + rect.w / 2,
      cy: rect.y + rect.h * 0.36,
      rect,
      radius,
    };
  });
}

export interface DaySlot {
  day: number;
  x: number;
  y: number;
}

/** Calendar-shaped but organically nudged: no two days can ever collide. */
export function layoutDays(
  year: number,
  month: number,
  area: Rect
): { slots: DaySlot[]; cell: number } {
  const total = daysInMonth(year, month);
  const first = weekdayOf(year, month, 1);
  const rows = Math.ceil((first + total) / 7);

  const cell = Math.min(area.w / 7, area.h / rows, 92);
  const gridW = cell * 7;
  const gridH = cell * rows;

  const startX = area.x + (area.w - gridW) / 2;
  const startY = area.y + (area.h - gridH) / 2;

  const slots: DaySlot[] = [];

  for (let day = 1; day <= total; day += 1) {
    const index = first + day - 1;
    const key = makeDayKey(year, month, day);
    const jitter = 0.2;

    slots.push({
      day,
      x:
        startX +
        cell * ((index % 7) + 0.5 + (unit(key, "x") - 0.5) * jitter),
      y:
        startY +
        cell *
          (Math.floor(index / 7) + 0.5 + (unit(key, "y") - 0.5) * jitter),
    });
  }

  return { slots, cell };
}

// ---------------------------------------------------------------------------
// Background stars: A fixed list in unit coordinates. Only the first N are
// drawn, so resizing scales the same sky instead of reshuffling it.
// ---------------------------------------------------------------------------

export interface BackgroundStar {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

export const BACKGROUND_STARS: BackgroundStar[] = Array.from(
  { length: 320 },
  (_, index) => {
    const key = "sky" + index;
    const tier = unit(key, "t");

    return {
      x: unit(key, "x"),
      y: unit(key, "y"),
      size: tier > 0.94 ? 1.5 : tier > 0.7 ? 1.05 : 0.7,
      alpha: tier > 0.94 ? 0.85 : tier > 0.7 ? 0.55 : 0.32,
    };
  }
);
