import { ChevronRight, Plus, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createTrack, fetchTracks, formatAmount, toMonthKey } from "../api/tracks.api";
import type { TrackWithMonth } from "../api/tracks.api";
import TrackIcon from "../components/TrackIcon";
import { TrackStatusBadge } from "../components/TrackStatus";
import { getJournalToday, parseDayKey } from "../config/dates";

type LoadState = "loading" | "ready" | "error";

function currentMonthKey(): string {
  const parts = parseDayKey(getJournalToday());
  return parts ? toMonthKey(parts.year, parts.month) : toMonthKey(new Date().getFullYear(), new Date().getMonth() + 1);
}

function monthSummary(track: TrackWithMonth): string {
  const days = track.monthDays.length;
  if (days === 0) return "Nothing logged this month";
  const dayText = `${days} ${days === 1 ? "day" : "days"} this month`;
  return track.unit && track.monthTotal > 0 ? `${dayText} · ${formatAmount(track.monthTotal, track.unit)}` : dayText;
}

export default function Tracks() {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<TrackWithMonth[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchTracks(currentMonthKey())
      .then((data) => {
        setTracks(data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, []);

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const track = await createTrack();
      navigate(`/tracks/${track.id}`, { state: { editing: true } });
    } catch {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[720px] px-5 pb-24 pt-6 sm:px-8 lg:px-12 lg:pt-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="type-display">Tracks</h1>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-control bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85 disabled:opacity-50"
        >
          <Plus size={15} strokeWidth={2} />
          New track
        </button>
      </div>
      <p className="mt-2 font-serif text-[1.125rem] text-secondary">Things you keep doing.</p>

      {loadState === "error" && <p className="mt-8 text-[15px] text-alert">Couldn&apos;t load your tracks.</p>}

      {loadState === "ready" && tracks.length === 0 && (
        <div className="mt-12 flex flex-col items-center gap-3 border-t border-border py-14 text-center text-secondary">
          <Target size={28} strokeWidth={1.5} />
          <p className="max-w-sm text-[15px]">
            No tracks yet. Add something you keep coming back to, like DSA practice, meditation or your startup.
          </p>
        </div>
      )}

      <div className="mt-8 space-y-1">
        {tracks.map((track) => (
          <Link
            key={track.id}
            to={`/tracks/${track.id}`}
            className={
              "group -mx-3 flex items-center gap-4 rounded-card px-3 py-3.5 transition-colors duration-150 hover:bg-hover active:bg-selected " +
              (track.status === "archived" ? "opacity-60" : "")
            }
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-hover">
              <TrackIcon name={track.icon} size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[16px] font-medium">{track.title}</h2>
                {track.status !== "active" && <TrackStatusBadge status={track.status} />}
              </div>
              {track.subtitle && <p className="mt-0.5 truncate text-[13px] text-secondary">{track.subtitle}</p>}
              <p className="mt-1 text-[13px] text-tertiary">{monthSummary(track)}</p>
            </div>
            <ChevronRight
              size={16}
              strokeWidth={2}
              className="shrink-0 text-tertiary transition-transform duration-150 group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </div>
    </div>
  );
}