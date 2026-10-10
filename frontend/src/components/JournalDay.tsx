import { Circle, MapPin, Pencil } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { Link } from "react-router-dom";
import { fetchArchivePage, fetchEntry, saveEntry } from "../api/journal.api";
import type { ArchiveEntry, EntryFields, JournalEntry, JournalPhoto, Mood } from "../api/journal.api";
import { formatLongDate, formatWeekday, getJournalToday } from "../config/dates";
import type { DayKey } from "../config/dates";
import AutoGrowTextarea from "./AutoGrowTextarea";
import LineField from "./LineField";
import Countdown from "./Countdown";
import DayNav from "./DayNav";
import DayPhotos from "./DayPhotos";
import Lightbox from "./Lightbox";
import { MoodBadge, MoodPicker } from "./MoodPicker";
import { useMoods } from "./MoodProvider";
import RecentDays from "./RecentDays";
import TodayChecklist from "./TodayChecklist";
import TracksOverview from "./TrackOverview";
import { analyzeDay } from "../api/insights.api";

const LIMIT_SUMMARY = 50_000;
const LIMIT_LOCATION = 120;
const LIMIT_ONE_LINER = 280;
const SAVE_DELAY_MS = 800;
const RECENT_DAYS_COUNT = 4;

const EMPTY_FIELDS: EntryFields = {
  whatIDidToday: "",
  whatDrainedMe: "",
  tomorrowDifferent: "",
  dailySummary: "",
  mood: "neutral",
  location: "",
};

function toFields(entry: JournalEntry | null): EntryFields {
  if (!entry) return EMPTY_FIELDS;
  return {
    whatIDidToday: entry.whatIDidToday,
    whatDrainedMe: entry.whatDrainedMe,
    tomorrowDifferent: entry.tomorrowDifferent,
    dailySummary: entry.dailySummary,
    mood: entry.mood,
    location: entry.location,
  };
}

// Pulled straight from Lightbox's own prop type, so this always matches
// whatever LibraryPhoto actually requires without importing it directly.
// If the object built below is missing a field, TypeScript will say exactly which.
type LightboxPhoto = ComponentProps<typeof Lightbox>["photo"];

function toLightboxPhoto(photo: JournalPhoto, day: DayKey): LightboxPhoto {
  return {
    id: photo.id,
    url: photo.url,
    caption: photo.caption,
    date: day,
    source: "journal",
    sourceHref: `/day/${day}`,
    sourceLabel: "Journal",
  };
}

type LoadState = "loading" | "ready" | "error";
type SaveState = "idle" | "saving" | "saved" | "error";

export default function JournalDay({ day }: { day: DayKey }) {
  const { setDayMood } = useMoods();
  const isToday = day === getJournalToday();

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [draft, setDraft] = useState<EntryFields>(EMPTY_FIELDS);
  const [hasEntry, setHasEntry] = useState(false);
  const [photos, setPhotos] = useState<JournalPhoto[]>([]);
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [recentDays, setRecentDays] = useState<ArchiveEntry[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const draftRef = useRef<EntryFields>(EMPTY_FIELDS);
  const savedJsonRef = useRef(JSON.stringify(EMPTY_FIELDS));
  const loadedRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const loadTokenRef = useRef(0);

  const load = useCallback(() => {
    const token = ++loadTokenRef.current;
    setLoadState("loading");

    fetchEntry(day)
      .then((entry) => {
        if (token !== loadTokenRef.current) return;
        const fields = toFields(entry);
        draftRef.current = fields;
        savedJsonRef.current = JSON.stringify(fields);
        loadedRef.current = true;
        setDraft(fields);
        setHasEntry(entry !== null);
        setPhotos(entry?.photos ?? []);
        setLoadState("ready");
      })
      .catch(() => {
        if (token === loadTokenRef.current) setLoadState("error");
      });
  }, [day]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchArchivePage(null)
      .then(({ entries }) => setRecentDays(entries.filter((entry) => entry.date !== day).slice(0, RECENT_DAYS_COUNT)))
      .catch(() => setRecentDays([]));
  }, [day]);

  const flush: () => Promise<void> = useCallback(() => {
    window.clearTimeout(timerRef.current);

    queueRef.current = queueRef.current.then(async () => {
      if (!loadedRef.current) return;

      const payload = draftRef.current;
      const json = JSON.stringify(payload);
      if (json === savedJsonRef.current) return;

      setSaveState("saving");
      try {
        const saved = await saveEntry(day, payload);
        savedJsonRef.current = json;
        setHasEntry(true);
        setDayMood(day, saved.mood);
        setSaveState(JSON.stringify(draftRef.current) === json ? "saved" : "idle");
      } catch {
        setSaveState("error");
      }
    });

    return queueRef.current;
  }, [day, setDayMood]);

  function update(patch: Partial<EntryFields>) {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setSaveState("idle");

    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
  }

  function handlePhotosChange(next: JournalPhoto[]) {
    setPhotos(next);
    if (!hasEntry && next.length > 0) {
      setHasEntry(true);
      setDayMood(day, draftRef.current.mood);
    }
  }

  async function finishEditing() {
    await flush();
    if (JSON.stringify(draftRef.current) === savedJsonRef.current) {
      setEditing(false);
      analyzeDay(day).catch(() => undefined);
    }
  }

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current);
      if (loadedRef.current && JSON.stringify(draftRef.current) !== savedJsonRef.current) {
        saveEntry(day, draftRef.current)
          .then((saved) => setDayMood(day, saved.mood))
          .catch(() => undefined);
      }
    };
  }, [day, setDayMood]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(draftRef.current) !== savedJsonRef.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const ready = loadState === "ready";
  const showEmptyState = ready && !hasEntry && !editing;
  const hasOneLiner = draft.whatIDidToday.trim().length > 0;
  const showRecent = !editing && recentDays.length > 0;
  // Visible on today's page, but hidden while you're writing so the writing
  // area comes first. It comes back when you press Done.
  const showTodayChecklist = isToday && ready && !editing;

  return (
    <>
      <div className="mx-auto w-full max-w-[1180px] px-5 pb-24 sm:px-8 lg:px-12">
        <div className="sticky top-0 z-10 -mx-5 flex h-12 items-center justify-end gap-3 bg-bg/85 px-5 backdrop-blur-xl sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
          {editing ? (
            <>
              <SaveStatus state={saveState} onRetry={() => void flush()} />
              <button
                type="button"
                onClick={() => void finishEditing()}
                className="h-9 rounded-control bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85 lg:h-8"
              >
                Done
              </button>
            </>
          ) : (
            ready &&
            hasEntry && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex h-9 items-center gap-1.5 rounded-control border border-border px-3 text-[13px] font-medium text-text transition-colors duration-150 hover:bg-hover lg:h-8"
              >
                <Pencil size={13} strokeWidth={1.75} />
                Edit
              </button>
            )
          )}
        </div>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start lg:gap-14">
          <div className="mx-auto w-full max-w-[760px] lg:mx-0">
            <header className="pb-8 pt-2 lg:pt-6">
              <p className="text-[15px] font-medium text-secondary">{formatWeekday(day)}</p>
              <h1 className="type-display mt-1">{formatLongDate(day)}</h1>

              {ready && (editing || hasEntry) && (
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
                  {editing ? (
                    <MoodPicker value={draft.mood} onChange={(mood: Mood) => update({ mood })} />
                  ) : (
                    <MoodBadge mood={draft.mood} />
                  )}

                  {editing ? (
                    <label className="flex items-center gap-1.5 text-secondary">
                      <MapPin size={14} strokeWidth={1.75} />
                      <div className="w-44">
                        <LineField
                          value={draft.location}
                          maxLength={LIMIT_LOCATION}
                          placeholder="Add location"
                          onChange={(event) => update({ location: event.target.value })}
                          className="text-[16px] leading-7 text-text placeholder:text-tertiary sm:text-[13px]"
                        />
                      </div>
                    </label>
                  ) : (
                    draft.location && (
                      <span className="flex items-center gap-1.5 text-[13px] text-secondary">
                        <MapPin size={14} strokeWidth={1.75} />
                        {draft.location}
                      </span>
                    )
                  )}
                </div>
              )}

              {isToday && !editing && (
                <div className="mt-6 flex items-stretch gap-3">
                  <div>
                    <Countdown />
                  </div>
                  <Link
                    to="/now"
                    aria-label="Open Now"
                    title="Now"
                    className="flex aspect-square min-w-[56px] items-center justify-center rounded-card border border-border bg-surface text-secondary transition-colors duration-150 hover:bg-hover hover:text-text active:scale-95"
                  >
                    <Circle size={20} strokeWidth={1.5} />
                  </Link>
                </div>
              )}
            </header>

            {showTodayChecklist && <TodayChecklist />}

            {loadState === "loading" && <div className="h-64" aria-busy="true" />}

            {loadState === "error" && (
              <div className="border-t border-border py-8">
                <p className="font-serif text-[20px]">This day couldn&apos;t be loaded.</p>
                <p className="mt-1 text-[15px] text-secondary">Check that the server is running, then try again.</p>
                <button
                  type="button"
                  onClick={load}
                  className="mt-5 h-9 rounded-control border border-border px-4 text-[13px] transition-colors hover:bg-hover"
                >
                  Try again
                </button>
              </div>
            )}

            {showEmptyState && (
              <div className="border-t border-border py-8">
                <p className="font-serif text-[22px] leading-snug text-secondary">Nothing written for this day yet.</p>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="mt-5 h-10 rounded-control bg-text px-5 text-[14px] font-medium text-bg transition-opacity duration-150 hover:opacity-85"
                >
                  Start writing
                </button>
              </div>
            )}

            {ready && (editing || hasEntry) && (
              <>
                <DayPhotos
                  day={day}
                  photos={photos}
                  editing={editing}
                  onPhotosChange={handlePhotosChange}
                  onPhotoClick={(index) => setLightboxIndex(index)}
                />

                {editing || hasOneLiner ? (
                  <section className="mt-6">
                    <h2 className="type-eyebrow">Today</h2>
                    {editing ? (
                      <div className="mt-2 border-b border-border pb-2 transition-colors duration-150 focus-within:border-secondary">
                        <LineField
                          value={draft.whatIDidToday}
                          maxLength={LIMIT_ONE_LINER}
                          placeholder="One good line about today."
                          autoFocus
                          onChange={(event) => update({ whatIDidToday: event.target.value })}
                          className="font-serif text-[1.5rem] leading-snug tracking-tight text-text placeholder:text-tertiary"
                        />
                      </div>
                    ) : (
                      <p className="mt-2 border-b border-transparent pb-2 font-serif text-[1.5rem] leading-snug tracking-tight">
                        {draft.whatIDidToday}
                      </p>
                    )}
                  </section>
                ) : (
                  <section className="mt-6">
                    <h2 className="type-eyebrow">Today</h2>
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="group mt-2 flex w-full items-center justify-between gap-4 border-b border-border pb-2 text-left transition-colors duration-150 hover:border-secondary"
                    >
                      <span className="font-serif text-[1.5rem] leading-snug tracking-tight text-tertiary transition-colors duration-150 group-hover:text-secondary">
                        One good line about today.
                      </span>
                      <Pencil
                        size={15}
                        strokeWidth={1.75}
                        className="shrink-0 text-tertiary transition-colors duration-150 group-hover:text-text"
                      />
                    </button>
                  </section>
                )}

                {(editing || draft.dailySummary) && (
                  <section className="mt-12">
                    <h2 className="type-eyebrow">Daily Summary</h2>
                    {editing ? (
                      <AutoGrowTextarea
                        value={draft.dailySummary}
                        maxLength={LIMIT_SUMMARY}
                        placeholder="Tell the story of the day."
                        onChange={(event) => update({ dailySummary: event.target.value })}
                        className="type-journal mt-3 w-full placeholder:text-tertiary"
                      />
                    ) : (
                      <p className="type-journal mt-3 whitespace-pre-wrap">{draft.dailySummary}</p>
                    )}
                  </section>
                )}
              </>
            )}

            <TracksOverview />

            {showRecent && (
              <div className="mt-14 lg:hidden">
                <RecentDays entries={recentDays} />
              </div>
            )}
            <DayNav day={day} />
          </div>

          {showRecent && (
            <aside className="hidden pt-2 lg:sticky lg:top-16 lg:block lg:pt-6">
              <RecentDays entries={recentDays} />
            </aside>
          )}
        </div>
      </div>

      {lightboxIndex !== null && photos[lightboxIndex] && (
        <Lightbox
          photo={toLightboxPhoto(photos[lightboxIndex], day)}
          onClose={() => setLightboxIndex(null)}
          onPrev={lightboxIndex > 0 ? () => setLightboxIndex(lightboxIndex - 1) : undefined}
          onNext={lightboxIndex < photos.length - 1 ? () => setLightboxIndex(lightboxIndex + 1) : undefined}
        />
      )}
    </>
  );
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "saving") return <span className="text-[13px] text-tertiary">Saving…</span>;
  if (state === "saved") return <span className="text-[13px] text-tertiary">Saved</span>;
  if (state === "error") {
    return (
      <span className="flex items-center gap-2 text-[13px] text-alert">
        Couldn&apos;t save
        <button type="button" onClick={onRetry} className="underline underline-offset-2 hover:opacity-80">
          Retry
        </button>
      </span>
    );
  }
  return null;
}