import { Link } from "react-router-dom";
import type { ArchiveEntry } from "../api/journal.api";
import { formatDayMonth } from "../config/dates";
import MoodDot from "./MoodDot";

// The day's title (the "one good line") comes first.
function previewText(entry: ArchiveEntry): string {
  const title = entry.whatIDidToday.trim();
  return title || entry.dailySummary || entry.whatDrainedMe || entry.tomorrowDifferent;
}

export default function RecentDays({ entries }: { entries: ArchiveEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="type-eyebrow">Recent days</h2>
        <Link to="/archive" className="text-[12px] font-medium text-secondary transition-colors hover:text-text">
          All Days
        </Link>
      </div>

      <div className="space-y-0.5">
        {entries.map((entry) => (
          <Link
            key={entry.date}
            to={`/day/${entry.date}`}
            className="-mx-2 flex items-center gap-3 rounded-control px-2 py-2.5 transition-colors duration-150 hover:bg-hover active:bg-selected"
          >
            {entry.photos[0] ? (
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[8px] border border-border bg-surface">
                <img src={entry.photos[0].url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-border bg-surface">
                <MoodDot mood={entry.mood} className="h-2 w-2" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-tertiary">{formatDayMonth(entry.date)}</p>
              <p className="truncate text-[14px] font-medium text-text">{previewText(entry) || "—"}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}