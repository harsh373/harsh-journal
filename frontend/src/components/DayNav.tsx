import { ArrowLeft, ArrowRight, LayoutGrid } from "lucide-react";
import { Link } from "react-router-dom";
import { addDays, formatDayMonth, getJournalToday } from "../config/dates";
import type { DayKey } from "../config/dates";

const linkStyle =
  "flex h-10 items-center gap-1.5 rounded-control px-2 font-medium text-secondary transition-colors duration-150 hover:bg-hover hover:text-text active:bg-selected lg:h-8";

// Move through your life one day at a time.
export default function DayNav({ day }: { day: DayKey }) {
  const today = getJournalToday();
  const previous = addDays(day, -1);
  const next = addDays(day, 1);
  const hrefFor = (key: DayKey) => (key === today ? "/" : "/day/" + key);

  return (
    <nav
      aria-label="Day navigation"
      className="mt-16 grid grid-cols-3 items-center border-t border-border pt-4 text-[13px]"
    >
      <Link to={hrefFor(previous)} className={linkStyle + " -ml-2 justify-self-start"}>
        <ArrowLeft size={16} strokeWidth={2} />
        {formatDayMonth(previous)}
      </Link>
      <Link to="/archive" className={linkStyle + " justify-self-center"}>
        <LayoutGrid size={15} strokeWidth={2} />
        All Days
      </Link>
      <Link to={hrefFor(next)} className={linkStyle + " -mr-2 justify-self-end"}>
        {formatDayMonth(next)}
        <ArrowRight size={16} strokeWidth={2} />
      </Link>
    </nav>
  );
}