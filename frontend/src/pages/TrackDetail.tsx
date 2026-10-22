import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  createLog,
  deleteLog,
  deleteTrack,
  fetchLogs,
  fetchTrack,
  formatAmount,
  toMonthKey,
  updateLog,
  updateTrack,
} from "../api/tracks.api";
import type { LogValues, Track, TrackIconKey, TrackLog, TrackPatch, TrackStatus } from "../api/tracks.api";
import LineField from "../components/LineField";
import TrackCalendar from "../components/TrackCalender";
import TrackCheck from "../components/TrackCheck";
import TrackIcon, { TRACK_ICON_KEYS } from "../components/TrackIcon";
import TrackLogForm from "../components/TrackLogForm";
import TrackLogRow from "../components/TrackLogRow";
import TrackStreak from "../components/TrackStrak";
import { TrackStatusBadge, TrackStatusPicker } from "../components/TrackStatus";
import { formatMonthName, getJournalToday, parseDayKey, shiftMonth } from "../config/dates";

type LoadState = "loading" | "ready" | "error" | "not-found";

interface MetaDraft {
  title: string;
  subtitle: string;
  unit: string;
  icon: TrackIconKey;
  status: TrackStatus;
}

function toDraft(track: Track): MetaDraft {
  return {
    title: track.title,
    subtitle: track.subtitle,
    unit: track.unit,
    icon: track.icon,
    status: track.status,
  };
}

function todayMonth(): { year: number; month: number } {
  const parts = parseDayKey(getJournalToday());
  const now = new Date();
  return { year: parts?.year ?? now.getFullYear(), month: parts?.month ?? now.getMonth() + 1 };
}

// "2026-10-23" -> "Friday, 23 October"
function longDayLabel(dayKey: string): string | null {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// The day before a "YYYY-MM-DD" key. Uses UTC so time zones and daylight saving can't shift the result.
function previousDay(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// Is today logged, and how many consecutive logged days end today (or yesterday, if today isn't logged yet)?
// Each month is fetched at most once.
async function loadStreak(trackId: string, today: string): Promise<{ done: boolean; streak: number }> {
  const months = new Map<string, Set<string>>();

  async function isLogged(dayKey: string): Promise<boolean> {
    const parts = parseDayKey(dayKey);
    if (!parts) return false;
    const monthKey = toMonthKey(parts.year, parts.month);
    let set = months.get(monthKey);
    if (!set) {
      const monthLogs = await fetchLogs(trackId, monthKey);
      set = new Set(monthLogs.map((log) => log.date));
      months.set(monthKey, set);
    }
    return set.has(dayKey);
  }

  const done = await isLogged(today);
  let cursor = done ? today : previousDay(today);
  let streak = 0;
  // Hard cap (about 2 years) so a bug can never loop forever.
  for (let i = 0; i < 800; i += 1) {
    if (!(await isLogged(cursor))) break;
    streak += 1;
    cursor = previousDay(cursor);
  }
  return { done, streak };
}

const metaField =
  "w-full bg-transparent text-text placeholder:text-tertiary focus:outline-none";

export default function TrackDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const startInEditMode = (location.state as { editing?: boolean } | null)?.editing === true;

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [track, setTrack] = useState<Track | null>(null);
  const [draft, setDraft] = useState<MetaDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState(todayMonth);
  const [logs, setLogs] = useState<TrackLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"next" | "prev" | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [doneToday, setDoneToday] = useState(false);
  const [streak, setStreak] = useState(0);
  const [toggling, setToggling] = useState(false);

  const today = getJournalToday();
  const todayParts = parseDayKey(today);
  const todayMonthKey = todayParts ? toMonthKey(todayParts.year, todayParts.month) : null;

  useEffect(() => {
    if (!id) return;
    setLoadState("loading");
    fetchTrack(id)
      .then((loaded) => {
        setTrack(loaded);
        setDraft(toDraft(loaded));
        setEditing(startInEditMode);
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        setLoadState(status === 404 ? "not-found" : "error");
      });
  }, [id, startInEditMode]);

  const loadLogs = useCallback(async () => {
    if (!id) return;
    try {
      setLogs(await fetchLogs(id, toMonthKey(view.year, view.month)));
    } catch {
      setError("Couldn't load the log.");
    }
  }, [id, view]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  // Today's status and the streak, independent of which month is on screen.
  const refreshStatus = useCallback(async () => {
    if (!id) return;
    try {
      const result = await loadStreak(id, today);
      setDoneToday(result.done);
      setStreak(result.streak);
    } catch {
      // Keep the current values; the main log load reports errors.
    }
  }, [id, today]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const loggedDays = useMemo(() => new Set(logs.map((log) => log.date)), [logs]);
  const monthTotal = useMemo(() => logs.reduce((sum, log) => sum + (log.amount ?? 0), 0), [logs]);
  const selectedLogs = useMemo(
    () => (selectedDay ? logs.filter((log) => log.date === selectedDay) : []),
    [logs, selectedDay],
  );

  function updateDraft(patch: Partial<MetaDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function goToMonth(delta: number) {
    setDirection(delta > 0 ? "next" : "prev");
    setSelectedDay(null);
    setView((current) => shiftMonth(current.year, current.month, delta));
  }

  async function finishEditing() {
    if (!id || !track || !draft) return;
    if (draft.title.trim() === "") {
      setError("A track needs a title.");
      return;
    }

    const patch: TrackPatch = {};
    if (draft.title.trim() !== track.title) patch.title = draft.title;
    if (draft.subtitle.trim() !== track.subtitle) patch.subtitle = draft.subtitle;
    if (draft.unit.trim() !== track.unit) patch.unit = draft.unit;
    if (draft.icon !== track.icon) patch.icon = draft.icon;
    if (draft.status !== track.status) patch.status = draft.status;

    try {
      if (Object.keys(patch).length > 0) {
        const saved = await updateTrack(id, patch);
        setTrack(saved);
        setDraft(toDraft(saved));
      }
      setError(null);
      setEditing(false);
    } catch {
      setError("Couldn't save your changes.");
    }
  }

  function cancelEditing() {
    if (track) setDraft(toDraft(track));
    setError(null);
    setEditing(false);
  }

  async function handleDeleteTrack() {
    if (!id) return;
    if (!confirm("Delete this track and every log inside it? This can't be undone.")) return;
    try {
      await deleteTrack(id);
      navigate("/tracks");
    } catch {
      setError("Couldn't delete this track.");
    }
  }

  async function handleToggleToday() {
    if (!id || !todayMonthKey || toggling) return;
    const wasDone = doneToday;
    setToggling(true);
    setDoneToday(!wasDone); // optimistic: the check responds instantly
    try {
      const todays = (await fetchLogs(id, todayMonthKey)).filter((log) => log.date === today);
      if (todays.length === 0) {
        await createLog(id, { date: today, note: "", amount: null });
      } else {
        const hasContent = todays.some((log) => log.note.trim() !== "" || log.amount !== null);
        if (hasContent && !confirm("Today's log has a note or amount. Remove it?")) {
          setDoneToday(wasDone);
          return;
        }
        for (const log of todays) await deleteLog(id, log.id);
      }
      await Promise.all([refreshStatus(), loadLogs()]);
    } catch {
      setDoneToday(wasDone);
      setError("Couldn't update today.");
    } finally {
      setToggling(false);
    }
  }

  async function handleAddLog(values: LogValues) {
    if (!id) return;
    await createLog(id, values);
    // If the date was changed to another month, jump there so you see it land.
    const parts = parseDayKey(values.date);
    if (parts && (parts.year !== view.year || parts.month !== view.month)) {
      setDirection(null);
      setSelectedDay(null);
      setView({ year: parts.year, month: parts.month });
    } else {
      await loadLogs();
    }
    void refreshStatus();
  }

  async function handleSaveLog(log: TrackLog, values: LogValues) {
    if (!id) return;
    await updateLog(id, log.id, values);
    await loadLogs();
    void refreshStatus();
  }

  async function handleDeleteLog(log: TrackLog) {
    if (!id) return;
    if (!confirm("Delete this log?")) return;
    try {
      await deleteLog(id, log.id);
      await loadLogs();
      void refreshStatus();
    } catch {
      setError("Couldn't delete that log.");
    }
  }

  if (loadState === "not-found") return <Navigate to="/tracks" replace />;

  if (loadState === "loading" || !track || !draft) {
    return <div className="mx-auto w-full max-w-[820px] px-5 py-14 sm:px-8 lg:px-12" aria-busy="true" />;
  }

  if (loadState === "error") {
    return (
      <div className="mx-auto w-full max-w-[820px] px-5 py-14 sm:px-8 lg:px-12">
        <p className="text-[15px] text-alert">Couldn&apos;t load this track.</p>
      </div>
    );
  }

  const shownIcon = editing ? draft.icon : track.icon;
  const days = loggedDays.size;
  const todayLabel = longDayLabel(today);

  return (
    <div className="relative mx-auto w-full max-w-[820px] px-5 pb-24 sm:px-8 lg:px-12">
      {/* A faint pool of light behind the header, so the page has depth without decoration. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(60%_70%_at_50%_0%,rgba(128,128,128,0.12),transparent)]"
      />

      <div className="sticky top-0 z-10 -mx-5 flex h-12 items-center justify-between gap-3 bg-bg/85 px-5 backdrop-blur-xl sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
        <Link
          to="/tracks"
          className="flex h-9 items-center gap-1.5 text-[13px] text-secondary transition-colors hover:text-text"
        >
          <ArrowLeft size={15} strokeWidth={1.75} />
          Tracks
        </Link>
        <div className="flex items-center gap-2">
          {editing && (
            <>
              <button
                type="button"
                onClick={() => void handleDeleteTrack()}
                className="flex h-9 items-center gap-1.5 rounded-control px-3 text-[13px] text-alert transition-colors hover:bg-hover lg:h-8"
              >
                <Trash2 size={13} strokeWidth={1.75} />
                Delete
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="h-9 rounded-control px-3 text-[13px] text-secondary transition-colors hover:bg-hover hover:text-text lg:h-8"
              >
                Cancel
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => (editing ? void finishEditing() : setEditing(true))}
            className={
              editing
                ? "h-9 rounded-control bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85 lg:h-8"
                : "flex h-9 items-center gap-1.5 rounded-control border border-border px-3 text-[13px] font-medium text-text transition-colors duration-150 hover:bg-hover lg:h-8"
            }
          >
            {editing ? (
              "Done"
            ) : (
              <>
                <Pencil size={13} strokeWidth={1.75} /> Edit
              </>
            )}
          </button>
        </div>
      </div>

      <header className="track-rise pb-6 pt-4 lg:pt-8">
        <span className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_1px_2px_rgba(0,0,0,0.12)]">
          <TrackIcon name={shownIcon} size={24} />
        </span>

        {editing ? (
          <LineField
            value={draft.title}
            maxLength={60}
            placeholder="Track name"
            autoFocus
            onFocus={(event) => event.target.select()}
            onChange={(event) => updateDraft({ title: event.target.value })}
            className={metaField + " type-display mt-6"}
          />
        ) : (
          <h1 className="type-display mt-6">{track.title}</h1>
        )}

        {editing ? (
          <LineField
            value={draft.subtitle}
            maxLength={160}
            placeholder="A short description (optional)"
            onChange={(event) => updateDraft({ subtitle: event.target.value })}
            className={metaField + " mt-2 font-serif text-[1.125rem] text-secondary"}
          />
        ) : (
          track.subtitle && <p className="mt-2 font-serif text-[1.125rem] text-secondary">{track.subtitle}</p>
        )}

        {editing ? (
          <div className="mt-6 space-y-5">
            <div>
              <p className="type-eyebrow mb-2">Icon</p>
              <div className="flex flex-wrap gap-1.5">
                {TRACK_ICON_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateDraft({ icon: key })}
                    aria-label={key}
                    aria-pressed={draft.icon === key}
                    className={
                      "flex h-10 w-10 items-center justify-center rounded-control transition-colors duration-150 " +
                      (draft.icon === key ? "bg-text text-bg" : "bg-hover text-secondary hover:text-text")
                    }
                  >
                    <TrackIcon name={key} size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="type-eyebrow mb-2">Unit (optional)</p>
              <div className="flex min-h-10 w-56 items-center rounded-control border border-border px-3 transition-colors duration-150 focus-within:border-secondary">
                <LineField
                  value={draft.unit}
                  maxLength={20}
                  placeholder="problems, minutes, hours…"
                  onChange={(event) => updateDraft({ unit: event.target.value })}
                  className="py-2 text-[16px] leading-snug text-text placeholder:text-tertiary sm:text-[13px]"
                />
              </div>
              <p className="mt-1.5 text-[12px] text-tertiary">
                Leave empty if you only want to record that you showed up.
              </p>
            </div>

            <div>
              <p className="type-eyebrow mb-2">Status</p>
              <TrackStatusPicker value={draft.status} onChange={(status) => updateDraft({ status })} />
            </div>
          </div>
        ) : (
          track.status !== "active" && (
            <div className="mt-4">
              <TrackStatusBadge status={track.status} />
            </div>
          )
        )}

        {error && <p className="mt-4 text-[13px] text-alert">{error}</p>}
      </header>

      {!editing && (
        <div className="track-rise flex items-center gap-4 px-1 pb-6" style={{ "--i": 1 } as CSSProperties}>
          <TrackCheck
            checked={doneToday}
            busy={toggling}
            label={doneToday ? "Mark today as not done" : "Mark today as done"}
            onToggle={() => void handleToggleToday()}
          />
          <div className="min-w-0">
            <p className="text-[16px] font-medium leading-tight tracking-tight">
              {doneToday ? "Done today" : "Mark today as done"}
            </p>
            {todayLabel && <p className="mt-0.5 text-[13px] text-secondary">{todayLabel}</p>}
          </div>
        </div>
      )}

      <section
        className="track-rise rounded-[24px] bg-surface p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_2px_rgba(0,0,0,0.08),0_18px_40px_-18px_rgba(0,0,0,0.35)] ring-1 ring-border/60 sm:p-8"
        style={{ "--i": 2 } as CSSProperties}
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[26px] leading-none tracking-tight sm:text-[30px]">
              <span className="font-semibold">{formatMonthName(view.month)}</span>{" "}
              <span className="text-secondary">{view.year}</span>
            </h2>
            <p className="mt-2 text-[13px] text-secondary">
              {days === 0 ? "Nothing logged" : `${days} ${days === 1 ? "day" : "days"}`}
              {track.unit && monthTotal > 0 ? ` · ${formatAmount(monthTotal, track.unit)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => goToMonth(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-secondary transition-colors hover:bg-hover hover:text-text active:bg-selected"
            >
              <ChevronLeft size={17} strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => goToMonth(1)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-secondary transition-colors hover:bg-hover hover:text-text active:bg-selected"
            >
              <ChevronRight size={17} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_9rem] lg:gap-8">
          <TrackStreak count={streak} doneToday={doneToday} className="lg:order-2" />
          <div className="lg:order-1">
            <TrackCalendar
              year={view.year}
              month={view.month}
              loggedDays={loggedDays}
              today={today}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
              direction={direction}
            />
          </div>
        </div>
      </section>

      {!selectedDay && (
        <p className="mt-4 text-center text-[12px] text-tertiary">Tap a day to see or add its log.</p>
      )}

      {selectedDay && (
        <section className="track-rise mt-10" style={{ "--i": 0 } as CSSProperties}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="type-eyebrow">{longDayLabel(selectedDay)}</h2>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="text-[13px] text-secondary transition-colors hover:text-text"
            >
              Close
            </button>
          </div>

          {selectedLogs.length > 0 && (
            <div className="mb-6 divide-y divide-border overflow-hidden rounded-card bg-surface">
              {selectedLogs.map((log) => (
                <TrackLogRow
                  key={log.id}
                  log={log}
                  unit={track.unit}
                  onSave={(values) => handleSaveLog(log, values)}
                  onDelete={() => void handleDeleteLog(log)}
                />
              ))}
            </div>
          )}

          <TrackLogForm
            key={track.unit + selectedDay}
            unit={track.unit}
            initial={{ date: selectedDay, note: "", amount: null }}
            submitLabel={selectedLogs.length > 0 ? "Add another" : "Add"}
            clearAfterSubmit
            onSubmit={handleAddLog}
          />
        </section>
      )}
    </div>
  );
}