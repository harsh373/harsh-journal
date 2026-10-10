import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Lightbox from "../components/Lightbox";
import { fetchPhotoLibraryPage } from "../api/photoLibrary.api";
import type { LibraryPhoto, PhotoSource } from "../api/photoLibrary.api";
import type { DayKey } from "../config/dates";

type LoadState = "idle" | "loading" | "done" | "error";
type FilterValue = "all" | PhotoSource;

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "journal", label: "Journal" },
  { value: "side-quest", label: "Side Quests" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(date: string): string {
  const [year, month] = date.split("-");
  return `${MONTH_NAMES[Number(month) - 1] ?? ""} ${year}`;
}

export default function Photos() {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [photos, setPhotos] = useState<LibraryPhoto[]>([]);
  const [cursor, setCursor] = useState<DayKey | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadMore = useCallback(
    (reset = false) => {
      if (loadingRef.current) return;
      if (!reset && state === "done") return;
      loadingRef.current = true;
      setState("loading");

      fetchPhotoLibraryPage(reset ? null : cursor, filter === "all" ? undefined : filter)
        .then(({ photos: page, nextCursor }) => {
          setPhotos((current) => (reset ? page : [...current, ...page]));
          setCursor(nextCursor);
          setState(nextCursor ? "idle" : "done");
        })
        .catch(() => setState("error"))
        .finally(() => {
          loadingRef.current = false;
        });
    },
    [cursor, state, filter],
  );

  // Reload from scratch whenever the source filter changes.
  useEffect(() => {
    setPhotos([]);
    setCursor(null);
    setState("idle");
    loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const months = useMemo(() => {
    const groups: { label: string; items: { photo: LibraryPhoto; index: number }[] }[] = [];
    photos.forEach((photo, index) => {
      const label = monthLabel(photo.date);
      const last = groups.at(-1);
      if (last && last.label === label) {
        last.items.push({ photo, index });
      } else {
        groups.push({ label, items: [{ photo, index }] });
      }
    });
    return groups;
  }, [photos]);

  const activePhoto = activeIndex !== null ? (photos[activeIndex] ?? null) : null;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 pb-24 pt-6 sm:px-8 lg:px-12 lg:pt-12">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-4">
        <h1 className="type-display">Photos</h1>
        <div className="flex items-center gap-0.5 rounded-control bg-selected p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={
                "flex h-8 items-center whitespace-nowrap rounded-[7px] px-3 text-[13px] font-medium transition-colors duration-150 " +
                (filter === f.value ? "bg-bg text-text shadow-sm ring-1 ring-border" : "text-secondary hover:text-text")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {photos.length === 0 && state === "done" && (
        <p className="mt-10 text-[15px] text-secondary">No photos here yet.</p>
      )}

      <div className="mt-8 space-y-12">
        {months.map((group) => (
          <div key={group.label}>
            <h2 className="mb-3 text-[17px] font-semibold tracking-tight">{group.label}</h2>
            <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-5">
              {group.items.map(({ photo, index }) => (
                <button
                  key={photo.id + photo.date}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className="aspect-square overflow-hidden rounded-[8px] bg-surface transition-opacity duration-150 hover:opacity-90"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? ""}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div ref={sentinelRef} className="h-1" />

      {state === "loading" && <p className="py-6 text-center text-[13px] text-tertiary">Loading…</p>}
      {state === "error" && (
        <div className="py-6 text-center">
          <p className="text-[13px] text-alert">Couldn&apos;t load more.</p>
          <button type="button" onClick={() => loadMore()} className="mt-2 text-[13px] underline underline-offset-2">
            Try again
          </button>
        </div>
      )}

      {activePhoto && (
        <Lightbox
          photo={activePhoto}
          onClose={() => setActiveIndex(null)}
          onPrev={activeIndex !== null && activeIndex > 0 ? () => setActiveIndex(activeIndex - 1) : undefined}
          onNext={
            activeIndex !== null && activeIndex < photos.length - 1
              ? () => setActiveIndex(activeIndex + 1)
              : undefined
          }
        />
      )}
    </div>
  );
}