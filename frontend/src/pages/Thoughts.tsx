import { Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { createThought, fetchThoughts } from "../api/thoughts.api";
import type { ThoughtSummary } from "../api/thoughts.api";
import ImmersiveGalaxy from "../components/ImmersiveGalaxy";
import "./thoughts.css";

type LoadState = "loading" | "ready" | "error";

const TINTS = ["255,255,255", "190,208,255", "255,226,190"] as const;
const TILT = -0.35; // matches the tilt of the band in the background sky
const MIN_GAP = 26;

// How fast the sky drifts on its own, in px per second. Slow enough to read against.
const DRIFT_X = 4.5;
const DRIFT_Y = 1.8;

// A drag has to travel this far before it stops being a click.
const CLICK_SLOP = 5;

// The pannable world is a torus: walk off the right edge and you come back on the left.
// It is only a little larger than the viewport, so the first screen is the main scene —
// the galaxy fills what you see, and panning carries you into the rest of it.
const WORLD_FACTOR = 1.25;
const WORLD_MIN = 480;
const WORLD_MAX = 3000;
const DUPLICATE_MARGIN = 200;

// Flying into a star when you pick it from search.
const FLY_MS = 620;
const FLY_SCALE = 2.8;

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

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Fold a per-session nonce into the id hash. Same id + same nonce = same star,
// new page load = new nonce = new sky.
function mixSeed(a: number, b: number): number {
  let h = (a ^ Math.imul(b | 0, 0x9e3779b9)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function rngFromSeed(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shortest signed distance between two points on a wrapping axis.
function wrapDelta(delta: number, size: number): number {
  if (size <= 0) return delta;
  const half = size / 2;
  return ((((delta + half) % size) + size) % size) - half;
}

function wrapValue(value: number, size: number): number {
  if (size <= 0) return value;
  return ((value % size) + size) % size;
}

// Every thought gets a home on a two-armed spiral, wrapped into a torus. A few drift out
// into the halo. Stars that land too close are eased apart — using wrap-aware distances,
// so the seam of the world is as calm as its middle.
function layoutStars(items: ThoughtSummary[], w: number, h: number, nonce: number): Placed[] {
  if (w < 1 || h < 1) return [];

  const flat = w < h ? 0.78 : 0.58;
  const cos = Math.cos(TILT);
  const sin = Math.sin(TILT);
  const halfW = Math.hypot(cos, flat * sin);
  const halfH = Math.hypot(sin, flat * cos);
  const radius = Math.max(80, Math.min(w / 2 / halfW, h / 2 / halfH) * 0.94);
  const cx = w / 2;
  const cy = h / 2;

  const placed: Placed[] = items.map((item, index) => {
    const rand = rngFromSeed(mixSeed(hashString(item.id), nonce));
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
      x: wrapValue(cx + (ux * cos - uy * sin) * radius, w),
      y: wrapValue(cy + (ux * sin + uy * cos) * radius, h),
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
          let dx = wrapDelta(q.x - p.x, w);
          let dy = wrapDelta(q.y - p.y, h);
          let dist = Math.hypot(dx, dy);
          if (dist >= MIN_GAP) continue;
          touched = true;
          if (dist < 0.01) {
            dx = i % 2 === 0 ? 1 : -1;
            dy = 0.5;
            dist = Math.hypot(dx, dy);
          }
          const push = (MIN_GAP - dist) / 2;
          p.x = wrapValue(p.x - (dx / dist) * push, w);
          p.y = wrapValue(p.y - (dy / dist) * push, h);
          q.x = wrapValue(q.x + (dx / dist) * push, w);
          q.y = wrapValue(q.y + (dy / dist) * push, h);
        }
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

  // A fresh nonce per page load, so the sky is never the same twice.
  const [nonce] = useState(() => (Math.random() * 4294967296) >>> 0);

  const fieldRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const lastPointer = useRef("mouse");
  const loadToken = useRef(0);
  const noticeTimer = useRef<number | undefined>(undefined);

  // Camera lives outside React state: panning never re-renders the star field,
  // it just moves one transformed layer.
  const camRef = useRef({ x: 0, y: 0 });
  const worldSizeRef = useRef({ w: WORLD_MIN, h: WORLD_MIN });
  const centeredRef = useRef(false);
  const draggingRef = useRef(false);
  const pauseRef = useRef(false);
  const flyingRef = useRef(false);
  const suppressClickRef = useRef(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    camX: number;
    camY: number;
    moved: boolean;
  } | null>(null);

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
  const [flying, setFlying] = useState(false);
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
      if (flyingRef.current) return;
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

  // ---- the world --------------------------------------------------------------

  // Only slightly larger than the viewport: the first screen is the galaxy itself,
  // and the torus wrap is what makes the space endless.
  const world = useMemo(() => {
    const vw = Math.max(1, box.w);
    const vh = Math.max(1, box.h);
    const spread = Math.sqrt(Math.max(1, items.length)) * 260;
    return {
      w: Math.round(clamp(Math.max(vw * WORLD_FACTOR, spread), WORLD_MIN, WORLD_MAX)),
      h: Math.round(clamp(Math.max(vh * WORLD_FACTOR, spread), WORLD_MIN, WORLD_MAX)),
    };
  }, [box.w, box.h, items.length]);

  const placed = useMemo(
    () => (box.w < 1 || box.h < 1 ? [] : layoutStars(items, world.w, world.h, nonce)),
    [items, world.w, world.h, nonce, box.w, box.h],
  );

  const syncCam = useCallback(() => {
    const el = worldRef.current;
    if (!el) return;
    const { x, y } = camRef.current;
    el.style.transform = `translate3d(${-x.toFixed(2)}px, ${-y.toFixed(2)}px, 0)`;
  }, []);

  const wrapCam = useCallback(() => {
    const { w, h } = worldSizeRef.current;
    camRef.current.x = wrapValue(camRef.current.x, w);
    camRef.current.y = wrapValue(camRef.current.y, h);
  }, []);

  useLayoutEffect(() => {
    worldSizeRef.current = world;
    if (!centeredRef.current && box.w > 0 && box.h > 0) {
      centeredRef.current = true;
      // Start on the heart of the galaxy: the main scene, not an empty corner of it.
      camRef.current.x = world.w / 2 - box.w / 2;
      camRef.current.y = world.h / 2 - box.h / 2;
    }
    wrapCam();
    syncCam();
  }, [world, box.w, box.h, wrapCam, syncCam]);

  const activeId = hoverId ?? focusId ?? selectedId;
  const active = activeId ? (placed.find((star) => star.id === activeId) ?? null) : null;

  useEffect(() => {
    pauseRef.current = activeId !== null || panelOpen || flying;
  }, [activeId, panelOpen, flying]);

  // A slow, constant drift so the sky is never frozen — paused while you interact.
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      if (draggingRef.current || pauseRef.current || flyingRef.current) return;
      camRef.current.x += DRIFT_X * dt;
      camRef.current.y += DRIFT_Y * dt;
      wrapCam();
      syncCam();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, wrapCam, syncCam]);

  // A star may need to be drawn a world-width to the right / a world-height below, so
  // that walking off one edge brings you back on the other without a visible seam.
  const copiesOf = useCallback(
    (star: Placed) => {
      const list: { key: string; x: number; y: number }[] = [{ key: "", x: star.x, y: star.y }];
      const spanX = star.x < box.w + DUPLICATE_MARGIN;
      const spanY = star.y < box.h + DUPLICATE_MARGIN;
      if (spanX) list.push({ key: "x", x: star.x + world.w, y: star.y });
      if (spanY) list.push({ key: "y", x: star.x, y: star.y + world.h });
      if (spanX && spanY) list.push({ key: "xy", x: star.x + world.w, y: star.y + world.h });
      return list;
    },
    [box.w, box.h, world.w, world.h],
  );

  // ---- search -----------------------------------------------------------------

  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () => (needle ? items.filter((item) => (item.title || "untitled").toLowerCase().includes(needle)) : items),
    [items, needle],
  );
  const matchIds = useMemo(() => (needle ? new Set(matches.map((item) => item.id)) : null), [matches, needle]);

  function open(id: string) {
    navigate(`/thoughts/${id}`);
  }

  // Fly the camera into the chosen star, then open it. The chrome fades out on the way,
  // so for a moment all that is left is the star getting closer.
  const flyTo = useCallback(
    (id: string) => {
      if (flyingRef.current) return;
      const star = placed.find((s) => s.id === id);
      if (!star) {
        open(id);
        return;
      }

      flyingRef.current = true;
      setFlying(true);

      const vw = Math.max(1, box.w);
      const vh = Math.max(1, box.h);
      const { w, h } = worldSizeRef.current;

      // Pick the copy of the star nearest to where the camera is already looking.
      const cam = camRef.current;
      const sx = star.x + Math.round((cam.x + vw / 2 - star.x) / w) * w;
      const sy = star.y + Math.round((cam.y + vh / 2 - star.y) / h) * h;

      const startScreenX = sx - cam.x;
      const startScreenY = sy - cam.y;
      const el = worldRef.current;
      const t0 = performance.now();

      const step = (now: number) => {
        const raw = Math.min(1, (now - t0) / FLY_MS);
        // Smooth in and out: leaves slowly, arrives fast.
        const t = raw * raw * (3 - 2 * raw);
        const scale = 1 + (FLY_SCALE - 1) * t;
        const screenX = startScreenX + (vw / 2 - startScreenX) * t;
        const screenY = startScreenY + (vh / 2 - startScreenY) * t;

        camRef.current.x = sx * scale - screenX;
        camRef.current.y = sy * scale - screenY;
        if (el) {
          el.style.transform =
            `translate3d(${(-camRef.current.x).toFixed(2)}px, ${(-camRef.current.y).toFixed(2)}px, 0)` +
            ` scale(${scale.toFixed(4)})`;
        }

        if (raw < 1) requestAnimationFrame(step);
        else open(id);
      };

      requestAnimationFrame(step);
    },
    [placed, box.w, box.h],
  );

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

  // ---- panning ----------------------------------------------------------------

  function onFieldPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (flyingRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    suppressClickRef.current = false;
    draggingRef.current = true;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      camX: camRef.current.x,
      camY: camRef.current.y,
      moved: false,
    };
    if (!(event.target as HTMLElement).closest(".t-star, .t-label")) setSelectedId(null);
  }

  function onFieldPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < CLICK_SLOP) return;
      drag.moved = true;
      // Capture only once it is really a drag, so ordinary taps still land on the star.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* noop */
      }
      fieldRef.current?.classList.add("is-grabbing");
    }
    camRef.current.x = drag.camX - dx;
    camRef.current.y = drag.camY - dy;
    wrapCam();
    syncCam();
  }

  function onFieldPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    draggingRef.current = false;
    fieldRef.current?.classList.remove("is-grabbing");
    if (drag.moved) suppressClickRef.current = true;
  }

  // With a mouse, a star opens on click and shows its name on hover. On a phone there is no hover,
  // so the first tap names the star and the second (or a tap on the name) opens it.
  function onStarClick(id: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (flyingRef.current) return;
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

  const labelBelow = active ? active.y - camRef.current.y < 90 : false;

  const showEmpty = state === "ready" && items.length === 0;
  const teach = state === "ready" && items.length > 0 && !taught && !activeId && !panelOpen;
  const note = notice ?? (teach ? "Each star is a thought. Drag the sky." : null);

  return (
    <div
      className={
        "thoughts relative h-full min-h-[calc(100dvh-3.75rem)] overflow-hidden bg-black lg:min-h-0" +
        (panelOpen ? " t-panel-open" : "") +
        (flying ? " t-flying" : "")
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
        onPointerDown={onFieldPointerDown}
        onPointerMove={onFieldPointerMove}
        onPointerUp={onFieldPointerUp}
        onPointerCancel={onFieldPointerUp}
      >
        <div
          ref={worldRef}
          className="t-world"
          style={{ width: world.w * 2, height: world.h * 2 }}
        >
          {state === "ready" &&
            placed.map((star) => {
              const dim = matchIds !== null && !matchIds.has(star.id);
              return copiesOf(star).map((copy) => {
                const primary = copy.key === "";
                return (
                  <button
                    key={star.id + copy.key}
                    type="button"
                    className={
                      "t-star" + (star.id === activeId ? " is-active" : "") + (dim ? " is-dim" : "")
                    }
                    aria-label={primary ? star.title || "Untitled" : undefined}
                    aria-hidden={primary ? undefined : true}
                    tabIndex={dim || !primary ? -1 : 0}
                    style={
                      {
                        "--x": `${copy.x.toFixed(1)}px`,
                        "--y": `${copy.y.toFixed(1)}px`,
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
              });
            })}

          {active &&
            copiesOf(active).map((copy) => (
              <button
                key={"label" + copy.key}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                data-below={labelBelow || undefined}
                onClick={() => open(active.id)}
                className={"t-label" + (selectedId === active.id ? " is-tappable" : "")}
                style={{ left: copy.x, top: copy.y }}
              >
                {active.title || "Untitled"}
              </button>
            ))}
        </div>

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
                if (flyingRef.current) return;
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
                if (event.key === "Enter" && first) flyTo(first.id);
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
                    <button type="button" className="t-row" onClick={() => flyTo(item.id)}>
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