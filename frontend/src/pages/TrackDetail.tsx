import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import MonthDots from "../components/MonthDots";
import TrackIcon, { TRACK_ICON_KEYS } from "../components/TrackIcon";
import TrackLogForm from "../components/TrackLogForm";
import TrackLogRow from "../components/TrackLogRow";
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

  const today = getJournalToday();

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

  const loggedDays = useMemo(() => new Set(logs.map((log) => log.date)), [logs]);
  const monthTotal = useMemo(() => logs.reduce((sum, log) => sum + (log.amount ?? 0), 0), [logs]);

  function updateDraft(patch: Partial<MetaDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
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

  async function handleAddLog(values: LogValues) {
    if (!id) return;
    await createLog(id, values);
    // Jump to the month of the new log so you see it land.
    const parts = parseDayKey(values.date);
    if (parts && (parts.year !== view.year || parts.month !== view.month)) {
      setView({ year: parts.year, month: parts.month });
    } else {
      await loadLogs();
    }
  }

  async function handleSaveLog(log: TrackLog, values: LogValues) {
    if (!id) return;
    await updateLog(id, log.id, values);
    await loadLogs();
  }

  async function handleDeleteLog(log: TrackLog) {
    if (!id) return;
    if (!confirm("Delete this log?")) return;
    try {
      await deleteLog(id, log.id);
      await loadLogs();
    } catch {
      setError("Couldn't delete that log.");
    }
  }

  if (loadState === "not-found") return <Navigate to="/tracks" replace />;

  if (loadState === "loading" || !track || !draft) {
    return <div className="mx-auto w-full max-w-[820px] px-6 py-14 lg:px-12" aria-busy="true" />;
  }

  if (loadState === "error") {
    return (
      <div className="mx-auto w-full max-w-[820px] px-6 py-14 lg:px-12">
        <p className="text-[15px] text-alert">Couldn&apos;t load this track.</p>
      </div>
    );
  }

  const shownIcon = editing ? draft.icon : track.icon;
  const days = loggedDays.size;

  return (
    <div className="mx-auto w-full max-w-[820px] px-6 pb-24 lg:px-12">
      <div className="sticky top-0 z-10 -mx-6 flex h-14 items-center justify-between gap-3 bg-bg/80 px-6 backdrop-blur-xl lg:-mx-12 lg:px-12">
        <Link
          to="/tracks"
          className="flex items-center gap-1.5 text-[13px] text-secondary transition-colors hover:text-text"
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
                className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] text-alert transition-colors hover:bg-hover"
              >
                <Trash2 size={13} strokeWidth={1.75} />
                Delete
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="h-8 rounded-lg px-3 text-[13px] text-secondary transition-colors hover:bg-hover hover:text-text"
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
                ? "h-8 rounded-lg bg-text px-4 text-[13px] font-medium text-bg transition-opacity duration-150 hover:opacity-85"
                : "flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-[13px] text-text transition-colors duration-150 hover:bg-hover"
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

      <header className="pb-8 pt-4 lg:pt-8">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-hover">
          <TrackIcon name={shownIcon} size={22} />
        </span>

        {editing ? (
          <input
            value={draft.title}
            maxLength={60}
            placeholder="Track name"
            autoFocus
            onFocus={(event) => event.target.select()}
            onChange={(event) => updateDraft({ title: event.target.value })}
            className={metaField + " mt-5 text-4xl font-light tracking-tight lg:text-5xl"}
          />
        ) : (
          <h1 className="mt-5 text-4xl font-light tracking-tight lg:text-5xl">{track.title}</h1>
        )}

        {editing ? (
          <input
            value={draft.subtitle}
            maxLength={160}
            placeholder="A short description (optional)"
            onChange={(event) => updateDraft({ subtitle: event.target.value })}
            className={metaField + " mt-2 text-[17px] text-secondary"}
          />
        ) : (
          track.subtitle && <p className="mt-2 text-[17px] text-secondary">{track.subtitle}</p>
        )}

        {editing ? (
          <div className="mt-6 space-y-5">
            <div>
              <p className="mb-2 text-[13px] font-medium text-secondary">Icon</p>
              <div className="flex flex-wrap gap-1.5">
                {TRACK_ICON_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateDraft({ icon: key })}
                    aria-label={key}
                    aria-pressed={draft.icon === key}
                    className={
                      "flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-150 " +
                      (draft.icon === key ? "bg-text text-bg" : "bg-hover text-secondary hover:text-text")
                    }
                  >
                    <TrackIcon name={key} size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-secondary">Unit (optional)</p>
              <input
                value={draft.unit}
                maxLength={20}
                placeholder="problems, minutes, hours…"
                onChange={(event) => updateDraft({ unit: event.target.value })}
                className="h-9 w-56 rounded-lg border border-border bg-transparent px-3 text-[16px] placeholder:text-tertiary focus:border-tertiary focus:outline-none sm:text-[13px]"
              />
              <p className="mt-1.5 text-[12px] text-tertiary">
                Leave empty if you only want to record that you showed up.
              </p>
            </div>

            <div>
              <p className="mb-2 text-[13px] font-medium text-secondary">Status</p>
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

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-[15px]">
            <span className="font-semibold">{formatMonthName(view.month)}</span>{" "}
            <span className="text-secondary">{view.year}</span>
          </h2>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setView((current) => shiftMonth(current.year, current.month, -1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors hover:bg-hover hover:text-text"
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setView((current) => shiftMonth(current.year, current.month, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-secondary transition-colors hover:bg-hover hover:text-text"
            >
              <ChevronRight size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        <p className="mt-1 text-[13px] text-secondary">
          {days === 0 ? "Nothing logged" : `${days} ${days === 1 ? "day" : "days"}`}
          {track.unit && monthTotal > 0 ? ` · ${formatAmount(monthTotal, track.unit)}` : ""}
        </p>

        <div className="mt-4">
          <MonthDots year={view.year} month={view.month} loggedDays={loggedDays} today={today} />
        </div>
      </section>

      <section className="mt-10 rounded-[18px] border border-border bg-surface p-6 shadow-card">
        <h2 className="mb-4 text-[13px] font-medium text-secondary">Add a log</h2>
        <TrackLogForm
          key={track.unit}
          unit={track.unit}
          initial={{ date: today, note: "", amount: null }}
          submitLabel="Add"
          clearAfterSubmit
          onSubmit={handleAddLog}
        />
      </section>

      <section className="mt-8">
        {logs.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-border px-6 py-10 text-center text-[15px] text-secondary">
            Nothing logged in {formatMonthName(view.month)} {view.year}.
          </div>
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-[18px] border border-border bg-surface shadow-card">
            {logs.map((log) => (
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
      </section>
    </div>
  );
}