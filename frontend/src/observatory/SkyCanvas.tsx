import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from "react";
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

interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Placed {
  memory: Memory;
  x: number;
  y: number;
  color: number;
  r: number;
  twinkle: boolean;
  duration: number;
  delay: number;
}

interface Speck {
  x: number;
  y: number;
  size: number;
  alpha: number;
  layer: number;
  phase: number;
  rate: number;
  tint: number;
  kind: 0 | 1 | 2;
  fill: string;
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  ttl: number;
  len: number;
  bright: boolean;
}

// Memory stars keep a real stellar colour temperature, forever.
const PALETTE = ["#ffffff", "#cfe3ff", "#fff0cf", "#ffd29a", "#bfe9ff", "#ffe1c2"] as const;

// Backdrop colour temperatures: white, blue-white, cream, amber, ice.
const TINTS = ["255,255,255", "190,214,255", "255,238,205", "255,214,170", "175,235,255"] as const;

// Drift speed per depth layer, px/second. Far stars barely move.
const DRIFT = [1.5, 3.5, 6.5] as const;

// The galaxy runs along this angle (radians).
const BAND_ANGLE = -0.46;

function pickColor(value: number): number {
  if (value < 0.34) return 0;
  if (value < 0.55) return 1;
  if (value < 0.75) return 2;
  if (value < 0.86) return 3;
  if (value < 0.94) return 4;
  return 5;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Small seeded generator so the backdrop looks identical every visit.
function mulberry(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A soft glowing star, drawn once and stamped many times. Giants get faint diffraction spikes.
function glowSprite(rgb: string, radius: number, spikes: boolean): HTMLCanvasElement {
  const size = Math.ceil(radius * 2);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const mid = size / 2;
  const glow = ctx.createRadialGradient(mid, mid, 0, mid, mid, mid);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.05, `rgba(${rgb},0.95)`);
  glow.addColorStop(0.14, `rgba(${rgb},0.38)`);
  glow.addColorStop(0.4, `rgba(${rgb},0.08)`);
  glow.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  if (spikes) {
    const across = ctx.createLinearGradient(0, 0, size, 0);
    across.addColorStop(0, `rgba(${rgb},0)`);
    across.addColorStop(0.5, `rgba(${rgb},0.55)`);
    across.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = across;
    ctx.fillRect(0, mid - 0.5, size, 1);

    const down = ctx.createLinearGradient(0, 0, 0, size);
    down.addColorStop(0, `rgba(${rgb},0)`);
    down.addColorStop(0.5, `rgba(${rgb},0.55)`);
    down.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = down;
    ctx.fillRect(mid - 0.5, 0, 1, size);
  }
  return canvas;
}

// One soft, optionally stretched and rotated cloud of light (or dark, for dust).
function cloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  stretch: number,
  angle: number,
  rgb: string,
  alpha: number,
) {
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

// The static deep field: galactic haze, a warm core, dust lanes, faint nebulae and thousands of
// pinprick stars. Painted once per size, so the animated layer on top stays cheap.
function paintDeepField(w: number, h: number, ratio: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * ratio));
  canvas.height = Math.max(1, Math.round(h * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.scale(ratio, ratio);
  const rand = mulberry(41);
  const gauss = () => (rand() + rand() + rand() + rand() - 2) * 0.5;
  const cx = w * 0.5;
  const cy = h * 0.52;
  const length = Math.hypot(w, h);
  const width = Math.min(w, h) * 0.3;
  const cos = Math.cos(BAND_ANGLE);
  const sin = Math.sin(BAND_ANGLE);
  const along = (t: number, off: number) => ({
    x: cx + cos * t - sin * off,
    y: cy + sin * t + cos * off,
  });

  // Faint nebulae well away from the band, so colour feels discovered rather than painted on.
  ctx.globalCompositeOperation = "lighter";
  const nebulae: Array<[number, number, number, string, number]> = [
    [0.18, 0.28, 0.34, "150,96,214", 0.05],
    [0.82, 0.72, 0.3, "226,120,92", 0.04],
    [0.7, 0.2, 0.26, "84,140,230", 0.04],
    [0.28, 0.82, 0.24, "70,190,190", 0.03],
  ];
  for (const [nx, ny, nr, rgb, a] of nebulae) {
    cloud(ctx, nx * w, ny * h, nr * Math.min(w, h) * 1.4, 1.5, rand() * Math.PI, rgb, a);
  }

  // Wide haze first, then the brighter, tighter arms.
  for (let i = 0; i < 34; i += 1) {
    const t = (rand() - 0.5) * length * 1.05;
    const off = gauss() * width * 0.35;
    const { x, y } = along(t, off);
    cloud(ctx, x, y, width * (1.1 + rand() * 0.9), 1.9, BAND_ANGLE, "120,150,235", 0.022);
  }
  for (let i = 0; i < 120; i += 1) {
    const t = (rand() - 0.5) * length * 0.98;
    const off = gauss() * width * 0.5;
    const { x, y } = along(t, off);
    const core = 1 - Math.min(1, Math.abs(t) / (length * 0.4));
    const warm = core > 0.5 && rand() < 0.65;
    const rgb = warm ? "255,222,182" : rand() < 0.5 ? "168,196,255" : "196,170,255";
    cloud(ctx, x, y, width * (0.3 + rand() * 0.6), 1.5 + rand(), BAND_ANGLE + (rand() - 0.5) * 0.4, rgb, 0.018 + 0.05 * core);
  }

  // The bright galactic bulge, slightly off-centre.
  const bulge = along(-length * 0.07, 0);
  cloud(ctx, bulge.x, bulge.y, width * 1.15, 2.1, BAND_ANGLE, "255,214,168", 0.14);
  cloud(ctx, bulge.x, bulge.y, width * 0.5, 1.7, BAND_ANGLE, "255,238,214", 0.15);

  // Dust lanes carve dark rifts through the glow.
  ctx.globalCompositeOperation = "source-over";
  for (let i = 0; i < 26; i += 1) {
    const t = (rand() - 0.5) * length * 0.8;
    const off = gauss() * width * 0.3;
    const { x, y } = along(t, off);
    cloud(ctx, x, y, width * (0.12 + rand() * 0.22), 3 + rand() * 2.5, BAND_ANGLE + (rand() - 0.5) * 0.25, "0,0,0", 0.3 + rand() * 0.25);
  }

  // Star dust: thousands of tiny points, crowded into the band.
  const dust = clamp(Math.round((w * h) / 380), 1400, 5200);
  for (let i = 0; i < dust; i += 1) {
    let x: number;
    let y: number;
    if (rand() < 0.62) {
      const p = along((rand() - 0.5) * length * 1.05, gauss() * width * 0.62);
      x = p.x;
      y = p.y;
    } else {
      x = rand() * w;
      y = rand() * h;
    }
    if (x < 0 || x > w || y < 0 || y > h) continue;
    const s = rand() < 0.08 ? 1.3 : 0.7 + rand() * 0.4;
    ctx.globalAlpha = 0.1 + Math.pow(rand(), 2.2) * 0.62;
    ctx.fillStyle = `rgb(${TINTS[rand() < 0.7 ? 0 : 1 + Math.floor(rand() * 4)] ?? TINTS[0]})`;
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
  return canvas;
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ w: 960, h: 640 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setSize({ w: Math.round(rect.width), h: Math.round(rect.height) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

function pressable(action: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: (event: MouseEvent) => {
      event.stopPropagation();
      action();
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        action();
      }
    },
  };
}

// Scatter every memory at a stable spot inside a soft ellipse, denser towards the middle like a
// galaxy, then nudge overlapping stars apart so each one stays tappable.
function scatter(memories: Memory[], area: Area, seed: number) {
  const n = memories.length;
  const cx = area.x + area.w / 2;
  const cy = area.y + area.h / 2;
  const rx = area.w / 2;
  const ry = area.h / 2;

  const pts = memories.map((memory) => {
    const key = `${memory.date}:${seed}`;
    const angle = unit(key, "a") * Math.PI * 2;
    const radius = Math.pow(unit(key, "r"), 0.72);
    return { x: cx + Math.cos(angle) * radius * rx, y: cy + Math.sin(angle) * radius * ry };
  });

  const minDist = Math.max(8, Math.min(30, Math.sqrt((area.w * area.h * 0.5) / Math.max(n, 1))));
  const passes = n > 1500 ? 2 : n > 600 ? 4 : 8;

  for (let pass = 0; pass < passes; pass += 1) {
    const grid = new Map<string, number[]>();
    for (let i = 0; i < pts.length; i += 1) {
      const p = pts[i];
      if (!p) continue;
      const cell = `${Math.floor(p.x / minDist)}:${Math.floor(p.y / minDist)}`;
      const bucket = grid.get(cell);
      if (bucket) bucket.push(i);
      else grid.set(cell, [i]);
    }

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
            if (j <= i) continue;
            const q = pts[j];
            if (!q) continue;
            let vx = q.x - p.x;
            let vy = q.y - p.y;
            let dist = Math.hypot(vx, vy);
            if (dist >= minDist) continue;
            if (dist < 0.001) {
              vx = 1;
              vy = 0;
              dist = 1;
            }
            const push = (minDist - dist) / 2;
            const nx = vx / dist;
            const ny = vy / dist;
            p.x -= nx * push;
            p.y -= ny * push;
            q.x += nx * push;
            q.y += ny * push;
          }
        }
      }
    }

    for (const p of pts) {
      p.x = clamp(p.x, area.x, area.x + area.w);
      p.y = clamp(p.y, area.y, area.y + area.h);
    }
  }

  return { pts, minDist };
}

export default function SkyCanvas({ memories, selected, today, panelOpen, seed, onPickDay, onBackground }: SkyCanvasProps) {
  const [wrapRef, size] = useElementSize<HTMLDivElement>();
  const deepRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- layer 1: the static deep field, painted once per size -------------------
  useEffect(() => {
    const canvas = deepRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.w * ratio);
    canvas.height = Math.round(size.h * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(paintDeepField(size.w, size.h, ratio), 0, 0);
  }, [size]);

  // --- layer 2: twinkling, drifting stars, glowing giants, rare shooting stars --
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size.w * ratio);
    canvas.height = Math.round(size.h * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;

    const { w, h } = size;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const bigSprites = TINTS.map((rgb) => glowSprite(rgb, 34 * ratio, true));
    const midSprites = TINTS.map((rgb) => glowSprite(rgb, 11 * ratio, false));

    const rand = mulberry(7);
    const gauss = () => (rand() + rand() + rand() + rand() - 2) * 0.5;
    const total = clamp(Math.round((w * h) / 3600), 90, 300);
    const length = Math.hypot(w, h);
    const bandWidth = Math.min(w, h) * 0.17;
    const cos = Math.cos(BAND_ANGLE);
    const sin = Math.sin(BAND_ANGLE);

    const specks: Speck[] = [];
    for (let i = 0; i < total; i += 1) {
      let x: number;
      let y: number;
      if (rand() < 0.5) {
        const t = (rand() - 0.5) * length * 1.05;
        const off = gauss() * bandWidth;
        x = w / 2 + cos * t - sin * off;
        y = h * 0.52 + sin * t + cos * off;
      } else {
        x = rand() * w;
        y = rand() * h;
      }
      if (x < -10 || x > w + 10 || y < -10 || y > h + 10) continue;

      const roll = rand();
      // Giants are rare on purpose: a handful of bright, spiked stars read as real.
      const kind: 0 | 1 | 2 = roll > 0.985 ? 2 : roll > 0.9 ? 1 : 0;
      const tint = rand() < 0.6 ? 0 : 1 + Math.floor(rand() * (TINTS.length - 1));
      const layer = Math.floor(rand() * 3);
      specks.push({
        x,
        y,
        size: kind === 0 ? 0.4 + rand() * 0.8 + layer * 0.12 : 1,
        alpha: kind === 0 ? 0.3 + rand() * 0.55 : kind === 1 ? 0.5 + rand() * 0.3 : 0.7 + rand() * 0.3,
        layer,
        phase: rand() * Math.PI * 2,
        rate: 0.4 + rand() * 2.2,
        tint,
        kind,
        fill: `rgb(${TINTS[tint] ?? TINTS[0]})`,
      });
    }

    const shots: Shot[] = [];
    let nextShot = performance.now() + 2500;
    let last = performance.now();
    let raf = 0;

    const spawnShot = () => {
      const bright = Math.random() < 0.2;
      const toRight = Math.random() < 0.6;
      const base = ((16 + Math.random() * 26) * Math.PI) / 180;
      const angle = toRight ? base : Math.PI - base;
      const speed = (bright ? 980 : 700) + Math.random() * 420;
      shots.push({
        x: toRight ? Math.random() * w * 0.7 : w * 0.3 + Math.random() * w * 0.7,
        y: -10 + Math.random() * h * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        ttl: bright ? 1.0 + Math.random() * 0.4 : 0.6 + Math.random() * 0.4,
        len: bright ? 260 + Math.random() * 120 : 130 + Math.random() * 90,
        bright,
      });
    };

    const paint = (now: number, dt: number) => {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, w, h);
      context.globalAlpha = 1;

      const t = now / 1000;
      for (const s of specks) {
        if (!reduceMotion) {
          const speed = DRIFT[s.layer] ?? 3.5;
          s.x -= speed * dt;
          s.y += speed * 0.25 * dt;
          if (s.x < -40) s.x = w + 40;
          if (s.y > h + 40) s.y = -40;
        }

        const swing = s.kind === 0 ? 0.55 : s.kind === 1 ? 0.3 : 0.18;
        const twinkle = reduceMotion ? 1 : 1 - swing * (0.5 + 0.5 * Math.sin(t * s.rate + s.phase));
        context.globalAlpha = s.alpha * twinkle;

        if (s.kind === 0) {
          context.fillStyle = s.fill;
          context.beginPath();
          context.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          context.fill();
        } else {
          const sprite = (s.kind === 2 ? bigSprites : midSprites)[s.tint];
          if (!sprite) continue;
          const radius = s.kind === 2 ? 34 : 11;
          context.drawImage(sprite, s.x - radius, s.y - radius, radius * 2, radius * 2);
        }
      }
      context.globalAlpha = 1;

      if (reduceMotion) return;

      if (now > nextShot) {
        spawnShot();
        if (Math.random() < 0.12) spawnShot();
        nextShot = now + 3200 + Math.random() * 5200;
      }

      for (let i = shots.length - 1; i >= 0; i -= 1) {
        const shot = shots[i];
        if (!shot) continue;
        shot.age += dt;
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        const progress = shot.age / shot.ttl;
        if (progress >= 1) {
          shots.splice(i, 1);
          continue;
        }

        const fade = Math.pow(Math.sin(progress * Math.PI), 0.7);
        const speed = Math.hypot(shot.vx, shot.vy);
        const tailX = shot.x - (shot.vx / speed) * shot.len;
        const tailY = shot.y - (shot.vy / speed) * shot.len;

        const trail = context.createLinearGradient(tailX, tailY, shot.x, shot.y);
        trail.addColorStop(0, "rgba(190,214,255,0)");
        trail.addColorStop(0.7, `rgba(215,230,255,${(0.35 * fade).toFixed(3)})`);
        trail.addColorStop(1, `rgba(255,255,255,${(0.95 * fade).toFixed(3)})`);

        context.lineCap = "round";
        context.strokeStyle = trail;
        context.lineWidth = shot.bright ? 3.6 : 2.4;
        context.globalAlpha = 0.25;
        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(shot.x, shot.y);
        context.stroke();

        context.globalAlpha = 1;
        context.lineWidth = shot.bright ? 1.5 : 1;
        context.beginPath();
        context.moveTo(tailX, tailY);
        context.lineTo(shot.x, shot.y);
        context.stroke();

        const headR = shot.bright ? 10 : 6;
        const head = context.createRadialGradient(shot.x, shot.y, 0, shot.x, shot.y, headR);
        head.addColorStop(0, `rgba(255,255,255,${(0.95 * fade).toFixed(3)})`);
        head.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = head;
        context.fillRect(shot.x - headR, shot.y - headR, headR * 2, headR * 2);
      }
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      paint(now, dt);
      raf = requestAnimationFrame(frame);
    };

    paint(last, 0);
    if (!reduceMotion) raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  // --- scene geometry -------------------------------------------------------
  const compact = size.w < 640;
  const headerHeight = compact ? 150 : 168;
  const footerHeight = 96;
  const padding = compact ? 22 : 64;

  const { placed, hitRadius } = useMemo(() => {
    const area: Area = {
      x: padding,
      y: headerHeight,
      w: Math.max(200, size.w - padding * 2),
      h: Math.max(200, size.h - headerHeight - footerHeight),
    };
    const { pts, minDist } = scatter(memories, area, seed);

    const list: Placed[] = [];
    memories.forEach((memory, index) => {
      const p = pts[index];
      if (!p) return;
      const key = `${memory.date}:style`;
      list.push({
        memory,
        x: p.x,
        y: p.y,
        color: pickColor(unit(key, "c")),
        r: clamp(memory.radius, 1.8, 4.2),
        twinkle: unit(key, "t") < 0.7,
        duration: 2.4 + unit(key, "d") * 4,
        delay: -unit(key, "l") * 6,
      });
    });

    return { placed: list, hitRadius: clamp(minDist / 2, 8, 16) };
  }, [memories, seed, size.w, size.h, padding, headerHeight, footerHeight]);

  // The open star quietly reaches for the day before and the day after, like a constellation.
  const links = useMemo(() => {
    if (!selected) return [] as Array<{ from: Placed; to: Placed }>;
    const sorted = [...placed].sort((a, b) => (a.memory.date < b.memory.date ? -1 : a.memory.date > b.memory.date ? 1 : 0));
    const at = sorted.findIndex((entry) => entry.memory.date === selected);
    const here = sorted[at];
    if (!here) return [];
    const out: Array<{ from: Placed; to: Placed }> = [];
    const before = sorted[at - 1];
    const after = sorted[at + 1];
    if (before) out.push({ from: here, to: before });
    if (after) out.push({ from: here, to: after });
    return out;
  }, [placed, selected]);

  // --- camera: nudge the scene so the selected star is never under the panel
  let cameraX = 0;
  let cameraY = 0;
  if (panelOpen && selected) {
    const star = placed.find((entry) => entry.memory.date === selected);
    if (star) {
      if (size.w >= 1024) {
        const limit = size.w - 372 - 40;
        if (star.x > limit) cameraX = limit - star.x;
      } else {
        const limit = size.h * 0.34;
        if (star.y > limit) cameraY = limit - star.y;
      }
    }
  }

  // --- gentle pointer parallax: written straight to CSS variables, no re-render
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--px", ((event.clientX - rect.left) / rect.width - 0.5).toFixed(3));
    el.style.setProperty("--py", ((event.clientY - rect.top) / rect.height - 0.5).toFixed(3));
  };

  return (
    <div ref={wrapRef} className="obs-sky absolute inset-0 overflow-hidden" onPointerMove={onMove}>
      <div className="obs-drift absolute inset-0" aria-hidden="true">
        <canvas ref={deepRef} className="obs-parallax-far absolute inset-0 h-full w-full" />
        <canvas ref={canvasRef} className="obs-parallax-mid absolute inset-0 h-full w-full" />
      </div>

      <svg
        className="obs-svg absolute inset-0 h-full w-full"
        viewBox={`0 0 ${size.w} ${size.h}`}
        role="group"
        aria-label="Journal memories"
        onClick={onBackground}
      >
        <defs>
          {PALETTE.map((color, index) => (
            <radialGradient key={`glow-${color}`} id={`obs-glow-${index}`}>
              <stop offset="0%" stopColor={color} stopOpacity={0.6} />
              <stop offset="22%" stopColor={color} stopOpacity={0.2} />
              <stop offset="55%" stopColor={color} stopOpacity={0.05} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </radialGradient>
          ))}
          {PALETTE.map((color, index) => (
            <radialGradient key={`core-${color}`} id={`obs-core-${index}`} cx="50%" cy="50%" fx="38%" fy="34%" r="62%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="34%" stopColor="#ffffff" />
              <stop offset="72%" stopColor={color} />
              <stop offset="100%" stopColor={color} stopOpacity={0.8} />
            </radialGradient>
          ))}
          {PALETTE.map((color, index) => (
            <linearGradient key={`spike-${color}`} id={`obs-spike-${index}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity={0} />
              <stop offset="50%" stopColor={color} stopOpacity={0.85} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          ))}
          {PALETTE.map((color, index) => (
            <radialGradient key={`tight-${color}`} id={`obs-tight-${index}`}>
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0.95} />
              <stop offset="30%" stopColor={color} stopOpacity={0.6} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </radialGradient>
          ))}
          <linearGradient id="obs-link" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0.08} />
          </linearGradient>
        </defs>

        <g className="obs-camera" style={{ transform: `translate(${cameraX}px, ${cameraY}px)` }}>
          <g className="obs-parallax-near">
            {links.map(({ from, to }) => (
              <line
                key={`${from.memory.date}-${to.memory.date}`}
                className="obs-link"
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
              />
            ))}

            {placed.map((star, index) => {
              const { memory } = star;
              const isSelected = selected === memory.date;
              const isToday = memory.date === today;
              const brightness = Math.max(0.6, memory.brightness);
              const label = `${formatLongDate(memory.date)}${memory.title ? `: ${memory.title}` : ""}${
                memory.photoCount > 0 ? ", with photographs" : ""
              }`;
              const twinkles = star.twinkle && !isSelected;
              const flare = star.r >= 2.4 || isSelected;
              const flareLength = star.r * (isSelected ? 8 : 6);
              const diagonal = star.r >= 3.4 || isSelected;

              const nodeStyle: CSSProperties = {
                transform: `translate(${star.x}px, ${star.y}px)`,
                animationDelay: `${Math.min(index * 5, 900)}ms`,
              };
              const bobStyle: CSSProperties = {
                animationDuration: `${(star.duration * 2.4).toFixed(2)}s`,
                animationDelay: `${(star.delay * 1.5).toFixed(2)}s`,
              };
              const coreStyle = {
                opacity: isSelected ? 1 : brightness,
                "--d": `${star.duration.toFixed(2)}s`,
                "--dl": `${star.delay.toFixed(2)}s`,
              } as CSSProperties;

              return (
                <g
                  key={memory.date}
                  className="obs-hit obs-node"
                  data-star={memory.date}
                  aria-label={label}
                  aria-pressed={isSelected}
                  style={nodeStyle}
                  {...pressable(() => onPickDay(memory.date))}
                >
                  <circle r={hitRadius} fill="transparent" />
                  <circle className="obs-focus" r={star.r + 9} />

                  <g className="obs-bob" style={bobStyle}>
                    {isSelected && (
                      <g className="obs-selected">
                        <circle className="obs-select-glow" r={star.r + 24} />
                        <circle className="obs-ping" r={star.r + 8} />
                        <circle className="obs-halo" r={star.r + 8} />
                      </g>
                    )}

                    <circle
                      className="obs-glow"
                      r={star.r * 11}
                      fill={`url(#obs-glow-${star.color})`}
                      opacity={isSelected ? 1 : brightness * 0.7}
                    />
                    <circle
                      className="obs-glow-tight"
                      r={star.r * 3.4}
                      fill={`url(#obs-tight-${star.color})`}
                      opacity={isSelected ? 1 : Math.min(1, brightness + 0.1)}
                    />

                    {flare && (
                      <g className="obs-flare" opacity={isSelected ? 0.95 : 0.42 * brightness}>
                        <rect x={-flareLength} y={-0.5} width={flareLength * 2} height={1} fill={`url(#obs-spike-${star.color})`} />
                        <rect x={-flareLength} y={-0.5} width={flareLength * 2} height={1} fill={`url(#obs-spike-${star.color})`} transform="rotate(90)" />
                        {diagonal && (
                          <g opacity={0.45}>
                            <rect x={-flareLength * 0.55} y={-0.4} width={flareLength * 1.1} height={0.8} fill={`url(#obs-spike-${star.color})`} transform="rotate(45)" />
                            <rect x={-flareLength * 0.55} y={-0.4} width={flareLength * 1.1} height={0.8} fill={`url(#obs-spike-${star.color})`} transform="rotate(-45)" />
                          </g>
                        )}
                      </g>
                    )}

                    {memory.photoCount > 0 && <circle className="obs-ring" r={star.r + 5} />}
                    <circle
                      className={"obs-core" + (twinkles ? " obs-twinkle" : "")}
                      r={star.r}
                      fill={`url(#obs-core-${star.color})`}
                      style={coreStyle}
                    />
                    {isToday && <circle className="obs-today" r={star.r + 8.5} />}
                  </g>

                  <text
                    className={"obs-tip" + (isSelected ? " obs-tip-on" : "")}
                    y={star.r + 21}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={500}
                  >
                    {formatLongDate(memory.date)}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}