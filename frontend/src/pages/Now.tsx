import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createTimeTravelEntry } from "../api/now.api";
import AutoGrowTextarea from "../components/AutoGrowTextarea";
import ImmersiveGalaxy from "../components/ImmersiveGalaxy";
import { getJournalToday } from "../config/dates";

const THOUGHT_LIMIT = 2000;


type Phase = "entering" | "ready" | "running" | "stopped";

// waiting: not yet invited. invited: the marker is showing. writing: the field is open.
// noted: saved (brief acknowledgement). closed: finished or dismissed, never returns this session.
type Reflection = "waiting" | "invited" | "writing" | "noted" | "closed";

const pad = (n: number) => String(n).padStart(2, "0");

function formatElapsed(ms: number): { main: string; cs: string } {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return {
    main: hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`,
    cs: pad(Math.floor((ms % 1000) / 10)),
  };
}

const pillButton =
  "inline-flex h-11 min-w-[112px] items-center justify-center rounded-full border border-white/15 bg-white/10 px-7 text-[13px] font-medium tracking-[0.04em] text-white backdrop-blur-xl transition-colors duration-200 hover:bg-white/15 active:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70";

export default function Now() {
  const navigate = useNavigate();
  const reducedMotion = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;

  const [shown, setShown] = useState(false);
  const [phase, setPhase] = useState<Phase>("entering");
  const [reflection, setReflection] = useState<Reflection>("waiting");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stoppedLabel, setStoppedLabel] = useState("");

  const startRef = useRef(0);
  const rafRef = useRef(0);
  const leavingRef = useRef(false);
  const digitsRef = useRef<HTMLSpanElement>(null);
  const csRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);

  // Galaxy fades in on mount; the stopwatch and marker are offered once it has had time to appear.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    const timer = window.setTimeout(() => setPhase("ready"), reducedMotion ? 500 : 2200);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [reducedMotion]);

  function paint(ms: number) {
    const { main, cs } = formatElapsed(ms);
    if (digitsRef.current) digitsRef.current.textContent = main;
    if (csRef.current) csRef.current.textContent = cs;
    if (dotRef.current) dotRef.current.style.left = `${((ms % 60000) / 60000) * 100}%`;
  }

  // The stopwatch. Elapsed time is always (now - start) from the monotonic clock, so a late frame or a
  // throttled background tab can never cause drift. Text is written straight to the DOM, not through state.
  useEffect(() => {
    if (phase !== "running") return;
    startRef.current = performance.now();
    const tick = () => {
      paint(performance.now() - startRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  // The reflection marker is invited a moment after the galaxy is visible, independent of the stopwatch.
  const entered = phase !== "entering";
  useEffect(() => {
    if (!entered) return;
    const invite = window.setTimeout(
      () => setReflection((current) => (current === "waiting" ? "invited" : current)),
      reducedMotion ? 600 : 2200,
    );
    return () => window.clearTimeout(invite);
  }, [entered, reducedMotion]);

  useEffect(() => {
    if (phase === "stopped") exitRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (reflection !== "noted") return;
    const timer = window.setTimeout(() => setReflection("closed"), 2200);
    return () => window.clearTimeout(timer);
  }, [reflection]);

  function start() {
    if (phase !== "ready") return;
    setPhase("running");
  }

  function stop() {
    if (phase !== "running") return;
    const elapsed = performance.now() - startRef.current;
    cancelAnimationFrame(rafRef.current);
    paint(elapsed);
    const { main, cs } = formatElapsed(elapsed);
    setStoppedLabel(`${main}.${cs}`);
    setPhase("stopped");
  }

  async function commitThought() {
    const text = draft.trim();
    if (!text) {
      setReflection("closed");
      return;
    }
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await createTimeTravelEntry(getJournalToday(), text);
      setDraft("");
      setReflection("noted");
    } catch {
      setError("Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function dismissReflection() {
    setDraft("");
    setError(null);
    setReflection("closed");
  }

  function onReflectionKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      dismissReflection();
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void commitThought();
    }
  }

  async function exit() {
    if (leavingRef.current) return;
    leavingRef.current = true;
    // Don't lose a thought that was typed but never submitted.
    const text = draft.trim();
    if (reflection === "writing" && text) {
      try {
        await createTimeTravelEntry(getJournalToday(), text);
      } catch {
        // Quiet: leaving should never be blocked.
      }
    }
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/");
  }

  const ready = phase !== "entering";
  const slow = "duration-[1400ms] ease-out motion-reduce:duration-300 motion-reduce:transform-none";

  return (
    // Sized by AppShell's content area. No fixed positioning, no portal, no viewport units.
    <div className="relative isolate h-full min-h-0 w-full overflow-hidden text-white">
      {/* Environment: black and galaxy arrive together as one cross-fade over the app's own background. */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-black transition-[opacity,transform] duration-[2200ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transform-none motion-reduce:duration-500 ${
          shown ? "scale-100 opacity-100" : "scale-[1.04] opacity-0"
        }`}
      >
        <ImmersiveGalaxy reducedMotion={reducedMotion} />
      </div>

      {/* Reflection marker. Appears only after the galaxy is visible and the stopwatch is live. */}
      <div
        onKeyDown={onReflectionKeyDown}
        className="absolute left-1/2 top-[16%] z-20 flex w-[min(440px,calc(100%-3rem))] -translate-x-1/2 flex-col items-center text-center [text-shadow:0_1px_14px_rgba(0,0,0,0.7)]"
      >
        {reflection === "invited" && (
          <button
            key="invited"
            type="button"
            onClick={() => setReflection("writing")}
            className="page-in group flex items-center gap-3.5 rounded-full px-4 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inset-0 rounded-full bg-white shadow-[0_0_12px_2px_rgba(180,205,255,0.55)]" />
              <span className="absolute -inset-1.5 animate-ping rounded-full border border-white/30 opacity-60 [animation-duration:3.2s] motion-reduce:animate-none" />
            </span>
            <span className="text-[15px] tracking-[0.01em] text-white/70 transition-colors duration-200 group-hover:text-white">
              What are you thinking?
            </span>
          </button>
        )}

        {reflection === "writing" && (
          <div key="writing" className="page-in w-full">
            <AutoGrowTextarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="What are you thinking?"
              maxLength={THOUGHT_LIMIT}
              autoFocus
              className="min-h-[56px] w-full border-b border-white/25 bg-transparent px-0 py-2 text-center font-serif text-[1.25rem] leading-relaxed text-white outline-none transition-colors duration-200 placeholder:text-white/40 focus:border-white/60"
            />
            {error && <p className="mt-3 text-[13px] text-alert">{error}</p>}
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={dismissReflection}
                className="h-9 rounded-full px-4 text-[13px] text-white/50 transition-colors duration-200 hover:text-white"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => void commitThought()}
                disabled={saving}
                className="h-9 rounded-full px-4 text-[13px] font-medium text-white transition-opacity duration-200 hover:opacity-80 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Done"}
              </button>
            </div>
          </div>
        )}

        {reflection === "noted" && (
          <p key="noted" className="page-in text-[13px] tracking-[0.04em] text-white/60">
            Noted.
          </p>
        )}
      </div>

      {/* Instrument. Centred in the content area; on phones it clears the floating bottom bar. */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 pb-[calc(var(--bottom-nav-space,0px)+env(safe-area-inset-bottom))] lg:pb-0">
        <div
          role="timer"
          aria-label="Session stopwatch"
          className={`flex flex-col items-center transition-[opacity,transform] ${slow} ${
            ready ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          }`}
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-white/40">Time here</p>

          <p
            aria-hidden="true"
            className={`mt-5 flex items-baseline text-[clamp(4.25rem,13vw,7rem)] font-extralight leading-none tracking-[-0.025em] tabular-nums transition-colors duration-700 [text-shadow:0_0_48px_rgba(150,180,255,0.22)] ${
              phase === "stopped" ? "text-white/75" : "text-white/95"
            }`}
          >
            <span ref={digitsRef}>00:00</span>
            <span ref={csRef} className="ml-2 inline-block w-[1.9em] text-left text-[0.32em] tracking-normal text-white/40">
              00
            </span>
          </p>

          {/* A once-a-minute sweep: a single point of light travelling a hairline. */}
          <div aria-hidden="true" className="relative mt-8 h-px w-[min(220px,56vw)] bg-white/10">
            <span
              ref={dotRef}
              className={`absolute left-0 top-1/2 h-[3px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_2px_rgba(170,200,255,0.6)] transition-opacity duration-700 ${
                phase === "running" ? "opacity-100" : "opacity-0"
              }`}
            />
          </div>
        </div>

        <div
          className={`mt-10 h-11 transition-opacity delay-500 ${slow} ${ready ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          {phase === "stopped" ? (
            <button key="exit" ref={exitRef} type="button" onClick={() => void exit()} className={`${pillButton} page-in`}>
              Exit
            </button>
          ) : phase === "running" ? (
            <button key="stop" type="button" onClick={stop} aria-label="Stop stopwatch" className={pillButton}>
              Stop
            </button>
          ) : (
            <button
              key="start"
              type="button"
              onClick={start}
              disabled={!ready}
              aria-label="Start stopwatch"
              className={pillButton}
            >
              Start
            </button>
          )}
        </div>
      </div>

      {/* Quiet way into the archive. Top corner so it never collides with the bottom bar. */}
      <Link
        to="/now/archive"
        className={`absolute right-3 top-3 z-20 inline-flex h-9 items-center rounded-full px-3.5 text-[12px] tracking-[0.04em] text-white/40 transition-[opacity,color] duration-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 ${
          ready ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        Past thoughts
      </Link>

      <p className="sr-only" role="status">
        {phase === "stopped" ? `Stopped. Time here: ${stoppedLabel}` : ""}
      </p>
    </div>
  );
}