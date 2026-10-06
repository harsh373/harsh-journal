import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Link } from "react-router-dom";

/* ------------------------------------------------------------------ */
/* Styles (scoped by the "wake-" prefix)                               */
/* ------------------------------------------------------------------ */
const CSS = `
.wake-root {
  --pad: clamp(12px, 3vw, 40px);
  position: relative;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--pad);
  overflow-x: hidden;
  background: #d9d6d1;
  color: #111113;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter,
    system-ui, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

@keyframes wake-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes wake-rise {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes wake-window-in {
  from { opacity: 0; transform: scale(0.985); }
  to { opacity: 1; transform: scale(1); }
}

.wake-rise {
  opacity: 0;
  animation: wake-rise 1.2s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: var(--d, 0s);
}

.wake-bg {
  position: fixed;
  inset: 0;
  overflow: hidden;
  animation: wake-fade 1.6s ease both;
}
.wake-sky {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, #c9cdd1 0%, #e4e0d9 45%, #f1e2cc 68%, #ead7c0 100%);
}
.wake-sun {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 70% 64%,
    rgba(255, 214, 170, 0.9) 0,
    rgba(255, 214, 170, 0.35) 18%,
    transparent 46%
  );
}
.wake-mountains { position: absolute; inset: 0; width: 100%; height: 100%; }

.wake-window {
  position: relative;
  z-index: 1;
  width: min(100%, 76rem);
  min-height: calc(100dvh - 2 * var(--pad));
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.55);
  background: rgba(250, 248, 244, 0.62);
  -webkit-backdrop-filter: blur(28px) saturate(1.3);
  backdrop-filter: blur(28px) saturate(1.3);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.6) inset,
    0 30px 80px -20px rgba(40, 30, 20, 0.28),
    0 2px 8px rgba(40, 30, 20, 0.08);
  animation: wake-window-in 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
}
.wake-titlebar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 20px 0;
}
.wake-lights { display: flex; gap: 8px; padding-top: 4px; }
.wake-light {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.18);
}
.wake-light-red { background: #ff5f57; }
.wake-light-yellow { background: #febc2e; }
.wake-light-green { background: #28c840; }

.wake-clock {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
}
.wake-clock-time { font-size: 12px; font-weight: 500; color: #3a3a3c; }
.wake-clock-date { font-size: 11px; color: #6e6e73; }

.wake-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 clamp(20px, 4vw, 56px) clamp(24px, 4vw, 44px);
}

.wake-hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: clamp(24px, 4vh, 48px);
  transition: opacity 0.6s ease, transform 0.6s ease, filter 0.6s ease;
}
.wake-leave { opacity: 0; transform: translateY(-8px); filter: blur(6px); }
.wake-hero-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding-top: clamp(8px, 3vh, 32px);
}
.wake-eyebrow {
  margin: 0 0 clamp(14px, 2.4vh, 28px);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.32em;
  color: #6e6e73;
}
.wake-headline {
  margin: 0;
  font-family: "New York", "Iowan Old Style", "Palatino Linotype", Charter, Georgia, "Times New Roman", serif;
  font-weight: 600;
  font-size: clamp(1.75rem, 9.2vw, 8.5rem);
  line-height: 0.95;
  letter-spacing: -0.025em;
  color: #0c0c0e;
}
.wake-tagline {
  margin: clamp(16px, 3vh, 36px) 0 0;
  font-size: clamp(0.8rem, 1.5vw, 1.05rem);
  font-weight: 500;
  letter-spacing: 0.28em;
  color: #1d1d1f;
}
.wake-support {
  margin-top: clamp(14px, 2.4vh, 28px);
  font-size: 13px;
  line-height: 1.7;
  color: #6e6e73;
}
.wake-support p { margin: 0; }

.wake-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
@media (min-width: 640px) { .wake-cards { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .wake-cards { grid-template-columns: repeat(4, 1fr); gap: 14px; } }

.wake-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  background: rgba(255, 255, 255, 0.28);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), background 0.5s ease, box-shadow 0.5s ease;
}
.wake-card:hover {
  transform: translateY(-3px);
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 0 10px 28px -12px rgba(40, 30, 20, 0.2);
}
@media (min-width: 1024px) {
  .wake-card { flex-direction: column; align-items: flex-start; gap: 22px; padding: 22px 22px 24px; }
}
.wake-card-icon { width: 22px; height: 22px; flex: none; color: #6e6e73; }
.wake-card-title { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: 0.2em; color: #1d1d1f; }
.wake-card-line { margin: 4px 0 0; font-size: 13px; color: #6e6e73; }

.wake-footer { display: flex; justify-content: center; }
.wake-awake {
  appearance: none;
  border: 0;
  cursor: pointer;
  padding: 13px 30px;
  border-radius: 999px;
  background: #111113;
  color: #fafaf8;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.24em;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s;
}
.wake-awake:hover { transform: translateY(-1px); background: #000; }
.wake-awake:focus-visible,
.wake-start:focus-visible { outline: 2px solid #111113; outline-offset: 4px; }

.wake-complete {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(28px, 6vh, 56px);
  text-align: center;
}
.wake-complete-title {
  margin: 0;
  outline: none;
  font-family: "New York", "Iowan Old Style", "Palatino Linotype", Charter, Georgia, "Times New Roman", serif;
  font-weight: 600;
  font-size: clamp(1.75rem, 7.2vw, 6.5rem);
  line-height: 1;
  letter-spacing: -0.02em;
  color: #0c0c0e;
}
.wake-start {
  display: inline-block;
  padding: 13px 30px;
  border-radius: 999px;
  background: #111113;
  color: #fafaf8;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.24em;
  text-decoration: none;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.wake-start:hover { transform: translateY(-1px); }

@media (prefers-reduced-motion: reduce) {
  .wake-rise, .wake-bg, .wake-window { animation: none; opacity: 1; transform: none; }
  .wake-card, .wake-hero, .wake-awake, .wake-start { transition: none; }
}
`;

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */
type IconName = "sunrise" | "arrow" | "layers" | "check";

const ICONS: Record<IconName, ReactElement> = {
  sunrise: (
    <>
      <path d="M3 18h18" />
      <path d="M6.5 18a5.5 5.5 0 0 1 11 0" />
      <path d="M12 6V3.5" />
      <path d="M4.9 9.9 3.5 8.5M19.1 9.9l1.4-1.4" />
    </>
  ),
  arrow: (
    <>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.8 2.8L16 9.7" />
    </>
  ),
};

const CARDS: { title: string; line: string; icon: IconName }[] = [
  { title: "WAKE UP", line: "You showed up.", icon: "sunrise" },
  { title: "TAKE ACTION", line: "Discipline today.", icon: "arrow" },
  { title: "BUILD YOURSELF", line: "Better than yesterday.", icon: "layers" },
  { title: "MAKE IT COUNT", line: "You can do this.", icon: "check" },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
// Sets the animation delay for an element through a CSS variable.
const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

// Builds "05:42 AM" and "Tuesday · October 6" from a Date.
function formatNow(now: Date) {
  const time = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const month = now.toLocaleDateString("en-US", { month: "long" });
  return { time, date: `${weekday} · ${month} ${now.getDate()}` };
}

type Phase = "idle" | "leaving" | "done";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function WakePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [clock, setClock] = useState(() => formatNow(new Date()));
  const timer = useRef<number | undefined>(undefined);
  const completeHeading = useRef<HTMLHeadingElement>(null);

  // Tab title + cleanup of the pending timeout.
  useEffect(() => {
    const previous = document.title;
    document.title = "Good morning";
    return () => {
      document.title = previous;
      window.clearTimeout(timer.current);
    };
  }, []);

  // Live clock. React only re-renders when the displayed text changes.
  useEffect(() => {
    const id = window.setInterval(() => setClock(formatNow(new Date())), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Move focus to the final message for keyboard / screen-reader users.
  useEffect(() => {
    if (phase === "done") completeHeading.current?.focus();
  }, [phase]);

  const handleAwake = () => {
    setPhase("leaving");
    timer.current = window.setTimeout(() => setPhase("done"), 700);
  };

  return (
    <main className="wake-root">
      <style>{CSS}</style>

      {/* Background: sunrise glow, mountains, a solitary figure */}
      <div className="wake-bg" aria-hidden="true">
        <div className="wake-sky" />
        <div className="wake-sun" />
        <svg className="wake-mountains" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
          <path
            d="M0 620 L180 540 L330 600 L520 480 L700 580 L880 500 L1060 590 L1250 470 L1430 570 L1600 520 V900 H0Z"
            fill="rgba(120,124,132,0.35)"
          />
          <path
            d="M0 700 L220 610 L400 690 L640 570 L860 680 L1100 600 L1330 700 L1600 630 V900 H0Z"
            fill="rgba(86,90,98,0.55)"
          />
          <path
            d="M0 790 L280 740 L560 800 L840 750 L1080 720 L1330 780 L1600 750 V900 H0Z"
            fill="#2a2c31"
            fillOpacity="0.9"
          />
          <g transform="translate(1080 720)" fill="#15161a">
            <circle cx="0" cy="-20" r="3.6" />
            <path d="M-3.5 -15.5 H3.5 L4.5 -6 L3 -6 L2.5 0 H-2.5 L-3 -6 L-4.5 -6 Z" />
          </g>
        </svg>
      </div>

      {/* macOS-style window */}
      <div className="wake-window">
        <div className="wake-titlebar">
          <div className="wake-lights" aria-hidden="true">
            <span className="wake-light wake-light-red" />
            <span className="wake-light wake-light-yellow" />
            <span className="wake-light wake-light-green" />
          </div>
          <div className="wake-clock">
            <time className="wake-clock-time">{clock.time}</time>
            <span className="wake-clock-date">{clock.date}</span>
          </div>
        </div>

        <div className="wake-body">
          {phase === "done" ? (
            <section className="wake-complete">
              <h1
                ref={completeHeading}
                tabIndex={-1}
                className="wake-complete-title wake-rise"
              >
                GOOD.
                <br />
                NOW DON'T WASTE
                <br />
                THE MORNING.
              </h1>
              <Link to="/" className="wake-start wake-rise" style={delay(0.6)}>
                START YOUR DAY →
              </Link>
            </section>
          ) : (
            <section className={`wake-hero ${phase === "leaving" ? "wake-leave" : ""}`}>
              <div className="wake-hero-main">
                <p className="wake-eyebrow wake-rise" style={delay(0.7)}>
                  GOOD MORNING
                </p>
                <h1 className="wake-headline wake-rise" style={delay(1)}>
                  YOU ARE
                  <br />
                  THE GREATEST
                </h1>
                <p className="wake-tagline wake-rise" style={delay(1.3)}>
                  TODAY IS YOUR DAY.
                </p>
                <div className="wake-support wake-rise" style={delay(1.7)}>
                  <p>You are awake. Now act like it.</p>
                  <p>No tomorrow. No yesterday. Just today.</p>
                </div>
              </div>

              <ul className="wake-cards">
                {CARDS.map((card, i) => (
                  <li key={card.title} className="wake-card wake-rise" style={delay(2 + i * 0.15)}>
                    <svg
                      className="wake-card-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {ICONS[card.icon]}
                    </svg>
                    <div>
                      <h2 className="wake-card-title">{card.title}</h2>
                      <p className="wake-card-line">{card.line}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="wake-footer wake-rise" style={delay(2.8)}>
                <button
                  type="button"
                  className="wake-awake"
                  onClick={handleAwake}
                  disabled={phase === "leaving"}
                >
                  I'M AWAKE
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}