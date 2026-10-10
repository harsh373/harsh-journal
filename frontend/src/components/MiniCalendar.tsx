import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { Mood } from "../api/journal.api";
import {
  buildMonthGrid,
  formatLongDate,
  formatMonthName,
  parseDayKey,
  shiftMonth,
} from "../config/dates";
import type { DayKey } from "../config/dates";

// Journal tracking started on this date — nothing before this counts as "missed"
const START_DATE: DayKey = "2026-09-22";

interface MiniCalendarProps {
  selected: DayKey;
  today: DayKey;
  moods?: Record<DayKey, Mood>;
  onSelect: (day: DayKey) => void;
  onViewChange?: (year: number, month: number) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthOf(key: DayKey): { year: number; month: number } {
  const parts = parseDayKey(key);
  if (parts) return { year: parts.year, month: parts.month };
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

const iconButton =
  "flex h-7 w-7 items-center justify-center rounded-control text-secondary transition-colors duration-150 hover:bg-hover hover:text-text active:bg-selected";

export default function MiniCalendar({
  selected,
  today,
  moods = {},
  onSelect,
  onViewChange,
}: MiniCalendarProps) {
  const [view, setView] = useState(() => monthOf(selected));

  useEffect(() => {
    setView(monthOf(selected));
  }, [selected]);

  useEffect(() => {
    onViewChange?.(view.year, view.month);
  }, [view, onViewChange]);

  const cells = buildMonthGrid(view.year, view.month);

  return (
    <section aria-label="Calendar">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] tracking-tight">
          <span className="font-semibold text-text">{formatMonthName(view.month)}</span>{" "}
          <span className="font-medium text-secondary">{view.year}</span>
        </h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Previous month"
            className={iconButton}
            onClick={() => setView((current) => shiftMonth(current.year, current.month, -1))}
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            className={iconButton}
            onClick={() => setView((current) => shiftMonth(current.year, current.month, 1))}
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-medium text-tertiary">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday[0]}</span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          if (!day) return <span key={"blank-" + index} className="h-10" />;

          const parts = parseDayKey(day);
          const isSelected = day === selected;
          const isToday = day === today;
          const isFuture = day > today;
          const isWithinTrackedRange = day >= START_DATE && day < today;
          const isLogged = Boolean(moods[day]);
          const isMissed = isWithinTrackedRange && !isLogged;

          // The number itself: today is a red circle, a selected day is an inverted circle.
          const numberStyle = isToday
            ? isSelected
              ? "bg-alert font-semibold text-white ring-2 ring-alert/35 ring-offset-2 ring-offset-sidebar"
              : "bg-alert font-semibold text-white group-hover:opacity-90"
            : isSelected
              ? "bg-text font-semibold text-bg"
              : isFuture
                ? "font-medium text-tertiary group-hover:bg-hover"
                : "font-medium text-text group-hover:bg-hover"; // covers dates before START_DATE too

          // Recorded state lives in a small dot under the number, not a big filled circle.
          const dotStyle = isLogged ? "bg-secondary" : isMissed ? "bg-tough" : "";

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              aria-label={formatLongDate(day)}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              className="group relative flex h-10 items-start justify-center pt-0.5"
            >
              <span
                className={
                  "flex h-7 w-7 items-center justify-center rounded-full text-[13px] tabular-nums transition-colors duration-150 " +
                  numberStyle
                }
              >
                {parts?.day}
              </span>
              {dotStyle && (
                <span
                  aria-hidden="true"
                  className={"absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full " + dotStyle}
                />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}