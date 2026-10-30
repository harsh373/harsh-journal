// Procedural, infinite city street map.
// Everything is a pure function of world coordinates, so tiles always line up and the map never repeats.

export const TILE_PX = 512;
export const MIN_LEVEL = -1;
export const MAX_LEVEL = 4;

export const BG = "#030304";

/** The glow layer is stored at half resolution to save memory; it is only used for soft light. */
export const GLOW_SCALE = 0.5;

// ---------- Noise ----------

function hash(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}

function hash01(ix: number, iy: number, seed: number): number {
  return hash(ix, iy, seed) / 4294967296;
}

function grad(h: number, x: number, y: number): number {
  switch (h & 7) {
    case 0: return x + y;
    case 1: return x - y;
    case 2: return -x + y;
    case 3: return -x - y;
    case 4: return x;
    case 5: return -x;
    case 6: return y;
    default: return -y;
  }
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

function perlin(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = fade(xf);
  const v = fade(yf);
  const n00 = grad(hash(xi, yi, seed), xf, yf);
  const n10 = grad(hash(xi + 1, yi, seed), xf - 1, yf);
  const n01 = grad(hash(xi, yi + 1, seed), xf, yf - 1);
  const n11 = grad(hash(xi + 1, yi + 1, seed), xf - 1, yf - 1);
  const a = n00 + u * (n10 - n00);
  const b = n01 + u * (n11 - n01);
  return a + v * (b - a);
}

// Roughly 0..1, centred on 0.5.
function fbm(x: number, y: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * perlin(fx, fy, seed + o * 31);
    norm += amp;
    amp *= 0.5;
    const nx = (fx * 0.8 - fy * 0.6) * 2;
    const ny = (fx * 0.6 + fy * 0.8) * 2;
    fx = nx;
    fy = ny;
  }
  return 0.5 + (sum / norm) * 0.85;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---------- World fields ----------

const SEED_LAND = 101;
const SEED_PARK = 202;
const SEED_ZONE = 303;
const SEED_DENS = 404;
const SEED_WARP = 505;

export const LAND_MIN = 0.37;
const PARK_MIN = 0.22;

function landField(x: number, y: number): number {
  return fbm(x * 0.00062 + 11.3, y * 0.00062 - 4.1, SEED_LAND, 4);
}
function parkField(x: number, y: number): number {
  return fbm(x * 0.0021 + 3.7, y * 0.0021 + 9.2, SEED_PARK, 3);
}
function zoneField(x: number, y: number): number {
  return fbm(x * 0.0011 - 6.1, y * 0.0011 + 2.4, SEED_ZONE, 2);
}
function densField(x: number, y: number): number {
  return fbm(x * 0.0016 + 1.9, y * 0.0016 - 7.7, SEED_DENS, 3);
}

/** True when a world point sits on land that has streets. Handy for placing pins. */
export function isBuiltLand(x: number, y: number): boolean {
  return landField(x, y) > LAND_MIN + 0.02 && parkField(x, y) > PARK_MIN;
}

// ---------- Street families ----------

interface Family {
  theta: number;
  spacing: number;
  seed: number;
  zoneLo: number;
  zoneHi: number;
}

const FAMILIES: readonly Family[] = [
  { theta: 0.31, spacing: 7, seed: 11, zoneLo: -1, zoneHi: 0.42 },
  { theta: -0.55, spacing: 9, seed: 23, zoneLo: 0.42, zoneHi: 0.62 },
  { theta: 1.05, spacing: 12, seed: 37, zoneLo: 0.62, zoneHi: 2 },
];

const WARP_AMP = 42;

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Ctx = CanvasRenderingContext2D;

// Smooth jitter that equals a random offset at every integer grid vertex. Because it is a function of grid
// position, two streets that cross always agree on where the crossing is.
function jitter(u: number, v: number, seed: number): [number, number] {
  const ui = Math.floor(u);
  const vi = Math.floor(v);
  const fu = u - ui;
  const fv = v - vi;
  const at4 = (k: number) => {
    const h00 = hash01(ui, vi, seed + k);
    const h10 = hash01(ui + 1, vi, seed + k);
    const h01 = hash01(ui, vi + 1, seed + k);
    const h11 = hash01(ui + 1, vi + 1, seed + k);
    const top = h00 + (h10 - h00) * fu;
    const bot = h01 + (h11 - h01) * fu;
    return top + (bot - top) * fv - 0.5;
  };
  return [at4(1) * 0.55, at4(2) * 0.55];
}

function* drawFamily(ctx: Ctx, fam: Family, rect: Rect, level: number): Generator<void, void, void> {
  const stride = level < 0 ? 2 ** -level : 1;
  const s = fam.spacing;
  const cos = Math.cos(fam.theta);
  const sin = Math.sin(fam.theta);
  const pad = WARP_AMP * 1.5 + s * 2;

  // Bounding box of the (padded) rect in grid space.
  let umin = Infinity;
  let umax = -Infinity;
  let vmin = Infinity;
  let vmax = -Infinity;
  const xs = [rect.x0 - pad, rect.x1 + pad];
  const ys = [rect.y0 - pad, rect.y1 + pad];
  for (const px of xs) {
    for (const py of ys) {
      const u = (px * cos + py * sin) / s;
      const v = (-px * sin + py * cos) / s;
      if (u < umin) umin = u;
      if (u > umax) umax = u;
      if (v < vmin) vmin = v;
      if (v > vmax) vmax = v;
    }
  }

  const sub = level >= 2 ? 4 : 2;

  for (let dir = 0; dir < 2; dir += 1) {
    ctx.beginPath();
    const iMin = dir === 0 ? umin : vmin;
    const iMax = dir === 0 ? umax : vmax;
    const jMin = dir === 0 ? vmin : umin;
    const jMax = dir === 0 ? vmax : umax;

    for (let i = Math.ceil(iMin / stride) * stride; i <= iMax; i += stride) {
      // Every line wobbles a little so streets are never perfectly parallel.
      const off = (hash01(i, dir, fam.seed + 5) - 0.5) * 0.35;
      let drawing = false;

      for (let j = Math.floor(jMin / stride) * stride; j < jMax; j += stride) {
        const mid = j + stride / 2;
        const a = dir === 0 ? i + off : mid;
        const b = dir === 0 ? mid : i + off;
        const gx = (a * cos - b * sin) * s;
        const gy = (a * sin + b * cos) * s;

        let keep = false;
        const zone = zoneField(gx, gy);
        if (zone >= fam.zoneLo && zone < fam.zoneHi) {
          const land = landField(gx, gy);
          if (land > LAND_MIN && parkField(gx, gy) > PARK_MIN) {
            const dens = densField(gx, gy);
            const pKeep = (0.5 + 0.48 * smooth(0.3, 0.62, dens)) * smooth(LAND_MIN, LAND_MIN + 0.05, land);
            keep = hash01(i, j, fam.seed + dir * 977) < pKeep;
          }
        }

        if (!keep) {
          drawing = false;
          continue;
        }

        for (let q = drawing ? 1 : 0; q <= sub; q += 1) {
          const t = j + (stride * q) / sub;
          const ua = dir === 0 ? i + off : t;
          const vb = dir === 0 ? t : i + off;
          const [ju, jv] = jitter(ua, vb, fam.seed);
          const ja = ua + ju;
          const jb = vb + jv;
          const px = (ja * cos - jb * sin) * s;
          const py = (ja * sin + jb * cos) * s;
          const wx = perlin(px * 0.0035, py * 0.0035, SEED_WARP) * 1.3 * WARP_AMP;
          const wy = perlin(px * 0.0035 + 40, py * 0.0035 - 17, SEED_WARP + 9) * 1.3 * WARP_AMP;
          const X = px + wx;
          const Y = py + wy;
          if (q === 0) ctx.moveTo(X, Y);
          else ctx.lineTo(X, Y);
        }
        drawing = true;
      }
    }
    ctx.stroke();
    yield;
  }
}

// ---------- Contour roads (marching squares on a global lattice) ----------

function at(a: ArrayLike<number>, i: number): number {
  return a[i] ?? 0;
}

function sampleGrid(
  field: (x: number, y: number) => number,
  gx0: number,
  gy0: number,
  nx: number,
  ny: number,
  cell: number,
): Float32Array {
  const vals = new Float32Array(nx * ny);
  for (let r = 0; r < ny; r += 1) {
    for (let c = 0; c < nx; c += 1) {
      vals[r * nx + c] = field(gx0 + c * cell, gy0 + r * cell);
    }
  }
  return vals;
}

function contourSegments(vals: Float32Array, gx0: number, gy0: number, nx: number, ny: number, cell: number, level: number): number[] {
  const out: number[] = [];
  const lerp = (v0: number, v1: number) => {
    const d = v1 - v0;
    return d === 0 ? 0.5 : (level - v0) / d;
  };
  for (let r = 0; r < ny - 1; r += 1) {
    for (let c = 0; c < nx - 1; c += 1) {
      const a = at(vals, r * nx + c); // top-left
      const b = at(vals, r * nx + c + 1); // top-right
      const d = at(vals, (r + 1) * nx + c); // bottom-left
      const e = at(vals, (r + 1) * nx + c + 1); // bottom-right
      const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (e > level ? 2 : 0) | (d > level ? 1 : 0);
      if (idx === 0 || idx === 15) continue;

      const x = gx0 + c * cell;
      const y = gy0 + r * cell;
      const tx = x + lerp(a, b) * cell; // top edge
      const ty = y;
      const rx = x + cell; // right edge
      const ry = y + lerp(b, e) * cell;
      const bx = x + lerp(d, e) * cell; // bottom edge
      const by = y + cell;
      const lx = x; // left edge
      const ly = y + lerp(a, d) * cell;

      switch (idx) {
        case 1: case 14: out.push(lx, ly, bx, by); break;
        case 2: case 13: out.push(bx, by, rx, ry); break;
        case 3: case 12: out.push(lx, ly, rx, ry); break;
        case 4: case 11: out.push(tx, ty, rx, ry); break;
        case 5: out.push(lx, ly, tx, ty, bx, by, rx, ry); break;
        case 6: case 9: out.push(tx, ty, bx, by); break;
        case 7: case 8: out.push(lx, ly, tx, ty); break;
        default: out.push(lx, ly, bx, by, tx, ty, rx, ry); break; // 10
      }
    }
  }
  return out;
}

function strokeSegments(ctx: Ctx, segs: number[], style: string, widthWorld: number, landOnly = false): void {
  if (segs.length === 0) return;
  ctx.strokeStyle = style;
  ctx.lineWidth = widthWorld;
  ctx.beginPath();
  for (let i = 0; i + 3 < segs.length; i += 4) {
    if (landOnly) {
      const mx = (at(segs, i) + at(segs, i + 2)) / 2;
      const my = (at(segs, i + 1) + at(segs, i + 3)) / 2;
      if (landField(mx, my) < LAND_MIN) continue;
    }
    ctx.moveTo(at(segs, i), at(segs, i + 1));
    ctx.lineTo(at(segs, i + 2), at(segs, i + 3));
  }
  ctx.stroke();
}

// A road is a contour line of a field. "wave" roads sweep across the map in a chosen direction with a wobble,
// "noise" roads wander freely. Different roads use different fields, so they cross like a real network.
interface RoadField {
  kind: "wave" | "noise";
  freq: number;
  ox: number;
  oy: number;
  seed: number;
  angle: number;
  period: number;
  wobble: number;
}

const HIGHWAYS: readonly RoadField[] = [
  { kind: "wave", freq: 0.0006, ox: 5.5, oy: 1.3, seed: 611, angle: 0.55, period: 1150, wobble: 0.75 },
  { kind: "wave", freq: 0.0005, ox: -3.2, oy: 8.8, seed: 622, angle: -0.95, period: 1500, wobble: 0.85 },
  { kind: "noise", freq: 0.00058, ox: 12.1, oy: -6.4, seed: 633, angle: 0, period: 1, wobble: 0 },
];

const ARTERIALS: readonly RoadField[] = [
  { kind: "wave", freq: 0.0012, ox: 2.8, oy: 6.6, seed: 711, angle: 1.3, period: 460, wobble: 0.9 },
  { kind: "wave", freq: 0.0014, ox: -7.1, oy: 3.3, seed: 722, angle: -0.2, period: 540, wobble: 0.9 },
  { kind: "wave", freq: 0.0013, ox: 9.4, oy: -2.2, seed: 733, angle: 2.25, period: 400, wobble: 1.0 },
  { kind: "noise", freq: 0.0015, ox: -1.7, oy: -9.9, seed: 744, angle: 0, period: 1, wobble: 0 },
  { kind: "noise", freq: 0.0019, ox: 4.6, oy: 11.5, seed: 755, angle: 0, period: 1, wobble: 0 },
];

function roadValue(road: RoadField, x: number, y: number): number {
  const n = fbm(x * road.freq + road.ox, y * road.freq + road.oy, road.seed, 3);
  if (road.kind === "noise") return n;
  const ramp = (x * Math.cos(road.angle) + y * Math.sin(road.angle)) / road.period;
  return 0.5 + 0.5 * Math.sin(2 * Math.PI * (ramp + road.wobble * (n - 0.5)));
}

function roadSegments(road: RoadField, gx0: number, gy0: number, nx: number, ny: number, cell: number): number[] {
  const vals = sampleGrid((x, y) => roadValue(road, x, y), gx0, gy0, nx, ny, cell);
  return contourSegments(vals, gx0, gy0, nx, ny, cell, 0.5);
}

// ---------- Tile ----------

export function levelFor(deviceScale: number): number {
  const l = Math.round(Math.log2(Math.max(deviceScale, 0.01)));
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, l));
}

export function tileWorldSize(level: number): number {
  return TILE_PX / 2 ** level;
}

/**
 * Draws one square tile. `base` receives the full map (opaque), `glow` receives only the major roads,
 * brighter, on a transparent background. They are used for the sonar sweep.
 */
export function* renderTileSteps(base: Ctx, glow: Ctx, level: number, tx: number, ty: number): Generator<void, void, void> {
  const sL = 2 ** level;
  const size = TILE_PX / sL;
  const rect: Rect = { x0: tx * size, y0: ty * size, x1: tx * size + size, y1: ty * size + size };

  const gs = sL * GLOW_SCALE;
  base.setTransform(sL, 0, 0, sL, -rect.x0 * sL, -rect.y0 * sL);
  glow.setTransform(gs, 0, 0, gs, -rect.x0 * gs, -rect.y0 * gs);
  for (const ctx of [base, glow]) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 0;
  }
  base.fillStyle = BG;
  base.fillRect(rect.x0 - 1, rect.y0 - 1, size + 2, size + 2);
  glow.clearRect(rect.x0 - 1, rect.y0 - 1, size + 2, size + 2);

  // Local streets
  const localPx = Math.max(0.7, 0.3 + 0.4 * sL);
  base.strokeStyle = "rgba(160,160,174,0.5)";
  base.lineWidth = localPx / sL;
  for (const fam of FAMILIES) yield* drawFamily(base, fam, rect, level);

  // Contour roads, sampled on a global lattice so neighbouring tiles agree exactly.
  const cell = 14 / sL;
  const pad = cell * 2;
  const gx0 = Math.floor((rect.x0 - pad) / cell) * cell;
  const gy0 = Math.floor((rect.y0 - pad) / cell) * cell;
  const nx = Math.ceil((rect.x1 + pad - gx0) / cell) + 1;
  const ny = Math.ceil((rect.y1 + pad - gy0) / cell) + 1;

  const artPx = 0.8 + 0.45 * sL ** 0.8;
  for (const road of ARTERIALS) {
    const segs = roadSegments(road, gx0, gy0, nx, ny, cell);
    strokeSegments(base, segs, "rgba(222,222,232,0.62)", artPx / sL, true);
  }
  yield;

  const hwPx = 1.2 + 0.8 * sL ** 0.8;
  for (const road of HIGHWAYS) {
    const segs = roadSegments(road, gx0, gy0, nx, ny, cell);
    strokeSegments(base, segs, "rgba(0,0,0,0.8)", (hwPx + 3) / sL);
    strokeSegments(base, segs, "#f1f1f3", hwPx / sL);
    strokeSegments(glow, segs, "#bfe6ff", (hwPx + 0.6) / sL);
  }
}

/** Runs every step at once. Handy for tests; the app uses renderTileSteps to stay smooth. */
export function renderTile(base: Ctx, glow: Ctx, level: number, tx: number, ty: number): void {
  const steps = renderTileSteps(base, glow, level, tx, ty);
  while (!steps.next().done) {
    // keep going
  }
}