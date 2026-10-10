import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchArchivePage } from "../api/journal.api";
import type { ArchiveEntry } from "../api/journal.api";
import { formatLongDate, formatWeekday, getJournalToday } from "../config/dates";
import type { DayKey } from "../config/dates";

function previewText(entry: ArchiveEntry): string {
  return entry.dailySummary || entry.whatIDidToday || entry.whatDrainedMe || entry.tomorrowDifferent;
}

type LoadState = "idle" | "loading" | "done" | "error";

export default function Archive() {
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [cursor, setCursor] = useState<DayKey | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(() => {
    if (loadingRef.current || state === "done") return;
    loadingRef.current = true;
    setState("loading");

    fetchArchivePage(cursor)
      .then(({ entries: page, nextCursor }) => {
        setEntries((current) => [...current, ...page]);
        setCursor(nextCursor);
        setState(nextCursor ? "idle" : "done");
      })
      .catch(() => setState("error"))
      .finally(() => {
        loadingRef.current = false;
      });
  }, [cursor, state]);

  useEffect(() => {
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entriesList) => {
      if (entriesList[0]?.isIntersecting) loadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const today = getJournalToday();

  return (
    <div className="mx-auto w-full max-w-[720px] px-5 pb-24 pt-6 sm:px-8 lg:px-12 lg:pt-12">
      <h1 className="type-display">All Days</h1>

      {entries.length === 0 && state === "done" && (
        <p className="mt-10 text-[15px] text-secondary">Nothing written yet. Your days will appear here.</p>
      )}

      <div className="mt-8">
        {entries.map((entry, index) => {
          // The day's title is the "one good line" written at the top of the day.
          const title = entry.whatIDidToday.trim();

          return (
            <Link
              key={entry.date}
              to={entry.date === today ? "/" : `/day/${entry.date}`}
              className={"block py-7 " + (index > 0 ? "border-t border-border" : "")}
            >
              <p className="text-[13px] text-secondary">
                {formatWeekday(entry.date)} <span className="text-tertiary">·</span> {formatLongDate(entry.date)}
              </p>

              {title && <p className="mt-1 font-serif text-[1.375rem] leading-snug tracking-tight text-text">{title}</p>}

              {entry.photos.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {entry.photos.slice(0, 2).map((photo) => (
                    <div
                      key={photo.id}
                      className="aspect-[4/3] overflow-hidden rounded-card border border-border bg-surface"
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption ?? ""}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              )}

              {previewText(entry) && (
                <p
                  className={
                    "mt-3 line-clamp-3 text-[16px] leading-relaxed " + (title ? "text-secondary" : "text-text")
                  }
                >
                  {previewText(entry)}
                </p>
              )}
            </Link>
          );
        })}
      </div>

      <div ref={sentinelRef} className="h-1" />

      {state === "loading" && <p className="py-6 text-center text-[13px] text-tertiary">Loading…</p>}
      {state === "error" && (
        <div className="py-6 text-center">
          <p className="text-[13px] text-alert">Couldn&apos;t load more.</p>
          <button type="button" onClick={loadMore} className="mt-2 text-[13px] underline underline-offset-2">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}