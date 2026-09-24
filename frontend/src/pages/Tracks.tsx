import { Plus, Target } from "lucide-react";
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
    <div className="mx-auto w-full max-w-[900px] px-6 pb-24 pt-8 lg:px-12 lg:pt-14">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-light tracking-tight">Tracks</h1>
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85 disabled:opacity-50"
        >
          <Plus size={15} strokeWidth={2} />
          New track
        </button>
      </div>
      <p className="mt-2 text-[15px] text-secondary">Things you keep doing.</p>

      {loadState === "error" && <p className="mt-8 text-[15px] text-alert">Couldn&apos;t load your tracks.</p>}

      {loadState === "ready" && tracks.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-border px-6 py-16 text-center text-secondary">
          <Target size={28} strokeWidth={1.5} />
          <p className="max-w-sm text-[15px]">
            No tracks yet. Add something you keep coming back to, like DSA practice, meditation or your startup.
          </p>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {tracks.map((track) => (
          <Link
            key={track.id}
            to={`/tracks/${track.id}`}
            className={
              "flex items-start gap-4 rounded-[18px] border border-border bg-surface p-5 shadow-card transition-transform duration-150 hover:-translate-y-0.5 " +
              (track.status === "archived" ? "opacity-60" : "")
            }
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-hover">
              <TrackIcon name={track.icon} size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-[16px] font-medium">{track.title}</h2>
                {track.status !== "active" && <TrackStatusBadge status={track.status} />}
              </div>
              {track.subtitle && <p className="mt-0.5 truncate text-[13px] text-secondary">{track.subtitle}</p>}
              <p className="mt-3 text-[13px] text-secondary">{monthSummary(track)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}