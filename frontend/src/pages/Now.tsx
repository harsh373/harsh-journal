import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  attachPresentState,
  createTimeTravelEntry,
  fetchRecentEscapes,
  fetchTodayEscapeCount,
} from "../api/now.api";
import type { RecentDay, TimeTravelEntry } from "../api/now.api";
import AutoGrowTextarea from "../components/AutoGrowTextarea";
import GalaxyBackground from "../components/GalaxyBackground";
import { getJournalToday, parseDayKey } from "../config/dates";
import { pickFutureQuote } from "../config/futureQuotes";

const THOUGHT_LIMIT = 2000;
const PRESENT_LIMIT = 1000;

type Screen = "present" | "traveling" | "future";

const recentLabelFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// Deliberately US month-first, deliberately uppercase: "OCT 8", not "8 October".
// A one-off for this page's own quiet history list, not the app's usual date style.
function formatRecentLabel(dayKey: string): string {
  const parts = parseDayKey(dayKey);
  if (!parts) return dayKey;
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return recentLabelFormat.format(date).toUpperCase();
}

const pillButton =
  "inline-flex h-11 items-center rounded-full px-8 text-[13px] font-medium uppercase tracking-[0.06em] transition-opacity duration-150";

export default function Now() {
  const today = getJournalToday();

  const [screen, setScreen] = useState<Screen>("present");
  const [justReturned, setJustReturned] = useState(false);
  const [presentDraft, setPresentDraft] = useState("");
  const [travelDraft, setTravelDraft] = useState("");
  const [activeEntry, setActiveEntry] = useState<TimeTravelEntry | null>(null);
  const [quote, setQuote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statsLoaded, setStatsLoaded] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [recent, setRecent] = useState<RecentDay[]>([]);

  useEffect(() => {
    Promise.all([fetchTodayEscapeCount(today), fetchRecentEscapes()])
      .then(([count, days]) => {
        setTodayCount(count);
        setRecent(days);
        setStatsLoaded(true);
      })
      .catch(() => {
        // Quiet failure: this is a small supporting stat, not the point of the page.
      });
  }, [today]);

  async function handleStayHere() {
    const text = presentDraft.trim();
    setPresentDraft("");

    if (justReturned && text && activeEntry) {
      try {
        await attachPresentState(activeEntry.id, text);
      } catch {
        // Quiet failure: this field is explicitly secondary per the spec.
      }
    }

    setJustReturned(false);
    setActiveEntry(null);
  }

  function startTimeTravel() {
    setError(null);
    setScreen("traveling");
  }

  function cancelTimeTravel() {
    setTravelDraft("");
    setError(null);
    setScreen("present");
  }

  async function handleEnterFuture() {
    const text = travelDraft.trim();
    if (!text || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      const entry = await createTimeTravelEntry(today, text);
      setActiveEntry(entry);
      setQuote((previous) => pickFutureQuote(previous));
      setTravelDraft("");
      setScreen("future");
      setTodayCount((count) => count + 1);
      setRecent((current) => {
        const existing = current.find((day) => day.date === today);
        if (existing) {
          return current.map((day) => (day.date === today ? { ...day, count: day.count + 1 } : day));
        }
        return [{ date: today, count: 1 }, ...current];
      });
    } catch {
      setError("Couldn't save that. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReturn() {
    setScreen("present");
    setJustReturned(true);
  }

  const showStats = screen === "present" && statsLoaded;

  return (
    <div className="mx-auto w-full max-w-[560px] px-6 pb-24 pt-10 lg:pt-16">
      {showStats && (
        <div className="page-in mb-16 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-tertiary">Today</p>
          <p className="mt-1 text-5xl font-light tracking-tight text-text">{todayCount}</p>
          <p className="mt-0.5 text-[12px] text-tertiary">
            {todayCount === 1 ? "future escape" : "future escapes"}
          </p>
        </div>
      )}

      {screen === "present" && (
        <div key="present" className="page-in text-center">
          <h1 className="text-[34px] font-light tracking-tight text-text sm:text-[40px]">
            {justReturned ? "WELCOME BACK." : "YOU ARE HERE."}
          </h1>
          {justReturned && <p className="mt-2 text-[15px] text-secondary">You are here.</p>}
          <p className="mt-4 text-[15px] text-tertiary">What are you doing right now?</p>

          <div className="mx-auto mt-10 max-w-[440px] text-left">
            <AutoGrowTextarea
              value={presentDraft}
              onChange={(event) => setPresentDraft(event.target.value)}
              placeholder="Write what is happening right now..."
              maxLength={PRESENT_LIMIT}
              className="min-h-[64px] border-b border-border px-0 py-2 text-[17px] leading-relaxed placeholder:text-tertiary"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleStayHere()}
            className={`${pillButton} mt-10 bg-text text-bg hover:opacity-85 active:opacity-70`}
          >
            Stay Here
          </button>

          {!justReturned && (
            <div className="mt-7">
              <button
                type="button"
                onClick={startTimeTravel}
                className="text-[13px] font-medium uppercase tracking-[0.06em] text-secondary underline-offset-4 transition-colors duration-150 hover:text-text hover:underline"
              >
                Time Travel
              </button>
            </div>
          )}
        </div>
      )}

      {screen === "traveling" && (
        <div key="traveling" className="page-in text-center">
          <h1 className="text-[34px] font-light tracking-tight text-text sm:text-[40px]">WHERE ARE YOU GOING?</h1>
          <p className="mx-auto mt-4 max-w-[360px] text-[15px] leading-relaxed text-secondary">
            You noticed yourself leaving the present. Tell me what you are about to imagine.
          </p>

          <div className="mx-auto mt-10 max-w-[440px] text-left">
            <AutoGrowTextarea
              value={travelDraft}
              onChange={(event) => setTravelDraft(event.target.value)}
              placeholder="What are you imagining?"
              maxLength={THOUGHT_LIMIT}
              autoFocus
              className="min-h-[96px] border-b border-border px-0 py-2 text-[17px] leading-relaxed placeholder:text-tertiary"
            />
          </div>

          {error && <p className="mt-3 text-[13px] text-alert">{error}</p>}

          <button
            type="button"
            onClick={() => void handleEnterFuture()}
            disabled={!travelDraft.trim() || submitting}
            className={`${pillButton} mt-10 bg-text text-bg hover:opacity-85 active:opacity-70 disabled:cursor-not-allowed disabled:opacity-30`}
          >
            {submitting ? "Entering…" : "Enter Future"}
          </button>

          <div className="mt-7">
            <button
              type="button"
              onClick={cancelTimeTravel}
              className="text-[13px] text-tertiary underline-offset-4 transition-colors duration-150 hover:text-text hover:underline"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {screen === "future" &&
        activeEntry &&
        createPortal(
          <div key="future" className="page-in fixed inset-0 z-50 bg-black text-white">
            <GalaxyBackground />
            <div className="absolute inset-0 overflow-y-auto overscroll-contain">
              <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col items-center justify-center px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] text-center [text-shadow:0_1px_14px_rgba(0,0,0,0.65)]">
                <h1 className="text-[34px] font-light tracking-tight sm:text-[40px]">YOU ARE IN THE FUTURE.</h1>

                <p className="mt-10 max-w-[440px] text-left text-[19px] italic leading-relaxed text-white/90">
                  &ldquo;{activeEntry.futureThought}&rdquo;
                </p>

                {quote && <p className="mt-10 max-w-[360px] text-[15px] leading-relaxed text-white/60">{quote}</p>}

                <button
                  type="button"
                  onClick={handleReturn}
                  autoFocus
                  className={`${pillButton} mt-12 border border-white/30 text-white hover:bg-white/10`}
                >
                  Return To Now
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {showStats && recent.length > 0 && (
        <div className="page-in mt-24 border-t border-border pt-6 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-tertiary">Recent</p>
          <ul className="mt-3 space-y-1.5">
            {recent.map((day) => (
              <li key={day.date} className="text-[13px] text-secondary">
                <span className="text-tertiary">{formatRecentLabel(day.date)}</span>
                {"  —  "}
                {day.count} {day.count === 1 ? "future escape" : "future escapes"}
              </li>
            ))}
          </ul>
          <Link
            to="/now/archive"
            className="mt-4 inline-block text-[12px] text-tertiary underline-offset-4 transition-colors duration-150 hover:text-text hover:underline"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}