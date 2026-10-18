import { ArrowRightLeft, ArrowUp, Check, List, Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { createCircleItem, deleteCircleItem, fetchCircleItems, updateCircleItem } from "../api/circle.api";
import type { CircleItem, CircleName } from "../api/circle.api";
import LineField from "../components/LineField";
import "./circle.css";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEXT_LIMIT = 120;
const INNER = 0.5; // inner ring diameter as a share of the outer ring
const PERSPECTIVE = 1400;
const Z_OUTER = 0;
const Z_INNER = 40;
const Z_CONCERN = 22;
const Z_INFLUENCE = 78;
const Z_DRAG = 120;
const DRAG_THRESHOLD = 6;
const PILL_H = 44;
const GOLDEN = 2.399963;

const RING_LABEL: Record<CircleName, string> = {
  concern: "Circle of Concern",
  influence: "Circle of Influence",
};
const RING_SHORT: Record<CircleName, string> = { concern: "Concern", influence: "Influence" };
const RINGS: readonly CircleName[] = ["concern", "influence"];

function otherRing(ring: CircleName): CircleName {
  return ring === "concern" ? "influence" : "concern";
}

type LoadState = "loading" | "ready" | "error";
type Mode = "none" | "add" | "edit" | "confirm";

interface DragState {
  id: string;
  x: number; // where the pill appears on screen, relative to the centre of the rings
  y: number;
  zone: CircleName | null;
  from: CircleName;
}

interface Gesture {
  id: string;
  pointerId: number;
  sx: number;
  sy: number;
  offX: number;
  offY: number;
  moved: boolean;
  zone: CircleName | null;
  from: CircleName;
}

interface Point {
  x: number;
  y: number;
}

interface Box extends Point {
  id: string;
  w: number;
  h: number;
}

interface Star {
  fx: number;
  fy: number;
  r: number;
  a: number;
  ph: number;
  sp: number;
  vx: number;
  depth: number;
  tint: number;
}

interface Dust {
  fx: number;
  fy: number;
  r: number;
  a: number;
  ph: number;
  vy: number;
  depth: number;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function frac(value: number): number {
  return value - Math.floor(value);
}

function pick<T>(list: readonly T[], index: number, fallback: T): T {
  return list[index] ?? fallback;
}

function byOrder(a: CircleItem, b: CircleItem): number {
  return a.order - b.order || a.id.localeCompare(b.id);
}

function labelWidth(text: string, max: number): number {
  return Math.min(max, Math.max(64, 38 + text.length * 6.4));
}

// Same seed, same sky: stars never jump around when the window resizes.
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TINTS = ["#ffffff", "#c8d6ff", "#ffe8d2"] as const;

function makeStars(w: number, h: number, lite: boolean): Star[] {
  const rand = seeded(7);
  const count = lite ? 90 : Math.round(clamp((w * h) / 5200, 140, 420));
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const layer = i < count * 0.62 ? 0 : i < count * 0.9 ? 1 : 2;
    const depth = pick([0.18, 0.5, 1], layer, 1);
    const r = layer === 0 ? 0.45 + rand() * 0.35 : layer === 1 ? 0.7 + rand() * 0.45 : 1.05 + rand() * 0.7;
    const a = layer === 0 ? 0.35 + rand() * 0.35 : layer === 1 ? 0.5 + rand() * 0.35 : 0.7 + rand() * 0.3;
    stars.push({
      fx: -0.08 + rand() * 1.16,
      fy: -0.08 + rand() * 1.16,
      r,
      a,
      ph: rand() * 6.28,
      sp: 0.6 + rand() * 1.6,
      vx: (0.003 + rand() * 0.004) * depth,
      depth,
      tint: rand() < 0.74 ? 0 : rand() < 0.55 ? 1 : 2,
    });
  }
  return stars;
}

function makeDust(w: number, h: number): Dust[] {
  const rand = seeded(19);
  const count = Math.round(clamp((w * h) / 24000, 10, 34));
  const dust: Dust[] = [];
  for (let i = 0; i < count; i++) {
    dust.push({
      fx: -0.08 + rand() * 1.16,
      fy: -0.08 + rand() * 1.16,
      r: 5 + rand() * 15,
      a: 0.03 + rand() * 0.05,
      ph: rand() * 6.28,
      vy: 0.0006 + rand() * 0.0012,
      depth: 0.6 + rand() * 0.5,
    });
  }
  return dust;
}

function makeGlowSprite(): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = 64;
  sprite.height = 64;
  const ctx = sprite.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.35)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  return sprite;
}

// Places one circle's items inside its zone. The result depends only on the items and the
// size, so the same thoughts always land in the same spots, and a new thought gently
// nudges the others instead of shuffling them.
function layoutRing(items: CircleItem[], ring: CircleName, size: number, maxLabel: number): Record<string, Point> {
  const outer = size / 2;
  const inner = outer * INNER;
  const boxes: Box[] = items.map((item) => ({
    id: item.id,
    w: labelWidth(item.text, maxLabel),
    h: PILL_H,
    x: 0,
    y: 0,
  }));

  // How far from the centre a label may sit, given how far it reaches along that direction.
  const limits = (box: Box, angle: number) => {
    const reach = (box.w / 2) * Math.abs(Math.cos(angle)) + (box.h / 2) * Math.abs(Math.sin(angle));
    if (ring === "influence") return { lo: 0, hi: Math.max(0, inner * 0.9 - reach) };
    const lo = inner * 1.06 + reach;
    const hi = outer * 0.94 - reach;
    if (lo <= hi) return { lo, hi };
    const mid = (lo + hi) / 2;
    return { lo: mid, hi: mid };
  };

  boxes.forEach((box, k) => {
    const angle = k * GOLDEN + (ring === "concern" ? -1.1 : 0.6);
    const { lo, hi } = limits(box, angle);
    const f = ring === "concern" ? frac(k * 0.618 + 0.35) : Math.sqrt(frac(k * 0.618 + 0.2));
    const r = lo + (hi - lo) * f;
    box.x = Math.cos(angle) * r;
    box.y = Math.sin(angle) * r;
  });

  for (let pass = 0; pass < 80; pass++) {
    let touched = false;

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const ox = (a.w + b.w) / 2 + 8 - Math.abs(dx);
        const oy = (a.h + b.h) / 2 + 6 - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        touched = true;
        if (ox < oy) {
          const push = (ox / 2) * (dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx));
          a.x -= push;
          b.x += push;
        } else {
          const push = (oy / 2) * (dy === 0 ? (j % 2 === 0 ? 1 : -1) : Math.sign(dy));
          a.y -= push;
          b.y += push;
        }
      }
    }

    for (const box of boxes) {
      const angle = Math.atan2(box.y, box.x);
      const r = Math.hypot(box.x, box.y);
      const { lo, hi } = limits(box, angle);
      const next = clamp(r, lo, hi);
      box.x = Math.cos(angle) * next;
      box.y = Math.sin(angle) * next;
    }

    if (!touched) break;
  }

  const placed: Record<string, Point> = {};
  for (const box of boxes) placed[box.id] = { x: Math.round(box.x * 10) / 10, y: Math.round(box.y * 10) / 10 };
  return placed;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Circle() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const flatRef = useRef(false);
  const gestureRef = useRef<Gesture | null>(null);
  const loadToken = useRef(0);
  const noticeTimer = useRef<number | undefined>(undefined);
  const receiveTimer = useRef<number | undefined>(undefined);

  const [items, setItems] = useState<CircleItem[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [intro, setIntro] = useState(true);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("none");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [receiving, setReceiving] = useState<CircleName | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [taught, setTaught] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const [draft, setDraft] = useState("");
  const [draftRing, setDraftRing] = useState<CircleName>("concern");
  const [composerKey, setComposerKey] = useState(0);
  const [editText, setEditText] = useState("");

  // --- loading ----------------------------------------------------------------
  const load = useCallback(() => {
    const token = ++loadToken.current;
    setState("loading");
    fetchCircleItems()
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
  }, [load]);

  useEffect(() => {
    if (state !== "ready") return;
    const timer = window.setTimeout(() => setIntro(false), 2600);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    return () => {
      window.clearTimeout(noticeTimer.current);
      window.clearTimeout(receiveTimer.current);
    };
  }, []);

  // --- reduced motion -----------------------------------------------------------
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // --- size of the space the rings may use ------------------------------------------
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

  const size = box.w > 0 ? Math.round(Math.max(260, Math.min(box.w - 12, box.h, 780))) : 0;
  const compact = size < 520;
  const maxLabel = compact ? 104 : 172;

  // --- the universe: stars, dust, parallax, tilt ---------------------------------------
  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sprite = makeGlowSprite();
    const pointer = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let w = 1;
    let h = 1;
    let stars: Star[] = [];
    let dust: Dust[] = [];
    let lite = root.dataset.lite === "true";
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let slowTotal = 0;

    const build = () => {
      stars = makeStars(w, h, lite);
      dust = lite || reduced ? [] : makeDust(w, h);
    };

    const draw = (t: number, dt: number) => {
      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        if (!reduced) {
          s.fx -= s.vx * dt;
          if (s.fx < -0.08) s.fx += 1.16;
        }
        const x = s.fx * w - current.x * s.depth * 28;
        const y = s.fy * h - current.y * s.depth * 20;
        const twinkle = reduced ? 1 : 0.62 + 0.38 * Math.sin(t * s.sp + s.ph);
        ctx.fillStyle = pick(TINTS, s.tint, "#ffffff");
        if (s.r > 1.3) {
          ctx.globalAlpha = s.a * twinkle * 0.35;
          ctx.drawImage(sprite, x - s.r * 4, y - s.r * 4, s.r * 8, s.r * 8);
        }
        ctx.globalAlpha = s.a * twinkle;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, 6.2832);
        ctx.fill();
      }

      for (const d of dust) {
        d.fy -= d.vy * dt;
        if (d.fy < -0.08) d.fy += 1.16;
        const x = d.fx * w - current.x * d.depth * 40;
        const y = d.fy * h - current.y * d.depth * 30;
        ctx.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(t * 0.3 + d.ph));
        ctx.drawImage(sprite, x - d.r, y - d.r, d.r * 2, d.r * 2);
      }

      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      if (reduced) draw(0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();

    if (reduced) {
      if (tiltRef.current) tiltRef.current.style.transform = "";
      return () => observer.disconnect();
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = root.getBoundingClientRect();
      pointer.x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
      pointer.y = clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1);
    };
    const onLeave = () => {
      pointer.x = 0;
      pointer.y = 0;
    };
    const onOrient = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      pointer.x = clamp(event.gamma / 28, -1, 1);
      pointer.y = clamp((event.beta - 50) / 28, -1, 1);
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse) window.addEventListener("deviceorientation", onOrient);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(64, now - last);
      last = now;
      frames++;

      // If the device can't keep up, quietly switch to a lighter sky.
      if (!lite && frames > 30 && frames <= 150) {
        slowTotal += dt;
        if (frames === 150 && slowTotal / 120 > 27) {
          lite = true;
          root.dataset.lite = "true";
          build();
        }
      }

      const t = now / 1000;
      const flat = flatRef.current;
      const k = 1 - Math.exp(-dt / 240);
      const targetX = flat ? 0 : pointer.x + Math.sin(t * 0.21) * 0.2;
      const targetY = flat ? 0 : pointer.y + Math.cos(t * 0.17) * 0.16;
      current.x += (targetX - current.x) * k;
      current.y += (targetY - current.y) * k;

      const tilt = tiltRef.current;
      if (tilt) {
        const float = flat ? 0 : Math.sin(t * 0.5) * 5;
        tilt.style.transform = `translate3d(0, ${float.toFixed(2)}px, 0) rotateX(${(-current.y * 5).toFixed(3)}deg) rotateY(${(current.x * 6.5).toFixed(3)}deg)`;
      }

      draw(t, dt / 1000);
    };

    const start = () => {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) start();
    };

    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("deviceorientation", onOrient);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduced]);

  // --- layout -------------------------------------------------------------------------
  const concernItems = useMemo(() => items.filter((item) => item.circle === "concern").sort(byOrder), [items]);
  const influenceItems = useMemo(() => items.filter((item) => item.circle === "influence").sort(byOrder), [items]);

  const positions = useMemo<Record<string, Point>>(() => {
    if (!size) return {};
    return {
      ...layoutRing(concernItems, "concern", size, maxLabel),
      ...layoutRing(influenceItems, "influence", size, maxLabel),
    };
  }, [concernItems, influenceItems, size, maxLabel]);

  const selected = selectedId ? (items.find((item) => item.id === selectedId) ?? null) : null;

  // --- feedback ------------------------------------------------------------------------
  const flash = useCallback((text: string) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4200);
  }, []);

  // --- selection and modes -----------------------------------------------------------------
  function selectItem(id: string, toggle = true) {
    setSelectedId((prev) => (toggle && prev === id ? null : id));
    setMode("none");
    setTaught(true);
  }

  function openAdd() {
    setSelectedId(null);
    setPanelOpen(false);
    setMode("add");
  }

  function startEdit() {
    if (!selected) return;
    setEditText(selected.text);
    setMode("edit");
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (panelOpen) {
        setPanelOpen(false);
      } else if (mode !== "none") {
        setMode("none");
      } else if (selectedId) {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, mode, selectedId]);

  function onFieldPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".c-pill, button")) return;
    if (panelOpen) setPanelOpen(false);
    if (mode === "none" && selectedId) setSelectedId(null);
  }

  // --- saving: add, move, edit, remove ---------------------------------------------------------
  async function submitAdd() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const created = await createCircleItem(text, draftRing);
      setItems((list) => [...list, created]);
      setDraft("");
      setComposerKey((key) => key + 1);
      setAnnouncement(`Added to ${RING_LABEL[created.circle]}.`);
    } catch {
      flash("Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function moveItem(id: string, to: CircleName) {
    const item = items.find((entry) => entry.id === id);
    if (!item || item.circle === to) return;

    const nextOrder = Math.max(-1, ...items.filter((entry) => entry.circle === to).map((entry) => entry.order)) + 1;
    setItems((list) => list.map((entry) => (entry.id === id ? { ...entry, circle: to, order: nextOrder } : entry)));
    setReceiving(to);
    window.clearTimeout(receiveTimer.current);
    receiveTimer.current = window.setTimeout(() => setReceiving(null), 900);
    setTaught(true);
    setAnnouncement(`Moved to ${RING_LABEL[to]}.`);

    try {
      const saved = await updateCircleItem(id, { circle: to });
      setItems((list) =>
        list.map((entry) => (entry.id === id ? { ...entry, circle: saved.circle, order: saved.order } : entry)),
      );
    } catch {
      setItems((list) => list.map((entry) => (entry.id === id ? item : entry)));
      setAnnouncement("");
      flash("Couldn't move that. It's back where it was.");
    }
  }

  async function saveEdit() {
    if (!selected || busy) return;
    const text = editText.trim();
    if (!text) return;
    if (text === selected.text) {
      setMode("none");
      return;
    }
    setBusy(true);
    try {
      const saved = await updateCircleItem(selected.id, { text });
      setItems((list) => list.map((entry) => (entry.id === saved.id ? { ...entry, text: saved.text } : entry)));
      setMode("none");
    } catch {
      flash("Couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected() {
    if (!selected || busy) return;
    const id = selected.id;
    setBusy(true);
    setRemoving(id);
    setSelectedId(null);
    setMode("none");
    try {
      await Promise.all([deleteCircleItem(id), new Promise((resolve) => window.setTimeout(resolve, 260))]);
      setItems((list) => list.filter((entry) => entry.id !== id));
      setAnnouncement("Removed.");
    } catch {
      flash("Couldn't remove that. Try again.");
    } finally {
      setRemoving(null);
      setBusy(false);
    }
  }

  // --- dragging --------------------------------------------------------------------------------
  function onPillDown(event: ReactPointerEvent<HTMLButtonElement>, item: CircleItem) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    gestureRef.current = {
      id: item.id,
      pointerId: event.pointerId,
      sx: event.clientX,
      sy: event.clientY,
      offX: event.clientX - (rect.left + rect.width / 2),
      offY: event.clientY - (rect.top + rect.height / 2),
      moved: false,
      zone: null,
      from: item.circle,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPillMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const gesture = gestureRef.current;
    const stage = stageRef.current;
    if (!gesture || !stage || gesture.pointerId !== event.pointerId) return;

    if (!gesture.moved) {
      if (Math.hypot(event.clientX - gesture.sx, event.clientY - gesture.sy) < DRAG_THRESHOLD) return;
      gesture.moved = true;
      flatRef.current = true;
      setTaught(true);
    }

    const rect = stage.getBoundingClientRect();
    const x = event.clientX - gesture.offX - (rect.left + rect.width / 2);
    const y = event.clientY - gesture.offY - (rect.top + rect.height / 2);
    const distance = Math.hypot(x, y);
    const outerRadius = size / 2;
    const innerRadius = outerRadius * INNER * (PERSPECTIVE / (PERSPECTIVE - Z_INNER));
    const zone: CircleName | null = distance <= innerRadius ? "influence" : distance <= outerRadius ? "concern" : null;

    gesture.zone = zone;
    setDrag({ id: gesture.id, x, y, zone, from: gesture.from });
  }

  function endPillGesture(event: ReactPointerEvent<HTMLButtonElement>, cancelled: boolean) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    flatRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!gesture.moved) {
      if (!cancelled) selectItem(gesture.id);
      return;
    }

    setDrag(null);
    if (!cancelled && gesture.zone && gesture.zone !== gesture.from) void moveItem(gesture.id, gesture.zone);
  }

  // --- derived UI state ---------------------------------------------------------------------------
  const view: "idle" | "add" | "actions" | "edit" | "confirm" =
    mode === "add"
      ? "add"
      : selected
        ? mode === "edit"
          ? "edit"
          : mode === "confirm"
            ? "confirm"
            : "actions"
        : "idle";

  const showDock = state === "ready" && (items.length > 0 || mode === "add");
  const showEmpty = state === "ready" && items.length === 0 && mode !== "add";
  const teach = state === "ready" && items.length > 0 && !taught && mode === "none" && !selectedId && !drag;

  const hint = drag
    ? drag.zone && drag.zone !== drag.from
      ? `Release to place in ${RING_LABEL[drag.zone]}`
      : drag.zone === null
        ? "Release to put it back"
        : null
    : null;
  const note = notice ?? hint ?? (teach ? "Drag a thought between the circles." : null);

  const liftOf = (ring: CircleName): number =>
    drag && drag.zone === ring && drag.zone !== drag.from ? 1 : receiving === ring ? 0.7 : 0;

  const dragScale = (PERSPECTIVE - Z_DRAG) / PERSPECTIVE;

  const counts: Record<CircleName, number> = { concern: concernItems.length, influence: influenceItems.length };

  return (
    <div
      ref={rootRef}
      className={"circle c-sky relative h-full min-h-[calc(100dvh-3.75rem)] overflow-hidden lg:min-h-0" + (panelOpen ? " c-panel-open" : "")}
    >
      <canvas ref={canvasRef} className="c-canvas" aria-hidden="true" />
      <div className="c-vignette" aria-hidden="true" />

      {/* ---- the space ------------------------------------------------------- */}
      <div ref={fieldRef} className="c-field" onPointerDown={onFieldPointerDown}>
        {size > 0 && (
          <div
            ref={stageRef}
            className="c-stage"
            role="group"
            aria-label="Your circles"
            style={{ width: size, height: size, "--label-w": `${maxLabel}px` } as CSSProperties}
          >
            <div className="c-bloom" aria-hidden="true" />
            <div className="c-floor" aria-hidden="true" />

            <div ref={tiltRef} className="c-tilt">
              <RingView ring="concern" diameter={size} lift={liftOf("concern")} />
              <RingView ring="influence" diameter={size * INNER} lift={liftOf("influence")} />

              {items.map((item, index) => {
                const slot = positions[item.id];
                if (!slot) return null;
                const dragging = drag?.id === item.id;
                const isSelected = item.id === selectedId;
                const baseZ = item.circle === "concern" ? Z_CONCERN : Z_INFLUENCE;
                const transform = dragging
                  ? `translate3d(${(drag.x * dragScale).toFixed(1)}px, ${(drag.y * dragScale).toFixed(1)}px, ${Z_DRAG}px)`
                  : `translate3d(${slot.x}px, ${slot.y}px, ${baseZ + (isSelected ? 14 : 0)}px)`;

                return (
                  <div
                    key={item.id}
                    className={"c-node" + (dragging ? " is-dragging" : "") + (removing === item.id ? " is-removing" : "")}
                    style={{ transform }}
                    data-ring={item.circle}
                  >
                    <div className="c-center">
                      <div
                        className="c-bob"
                        style={{ "--bob": `${6 + (index % 5) * 0.9}s`, "--bd": `${-(index % 7) * 1.3}s` } as CSSProperties}
                      >
                        <button
                          type="button"
                          className={"c-pill" + (isSelected ? " is-selected" : "") + (dragging ? " is-dragging" : "")}
                          data-ring={item.circle}
                          aria-label={`${item.text}. ${RING_LABEL[item.circle]}.`}
                          aria-pressed={isSelected}
                          style={{ "--delay": `${intro ? 0.9 + index * 0.07 : 0}s` } as CSSProperties}
                          onPointerDown={(event) => onPillDown(event, item)}
                          onPointerMove={onPillMove}
                          onPointerUp={(event) => endPillGesture(event, false)}
                          onPointerCancel={(event) => endPillGesture(event, true)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              selectItem(item.id);
                            }
                          }}
                        >
                          <span className="c-orb" aria-hidden="true" />
                          <span className="c-label">{item.text}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {state === "loading" && <p className="c-overlay c-overlay-text">Finding your circles…</p>}

            {state === "error" && (
              <div className="c-overlay">
                <p className="c-empty-title">Your circles didn&apos;t load.</p>
                <button type="button" className="c-btn c-btn--primary mt-3" onClick={load}>
                  Try again
                </button>
              </div>
            )}

            {showEmpty && (
              <div className="c-overlay" data-compact={compact || undefined}>
                <p className="c-empty-title">Start with one thought.</p>
                <p className="c-empty-sub">Add what&apos;s on your mind, then place it.</p>
                <button type="button" className="c-btn c-btn--primary mt-4" onClick={openAdd}>
                  <Plus size={15} strokeWidth={2} aria-hidden="true" />
                  Add a thought
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- header ---------------------------------------------------------- */}
      <header className="c-header pointer-events-none absolute inset-x-0 top-0 z-20 px-5 pt-4 sm:px-8 lg:px-10 lg:pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="pointer-events-auto flex items-center gap-2.5">
            <span className="c-chip flex h-8 w-8 items-center justify-center rounded-full">
              <CircleMark />
            </span>
            <h1 className="text-[14px] font-semibold tracking-tight">Circle</h1>
          </div>

          {state === "ready" && items.length > 0 && (
            <button
              type="button"
              aria-label={panelOpen ? "Hide all thoughts" : "Show all thoughts"}
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen((open) => !open)}
              className="c-hoverable pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full text-[var(--c-text-2)]"
            >
              <List size={17} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </header>

      {note && (
        <p key={note} className="c-note" role="status">
          {note}
        </p>
      )}

      {/* ---- dock: add, or act on the selected thought --------------------------- */}
      {showDock && (
        <div className={"c-dock" + (view === "idle" ? " c-dock--idle" : "")}>
          <div key={view} className="c-dock-in">
            {view === "idle" && (
              <button type="button" className="c-btn" onClick={openAdd}>
                <Plus size={15} strokeWidth={2} aria-hidden="true" />
                Add a thought
              </button>
            )}

            {view === "add" && (
              <div className="flex flex-col gap-2">
                <div className="c-input">
                  <div className="min-w-0 flex-1">
                    <LineField
                      key={composerKey}
                      value={draft}
                      autoFocus
                      maxLength={TEXT_LIMIT}
                      placeholder="What's on your mind?"
                      aria-label="New thought"
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void submitAdd();
                      }}
                      className="bg-transparent text-[16px] leading-6 text-[var(--c-text)] placeholder:text-[var(--c-text-3)] focus:outline-none sm:text-[14.5px]"
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Add thought"
                    className="c-send"
                    disabled={!draft.trim() || busy}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void submitAdd()}
                  >
                    <ArrowUp size={17} strokeWidth={2.25} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div role="radiogroup" aria-label="Which circle" className="c-seg">
                    {RINGS.map((ring) => (
                      <button
                        key={ring}
                        type="button"
                        role="radio"
                        aria-checked={draftRing === ring}
                        aria-label={RING_LABEL[ring]}
                        onClick={() => setDraftRing(ring)}
                      >
                        <span className="c-dot" data-ring={ring} aria-hidden="true" />
                        {RING_SHORT[ring]}
                      </button>
                    ))}
                  </div>
                  <button type="button" aria-label="Close" className="c-btn c-icon" onClick={() => setMode("none")}>
                    <X size={16} strokeWidth={1.9} />
                  </button>
                </div>
              </div>
            )}

            {view === "actions" && selected && (
              <div className="flex flex-col gap-2">
                <div className="px-2 pt-1">
                  <p className="c-dock-sub">
                    <span className="c-dot" data-ring={selected.circle} aria-hidden="true" />
                    {RING_LABEL[selected.circle]}
                  </p>
                  <p className="c-dock-title">{selected.text}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="c-btn c-btn--primary min-w-0 flex-1"
                    onClick={() => void moveItem(selected.id, otherRing(selected.circle))}
                  >
                    <ArrowRightLeft size={15} strokeWidth={1.9} aria-hidden="true" className="shrink-0" />
                    <span className="truncate">Move to {RING_LABEL[otherRing(selected.circle)]}</span>
                  </button>
                  <button type="button" aria-label="Edit thought" className="c-btn c-icon" onClick={startEdit}>
                    <Pencil size={15} strokeWidth={1.8} />
                  </button>
                  <button type="button" aria-label="Remove thought" className="c-btn c-icon" onClick={() => setMode("confirm")}>
                    <Trash2 size={15} strokeWidth={1.8} />
                  </button>
                  <button type="button" aria-label="Close" className="c-btn c-icon" onClick={() => setSelectedId(null)}>
                    <X size={16} strokeWidth={1.9} />
                  </button>
                </div>
              </div>
            )}

            {view === "edit" && selected && (
              <div className="c-input">
                <div className="min-w-0 flex-1">
                  <LineField
                    value={editText}
                    autoFocus
                    maxLength={TEXT_LIMIT}
                    aria-label="Edit thought"
                    onChange={(event) => setEditText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void saveEdit();
                    }}
                    className="bg-transparent text-[16px] leading-6 text-[var(--c-text)] placeholder:text-[var(--c-text-3)] focus:outline-none sm:text-[14.5px]"
                  />
                </div>
                <button
                  type="button"
                  aria-label="Save"
                  className="c-send"
                  disabled={!editText.trim() || busy}
                  onClick={() => void saveEdit()}
                >
                  <Check size={17} strokeWidth={2.25} />
                </button>
                <button type="button" aria-label="Cancel" className="c-btn c-icon" onClick={() => setMode("none")}>
                  <X size={16} strokeWidth={1.9} />
                </button>
              </div>
            )}

            {view === "confirm" && selected && (
              <div className="flex flex-col gap-2">
                <p className="c-dock-title px-2 pt-1">Remove this thought?</p>
                <div className="flex items-center gap-2">
                  <button type="button" className="c-btn flex-1" onClick={() => setMode("none")}>
                    Keep it
                  </button>
                  <button type="button" className="c-btn c-btn--danger flex-1" disabled={busy} onClick={() => void removeSelected()}>
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- inspector: every thought, by circle -------------------------------------- */}
      {panelOpen && (
        <div className="c-panel" role="dialog" aria-label="All thoughts">
          <div className="flex items-center justify-between px-3 pb-1">
            <span className="c-eyebrow">Your circles</span>
            <button type="button" aria-label="Close" className="c-hoverable flex h-8 w-8 items-center justify-center rounded-full" onClick={() => setPanelOpen(false)}>
              <X size={15} strokeWidth={1.9} />
            </button>
          </div>
          {RINGS.map((ring) => {
            const list = ring === "concern" ? concernItems : influenceItems;
            return (
              <section key={ring} className="mt-2">
                <h2 className="c-eyebrow flex items-center gap-2 px-3 py-1.5">
                  <span className="c-dot" data-ring={ring} aria-hidden="true" />
                  {RING_LABEL[ring]}
                  <span className="ml-auto">{counts[ring]}</span>
                </h2>
                {list.length === 0 ? (
                  <p className="px-3 py-2 text-[13px] text-[var(--c-text-3)]">Nothing here.</p>
                ) : (
                  <ul>
                    {list.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="c-hoverable block w-full rounded-[12px] px-3 py-2.5 text-left text-[14px]"
                          onClick={() => {
                            selectItem(item.id, false);
                            setPanelOpen(false);
                          }}
                        >
                          {item.text}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RingView({ ring, diameter, lift }: { ring: CircleName; diameter: number; lift: number }) {
  const radius = diameter / 2;
  const arc = radius - (ring === "concern" ? 26 : 22);
  const pathId = `c-arc-${ring}`;

  return (
    <div
      className="c-ring-wrap"
      style={
        {
          width: diameter,
          height: diameter,
          "--z": `${ring === "concern" ? Z_OUTER : Z_INNER}px`,
          "--rd": ring === "concern" ? "0s" : "0.28s",
        } as CSSProperties
      }
    >
      <div className={`c-ring c-ring--${ring}`} style={{ "--lift": lift } as CSSProperties}>
        <svg className="c-ring-svg" width={diameter} height={diameter} viewBox={`0 0 ${diameter} ${diameter}`} aria-hidden="true" focusable="false">
          {ring === "concern" && <circle className="c-ticks" cx={radius} cy={radius} r={radius - 7} pathLength={360} />}
          <path id={pathId} d={`M ${radius - arc} ${radius} A ${arc} ${arc} 0 0 1 ${radius + arc} ${radius}`} fill="none" />
          <text className="c-arc-text">
            <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
              {RING_LABEL[ring].toUpperCase()}
            </textPath>
          </text>
        </svg>
      </div>
    </div>
  );
}

function CircleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
      <circle cx="8" cy="8" r="2.9" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}