import { ArrowRight, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { formatLongDate, formatWeekday } from "../config/dates";
import type { DayKey } from "../config/dates";
import { entrySummary, entryTitle } from "./model";
import type { Memory } from "./model";

interface MemoryPanelProps {
  memory: Memory;
  today: DayKey;
  onClose: () => void;
}

// A compact preview: enough to recognise the memory and decide whether to open it.
// Desktop: a floating panel beside the sky. Phones: a bottom sheet above the safe area.
export default function MemoryPanel({ memory, today, onClose }: MemoryPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [memory.date]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const photos = memory.entries.flatMap((entry) => entry.photos).slice(0, 3);
  const openTo = memory.date === today ? "/" : `/day/${memory.date}`;

  return (
    <aside
      aria-label={`Memory from ${formatLongDate(memory.date)}`}
      className="obs-panel obs-sheet absolute inset-x-0 bottom-0 z-20 flex max-h-[58%] flex-col rounded-t-[22px] pb-[env(safe-area-inset-bottom)] lg:inset-x-auto lg:bottom-5 lg:right-5 lg:top-[88px] lg:max-h-none lg:w-[340px] lg:rounded-[18px] lg:pb-0"
    >
      <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full obs-divider lg:hidden" aria-hidden="true" />

      <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-4 lg:pt-5">
        <div className="min-w-0">
          <p className="obs-text-2 text-[12px] font-medium uppercase tracking-[0.08em]">{formatWeekday(memory.date)}</p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="obs-text mt-0.5 text-[20px] font-semibold leading-tight tracking-tight focus:outline-none"
          >
            {formatLongDate(memory.date)}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="obs-text-2 obs-hoverable -mr-1.5 -mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        >
          <X size={17} strokeWidth={1.75} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <div className="mt-3 space-y-5">
          {memory.entries.map((entry, index) => {
            const title = entryTitle(entry);
            const summary = entrySummary(entry);
            return (
              <article
                key={index}
                className={index > 0 ? "pt-5" : ""}
                style={index > 0 ? { borderTop: "1px solid var(--obs-border)" } : undefined}
              >
                {title && (
                  <p className="obs-text font-serif text-[1.35rem] leading-snug tracking-tight">{title}</p>
                )}
                {summary && (
                  <p className={"obs-text-2 line-clamp-5 text-[14.5px] leading-relaxed " + (title ? "mt-2" : "")}>{summary}</p>
                )}
                {!title && !summary && <p className="obs-text-3 text-[14px]">No written text for this entry.</p>}
              </article>
            );
          })}
        </div>

        {photos.length > 0 && (
          <div className={"mt-5 grid gap-2 " + (photos.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className={
                  "overflow-hidden rounded-[12px] " + (photos.length === 3 && index === 0 ? "col-span-2 aspect-[16/9]" : "aspect-[4/3]")
                }
                style={{ border: "1px solid var(--obs-border)" }}
              >
                <img src={photo.url} alt={photo.caption ?? ""} className="h-full w-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 pb-5 pt-2">
        <Link
          to={openTo}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] text-[14px] font-medium transition-opacity duration-150 hover:opacity-85"
          style={{ background: "var(--obs-text)", color: "var(--obs-on-text)" }}
        >
          Open entry
          <ArrowRight size={15} strokeWidth={2} />
        </Link>
      </div>
    </aside>
  );
}