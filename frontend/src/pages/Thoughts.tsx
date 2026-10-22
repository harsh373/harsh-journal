import { Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { createThought, fetchThoughts } from "../api/thoughts.api";
import type { ThoughtSummary } from "../api/thoughts.api";
import ImmersiveGalaxy from "../components/ImmersiveGalaxy";
import "./thoughts.css";

type LoadState = "loading" | "ready" | "error";

const TINTS = ["255,255,255", "190,208,255", "255,226,190"] as const;
const TILT = -0.35; // matches the tilt of the band in the background sky
const MIN_GAP = 26;
const EDGE = 16;

interface Placed {
  id: string;
  title: string;
  x: number;
  y: number;
  size: number;
  rgb: string;
  delay: number;
  twinkle: number;
  twinkleDelay: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Same id, same sequence of numbers: a thought's star never changes character between visits.
function rngFor(id: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Every thought gets a home on a two-armed spiral, decided by its id alone. A few drift out
// into the halo. Stars that land too close are eased apart, so a new thought nudges its
// neighbours gently instead of reshuffling the sky.
function layoutStars(items: ThoughtSummary[], w: number, h: number): Placed[] {
  if (w < 1 || h < 1) return [];

  const flat = w < h ? 0.78 : 0.58;
  const cos = Math.cos(TILT);
  const sin = Math.sin(TILT);
  const halfW = Math.hypot(cos, flat * sin);
  const halfH = Math.hypot(sin, flat * cos);
  const radius = Math.max(80, Math.min((w / 2 - EDGE) / halfW, (h / 2 - EDGE) / halfH));
  const cx = w / 2;
  const cy = h / 2;

  const placed: Placed[] = items.map((item, index) => {
    const rand = rngFor(item.id);
    const a = rand();
    const b = rand();
    const c = rand();
    const d = rand();
    const e = rand();
    const f = rand();

    const halo = e > 0.88;
    const rho = Math.sqrt(a) * 0.92 + 0.06;
    const arm = c < 0.5 ? 0 : Math.PI;
    const angle = halo ? d * Math.PI * 2 : arm + rho * 3.4 + (d - 0.5) * 0.9;

    const ux = rho * Math.cos(angle);
    const uy = rho * Math.sin(angle) * flat;

    return {
      id: item.id,
      title: item.title,
      x: cx + (ux * cos - uy * sin) * radius,
      y: cy + (ux * sin + uy * cos) * radius,
      size: 6.5 + b * 4.5,
      rgb: TINTS[f < 0.68 ? 0 : f < 0.86 ? 1 : 2],
      delay: Math.min(index * 0.018, 1.2) + 0.5,
      twinkle: 3 + e * 3.5,
      twinkleDelay: -d * 4,
    };
  });

  if (placed.length <= 900) {
    for (let pass = 0; pass < 6; pass++) {
      let touched = false;
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const p = placed[i];
          const q = placed[j];
          if (!p || !q) continue;
          let dx = q.x - p.x;
          let dy = q.y - p.y;
          let dist = Math.hypot(dx, dy);
          if (dist >= MIN_GAP) continue;
          touched = true;
          if (dist < 0.01) {
            dx = i % 2 === 0 ? 1 : -1;
            dy = 0.5;
            dist = Math.hypot(dx, dy);
          }
          const push = (MIN_GAP - dist) / 2;
          p.x -= (dx / dist) * push;
          p.y -= (dy / dist) * push;
          q.x += (dx / dist) * push;
          q.y += (dy / dist) * push;
        }
      }
      for (const star of placed) {
        star.x = clamp(star.x, EDGE, Math.max(EDGE, w - EDGE));
        star.y = clamp(star.y, EDGE, Math.max(EDGE, h - EDGE));
      }
      if (!touched) break;
    }
  }

  return placed;
}

export default function Thoughts() {
  const navigate = useNavigate();
  const reduced = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  ).current;

  const fieldRef = useRef<HTMLDivElement>(null);
  const lastPointer = useRef("mouse");
  const loadToken = useRef(0);
  const noticeTimer = useRef<number | undefined>(undefined);

  const [items, setItems] = useState<ThoughtSummary[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [taught, setTaught] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    const token = ++loadToken.current;
    setState("loading");
    fetchThoughts()
      .then((list) => {
        if (token !== loadToken.current) return;
        setItems(list);
        setState("ready");
      })
      .catch(() => {
        if (token === loadToken.current) setState("error");
      });
  }, []);

  useEffect(() => {
    load();
    return () => window.clearTimeout(noticeTimer.current);
  }, [load]);

  // The sky is sized by the space it is given inside the app, never by the window.
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setBox({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (panelOpen) {
        setPanelOpen(false);
        setQuery("");
      } else if (selectedId) {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, selectedId]);

  const flash = useCallback((text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4200);
  }, []);

  const placed = useMemo(() => layoutStars(items, box.w, box.h), [items, box.w, box.h]);

  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () => (needle ? items.filter((item) => (item.title || "untitled").toLowerCase().includes(needle)) : items),
    [items, needle],
  );
  const matchIds = useMemo(() => (needle ? new Set(matches.map((item) => item.id)) : null), [matches, needle]);

  function open(id: string) {
    navigate(`/thoughts/${id}`);
  }

  async function startNew() {
    if (creating) return;
    setCreating(true);
    try {
      const thought = await createThought();
      navigate(`/thoughts/${thought.id}`, { state: { fresh: true } });
    } catch {
      flash("Couldn't start a new thought. Try again.");
      setCreating(false);
    }
  }

  // With a mouse, a star opens on click and shows its name on hover. On a phone there is no hover,
  // so the first tap names the star and the second (or a tap on the name) opens it.
  function onStarClick(id: string) {
    setTaught(true);
    if (lastPointer.current === "touch" && selectedId !== id) {
      setSelectedId(id);
      return;
    }
    open(id);
  }

  function onStarKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    lastPointer.current = "keyboard";
    if (event.key === "Escape") setSelectedId(null);
  }

  const activeId = hoverId ?? focusId ?? selectedId;
  const active = activeId ? (placed.find((star) => star.id === activeId) ?? null) : null;
  const labelX = active ? clamp(active.x, 110, Math.max(110, box.w - 110)) : 0;
  const below = active ? active.y < 72 : false;

  const showEmpty = state === "ready" && items.length === 0;
  const teach = state === "ready" && items.length > 0 && !taught && !activeId && !panelOpen;
  const note = notice ?? (teach ? "Each star is a thought." : null);

  return (
    <div
      className={
        "thoughts relative h-full min-h-[calc(100dvh-3.75rem)] overflow-hidden bg-black lg:min-h-0" +
        (panelOpen ? " t-panel-open" : "")
      }
    >
      <div className="t-sky" aria-hidden="true">
        <ImmersiveGalaxy reducedMotion={reduced} quiet />
      </div>

      {/* ---- the sky --------------------------------------------------------- */}
      <div
        ref={fieldRef}
        className="t-field"
        role="group"
        aria-label="Your thoughts"
        onPointerDown={(event) => {
          if (!(event.target as HTMLElement).closest(".t-star, .t-label")) setSelectedId(null);
        }}
      >
        {state === "ready" &&
          placed.map((star) => {
            const dim = matchIds !== null && !matchIds.has(star.id);
            return (
              <button
                key={star.id}
                type="button"
                className={"t-star" + (star.id === activeId ? " is-active" : "") + (dim ? " is-dim" : "")}
                aria-label={star.title || "Untitled"}
                tabIndex={dim ? -1 : 0}
                style={
                  {
                    "--x": `${star.x.toFixed(1)}px`,
                    "--y": `${star.y.toFixed(1)}px`,
                    "--s": `${star.size.toFixed(1)}px`,
                    "--rgb": star.rgb,
                    "--delay": `${star.delay.toFixed(2)}s`,
                    "--tw": `${star.twinkle.toFixed(1)}s`,
                    "--td": `${star.twinkleDelay.toFixed(1)}s`,
                    "--bob": `${(6 + star.twinkle).toFixed(1)}s`,
                    "--bd": `${star.twinkleDelay.toFixed(1)}s`,
                  } as CSSProperties
                }
                onPointerDown={(event) => {
                  lastPointer.current = event.pointerType;
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") setHoverId(star.id);
                }}
                onPointerLeave={() => setHoverId((current) => (current === star.id ? null : current))}
                onFocus={(event) => {
                  if (event.currentTarget.matches(":focus-visible")) setFocusId(star.id);
                }}
                onBlur={() => setFocusId((current) => (current === star.id ? null : current))}
                onKeyDown={onStarKeyDown}
                onClick={() => onStarClick(star.id)}
              >
                <span className="t-drift" aria-hidden="true">
                  <span className="t-core" />
                </span>
              </button>
            );
          })}

        {active && (
          <button
            key={active.id}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            data-below={below || undefined}
            onClick={() => open(active.id)}
            className={"t-label" + (selectedId === active.id ? " is-tappable" : "")}
            style={{ left: labelX, top: active.y }}
          >
            {active.title || "Untitled"}
          </button>
        )}

        {state === "loading" && (
          <div className="t-overlay">
            <p className="t-pulse">Finding your stars…</p>
          </div>
        )}

        {state === "error" && (
          <div className="t-overlay">
            <p className="t-title">Your thoughts didn&apos;t load.</p>
            <button type="button" className="t-btn t-btn--primary mt-4" onClick={load}>
              Try again
            </button>
          </div>
        )}

        {showEmpty && (
          <div className="t-overlay">
            <p className="t-title">Your sky is empty.</p>
            <p className="t-sub">Every thought you write becomes a star.</p>
            <button
              type="button"
              className="t-btn t-btn--primary mt-5"
              disabled={creating}
              onClick={() => void startNew()}
            >
              <Plus size={15} strokeWidth={2} aria-hidden="true" />
              Write the first one
            </button>
          </div>
        )}
      </div>

      {/* ---- header ---------------------------------------------------------- */}
      <header className="t-header pointer-events-none absolute inset-x-0 top-0 z-20 px-5 pt-4 sm:px-8 lg:px-10 lg:pt-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="pointer-events-auto text-[14px] font-semibold tracking-tight">My Thoughts</h1>
          {state === "ready" && items.length > 0 && (
            <button
              type="button"
              aria-label={panelOpen ? "Close search" : "Search thoughts"}
              aria-expanded={panelOpen}
              onClick={() => {
                setPanelOpen((value) => !value);
                setQuery("");
                setSelectedId(null);
              }}
              className="t-hoverable pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full text-[var(--t-text-2)]"
            >
              <Search size={17} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </header>

      {note && (
        <p key={note} className="t-note" role="status">
          {note}
        </p>
      )}

      {/* ---- dock ------------------------------------------------------------ */}
      {state === "ready" && items.length > 0 && (
        <div className="t-dock">
          <button type="button" className="t-btn" disabled={creating} onClick={() => void startNew()}>
            <Plus size={15} strokeWidth={2} aria-hidden="true" />
            {creating ? "Opening…" : "New thought"}
          </button>
        </div>
      )}

      {/* ---- search and list: the way to find one thought among many ------------------- */}
      {panelOpen && (
        <div className="t-panel" role="dialog" aria-label="Search thoughts">
          <div className="t-input">
            <Search size={15} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[var(--t-text-3)]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                const first = matches[0];
                if (event.key === "Enter" && first) open(first.id);
              }}
              placeholder="Search your thoughts"
              aria-label="Search your thoughts"
            />
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                setPanelOpen(false);
                setQuery("");
              }}
              className="t-hoverable flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--t-text-2)]"
            >
              <X size={15} strokeWidth={1.9} />
            </button>
          </div>

          <div className="t-list">
            {matches.length === 0 ? (
              <p className="px-3 py-3 text-[13px] text-[var(--t-text-3)]">No thought matches that.</p>
            ) : (
              <ul>
                {matches.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="t-row" onClick={() => open(item.id)}>
                      {item.title || <span className="text-[var(--t-text-3)]">Untitled</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}