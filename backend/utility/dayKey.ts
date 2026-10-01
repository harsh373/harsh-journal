const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;

// A real calendar date written as "YYYY-MM-DD". Rejects things like 2026-02-31.
export function isValidDayKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DAY_KEY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// A month written as "YYYY-MM".
export function isValidMonthKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = MONTH_KEY_PATTERN.exec(value);
  if (!match) return false;

  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

// Caller must already know `key` is a valid day key (check isValidDayKey first
// if it came from outside this file, e.g. request params).
function toUtcDate(key: string): Date {
  const match = DAY_KEY_PATTERN.exec(key) as RegExpExecArray;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function toDayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Shifts a day key by `delta` days (negative goes backward).
export function addDays(key: string, delta: number): string {
  const date = toUtcDate(key);
  date.setUTCDate(date.getUTCDate() + delta);
  return toDayKey(date);
}

// The Monday (as a day key) of the week containing `key`.
// getUTCDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday.
export function getWeekStart(key: string): string {
  const date = toUtcDate(key);
  const weekday = date.getUTCDay();
  const diffToMonday = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return toDayKey(date);
}

// True only if `value` is a valid day key AND that day is itself a Monday —
// the only shape a week's identifying key is allowed to take. A week's
// identity IS its Monday, so this is just "is this key already its own week start".
export function isValidWeekStart(value: unknown): value is string {
  return isValidDayKey(value) && getWeekStart(value) === value;
}