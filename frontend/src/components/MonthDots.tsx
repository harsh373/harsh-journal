import { buildMonthGrid, formatLongDate, parseDayKey } from "../config/dates";
import type { DayKey } from "../config/dates";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

// A quiet month view: a filled circle on every day you showed up. Display only.
export default function MonthDots({
  year,
  month,
  loggedDays,
  today,
}: {
  year: number;
  month: number;
  loggedDays: Set<DayKey>;
  today: DayKey;
}) {
  const cells = buildMonthGrid(year, month);

  return (
    <div className="w-full max-w-[320px]">
      <div className="grid grid-cols-7 pb-1 text-center text-[10px] font-medium text-tertiary">
        {WEEKDAYS.map((weekday, index) => (
          <span key={index}>{weekday}</span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          if (!day) return <span key={"blank-" + index} className="h-9" />;

          const logged = loggedDays.has(day);
          const isToday = day === today;
          const style = logged
            ? "bg-text font-semibold text-bg"
            : isToday
              ? "font-semibold text-special"
              : day > today
                ? "text-tertiary"
                : "text-secondary";

          return (
            <div
              key={day}
              title={formatLongDate(day) + (logged ? " · logged" : "")}
              className="flex h-9 items-center justify-center"
            >
              <span
                className={
                  "flex h-7 w-7 items-center justify-center rounded-full text-[12px] tabular-nums " + style
                }
              >
                {parseDayKey(day)?.day}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}