import { CalendarDays, List, Search, Shuffle, Sparkles, Star, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import LineField from "../components/LineField";
import { formatLongDate, getJournalToday } from "../config/dates";
import type { DayKey } from "../config/dates";
import MemoryPanel from "../observatory/MemoryPanel";
import SkyCanvas from "../observatory/SkyCanvas";
import type { Memory } from "../observatory/model";
import { useArchiveEntries } from "../observatory/useArchiveEntries";
import "../observatory/observatory.css";

type Popover = "search" | "date" | null;
type View = "sky" | "list";

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function memoryLabel(memory: Memory): string {
  return memory.title || "Untitled day";
}

export default function Observatory() {
  const [params, setParams] = useSearchParams();
  // `memories` are tiny stubs; full entries are fetched by `loadDay` only when a star is opened.
  const { memories, state, retry, loadDay } = useArchiveEntries();
  const byDate = useMemo(() => new Map(memories.map((memory) => [memory.date, memory])), [memories]);

  const today = getJournalToday();

  // The only things in the URL: which star is open, and sky vs list.
  const view: View = params.get("v") === "list" ? "list" : "sky";
  const dateParam = params.get("d");
  const selectedMemory = useMemo(() => (dateParam ? (byDate.get(dateParam) ?? null) : null), [dateParam, byDate]);

  const [seed, setSeed] = useState(0);
  const [popover, setPopover] = useState<Popover>(null);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ text: string; date: DayKey } | null>(null);
  const toolsRef = useRef<HTMLDivElement>(null);

  const go = useCallback(
    (next: { d?: DayKey | null; v?: View }) => {
      const nextParams = new URLSearchParams();
      if (next.d) nextParams.set("d", next.d);
      if ((next.v ?? view) === "list") nextParams.set("v", "list");
      setParams(nextParams);
      setNotice(null);
      setPopover(null);
    },
    [setParams, view],
  );

  const goToDate = useCallback(
    (date: DayKey) => {
      if (byDate.has(date)) {
        go({ d: date });
      } else {
        go({});
        setNotice({ text: `No entry on ${formatLongDate(date)}.`, date });
      }
    },
    [byDate, go],
  );

  const closePanel = useCallback(() => go({}), [go]);

  const shuffle = () => setSeed((value) => value + 1);

  const discover = () => {
    if (memories.length === 0) return;
    const pool = memories.length > 1 ? memories.filter((memory) => memory.date !== selectedMemory?.date) : memories;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) go({ d: pick.date });
  };

  // --- search over the stubs' precomputed text ------------------------------------
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return memories
      .filter((memory) => memory.searchText.includes(needle))
      .slice(-8)
      .reverse();
  }, [memories, query]);

  const pickResult = (memory: Memory) => {
    setQuery("");
    go({ d: memory.date });
  };

  // --- popovers: close on outside press / Escape ----------------------------------
  useEffect(() => {
    if (!popover) return;
    const onPointer = (event: PointerEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) setPopover(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPopover(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [popover]);

  const subheading =
    memories.length === 0
      ? "Every day you write becomes a star."
      : `${plural(memories.length, "memory", "memories")}, scattered across your sky.`;

  const panelOpen = selectedMemory !== null && view === "sky";

  const toolButton = "obs-text-2 obs-hoverable flex h-9 w-9 items-center justify-center rounded-full";
  const pillButton = "obs-hoverable flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium";

  return (
    <div className="obs obs-sky obs-text relative h-full min-h-[calc(100dvh-3.75rem)] overflow-hidden">
      {view === "sky" && state === "ready" && memories.length > 0 && (
        <SkyCanvas
          memories={memories}
          selected={selectedMemory?.date ?? null}
          today={today}
          panelOpen={panelOpen}
          seed={seed}
          onPickDay={(date) => go({ d: date })}
          onBackground={() => {
            if (selectedMemory) closePanel();
          }}
        />
      )}

      {view === "sky" && state === "ready" && memories.length === 0 && <EmptySky />}
      {view === "sky" && state === "loading" && (
        <p className="obs-text-3 absolute inset-0 flex items-center justify-center text-[14px]">Mapping your sky…</p>
      )}
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="obs-text-2 text-[15px]">The Observatory couldn&apos;t load your archive.</p>
          <button type="button" onClick={retry} className="obs-chip obs-hoverable h-10 rounded-full px-5 text-[14px] font-medium">
            Try again
          </button>
        </div>
      )}

      {view === "list" && state === "ready" && <ListView memories={memories} today={today} />}

      {/* ---- header ---------------------------------------------------------- */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 px-5 pt-4 sm:px-8 lg:px-10 lg:pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-2.5">
            <span className="obs-chip flex h-8 w-8 items-center justify-center rounded-full">
              <Star size={14} strokeWidth={1.75} className="obs-text" aria-hidden="true" />
            </span>
            <span className="text-[14px] font-semibold tracking-tight">Observatory</span>
          </div>

          <div ref={toolsRef} className="pointer-events-auto relative flex items-center gap-1">
            <button
              type="button"
              aria-label="Search entries"
              aria-expanded={popover === "search"}
              onClick={() => setPopover(popover === "search" ? null : "search")}
              className={toolButton}
            >
              <Search size={17} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label="Jump to a date"
              aria-expanded={popover === "date"}
              onClick={() => setPopover(popover === "date" ? null : "date")}
              className={toolButton}
            >
              <CalendarDays size={17} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label={view === "sky" ? "Show as a list of dates" : "Show the sky"}
              aria-pressed={view === "list"}
              onClick={() => go({ d: selectedMemory?.date ?? null, v: view === "sky" ? "list" : "sky" })}
              className={toolButton}
            >
              {view === "sky" ? <List size={17} strokeWidth={1.75} /> : <Star size={17} strokeWidth={1.75} />}
            </button>

            {popover === "search" && (
              <div className="obs-panel absolute right-0 top-11 z-30 w-[min(92vw,340px)] rounded-[16px] p-2">
                <div className="obs-chip flex items-center gap-2 rounded-[11px] px-3 py-2">
                  <Search size={15} strokeWidth={1.75} className="obs-text-3 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <LineField
                      value={query}
                      autoFocus
                      maxLength={80}
                      placeholder="Search your days"
                      aria-label="Search your days"
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && results[0]) pickResult(results[0]);
                      }}
                      className="text-[16px] leading-6 placeholder:text-[var(--obs-text-3)] sm:text-[14px]"
                    />
                  </div>
                  {query && (
                    <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="obs-text-3 shrink-0">
                      <X size={14} strokeWidth={2} />
                    </button>
                  )}
                </div>

                {query.trim() !== "" && (
                  <ul className="mt-1.5 max-h-[50vh] overflow-y-auto">
                    {results.length === 0 && <li className="obs-text-3 px-3 py-3 text-[13px]">No matching days.</li>}
                    {results.map((memory) => (
                      <li key={memory.date}>
                        <button
                          type="button"
                          onClick={() => pickResult(memory)}
                          className="obs-hoverable block w-full rounded-[10px] px-3 py-2.5 text-left"
                        >
                          <span className="obs-text-3 block text-[11.5px]">{formatLongDate(memory.date)}</span>
                          <span className="block truncate text-[14px] font-medium">{memoryLabel(memory)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {popover === "date" && (
              <div className="obs-panel absolute right-0 top-11 z-30 w-[min(92vw,280px)] rounded-[16px] p-4">
                <label htmlFor="obs-date" className="obs-text-2 text-[12px] font-medium uppercase tracking-[0.08em]">
                  Jump to a date
                </label>
                <input
                  id="obs-date"
                  type="date"
                  defaultValue={selectedMemory?.date ?? today}
                  onChange={(event) => {
                    if (event.target.value) goToDate(event.target.value);
                  }}
                  className="obs-chip mt-2 h-11 w-full rounded-[11px] bg-transparent px-3 text-[16px] focus:outline-none"
                  style={{ colorScheme: "dark" }}
                />
                <p className="obs-text-3 mt-2 text-[12px] leading-snug">Days with an entry open their star.</p>
              </div>
            )}
          </div>
        </div>

        <h1 className="obs-title mt-5 text-[2rem] font-semibold leading-[1.08] tracking-tight sm:text-[2.6rem]">Your universe.</h1>
        <p className="obs-text-2 mt-1.5 max-w-[34rem] text-[14px] leading-snug sm:text-[15px]">{subheading}</p>

        {notice && (
          <p className="pointer-events-auto obs-text-2 mt-2 text-[13px]">
            {notice.text}{" "}
            {notice.date <= today && (
              <Link to={notice.date === today ? "/" : `/day/${notice.date}`} className="obs-text font-medium underline underline-offset-2">
                Write this day
              </Link>
            )}
          </p>
        )}
      </header>

      {/* ---- bottom controls ------------------------------------------------- */}
      {view === "sky" && state === "ready" && memories.length > 0 && (
        <div
          className={
            "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] transition-opacity duration-200 " +
            (panelOpen ? "invisible opacity-0 lg:visible lg:opacity-100" : "opacity-100")
          }
        >
          <Legend />
          <p className="obs-text-3 text-[11px] sm:hidden">Drag to explore · pinch to zoom</p>

          <div className="pointer-events-auto obs-chip flex items-center gap-0.5 rounded-full p-1">
            <button type="button" onClick={shuffle} className={pillButton}>
              <Shuffle size={15} strokeWidth={1.9} aria-hidden="true" />
              Shuffle
            </button>
            <span className="obs-divider mx-1 h-5 w-px" aria-hidden="true" />
            <button type="button" onClick={discover} className={pillButton}>
              <Sparkles size={15} strokeWidth={1.9} aria-hidden="true" />
              Discover
            </button>
          </div>
        </div>
      )}

      {panelOpen && selectedMemory && (
        <MemoryPanel memory={selectedMemory} today={today} loadDay={loadDay} onClose={closePanel} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Legend() {
  const item = "flex items-center gap-1.5";
  return (
    <ul className="obs-text-3 hidden items-center justify-center gap-x-5 text-[11px] sm:flex" aria-label="Legend">
      <li className={item}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <circle cx="6" cy="6" r="2.4" fill="var(--obs-star)" />
        </svg>
        A day you wrote
      </li>
      <li className={item}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <circle cx="6" cy="6" r="2" fill="var(--obs-star)" />
          <circle cx="6" cy="6" r="4.8" fill="none" stroke="var(--obs-warm)" strokeWidth="0.75" />
        </svg>
        With photographs
      </li>
      <li className={item}>Drag to explore · scroll to zoom</li>
    </ul>
  );
}

function EmptySky() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
      <p className="text-[1.35rem] font-semibold tracking-tight">Your first star is waiting.</p>
      <p className="obs-text-2 mt-2 max-w-sm text-[14.5px] leading-relaxed">
        Write a day in your journal and it appears here as a memory star.
      </p>
      <Link to="/" className="obs-chip obs-hoverable mt-6 flex h-11 items-center rounded-full px-6 text-[14px] font-medium">
        Open today
      </Link>
    </div>
  );
}

// The accessible alternative to the sky: the same real days, newest first, no grouping.
function ListView({ memories, today }: { memories: Memory[]; today: DayKey }) {
  const items = useMemo(() => [...memories].reverse(), [memories]);

  return (
    <div className="absolute inset-x-0 bottom-0 top-[9.5rem] z-[5] overflow-y-auto px-5 pb-10 sm:top-[10.5rem] sm:px-8 lg:px-10">
      <div className="max-w-[640px]">
        {items.length === 0 && <p className="obs-text-3 py-8 text-[14px]">Nothing recorded yet.</p>}
        <ul>
          {items.map((memory) => (
            <li key={memory.date}>
              <Link
                to={memory.date === today ? "/" : `/day/${memory.date}`}
                className="obs-hoverable -mx-3 block rounded-[12px] px-3 py-3"
              >
                <span className="block truncate text-[15px] font-medium">{memoryLabel(memory)}</span>
                <span className="obs-text-3 block text-[12px]">
                  {formatLongDate(memory.date)}
                  {memory.photoCount > 0 ? ` · ${plural(memory.photoCount, "photo", "photos")}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}