import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchNowArchivePage } from "../api/now.api";
import type { NowArchiveDay } from "../api/now.api";
import { formatLongDate, formatWeekday } from "../config/dates";

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

type LoadState = "loading" | "ready" | "error";

export default function NowArchive() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [days, setDays] = useState<NowArchiveDay[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(() => {
    setLoadState("loading");
    fetchNowArchivePage(null)
      .then((result) => {
        setDays(result.days);
        setCursor(result.nextCursor);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchNowArchivePage(cursor);
      setDays((current) => [...current, ...result.days]);
      setCursor(result.nextCursor);
    } catch {
      // Quiet — the button staying put is feedback enough; they can tap again.
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="page-in mx-auto w-full max-w-[680px] px-5 pb-24 pt-4 sm:px-8 lg:pt-10">
      <Link
        to="/now"
        className="inline-flex h-9 items-center gap-1.5 text-[13px] text-secondary transition-colors duration-150 hover:text-text"
      >
        <ArrowLeft size={14} strokeWidth={1.75} />
        Now
      </Link>

      <h1 className="type-display mt-3">All Visits</h1>

      {loadState === "loading" && days.length === 0 && <div className="mt-10 h-40" aria-busy="true" />}

      {loadState === "error" && (
        <div className="mt-8 border-t border-border py-8">
          <p className="font-serif text-[20px]">This couldn&apos;t be loaded.</p>
          <button
            type="button"
            onClick={load}
            className="mt-5 h-9 rounded-control border border-border px-4 text-[13px] transition-colors hover:bg-hover"
          >
            Try again
          </button>
        </div>
      )}

      {loadState === "ready" && days.length === 0 && (
        <p className="mt-10 text-[15px] text-tertiary">No visits recorded yet.</p>
      )}

      {days.length > 0 && (
        <div className="mt-10">
          {days.map((day) => (
            <div key={day.date} className="mb-10">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px] text-secondary">
                  {formatWeekday(day.date)} <span className="text-tertiary">·</span> {formatLongDate(day.date)}
                </p>
                <span className="flex-shrink-0 text-[12px] text-tertiary">
                  {day.count} {day.count === 1 ? "escape" : "escapes"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {day.entries.map((entry) => (
                  <div key={entry.id} className="rounded-card bg-surface p-3.5">
                    <p className="text-[11px] text-tertiary">{formatTime(entry.createdAt)}</p>
                    <p className="mt-1 line-clamp-4 text-[13px] leading-relaxed text-text">{entry.futureThought}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {cursor && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="mt-2 h-10 w-full rounded-control border border-border text-[13px] text-secondary transition-colors duration-150 hover:bg-hover disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}