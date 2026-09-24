import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchLogsForDay, formatAmount } from "../api/tracks.api";
import type { DayTrackLog } from "../api/tracks.api";
import type { DayKey } from "../config/dates";
import TrackIcon from "./TrackIcon";

// A quiet line on the journal page: what you logged on your tracks that day. Shows nothing if empty.
export default function TracksToday({ day }: { day: DayKey }) {
  const [logs, setLogs] = useState<DayTrackLog[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchLogsForDay(day)
      .then((result) => {
        if (!cancelled) setLogs(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [day]);

  if (logs.length === 0) return null;

  return (
    <section className="mt-14">
      <h2 className="text-[13px] font-medium text-secondary">Tracks</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {logs.map((log) => (
          <Link
            key={log.id}
            to={`/tracks/${log.track.id}`}
            className="flex h-8 items-center gap-2 rounded-full border border-border bg-surface px-3 text-[13px] transition-colors duration-150 hover:bg-hover"
          >
            <TrackIcon name={log.track.icon} size={14} className="text-secondary" />
            {log.track.title}
            {log.amount !== null && (
              <span className="text-secondary">· {formatAmount(log.amount, log.track.unit)}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}