import { memo, useEffect, useRef } from "react";
import { BG, TILE_PX, levelFor, renderTileSteps, tileWorldSize } from "./cityGen";
import type { MapController, View } from "./useMapView";

// The map is an endless procedural 

const FADE_MS = 650;
const SWEEP_FIRST_MS = 450;
const SWEEP_EVERY_MS = 7600;
const SWEEP_LENGTH_MS = 3800;
const GEN_BUDGET_MS = 7;
const MAX_TILES = 72;
const MAX_VISIBLE_TILES = 400;

interface Tile {
  level: number;
  tx: number;
  ty: number;
  base: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  steps: Generator<void, void, void> | null;
  born: number;
  used: number;
}

interface Wanted {
  key: string;
  tx: number;
  ty: number;
  dist: number;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const tileKey = (level: number, tx: number, ty: number) => `${level}/${tx}/${ty}`;

function release(tile: Tile): void {
  if (tile.steps) tile.steps.return();
  tile.steps = null;
  tile.base.width = 0;
  tile.glow.width = 0;
}

function WorldArt({ controller }: { controller: MapController }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 });

  useEffect(() => {
    return controller.subscribe((v) => {
      viewRef.current = v;
    });
  }, [controller]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const scratch = document.createElement("canvas");
    const sctx = scratch.getContext("2d");
    if (!sctx) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motion.matches;
    const onMotion = () => {
      reduced = motion.matches;
    };
    motion.addEventListener("change", onMotion);

    let dpr = window.devicePixelRatio || 1;
    let w = 0;
    let h = 0;
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      scratch.width = Math.max(1, Math.ceil(w * 0.5));
      scratch.height = Math.max(1, Math.ceil(h * 0.5));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const cache = new Map<string, Tile>();
    const startedAt = performance.now();
    let frame = 0;
    let raf = 0;

    const createTile = (level: number, tx: number, ty: number): Tile | null => {
      const base = document.createElement("canvas");
      base.width = TILE_PX;
      base.height = TILE_PX;
      const glow = document.createElement("canvas");
      glow.width = TILE_PX / 2;
      glow.height = TILE_PX / 2;
      const bctx = base.getContext("2d");
      const gctx = glow.getContext("2d");
      if (!bctx || !gctx) return null;
      return { level, tx, ty, base, glow, steps: renderTileSteps(bctx, gctx, level, tx, ty), born: 0, used: frame };
    };

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (w === 0 || h === 0) return;

      frame += 1;
      const clock = performance.now();
      const v = viewRef.current;
      const level = levelFor(v.k * dpr);
      const size = tileWorldSize(level);

      const wx0 = -v.x / v.k;
      const wy0 = -v.y / v.k;
      const wx1 = wx0 + w / v.k;
      const wy1 = wy0 + h / v.k;
      const cxw = (wx0 + wx1) / 2;
      const cyw = (wy0 + wy1) / 2;

      // Which tiles does the screen need right now?
      const wanted: Wanted[] = [];
      const txMin = Math.floor(wx0 / size);
      const txMax = Math.floor(wx1 / size);
      const tyMin = Math.floor(wy0 / size);
      const tyMax = Math.floor(wy1 / size);
      if ((txMax - txMin + 1) * (tyMax - tyMin + 1) > MAX_VISIBLE_TILES) return;
      for (let ty = tyMin; ty <= tyMax; ty += 1) {
        for (let tx = txMin; tx <= txMax; tx += 1) {
          const dx = (tx + 0.5) * size - cxw;
          const dy = (ty + 0.5) * size - cyw;
          wanted.push({ key: tileKey(level, tx, ty), tx, ty, dist: dx * dx + dy * dy });
        }
      }
      wanted.sort((a, b) => a.dist - b.dist);
      const wantedKeys = new Set(wanted.map((item) => item.key));

      // Stop building tiles nobody needs any more.
      for (const [key, tile] of cache) {
        if (tile.steps && !wantedKeys.has(key)) {
          release(tile);
          cache.delete(key);
        }
      }

      // Build missing tiles, centre first, within a small time budget.
      const genStart = performance.now();
      for (const item of wanted) {
        if (performance.now() - genStart > GEN_BUDGET_MS) break;
        let tile = cache.get(item.key);
        if (!tile) {
          const created = createTile(level, item.tx, item.ty);
          if (!created) continue;
          tile = created;
          cache.set(item.key, tile);
        }
        while (tile.steps && performance.now() - genStart <= GEN_BUDGET_MS) {
          if (tile.steps.next().done) {
            tile.steps = null;
            tile.born = clock;
          }
        }
      }
      for (const item of wanted) {
        const tile = cache.get(item.key);
        if (tile) tile.used = frame;
      }

      // ---- Paint ----
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const place = (target: CanvasRenderingContext2D, tile: Tile, img: HTMLCanvasElement, alpha: number, scale: number) => {
        const worldSize = tileWorldSize(tile.level);
        const px = worldSize * v.k * scale;
        const x = (tile.tx * worldSize * v.k + v.x) * scale;
        const y = (tile.ty * worldSize * v.k + v.y) * scale;
        const left = Math.floor(x);
        const top = Math.floor(y);
        target.globalAlpha = alpha;
        target.drawImage(img, left, top, Math.ceil(x + px) - left, Math.ceil(y + px) - top);
      };

      const fadeOf = (tile: Tile) => (reduced ? 1 : easeOut(clamp01((clock - tile.born) / FADE_MS)));

      // While tiles are still arriving, show the nearest-looking tiles from other zoom levels underneath.
      let settled = true;
      for (const item of wanted) {
        const tile = cache.get(item.key);
        if (!tile || tile.steps || clock - tile.born < FADE_MS) {
          settled = false;
          break;
        }
      }
      if (!settled) {
        const under: Tile[] = [];
        for (const tile of cache.values()) {
          if (tile.steps || tile.level === level) continue;
          const s = tileWorldSize(tile.level);
          if ((tile.tx + 1) * s < wx0 || tile.tx * s > wx1 || (tile.ty + 1) * s < wy0 || tile.ty * s > wy1) continue;
          under.push(tile);
        }
        under.sort((a, b) => Math.abs(b.level - level) - Math.abs(a.level - level));
        for (const tile of under) place(ctx, tile, tile.base, 1, dpr);
      }

      const live: Tile[] = [];
      for (const item of wanted) {
        const tile = cache.get(item.key);
        if (!tile || tile.steps) continue;
        live.push(tile);
        place(ctx, tile, tile.base, fadeOf(tile), dpr);
      }

      // ---- Light: a gentle shimmer on the main roads, plus a sonar sweep ----
      if (!reduced && live.length > 0) {
        ctx.globalCompositeOperation = "lighter";
        const shimmer = 0.1 + 0.05 * Math.sin(clock / 1700);
        for (const tile of live) place(ctx, tile, tile.glow, shimmer * fadeOf(tile), dpr);

        const since = clock - startedAt - SWEEP_FIRST_MS;
        const phase = since >= 0 ? since % SWEEP_EVERY_MS : -1;
        if (phase >= 0 && phase < SWEEP_LENGTH_MS) {
          const p = phase / SWEEP_LENGTH_MS;
          const maxR = Math.hypot(w, h) * 0.55;
          const r = easeOut(p) * maxR;
          const band = Math.max(80, maxR * 0.14);
          const envelope = Math.pow(1 - p, 1.15);
          const cx = w / 2;
          const cy = h / 2;

          sctx.globalCompositeOperation = "source-over";
          sctx.globalAlpha = 1;
          sctx.setTransform(1, 0, 0, 1, 0, 0);
          sctx.clearRect(0, 0, scratch.width, scratch.height);
          for (const tile of live) place(sctx, tile, tile.glow, 1, 0.5);

          const mask = sctx.createRadialGradient(cx * 0.5, cy * 0.5, Math.max(0, r - band) * 0.5, cx * 0.5, cy * 0.5, (r + band * 0.25) * 0.5);
          mask.addColorStop(0, "rgba(0,0,0,0)");
          mask.addColorStop(0.8, "rgba(0,0,0,1)");
          mask.addColorStop(1, "rgba(0,0,0,0)");
          sctx.globalCompositeOperation = "destination-in";
          sctx.globalAlpha = 1;
          sctx.fillStyle = mask;
          sctx.fillRect(0, 0, scratch.width, scratch.height);

          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = envelope;
          ctx.drawImage(scratch, 0, 0, canvas.width, canvas.height);

          // A very faint wash of light travelling with the ring.
          const wash = ctx.createRadialGradient(cx * dpr, cy * dpr, Math.max(0, r - band) * dpr, cx * dpr, cy * dpr, (r + band * 0.25) * dpr);
          wash.addColorStop(0, "rgba(120,190,255,0)");
          wash.addColorStop(0.8, "rgba(120,190,255,0.05)");
          wash.addColorStop(1, "rgba(120,190,255,0)");
          ctx.globalAlpha = envelope;
          ctx.fillStyle = wash;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      // ---- Keep memory in check ----
      if (cache.size > MAX_TILES) {
        const old = [...cache.entries()].filter(([key]) => !wantedKeys.has(key)).sort((a, b) => a[1].used - b[1].used);
        let over = cache.size - MAX_TILES;
        for (const [key, tile] of old) {
          if (over <= 0) break;
          release(tile);
          cache.delete(key);
          over -= 1;
        }
      }
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      motion.removeEventListener("change", onMotion);
      for (const tile of cache.values()) release(tile);
      cache.clear();
    };
  }, []);

  return <canvas ref={canvasRef} className="mr-canvas absolute inset-0 h-full w-full" aria-hidden="true" />;
}

export default memo(WorldArt);