import { Link } from "react-router-dom";
import type { ArchiveEntry } from "../api/journal.api";
import { formatDayMonth } from "../config/dates";
import MoodDot from "./MoodDot";

function previewText(entry: ArchiveEntry): string {
  return entry.dailySummary || entry.whatIDidToday || entry.whatDrainedMe || entry.tomorrowDifferent;
}

export default function RecentDays({ entries }: { entries: ArchiveEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section className="rounded-[16px] border border-border bg-surface p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-secondary">Recent days</h2>
        <Link to="/archive" className="text-[12px] font-medium text-secondary transition-colors hover:text-text">
          All Days
        </Link>
      </div>

      <div className="space-y-0.5">
        {entries.map((entry) => (
          <Link
            key={entry.date}
            to={`/day/${entry.date}`}
            className="-mx-1 flex items-center gap-3 rounded-[10px] px-2 py-2.5 transition-colors duration-150 hover:bg-hover"
          >
            {entry.photos[0] ? (
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[9px] border border-border bg-bg">
                <img src={entry.photos[0].url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] border border-border bg-bg">
                <MoodDot mood={entry.mood} className="h-2 w-2" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-medium text-secondary">{formatDayMonth(entry.date)}</p>
              <p className="truncate text-[13.5px] font-medium text-text">{previewText(entry) || "—"}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}