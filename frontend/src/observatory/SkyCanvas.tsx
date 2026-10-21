import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { formatLongDate } from "../config/dates";
import type { DayKey } from "../config/dates";
import { unit } from "./model";
import type { Memory } from "./model";

interface SkyCanvasProps {
  memories: Memory[];
  selected: DayKey | null;
  today: DayKey;
  panelOpen: boolean;
  seed: number;
  onPickDay: (date: DayKey) => void;
  onBackground: () => void;
}

interface Star {
  date: DayKey;
  label: string;
  x: number; // world coordinates
  y: number;
  color: number;
  core: number;
  bright: number;
  photo: boolean;
  twinkle: boolean;
  rate: number;
  phase: number;
  delay: number; // intro stagger, seconds
}

interface Cam {
  x: number;
  y: number;
  k: number;
}

interface Speck {
  x: number;
  y: number;
  s: number;
  a: number;
  layer: number;
  rate: number;
  phase: number;
  tint: number;
  glow: boolean;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  s: number;
  a: number;
  ph: number;
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  len: number;
  big: boolean;
}

interface Sprites {
  bloom: HTMLCanvasElement[];
  flare: HTMLCanvasElement[];
  warm: HTMLCanvasElement;
  dark: HTMLCanvasElement;
}

const TAU = Math.PI * 2;

// Memory star colours: mostly cool white and blue, a few cream / amber / lilac ones.
const STAR_RGB = ["210,225,255", "255,255,255", "255,244,224", "255,226,184", "200,214,255", "232,242,255"] as const;
const DUST_TINTS = ["255,255,255", "200,218,255", "255,236,204", "190,170,255"] as const;
const BAND_HAZE = ["50,76,170", "66,92,190", "44,68,150"] as const;
const NEBULA = ["40,66,160", "58,50,140", "34,92,170", "74,58,150"] as const;

const BAND_ANGLE = -0.46; // tilt of the faint Milky Way backdrop; memories are NOT tied to it
const HEADER = 150;
const FOOTER = 96;
const PARALLAX = [0.05, 0.12, 0.24] as const;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 10;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length] as T;
}

function pickColor(v: number): number {
  if (v < 0.3) return 0;
  if (v < 0.55) return 1;
  if (v < 0.72) return 2;
  if (v < 0.84) return 3;
  if (v < 0.93) return 4;
  return 5;
}

function colorFor(v: number, photo: boolean): number {
  if (photo) return v < 0.6 ? 3 : 2; // days with photographs glow warm gold
  return pickColor(v);
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------

// Soft light bloom: hot centre and a smooth tail, tighter falloff than before so stars look crisp.
function bloomSprite(rgb: string): HTMLCanvasElement {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const m = size / 2;
  const g = ctx.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.05, `rgba(${rgb},0.9)`);
  g.addColorStop(0.14, `rgba(${rgb},0.34)`);
  g.addColorStop(0.3, `rgba(${rgb},0.08)`);
  g.addColorStop(0.6, `rgba(${rgb},0.015)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

// Telescope-style diffraction spikes: two long thin ones, two short faint diagonals.
function flareSprite(rgb: string): HTMLCanvasElement {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const m = S / 2;
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(m, m);
  const spike = (len: number, th: number, alpha: number, rot: number) => {
    ctx.save();
    ctx.rotate(rot);
    const g = ctx.createLinearGradient(-len, 0, len, 0);
    g.addColorStop(0, `rgba(${rgb},0)`);
    g.addColorStop(0.4, `rgba(${rgb},${alpha * 0.4})`);
    g.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.6, `rgba(${rgb},${alpha * 0.4})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.lineTo(0, -th);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, th);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  spike(120, 1.2, 0.8, 0);
  spike(120, 1.2, 0.8, Math.PI / 2);
  spike(46, 0.8, 0.28, Math.PI / 4);
  spike(46, 0.8, 0.28, -Math.PI / 4);
  return c;
}

// A soft dark pool placed under each memory star so it stays readable on a bright nebula.
function darkSprite(): HTMLCanvasElement {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const m = size / 2;
  const g = ctx.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, "rgba(3,3,14,0.65)");
  g.addColorStop(0.5, "rgba(3,3,14,0.3)");
  g.addColorStop(1, "rgba(3,3,14,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

let spriteCache: Sprites | null = null;
function getSprites(): Sprites {
  if (!spriteCache) {
    spriteCache = {
      bloom: STAR_RGB.map(bloomSprite),
      flare: STAR_RGB.map(flareSprite),
      warm: bloomSprite("255,150,120"),
      dark: darkSprite(),
    };
  }
  return spriteCache;
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stretch: number, angle: number, rgb: string, alpha: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(stretch, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, `rgba(${rgb},${alpha.toFixed(3)})`);
  g.addColorStop(0.5, `rgba(${rgb},${(alpha * 0.35).toFixed(3)})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The backdrop: a very restrained Milky Way, a few faint nebulae, dark dust lanes and fine stars.
// Most of the canvas is intentionally left near-black so the sky feels deep.
// ---------------------------------------------------------------------------

function paintBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const rand = mulberry(77);
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
  const cx = w / 2;
  const cy = h / 2;
  const L = Math.hypot(w, h);
  const bw = Math.min(w, h) * 0.2;
  const cos = Math.cos(BAND_ANGLE);
  const sin = Math.sin(BAND_ANGLE);
  const along = (t: number, off: number) => ({ x: cx + cos * t - sin * off, y: cy + sin * t + cos * off });

  ctx.globalCompositeOperation = "lighter";

  // faint, cool glow of the galactic band (about a third of the old brightness)
  for (let i = 0; i < 40; i += 1) {
    const p = along((rand() - 0.5) * L * 1.05, gauss() * bw * 0.5);
    cloud(ctx, p.x, p.y, bw * (0.8 + rand() * 1.0), 1.9, BAND_ANGLE + gauss() * 0.12, pick(BAND_HAZE, Math.floor(rand() * BAND_HAZE.length)), 0.005 + rand() * 0.011);
  }
  // a whisper of warmth toward the middle of the band
  for (let i = 0; i < 6; i += 1) {
    const p = along((rand() - 0.55) * L * 0.4, gauss() * bw * 0.3);
    cloud(ctx, p.x, p.y, bw * (0.5 + rand() * 0.6), 1.5, BAND_ANGLE, "200,170,150", 0.006 + rand() * 0.008);
  }
  // four dim nebulae in one palette
  for (let n = 0; n < 4; n += 1) {
    const nx = rand() * w;
    const ny = rand() * h;
    const rgb = pick(NEBULA, n + Math.floor(rand() * 2));
    const size = Math.min(w, h) * (0.1 + rand() * 0.12);
    const rot = rand() * Math.PI;
    for (let j = 0; j < 9; j += 1) {
      cloud(ctx, nx + gauss() * size, ny + gauss() * size, size * (0.4 + rand() * 0.55), 1 + rand() * 1.2, rot + gauss(), rgb, 0.006 + rand() * 0.013);
    }
  }

  // fine star dust, crowded into the band, sparse elsewhere so there is real darkness
  const dust = Math.min(3600, Math.round((w * h) / 1100));
  for (let i = 0; i < dust; i += 1) {
    let x: number;
    let y: number;
    if (rand() < 0.62) {
      const p = along((rand() - 0.5) * L * 1.05, gauss() * bw * 0.75);
      x = p.x;
      y = p.y;
    } else {
      x = rand() * w;
      y = rand() * h;
    }
    if (x < 0 || x > w || y < 0 || y > h) continue;
    const tint = rand() < 0.6 ? pick(DUST_TINTS, 0) : pick(DUST_TINTS, 1 + Math.floor(rand() * 3));
    const r = rand() < 0.04 ? 1.0 : 0.3 + rand() * 0.45;
    ctx.globalAlpha = 0.08 + Math.pow(rand(), 2.6) * 0.7;
    ctx.fillStyle = `rgb(${tint})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  // a few brighter background stars with a soft bloom
  const { bloom } = getSprites();
  for (let i = 0; i < 45; i += 1) {
    const sprite = pick(bloom, Math.floor(rand() * bloom.length));
    const d = 7 + rand() * 11;
    ctx.globalAlpha = 0.16 + rand() * 0.3;
    ctx.drawImage(sprite, rand() * w - d / 2, rand() * h - d / 2, d, d);
  }
  ctx.globalAlpha = 1;

  // dark dust lanes cutting through the band (more and darker than before)
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < 48; i += 1) {
    const t = (rand() - 0.5) * L * 0.95;
    const p = along(t, Math.sin(t * 0.004) * bw * 0.35 + gauss() * bw * 0.18);
    cloud(ctx, p.x, p.y, bw * (0.14 + rand() * 0.24), 2.3, BAND_ANGLE + gauss() * 0.3, "0,0,4", 0.1 + rand() * 0.12);
  }

  // deep black vignette baked into the backdrop so the edges fall off into empty space
  const vg = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.25, cx, cy, L * 0.62);
  vg.addColorStop(0, "rgba(0,0,2,0)");
  vg.addColorStop(1, "rgba(0,0,2,0.7)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

// A few huge, slow colour clouds. Pure CSS (runs on the GPU) and kept barely visible on purpose.
const WISPS = [
  { l: "-15%", t: "0%", s: 62, c: "50,80,190", a: 0.05, d: 14, o: 0, k: "a" },
  { l: "55%", t: "35%", s: 58, c: "70,60,170", a: 0.045, d: 18, o: -5, k: "b" },
  { l: "5%", t: "55%", s: 54, c: "40,110,200", a: 0.04, d: 22, o: -9, k: "a" },
] as const;

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 960, h: 640 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

// ---------------------------------------------------------------------------
// World layout: memories sprinkle across the whole sky like real stars. Most are spread evenly,
// a few gather in loose natural clumps, and nothing is joined by lines.
// ---------------------------------------------------------------------------

function buildWorld(memories: Memory[], seed: number, aspect: number) {
  const n = memories.length;
  const area = Math.max(n, 12) * 5200;
  const H = Math.sqrt(area / aspect);
  const W = H * aspect;
  const rnd = mulberry(seed * 131 + 7);
  const p0 = rnd() * 6.28;
  const p1 = rnd() * 6.28;
  const p2 = rnd() * 6.28;

  // A smooth "density field" (random waves plus a bright Milky Way band) decides where stars
  // like to gather, so the sky has busy patches and quiet gaps instead of an even grid.
  const density = (u: number, v: number) => {
    const wave = 0.5 + 0.25 * Math.sin(u * 7.1 + p0) * Math.cos(v * 5.3 + p1) + 0.25 * Math.sin((u + v) * 6.2 + p2);
    const x = (u - 0.5) * W;
    const y = (v - 0.5) * H;
    const off = -x * Math.sin(BAND_ANGLE) + y * Math.cos(BAND_ANGLE);
    const band = Math.exp(-Math.pow(off / (0.24 * Math.min(W, H)), 2));
    return 0.4 + 0.35 * wave * wave + 0.3 * band;
  };

  const total = Math.ceil(Math.max(n, 12) * 4);
  const cols = Math.max(1, Math.ceil(Math.sqrt(total * aspect)));
  const rows = Math.max(1, Math.ceil(total / cols));
  const cellW = W / cols;
  const cellH = H / rows;
  const scored: Array<{ c: number; score: number }> = [];
  for (let c = 0; c < cols * rows; c += 1) {
    const u = ((c % cols) + 0.5) / cols;
    const v = (Math.floor(c / cols) + 0.5) / rows;
    scored.push({ c, score: density(u, v) * (0.3 + rnd()) });
  }
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored.slice(0, n).map((e) => e.c);
  for (let i = chosen.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const a = chosen[i] ?? 0;
    chosen[i] = chosen[j] ?? 0;
    chosen[j] = a;
  }

  const pts = memories.map((m, i) => {
    const key = `${m.date}:${seed}`;
    const c = chosen[i] ?? i;
    return {
      x: (((c % cols) + 0.5) / cols - 0.5) * W + (unit(key, "x") - 0.5) * cellW * 0.92,
      y: ((Math.floor(c / cols) + 0.5) / rows - 0.5) * H + (unit(key, "y") - 0.5) * cellH * 0.92,
    };
  });

  // Nudge overlapping stars apart so every one stays tappable.
  const minDist = 16;
  const passes = n > 1500 ? 2 : n > 600 ? 4 : 7;
  for (let pass = 0; pass < passes; pass += 1) {
    const grid = new Map<string, number[]>();
    pts.forEach((p, i) => {
      const cell = `${Math.floor(p.x / minDist)}:${Math.floor(p.y / minDist)}`;
      const b = grid.get(cell);
      if (b) b.push(i);
      else grid.set(cell, [i]);
    });
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i];
      if (!p) continue;
      const gx = Math.floor(p.x / minDist);
      const gy = Math.floor(p.y / minDist);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const bucket = grid.get(`${gx + dx}:${gy + dy}`);
          if (!bucket) continue;
          for (const j of bucket) {
            const q = pts[j];
            if (j <= i || !q) continue;
            let vx = q.x - p.x;
            let vy = q.y - p.y;
            let d = Math.hypot(vx, vy);
            if (d >= minDist) continue;
            if (d < 0.001) {
              vx = 1;
              vy = 0;
              d = 1;
            }
            const push = (minDist - d) / 2;
            p.x -= (vx / d) * push;
            p.y -= (vy / d) * push;
            q.x += (vx / d) * push;
            q.y += (vy / d) * push;
          }
        }
      }
    }
  }
  for (const p of pts) {
    p.x = clamp(p.x, -W / 2, W / 2);
    p.y = clamp(p.y, -H / 2, H / 2);
  }

  const order = memories.map((_, i) => i).sort((a, b) => ((memories[a]?.date ?? "") < (memories[b]?.date ?? "") ? -1 : 1));
  const rank = new Map(order.map((memIdx, r) => [memIdx, r]));

  const stars: Star[] = memories.map((m, i) => {
    const key = `${m.date}:style`;
    const p = pts[i] ?? { x: 0, y: 0 };
    return {
      date: m.date,
      label: formatLongDate(m.date),
      x: p.x,
      y: p.y,
      color: colorFor(unit(key, "c"), m.photoCount > 0),
      core: 2 + Math.pow(unit(key, "mag"), 2.2) * 2.4 + ((clamp(m.radius, 1.8, 4.2) - 1.8) / 2.4) * 0.8,
      bright: Math.max(0.78, m.brightness),
      photo: m.photoCount > 0,
      twinkle: unit(key, "t") < 0.8,
      rate: 0.8 + unit(key, "d") * 2.4, // slower, calmer twinkle
      phase: unit(key, "l") * Math.PI * 2,
      delay: Math.min((rank.get(i) ?? 0) * 0.04, 1.6),
    };
  });

  const index = new Map(stars.map((s, i) => [s.date, i]));
  return { stars, index, order, rank, W, H, bounds: { minX: -W / 2, maxX: W / 2, minY: -H / 2, maxY: H / 2, cx: 0, cy: 0 } };
}

type World = ReturnType<typeof buildWorld>;

export default function SkyCanvas({ memories, selected, today, panelOpen, seed, onPickDay, onBackground }: SkyCanvasProps) {
  const [wrapRef, size] = useElementSize<HTMLDivElement>();
  const deepRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pad0 = size.w < 640 ? 22 : 64;
  const aspect = clamp(Math.round(((size.w - pad0 * 2) / Math.max(160, size.h - HEADER - FOOTER)) * 10) / 10, 0.3, 3);
  const world = useMemo(() => buildWorld(memories, seed, aspect), [memories, seed, aspect]);

  // Everything the animation loop reads lives in refs, so panning never re-renders React.
  const worldRef = useRef<World>(world);
  const camRef = useRef<Cam>({ x: 0, y: 0, k: 1 });
  const targetRef = useRef<Cam>({ x: 0, y: 0, k: 1 });
  const fitRef = useRef<Cam>({ x: 0, y: 0, k: 1 });
  const touchedRef = useRef(false);
  const introRef = useRef(true);
  const introStart = useRef(0);
  const hoverRef = useRef(-1);
  // mouse position (-0.5..0.5) and its smoothed value; the sky leans a little toward the cursor
  const mouseRef = useRef({ x: 0, y: 0, sx: 0, sy: 0 });
  // Where each star was actually drawn last frame (sway and wobble included), used for hit testing.
  const posRef = useRef<Float32Array>(new Float32Array(0));
  const liveRef = useRef({ selected, today, onPickDay, onBackground });
  worldRef.current = world;
  liveRef.current = { selected, today, onPickDay, onBackground };

  const compact = size.w < 640;
  const padding = compact ? 22 : 64;

  // --- a new layout (first load, Shuffle) replays the fly-in -----------------------------
  useEffect(() => {
    touchedRef.current = false;
    introRef.current = true;
    introStart.current = performance.now();
  }, [world]);

  // --- fit the whole sky into the free area ----------------------------------------------
  useEffect(() => {
    const b = world.bounds;
    const availW = Math.max(160, size.w - padding * 2);
    const availH = Math.max(160, size.h - HEADER - FOOTER);
    const k = clamp(Math.min(availW / Math.max(b.maxX - b.minX, 60), availH / Math.max(b.maxY - b.minY, 60)) * 0.98, 0.15, 5);
    const place = (zoom: number): Cam => ({ k: zoom, x: size.w / 2 - b.cx * zoom, y: HEADER + availH / 2 - b.cy * zoom });
    const fit = place(k);
    fitRef.current = fit;
    if (!touchedRef.current) {
      if (introRef.current) {
        camRef.current = place(k * 0.55);
        introRef.current = false;
      } else {
        camRef.current = { ...fit };
      }
      targetRef.current = { ...fit };
    }
  }, [world, size.w, size.h, padding]);

  // --- fly to the open star, keeping it clear of the panel -------------------------------
  useEffect(() => {
    if (!selected) return;
    const i = world.index.get(selected);
    const s = i === undefined ? undefined : world.stars[i];
    if (!s) return;
    const fit = fitRef.current;
    const tg = targetRef.current;
    const k = clamp(Math.max(tg.k, fit.k * 2.2), fit.k * MIN_ZOOM, fit.k * MAX_ZOOM);
    const desktop = size.w >= 1024;
    const fx = panelOpen && desktop ? (size.w - 372) / 2 : size.w / 2;
    const fy = panelOpen && !desktop ? (HEADER + size.h * 0.46) / 2 : (HEADER + size.h - FOOTER) / 2;
    tg.k = k;
    tg.x = fx - s.x * k;
    tg.y = fy - s.y * k;
    touchedRef.current = true;
  }, [selected, panelOpen, world, size.w, size.h]);

  // --- static backdrop (repainted only when the size changes meaningfully) ---------------
  const bucketW = Math.max(64, Math.round(size.w / 64) * 64);
  const bucketH = Math.max(64, Math.round(size.h / 64) * 64);
  useEffect(() => {
    const canvas = deepRef.current;
    if (!canvas) return;
    // wait for resizing to settle before the expensive repaint
    const id = window.setTimeout(() => {
      const cw = Math.round(bucketW * 1.5);
      const ch = Math.round(bucketH * 1.5);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(cw * ratio);
      canvas.height = Math.round(ch * ratio);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      paintBackdrop(ctx, cw, ch);
    }, 120);
    return () => window.clearTimeout(id);
  }, [bucketW, bucketH]);

  // --- the single animation loop ---------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const deep = deepRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.w * ratio);
    canvas.height = Math.round(size.h * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { w, h } = size;
    // With reduced motion we keep the stars twinkling (it is only brightness)
    // but stop everything that travels: drift, shooting stars and the fly-in.
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { bloom, flare, warm } = getSprites();

    // three depth layers of twinkling stars (fewer and dimmer so the sky stays dark)
    const rand = mulberry(7);
    const specks: Speck[] = [];
    const total = clamp(Math.round((w * h) / 3400), 160, 420);
    for (let i = 0; i < total; i += 1) {
      const roll = rand();
      const layer = roll < 0.6 ? 0 : roll < 0.9 ? 1 : 2;
      specks.push({
        x: rand() * w,
        y: rand() * h,
        s: layer === 0 ? 0.5 + rand() * 0.35 : layer === 1 ? 0.7 + rand() * 0.45 : 1 + rand() * 0.7,
        a: 0.22 + rand() * 0.45,
        layer,
        rate: 0.8 + rand() * 3,
        phase: rand() * TAU,
        tint: rand() < 0.6 ? 0 : 1 + Math.floor(rand() * 3),
        glow: layer === 2 && rand() < 0.3,
      });
    }

    // slow floating dust: very faint soft motes, no streaks
    const motes: Mote[] = [];
    const moteCount = clamp(Math.round((w * h) / 12000), 20, 56);
    for (let i = 0; i < moteCount; i += 1) {
      motes.push({
        x: rand() * w,
        y: rand() * h,
        vx: (rand() - 0.4) * 7,
        vy: (rand() - 0.5) * 5,
        z: 0.3 + rand() * 0.7,
        s: 4 + rand() * 7,
        a: 0.05 + rand() * 0.14,
        ph: rand() * TAU,
      });
    }
    const wrap = (v: number, m: number) => ((v % m) + m) % m;

    const shots: Shot[] = [];
    const labelBuf: Array<{ x: number; y: number; core: number; text: string }> = [];
    let nextShot = performance.now() + 3500;
    let nextSpark = performance.now() + 1500;
    const sparks = new Map<number, number>(); // star index -> time it started flaring
    let last = performance.now();
    let raf = 0;
    let lastOpacity = "";

    const label = (text: string, x: number, y: number, strong: boolean, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.font = `${strong ? 600 : 500} 11px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 6;
      ctx.fillStyle = strong ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.78)";
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 0;
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = now / 1000;
      const cam = camRef.current;
      const tg = targetRef.current;
      const fit = fitRef.current;
      const { stars, index, order, rank } = worldRef.current;
      const { selected: sel, today: todayKey } = liveRef.current;
      const introT = calm ? 99 : (now - introStart.current) / 1000;
      const fade = smooth(0, 2.2, introT); // slower fade up from black

      // ease the camera; the opening fly-in is deliberately slow and cinematic
      const rate = !touchedRef.current && introT < 3.5 ? 1.8 : 9;
      const f = calm ? 1 : 1 - Math.exp(-dt * rate);
      cam.x += (tg.x - cam.x) * f;
      cam.y += (tg.y - cam.y) * f;
      cam.k += (tg.k - cam.k) * f;

      // the whole sky floats very gently, like you are drifting in space
      const mouse = mouseRef.current;
      mouse.sx += (mouse.x - mouse.sx) * 0.04;
      mouse.sy += (mouse.y - mouse.sy) * 0.04;
      const swayX = calm ? 0 : Math.sin(t * 0.17) * 5 + Math.sin(t * 0.41) * 1.5 - mouse.sx * 18;
      const swayY = calm ? 0 : Math.cos(t * 0.13) * 4 + Math.cos(t * 0.37) * 1.2 - mouse.sy * 18;
      const camX = cam.x + swayX;
      const camY = cam.y + swayY;

      // the backdrop: follows the camera a little, swells as you zoom, fades in from black
      if (deep) {
        const m = Math.min(w, h) * 0.22;
        const px = clamp((cam.x - fit.x) * 0.3 + swayX * 0.5, -m, m);
        const py = clamp((cam.y - fit.y) * 0.3 + swayY * 0.5, -m, m);
        const zoom = 1 + clamp(Math.log(Math.max(cam.k / fit.k, 0.01)) * 0.06, 0, 0.16);
        const breathe = calm ? 0 : Math.sin(t * 0.16) * 0.03;
        const rot = calm ? 0 : Math.sin(t * 0.07) * 1.4;
        deep.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0) scale(${(zoom + breathe).toFixed(4)}) rotate(${rot.toFixed(3)}deg)`;
        const op = fade.toFixed(2);
        if (op !== lastOpacity) {
          deep.style.opacity = op;
          lastOpacity = op;
        }
      }

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      const ox = cam.x - fit.x;
      const oy = cam.y - fit.y;
      const swing = calm ? 0.3 : 0.8;

      // drifting dust motes, each a soft speck that slowly brightens and fades
      for (const m of motes) {
        const x = wrap(m.x + ox * (0.25 + 0.5 * m.z), w);
        const y = wrap(m.y + oy * (0.25 + 0.5 * m.z), h);
        const pulse = 0.55 + 0.45 * Math.sin(t * 0.5 + m.ph);
        ctx.globalAlpha = m.a * fade * pulse;
        ctx.drawImage(pick(bloom, 0), x - m.s / 2, y - m.s / 2, m.s, m.s);
      }

      // twinkling, drifting stars on three depth layers
      for (const s of specks) {
        const par = PARALLAX[s.layer] ?? 0.1;
        const x = (((s.x + ox * par) % w) + w) % w;
        const y = (((s.y + oy * par) % h) + h) % h;
        // two out-of-step waves make the flicker irregular, like air turbulence
        const wave = 0.5 + 0.5 * Math.sin(t * s.rate + s.phase) * Math.sin(t * s.rate * 0.37 + s.phase * 1.7);
        const a = s.a * (1 - swing * wave) * fade;
        if (s.glow) {
          const sprite = pick(bloom, s.tint);
          const r = 6 + s.s * 4;
          ctx.globalAlpha = a * 0.45;
          ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
        }
        ctx.globalAlpha = a;
        ctx.fillStyle = `rgb(${pick(DUST_TINTS, s.tint)})`;
        ctx.fillRect(x - s.s / 2, y - s.s / 2, s.s, s.s);
      }

      // the trail from the open day to the day before and the day after
      const selIdx = sel ? index.get(sel) : undefined;
      if (selIdx !== undefined) {
        const here = stars[selIdx];
        const r = rank.get(selIdx) ?? 0;
        if (here) {
          const wob = (st: Star) => ({
            x: st.x * cam.k + camX + (calm ? 0 : Math.sin(t * 0.31 + st.phase) * 2.4),
            y: st.y * cam.k + camY + (calm ? 0 : Math.cos(t * 0.27 + st.phase * 1.4) * 2.4),
          });
          const a = wob(here);
          let n = 0;
          for (const nb of [order[r - 1], order[r + 1]]) {
            const other = nb === undefined ? undefined : stars[nb];
            if (!other) continue;
            const b = wob(other);
            const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
            g.addColorStop(0, "rgba(255,255,255,0.7)");
            g.addColorStop(1, "rgba(255,255,255,0.06)");
            ctx.globalAlpha = 1;
            ctx.strokeStyle = g;
            ctx.lineWidth = 1;
            ctx.lineCap = "round";
            ctx.setLineDash([2, 6]);
            ctx.lineDashOffset = calm ? 0 : -t * 10;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.setLineDash([]);
            // a small light drifts along the trail
            if (!calm) {
              const p = (t * 0.22 + n * 0.5) % 1;
              ctx.globalAlpha = Math.sin(p * Math.PI) * 0.9;
              ctx.drawImage(pick(bloom, 0), lerp(a.x, b.x, p) - 9, lerp(a.y, b.y, p) - 9, 18, 18);
            }
            n += 1;
          }
        }
      }

      // now and then one star flares up (was every ~0.3s, now every ~1-3s so it feels special)
      if (!calm && stars.length && now > nextSpark) {
        sparks.set(Math.floor(Math.random() * stars.length), now);
        nextSpark = now + 900 + Math.random() * 1800;
      }

      // memory stars (no lines between them: each one stands alone)
      const zk = Math.pow(cam.k / fit.k, 0.4);
      const lod = stars.length > 1200 && cam.k < fit.k * 1.6;
      const showLabels = cam.k > fit.k * 3;
      labelBuf.length = 0;
      let selScreen: { x: number; y: number; core: number } | null = null;
      let hoverScreen: { x: number; y: number; core: number; text: string; date: DayKey } | null = null;

      if (posRef.current.length !== stars.length * 2) posRef.current = new Float32Array(stars.length * 2);
      const pos = posRef.current;

      for (let i = 0; i < stars.length; i += 1) {
        const s = stars[i];
        if (!s) continue;
        const sx = s.x * cam.k + camX + (calm ? 0 : Math.sin(t * 0.31 + s.phase) * 2.4);
        const sy = s.y * cam.k + camY + (calm ? 0 : Math.cos(t * 0.27 + s.phase * 1.4) * 2.4);
        pos[i * 2] = sx;
        pos[i * 2 + 1] = sy;
        if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) continue;

        const ramp = calm ? 1 : clamp((introT - 0.3 - s.delay) / 0.9, 0, 1);
        if (ramp <= 0) continue;
        const ease = ramp * ramp * (3 - 2 * ramp);

        const isSel = s.date === sel;
        const isHov = i === hoverRef.current;
        const flareStart = sparks.get(i);
        const sk = flareStart === undefined ? 0 : Math.max(0, 1 - (now - flareStart) / 1400);
        if (flareStart !== undefined && sk === 0) sparks.delete(i);
        const core = s.core * zk * (isSel ? 1.25 : isHov ? 1.2 : 1) * (0.4 + 0.6 * ease);
        const wave = 0.5 + 0.5 * Math.sin(t * s.rate + s.phase) * Math.sin(t * s.rate * 0.43 + s.phase * 1.3);
        const tw = !s.twinkle || isSel ? 1 : 1 - 0.45 * wave;
        const alpha = clamp(s.bright * tw, 0, 1) * ease;
        const boost = isSel ? 1.5 : isHov ? 1.25 : 1;
        const breathe = calm ? 1 : 1 + 0.1 * Math.sin(t * 1.1 + s.phase);

        const glowSprite = pick(bloom, s.color);
        if (lod && !isSel) {
          const d = 9 + core * 5;
          ctx.globalAlpha = alpha;
          ctx.drawImage(glowSprite, sx - d / 2, sy - d / 2, d, d);
        } else {
          const d = (8 + core * 2.4) * breathe * boost * (1 + sk * 0.6);

          // 1) wide, very faint halo gives each star depth against the black
          ctx.globalAlpha = clamp(0.2 * tw + sk * 0.25, 0, 1) * ease;
          ctx.drawImage(glowSprite, sx - d * 1.4, sy - d * 1.4, d * 2.8, d * 2.8);

          // 2) tight bloom
          ctx.globalAlpha = clamp(0.9 + 0.1 * tw, 0, 1) * ease;
          ctx.drawImage(glowSprite, sx - d / 2, sy - d / 2, d, d);

          // 3) the biggest stars keep tiny resting diffraction spikes
          if (!isSel && !isHov && sk === 0 && s.core > 3.4) {
            const fd = d * 2.6;
            ctx.globalAlpha = clamp(0.2 * tw, 0, 1) * ease;
            ctx.drawImage(pick(flare, s.color), sx - fd / 2, sy - fd / 2, fd, fd);
          }

          // 4) full cross on the star you touch, or one that is flaring
          if (isSel || isHov || sk > 0) {
            const fd = d * (isSel ? 5 : 4) * (1 + sk * 0.6);
            ctx.globalAlpha = clamp((isSel ? 0.85 : 0.55) * ease + sk * 0.4, 0, 1);
            ctx.drawImage(pick(flare, s.color), sx - fd / 2, sy - fd / 2, fd, fd);
          }

          // 5) sharp white point at the centre
          ctx.globalAlpha = clamp(alpha + 0.3, 0, 1);
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(sx, sy, clamp(core * 0.3 + 0.55, 1.1, 2.1), 0, TAU);
          ctx.fill();
        }

        // today: a gentle warm glow with a breathing ring
        if (s.date === todayKey) {
          const pulse = calm ? 0.4 : 0.5 + 0.5 * Math.sin(t * 1.5);
          const d = (30 + core * 8) * (1 + pulse * 0.25);
          ctx.globalAlpha = (0.3 + 0.25 * pulse) * ease;
          ctx.drawImage(warm, sx - d / 2, sy - d / 2, d, d);
        }

        if (isSel) selScreen = { x: sx, y: sy, core };
        if (isHov) hoverScreen = { x: sx, y: sy, core, text: s.label, date: s.date };
        if (showLabels && !isSel && !isHov) labelBuf.push({ x: sx, y: sy, core, text: s.label });
      }

      if (selScreen) {
        // four slowly turning arcs and an outgoing ripple around the open star
        const rr = 15 + selScreen.core * 2.5;
        const spin = calm ? 0 : t * 0.5;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1;
        ctx.lineCap = "round";
        ctx.globalAlpha = 0.9;
        for (let k = 0; k < 4; k += 1) {
          const a0 = spin + (k * Math.PI) / 2;
          ctx.beginPath();
          ctx.arc(selScreen.x, selScreen.y, rr, a0 + 0.3, a0 + Math.PI / 2 - 0.3);
          ctx.stroke();
        }
        if (!calm) {
          const pr = (t * 0.35) % 1;
          ctx.globalAlpha = (1 - pr) * 0.4;
          ctx.beginPath();
          ctx.arc(selScreen.x, selScreen.y, rr * (1 + pr * 1.8), 0, TAU);
          ctx.stroke();
        }
      }

      // text is drawn normally, not additively
      ctx.globalCompositeOperation = "source-over";
      if (selScreen && sel) label(formatLongDate(sel), selScreen.x, selScreen.y + selScreen.core * 3 + 30, true);
      if (hoverScreen && hoverScreen.date !== sel) label(hoverScreen.text, hoverScreen.x, hoverScreen.y + hoverScreen.core * 2 + 14, false);
      if (showLabels) {
        const a = smooth(3, 4, cam.k / fit.k) * 0.8;
        for (const l of labelBuf) label(l.text, l.x, l.y + l.core * 2 + 12, false, a);
      }
      ctx.globalAlpha = 1;

      // shooting stars: rare, so each one feels like a small event
      if (!calm) {
        if (now > nextShot) {
          // occasionally a small meteor shower instead of a single streak
          const count = Math.random() < 0.12 ? 3 + Math.floor(Math.random() * 3) : 1;
          for (let b = 0; b < count; b += 1) {
            const right = Math.random() < 0.6;
            const big = Math.random() < 0.15;
            const base = ((14 + Math.random() * 30) * Math.PI) / 180;
            const ang = right ? base : Math.PI - base;
            const speed = (big ? 1100 : 800) + Math.random() * 500;
            shots.push({
              x: right ? Math.random() * w * 0.7 : w * 0.3 + Math.random() * w * 0.7,
              y: -10 + Math.random() * h * 0.45,
              vx: Math.cos(ang) * speed,
              vy: Math.sin(ang) * speed,
              age: 0,
              ttl: big ? 0.8 + Math.random() * 0.4 : 0.5 + Math.random() * 0.4,
              len: big ? 300 + Math.random() * 120 : 150 + Math.random() * 110,
              big,
            });
          }
          nextShot = now + 5000 + Math.random() * 6000;
        }
        ctx.globalCompositeOperation = "lighter";
        for (let i = shots.length - 1; i >= 0; i -= 1) {
          const sh = shots[i];
          if (!sh) continue;
          sh.age += dt;
          sh.x += sh.vx * dt;
          sh.y += sh.vy * dt;
          const p = sh.age / sh.ttl;
          if (p >= 1) {
            shots.splice(i, 1);
            continue;
          }
          const fd = Math.pow(Math.sin(p * Math.PI), 0.7);
          const sp = Math.hypot(sh.vx, sh.vy);
          const tx = sh.x - (sh.vx / sp) * sh.len;
          const ty = sh.y - (sh.vy / sp) * sh.len;
          const g = ctx.createLinearGradient(tx, ty, sh.x, sh.y);
          g.addColorStop(0, "rgba(160,190,255,0)");
          g.addColorStop(0.75, `rgba(210,225,255,${(0.32 * fd).toFixed(3)})`);
          g.addColorStop(1, `rgba(255,255,255,${(0.95 * fd).toFixed(3)})`);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = g;
          ctx.lineWidth = sh.big ? 1.8 : 1.2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(sh.x, sh.y);
          ctx.stroke();
          const hs = sh.big ? 16 : 10;
          ctx.globalAlpha = fd;
          ctx.drawImage(pick(bloom, sh.big ? 3 : 0), sh.x - hs, sh.y - hs, hs * 2, hs * 2);
        }
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  // --- hit testing: nearest star to a screen point, using where it was really drawn ------
  const hitTest = (mx: number, my: number, touch: boolean): number => {
    const pos = posRef.current;
    const { stars } = worldRef.current;
    if (pos.length !== stars.length * 2) return -1;
    const reach = touch ? 22 : 13;
    let best = -1;
    let bestD = reach;
    for (let i = 0; i < stars.length; i += 1) {
      const d = Math.hypot((pos[i * 2] ?? 1e9) - mx, (pos[i * 2 + 1] ?? 1e9) - my);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  // --- gestures: drag (with momentum) to pan, pinch / wheel to zoom, tap a star to open it ---
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef({ sx: 0, sy: 0, cx: 0, cy: 0, moved: false, tap: true, touch: false });
  const pinch = useRef({ d0: 1, k0: 1, wx: 0, wy: 0 });
  const vel = useRef({ x: 0, y: 0, t: 0, vx: 0, vy: 0 });

  const local = (e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  };

  // Free roaming: the sky may be dragged until only a quarter of it is still on screen.
  const keepInView = (c: Cam) => {
    const b = worldRef.current.bounds;
    const marginX = size.w * 0.25;
    const marginY = size.h * 0.25;
    c.x = clamp(c.x, marginX - b.maxX * c.k, size.w - marginX - b.minX * c.k);
    c.y = clamp(c.y, marginY - b.maxY * c.k, size.h - marginY - b.minY * c.k);
  };

  const sync = () => {
    targetRef.current = { ...camRef.current };
    touchedRef.current = true;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const cam = camRef.current;
    if (pointers.current.size === 1) {
      drag.current = { sx: p.x, sy: p.y, cx: cam.x, cy: cam.y, moved: false, tap: true, touch: e.pointerType !== "mouse" };
      vel.current = { x: p.x, y: p.y, t: performance.now(), vx: 0, vy: 0 };
      sync();
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinch.current = { d0: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1), k0: cam.k, wx: (mid.x - cam.x) / cam.k, wy: (mid.y - cam.y) / cam.k };
      drag.current.tap = false;
      sync();
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = local(e);
    const known = pointers.current.has(e.pointerId);
    if (known) pointers.current.set(e.pointerId, p);
    const el = wrapRef.current;

    if (!known || pointers.current.size === 0) {
      if (e.pointerType === "mouse") {
        mouseRef.current.x = p.x / size.w - 0.5;
        mouseRef.current.y = p.y / size.h - 0.5;
        const i = hitTest(p.x, p.y, false);
        hoverRef.current = i;
        if (el) el.style.cursor = i >= 0 ? "pointer" : "grab";
      }
      return;
    }

    const cam = camRef.current;
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      const fit = fitRef.current;
      const k = clamp((pinch.current.k0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.d0, fit.k * MIN_ZOOM, fit.k * MAX_ZOOM);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      cam.k = k;
      cam.x = mid.x - pinch.current.wx * k;
      cam.y = mid.y - pinch.current.wy * k;
      keepInView(cam);
      sync();
      return;
    }

    const d = drag.current;
    // touch needs a slightly larger dead zone than a mouse, but never blocks a real drag
    const slop = d.touch ? 8 : 5;
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > slop) {
      d.moved = true;
      d.tap = false;
      // restart the drag from here so the sky doesn't jump by the dead-zone distance
      d.sx = p.x;
      d.sy = p.y;
      d.cx = cam.x;
      d.cy = cam.y;
      if (el) el.style.cursor = "grabbing";
    }
    if (d.moved) {
      const now = performance.now();
      const v = vel.current;
      const dtv = Math.max((now - v.t) / 1000, 0.001);
      v.vx = lerp(v.vx, (p.x - v.x) / dtv, 0.5);
      v.vy = lerp(v.vy, (p.y - v.y) / dtv, 0.5);
      v.x = p.x;
      v.y = p.y;
      v.t = now;

      cam.x = d.cx + (p.x - d.sx);
      cam.y = d.cy + (p.y - d.sy);
      keepInView(cam);
      sync();
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = local(e);
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    const el = wrapRef.current;
    if (el) el.style.cursor = "grab";

    if (wasSingle && drag.current.tap && e.type === "pointerup") {
      const i = hitTest(p.x, p.y, drag.current.touch);
      const star = i >= 0 ? worldRef.current.stars[i] : undefined;
      if (star) liveRef.current.onPickDay(star.date);
      else liveRef.current.onBackground();
    }

    // flick: let the sky glide further in the direction you threw it
    if (wasSingle && drag.current.moved && e.type === "pointerup" && performance.now() - vel.current.t < 90) {
      const cam = camRef.current;
      const tg = { ...cam, x: cam.x + vel.current.vx * 0.4, y: cam.y + vel.current.vy * 0.4 };
      keepInView(tg);
      targetRef.current = tg;
    }

    // one finger left after a pinch: carry on panning from where it is
    const rest = [...pointers.current.values()][0];
    if (rest) {
      const cam = camRef.current;
      drag.current = { sx: rest.x, sy: rest.y, cx: cam.x, cy: cam.y, moved: true, tap: false, touch: true };
      vel.current = { x: rest.x, y: rest.y, t: performance.now(), vx: 0, vy: 0 };
    }
  };

  const onPointerLeave = () => {
    hoverRef.current = -1;
  };

  // wheel / trackpad pinch: needs a non-passive listener to stop the page from scrolling
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const fit = fitRef.current;
      const tg = targetRef.current;
      const k = clamp(tg.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016)), fit.k * MIN_ZOOM, fit.k * MAX_ZOOM);
      const wx = (mx - tg.x) / tg.k;
      const wy = (my - tg.y) / tg.k;
      tg.k = k;
      tg.x = mx - wx * k;
      tg.y = my - wy * k;
      keepInView(tg);
      touchedRef.current = true;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 overflow-hidden"
      style={{ touchAction: "none", cursor: "grab", userSelect: "none", WebkitUserSelect: "none", background: "radial-gradient(130% 100% at 30% 20%, #03050e 0%, #010208 45%, #000002 100%)" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      <canvas
        ref={deepRef}
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{ left: "-25%", top: "-25%", width: "150%", height: "150%", willChange: "transform, opacity", opacity: 0 }}
      />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <style>{`
          @keyframes skywind-a { from { transform: scale(1); opacity: .3 } to { transform: scale(1.1); opacity: 1 } }
          @keyframes skywind-b { from { transform: scale(1.1); opacity: 1 } to { transform: scale(1); opacity: .3 } }
          @media (prefers-reduced-motion: reduce) { .skywind { animation: none !important } }
        `}</style>
        {WISPS.map((wp, i) => (
          <div
            key={i}
            className="skywind absolute"
            style={{
              left: wp.l,
              top: wp.t,
              width: `${wp.s}vmax`,
              height: `${wp.s}vmax`,
              borderRadius: "50%",
              background: `radial-gradient(closest-side, rgba(${wp.c},${wp.a}), rgba(${wp.c},0))`,
              mixBlendMode: "screen",
              willChange: "transform, opacity",
              animation: `skywind-${wp.k} ${wp.d}s ease-in-out ${wp.o}s infinite alternate`,
            }}
          />
        ))}
      </div>
      {/* black vignette: pushes the corners into empty space, sits under the stars */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(120% 100% at 50% 45%, rgba(0,0,0,0) 35%, rgba(0,0,2,0.55) 100%)" }}
      />
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Sky of ${memories.length} journal memories. Drag to explore, pinch or scroll to zoom, tap a star to open it. Use the list view for a keyboard-friendly alternative.`}
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}