import { MapPin, Pencil } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchArchivePage, fetchEntry, saveEntry } from "../api/journal.api";
import type { ArchiveEntry, EntryFields, JournalEntry, JournalPhoto, Mood } from "../api/journal.api";
import { formatLongDate, formatWeekday, getJournalToday } from "../config/dates";
import type { DayKey } from "../config/dates";
import AutoGrowTextarea from "./AutoGrowTextarea";
import Countdown from "./Countdown";
import DayNav from "./DayNav";
import DayPhotos from "./DayPhotos";
import { MoodBadge, MoodPicker } from "./MoodPicker";
import { useMoods } from "./MoodProvider";
import RecentDays from "./RecentDays";

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
    if (JSON.stringify(draftRef.current) === savedJsonRef.current) setEditing(false);
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

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 pb-24 lg:px-12">
      <div className="sticky top-0 z-10 -mx-6 flex h-14 items-center justify-end gap-3 bg-bg/80 px-6 backdrop-blur-xl lg:-mx-12 lg:px-12">
        {editing ? (
          <>
            <SaveStatus state={saveState} onRetry={() => void flush()} />
            <button
              type="button"
              onClick={() => void finishEditing()}
              className="h-8 rounded-lg bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85"
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
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[13px] text-text transition-colors duration-150 hover:bg-hover"
            >
              <Pencil size={13} strokeWidth={1.75} />
              Edit
            </button>
          )
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-16">
        <div className="mx-auto w-full max-w-[760px] lg:mx-0">
          <header className="pb-8 pt-4 lg:pt-8">
            <p className="text-[17px] text-secondary">{formatWeekday(day)}</p>
            <h1 className="mt-1 text-4xl font-light tracking-tight lg:text-5xl">{formatLongDate(day)}</h1>

            {ready && (editing || hasEntry) && (
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
                {editing ? (
                  <MoodPicker value={draft.mood} onChange={(mood: Mood) => update({ mood })} />
                ) : (
                  <MoodBadge mood={draft.mood} />
                )}

                {editing ? (
                  <label className="flex h-7 items-center gap-1.5 text-secondary">
                    <MapPin size={14} strokeWidth={1.75} />
                    <input
                      type="text"
                      value={draft.location}
                      maxLength={LIMIT_LOCATION}
                      placeholder="Add location"
                      onChange={(event) => update({ location: event.target.value })}
                      className="w-44 bg-transparent text-[16px] text-text placeholder:text-tertiary focus:outline-none sm:text-[13px]"
                    />
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
              <div className="mt-6">
                <Countdown />
              </div>
            )}
          </header>

          {loadState === "loading" && <div className="h-64" aria-busy="true" />}

          {loadState === "error" && (
            <div className="rounded-[18px] border border-border bg-surface p-8 shadow-card">
              <p className="text-[17px]">This day couldn&apos;t be loaded.</p>
              <p className="mt-1 text-[15px] text-secondary">Check that the server is running, then try again.</p>
              <button
                type="button"
                onClick={load}
                className="mt-5 h-8 rounded-lg border border-border px-4 text-[13px] transition-colors hover:bg-hover"
              >
                Try again
              </button>
            </div>
          )}

          {showEmptyState && (
            <div className="rounded-[18px] border border-border bg-surface p-8 shadow-card">
              <p className="text-[17px]">Nothing written for this day yet.</p>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="mt-5 h-9 rounded-lg bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85"
              >
                Start writing
              </button>
            </div>
          )}

          {ready && (editing || hasEntry) && (
            <>
              <DayPhotos day={day} photos={photos} editing={editing} onPhotosChange={handlePhotosChange} />

              {editing || hasOneLiner ? (
                <section className="rounded-[18px] border border-border bg-surface px-6 py-5 shadow-card">
                  <h2 className="text-[13px] font-medium text-secondary">Today</h2>
                  {editing ? (
                    <input
                      type="text"
                      value={draft.whatIDidToday}
                      maxLength={LIMIT_ONE_LINER}
                      placeholder="One good line about today."
                      autoFocus
                      onChange={(event) => update({ whatIDidToday: event.target.value })}
                      className="mt-2 w-full bg-transparent text-[19px] leading-relaxed text-text placeholder:text-tertiary focus:outline-none"
                    />
                  ) : (
                    <p className="mt-2 text-[19px] leading-relaxed">{draft.whatIDidToday}</p>
                  )}
                </section>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex w-full items-center justify-between rounded-[18px] border border-dashed border-border px-6 py-5 text-left text-secondary transition-colors duration-150 hover:bg-hover hover:text-text"
                >
                  <span className="text-[15px]">You haven&apos;t written about this day yet.</span>
                  <span className="text-[13px] font-medium">Add a line →</span>
                </button>
              )}

              {(editing || draft.dailySummary) && (
                <section className="mt-14">
                  <h2 className="text-[13px] font-medium text-secondary">Daily Summary</h2>
                  {editing ? (
                    <AutoGrowTextarea
                      value={draft.dailySummary}
                      maxLength={LIMIT_SUMMARY}
                      placeholder="Tell the story of the day."
                      onChange={(event) => update({ dailySummary: event.target.value })}
                      className="mt-3 max-w-[65ch] text-[20px] leading-[1.75] placeholder:text-tertiary"
                    />
                  ) : (
                    <p className="mt-3 max-w-[65ch] whitespace-pre-wrap text-[20px] leading-[1.75]">
                      {draft.dailySummary}
                    </p>
                  )}
                </section>
              )}
            </>
          )}

          {showRecent && (
            <div className="mt-14 lg:hidden">
              <RecentDays entries={recentDays} />
            </div>
          )}

          <DayNav day={day} />
        </div>

        {showRecent && (
          <aside className="hidden pt-4 lg:sticky lg:top-20 lg:block lg:pt-8">
            <RecentDays entries={recentDays} />
          </aside>
        )}
      </div>
    </div>
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