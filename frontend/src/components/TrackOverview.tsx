import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTracks, formatAmount, toMonthKey } from "../api/tracks.api";
import type { TrackWithMonth } from "../api/tracks.api";
import TrackIcon from "./TrackIcon";

// A compact strip on the home page: all active tracks, regardless of whether
// anything was logged today. Shows this month's total per track.
export default function TracksOverview() {
  const [tracks, setTracks] = useState<TrackWithMonth[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const now = new Date();
    const month = toMonthKey(now.getFullYear(), now.getMonth() + 1);
    fetchTracks(month)
      .then((result) => setTracks(result.filter((track) => track.status === "active")))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || tracks.length === 0) return null;

  return (
    <section className="mt-14">
      <h2 className="text-[13px] font-medium text-secondary">Tracks</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {tracks.map((track) => (
          <Link
            key={track.id}
            to={`/tracks/${track.id}`}
            className="flex h-8 items-center gap-2 rounded-full border border-border bg-surface px-3 text-[13px] transition-colors duration-150 hover:bg-hover"
          >
            <TrackIcon name={track.icon} size={14} className="text-secondary" />
            {track.title}
            {track.monthTotal > 0 && (
              <span className="text-secondary">· {formatAmount(track.monthTotal, track.unit)}</span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}