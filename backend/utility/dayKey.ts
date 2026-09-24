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