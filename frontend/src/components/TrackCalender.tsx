import { useMemo } from "react";

interface TrackCalendarProps {
  year: number;
  month: number; // 1-12
  loggedDays: Set<string>;
  today: string;
  selectedDay?: string | null;
  onSelectDay?: (day: string | null) => void;
  direction?: "next" | "prev" | null;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function TrackCalendar({
  year,
  month,
  loggedDays,
  today,
  selectedDay = null,
  onSelectDay,
  direction = null,
}: TrackCalendarProps) {
  const { lead, days } = useMemo(() => {
    const total = new Date(year, month, 0).getDate();
    // Monday-first: JS getDay() is 0 for Sunday, so shift by 6.
    const leadingBlanks = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    return { lead: leadingBlanks, days: Array.from({ length: total }, (_, i) => i + 1) };
  }, [year, month]);

  const monthName = new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long" });
  const slide = direction === "next" ? "track-month-next" : direction === "prev" ? "track-month-prev" : "";

  return (
    <div>
      <div className="mb-3 grid grid-cols-7 gap-1.5 sm:gap-2" aria-hidden="true">
        {WEEKDAYS.map((label, index) => (
          <span key={index} className="text-center text-[11px] font-medium tracking-wide text-tertiary">
            {label}
          </span>
        ))}
      </div>

      <div key={`${year}-${month}`} className={"grid grid-cols-7 gap-1.5 sm:gap-2 " + slide}>
        {Array.from({ length: lead }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden="true" />
        ))}

        {days.map((day) => {
          const key = `${year}-${pad(month)}-${pad(day)}`;
          const logged = loggedDays.has(key);
          const isToday = key === today;
          const isSelected = key === selectedDay;

          return (
            <button
              key={key}
              type="button"
              aria-label={`${day} ${monthName}, ${logged ? "logged" : "nothing logged"}`}
              aria-pressed={isSelected}
              onClick={() => onSelectDay?.(isSelected ? null : key)}
              className={
                "aspect-square rounded-[10px] text-[12px] font-medium tabular-nums transition-[transform,box-shadow,background-color,color] duration-200 ease-out hover:scale-[1.06] active:scale-95 sm:rounded-[12px] sm:text-[13px] " +
                (logged
                  ? "bg-text text-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_3px_rgba(0,0,0,0.25)] "
                  : "bg-hover text-tertiary shadow-[inset_0_0_0_1px_rgba(128,128,128,0.10)] hover:text-secondary ") +
                (isSelected
                  ? "ring-2 ring-text ring-offset-2 ring-offset-surface"
                  : isToday
                    ? "ring-1 ring-text/50 ring-offset-2 ring-offset-surface"
                    : "")
              }
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}