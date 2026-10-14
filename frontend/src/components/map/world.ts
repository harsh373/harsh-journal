// The fictional world. Everything here is generated from fixed seeds, so the map is
// identical on every visit, on every device, in light and dark mode.
//
// The same land polygons drive the artwork AND the placement rules, so a landmark can
// never end up in the sea or on top of a mountain.

export const WORLD_W = 1600;
export const WORLD_H = 1000;

export type Pt = [number, number];
type Box = [number, number, number, number];

export function rng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ---------- Hand-drawn outlines (coarse; roughened below into natural coastlines) ---------- */

const LANDMASSES: Pt[][] = [
  // Aurelia, the great western continent
  [[210, 470], [240, 390], [300, 330], [330, 250], [410, 200], [500, 215], [560, 170], [660, 150], [740, 185], [790, 260], [860, 300], [900, 380], [880, 460], [930, 540], [900, 620], [820, 660], [760, 720], [680, 700], [620, 760], [530, 790], [470, 740], [400, 760], [330, 700], [300, 620], [240, 580]],
  // Ostrel, the eastern land
  [[1010, 300], [1090, 240], [1190, 230], [1290, 270], [1360, 340], [1340, 430], [1390, 500], [1350, 590], [1270, 640], [1180, 620], [1120, 680], [1050, 640], [1030, 560], [1070, 490], [1020, 420]],
  // Calder, north-east island
  [[960, 120], [1040, 80], [1150, 85], [1210, 130], [1170, 180], [1080, 170], [1010, 190]],
  // Merrow, southern island
  [[1000, 800], [1080, 760], [1180, 780], [1250, 840], [1200, 900], [1100, 910], [1030, 870]],
  // Small islands
  [[90, 250], [140, 220], [180, 260], [150, 310], [100, 300]],
  [[110, 650], [170, 620], [210, 670], [160, 720], [100, 700]],
  [[330, 880], [390, 850], [440, 890], [400, 930], [340, 925]],
  [[1430, 180], [1490, 160], [1520, 210], [1470, 240]],
  [[1420, 780], [1490, 760], [1520, 820], [1460, 860], [1410, 830]],
  [[420, 70], [500, 50], [560, 90], [520, 130], [450, 120]],
];

const RANGES = [
  { spine: [[400, 330], [470, 350], [540, 330], [600, 390], [640, 470], [620, 560]] as Pt[], spread: 20, step: 12, size: 1 },
  { spine: [[640, 230], [710, 250], [770, 300], [800, 350]] as Pt[], spread: 16, step: 12, size: 0.85 },
  { spine: [[1100, 320], [1160, 350], [1220, 390], [1250, 450]] as Pt[], spread: 18, step: 12, size: 1 },
  { spine: [[1300, 330], [1330, 400]] as Pt[], spread: 12, step: 11, size: 0.7 },
  { spine: [[1040, 130], [1100, 140], [1150, 125]] as Pt[], spread: 10, step: 11, size: 0.7 },
  { spine: [[1090, 830], [1160, 840]] as Pt[], spread: 8, step: 11, size: 0.6 },
];

const FORESTS = [
  { x: 330, y: 500, r: 60, n: 48, conifer: true },
  { x: 480, y: 620, r: 70, n: 62, conifer: false },
  { x: 760, y: 520, r: 70, n: 58, conifer: true },
  { x: 700, y: 650, r: 55, n: 34, conifer: false },
  { x: 850, y: 430, r: 45, n: 26, conifer: true },
  { x: 1150, y: 540, r: 60, n: 46, conifer: false },
  { x: 1260, y: 560, r: 50, n: 36, conifer: true },
  { x: 1120, y: 850, r: 35, n: 18, conifer: false },
];

// Typed as Pt[] so each entry is known to be a real [x, y] pair.
const LAKE_SPOTS: Pt[] = [[470, 470], [760, 420], [1180, 520], [560, 680], [1290, 500]];

export interface Label {
  id: string;
  text: string;
  d: string;
  size: number;
  kind: "sea" | "land" | "isle";
  spacing: number;
}

const LABELS: Label[] = [
  { id: "aurelia", text: "AURELIA", d: "M330 610 Q460 540 600 575", size: 30, kind: "land", spacing: 14 },
  { id: "ostrel", text: "OSTREL", d: "M1090 575 Q1200 535 1300 575", size: 24, kind: "land", spacing: 12 },
  { id: "lenta", text: "Mare Lenta", d: "M520 900 Q740 860 950 920", size: 28, kind: "sea", spacing: 10 },
  { id: "pale", text: "The Pale Reach", d: "M620 80 Q790 40 940 72", size: 20, kind: "sea", spacing: 8 },
  { id: "sound", text: "Halcyon Sound", d: "M962 300 Q948 450 964 620", size: 14, kind: "sea", spacing: 7 },
  { id: "deep", text: "Western Deep", d: "M66 380 Q92 500 66 600", size: 14, kind: "sea", spacing: 7 },
  { id: "march", text: "Eastern March", d: "M1472 330 Q1494 520 1472 720", size: 14, kind: "sea", spacing: 7 },
  { id: "merrow", text: "Isle of Merrow", d: "M1050 850 Q1120 830 1200 855", size: 12, kind: "isle", spacing: 2 },
  { id: "calder", text: "Calder", d: "M1030 140 Q1095 122 1165 140", size: 12, kind: "isle", spacing: 3 },
];

/* ---------- Geometry helpers ---------- */

function roughen(poly: Pt[], rand: () => number, levels = 4, rough = 0.2): Pt[] {
  let pts = poly;
  let amp = rough;
  for (let l = 0; l < levels; l++) {
    const out: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (!a || !b) continue; // indexing can give undefined; skip a missing point
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const off = (rand() - 0.5) * 2 * amp * len;
      out.push(a, [(a[0] + b[0]) / 2 - (dy / len) * off, (a[1] + b[1]) / 2 + (dx / len) * off]);
    }
    pts = out;
    amp *= 0.58;
  }
  return pts;
}

const f = (n: number) => n.toFixed(1);

function smooth(pts: Pt[], closed = true): string {
  const n = pts.length;
  const first = pts[0];
  if (!first || n < 2) return "";
  // Always returns a real point: wraps around for closed shapes, clamps for open ones.
  const at = (i: number): Pt =>
    (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]) ?? first;

  let d = `M${f(first[0])} ${f(first[1])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? d + "Z" : d;
}

function blob(cx: number, cy: number, r: number, rand: () => number): string {
  const n = 12;
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.78 + rand() * 0.44);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8]);
  }
  return smooth(pts);
}

function inPoly(x: number, y: number, pts: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const pi = pts[i];
    const pj = pts[j];
    if (!pi || !pj) continue; // guard before reading coordinates
    const xi = pi[0];
    const yi = pi[1];
    const xj = pj[0];
    const yj = pj[1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ---------- Build ---------- */

export interface World {
  coast: string;
  peaks: { body: string; shade: string }[];
  spines: string[];
  spineScale: number[];
  forest: string;
  lakes: string[];
  rivers: string[];
  waves: string;
  labels: Label[];
  sitesA: Pt[];
  sitesB: Pt[];
  isLand: (x: number, y: number) => boolean;
  coastDist: (x: number, y: number) => number;
}

function build(): World {
  const rand = rng(20260915);

  // Each landmass keeps its own roughened outline and bounding box together,
  // so there is no separate array to index into.
  const shapes = LANDMASSES.map((outline) => {
    const pts = roughen(outline, rand);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const box: Box = [x0, y0, x1, y1];
    return { pts, box };
  });

  const flat: number[] = [];
  for (const { pts } of shapes) for (const [x, y] of pts) flat.push(x, y);

  const isLand = (x: number, y: number) =>
    shapes.some(({ pts, box }) => x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3] && inPoly(x, y, pts));

  const coastDist = (x: number, y: number) => {
    let m = 1e9;
    for (let i = 0; i < flat.length; i += 2) {
      const dx = (flat[i] ?? 0) - x;
      const dy = (flat[i + 1] ?? 0) - y;
      const d = dx * dx + dy * dy;
      if (d < m) m = d;
    }
    return Math.sqrt(m);
  };

  const coast = shapes.map(({ pts }) => smooth(pts)).join("");

  // Mountains, laid along each range's spine.
  const peakData: { x: number; y: number; w: number; h: number }[] = [];
  for (const range of RANGES) {
    for (let i = 0; i < range.spine.length - 1; i++) {
      const start = range.spine[i];
      const end = range.spine[i + 1];
      if (!start || !end) continue;
      const [ax, ay] = start;
      const [bx, by] = end;
      const len = Math.hypot(bx - ax, by - ay);
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      const count = Math.floor(len / range.step);
      for (let j = 0; j <= count; j++) {
        const t = j / Math.max(count, 1);
        const along = (rand() - 0.5) * range.step * 0.8;
        const spread = (rand() - 0.5) * 2 * range.spread;
        const x = ax + (bx - ax) * t + ((bx - ax) / len) * along + nx * spread;
        const y = ay + (by - ay) * t + ((by - ay) / len) * along + ny * spread;
        const foothill = rand() < 0.4;
        const size = (7 + rand() * 9) * range.size * (foothill ? 0.6 : 1);
        const fx = foothill ? nx * range.spread * 1.2 * (rand() < 0.5 ? 1 : -1) : 0;
        const fy = foothill ? ny * range.spread * 1.2 * (rand() < 0.5 ? 1 : -1) : 0;
        const px = x + fx;
        const py = y + fy;
        if (!isLand(px, py) || coastDist(px, py) < 22) continue;
        peakData.push({ x: px, y: py, w: size * 0.9, h: size * 1.25 });
      }
    }
  }
  peakData.sort((a, b) => a.y - b.y);
  const peaks = peakData.map(({ x, y, w, h }) => ({
    body: `M${f(x - w)} ${f(y)}L${f(x)} ${f(y - h)}L${f(x + w)} ${f(y)}Z`,
    shade: `M${f(x)} ${f(y - h)}L${f(x + w)} ${f(y)}L${f(x + w * 0.2)} ${f(y)}Z`,
  }));
  const nearPeak = (x: number, y: number, d: number) => peakData.some((p) => Math.hypot(p.x - x, p.y - y) < d);

  // Lakes.
  const lakeData: { x: number; y: number; r: number }[] = [];
  for (const [cx, cy] of LAKE_SPOTS) {
    if (isLand(cx, cy) && coastDist(cx, cy) > 45 && !nearPeak(cx, cy, 28)) {
      lakeData.push({ x: cx, y: cy, r: 12 + rand() * 10 });
    }
  }
  const lakes = lakeData.map((l) => blob(l.x, l.y, l.r, rand));

  // Rivers: each starts in the hills (or a lake) and meanders to the nearest sea.
  const riverFrom = (sx: number, sy: number): Pt[] => {
    let best = 0;
    let bestD = 1e9;
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      for (let d = 10; d < 420; d += 10) {
        if (!isLand(sx + Math.cos(ang) * d, sy + Math.sin(ang) * d)) {
          if (d < bestD) { bestD = d; best = ang; }
          break;
        }
      }
    }
    const pts: Pt[] = [[sx, sy]];
    let x = sx;
    let y = sy;
    const phase = rand() * 6;
    for (let i = 0; i < 140; i++) {
      const ang = best + Math.sin(i * 0.28 + phase) * 0.7 + (rand() - 0.5) * 0.35;
      x += Math.cos(ang) * 6;
      y += Math.sin(ang) * 6;
      pts.push([x, y]);
      if (!isLand(x, y)) break;
    }
    return pts;
  };

  // River sources: chosen spine points, then every lake. The helper checks that the
  // range and the point both exist before using them.
  const sources: Pt[] = [];
  const addSource = (rangeIndex: number, pointIndex: number) => {
    const p = RANGES[rangeIndex]?.spine[pointIndex];
    if (p) sources.push(p);
  };
  addSource(0, 2); addSource(0, 3); addSource(0, 4); addSource(1, 2);
  addSource(2, 1); addSource(2, 2); addSource(3, 1);
  for (const l of lakeData) sources.push([l.x, l.y]);

  const rivers = sources
    .filter(([x, y]) => isLand(x, y))
    .map(([x, y]) => riverFrom(x, y))
    .filter((p) => p.length > 8)
    .map((p) => smooth(p, false));

  // Forests.
  let forest = "";
  for (const fo of FORESTS) {
    let placed = 0;
    for (let tries = 0; tries < fo.n * 14 && placed < fo.n; tries++) {
      const a = rand() * Math.PI * 2;
      const rr = fo.r * Math.sqrt(rand());
      const x = fo.x + Math.cos(a) * rr;
      const y = fo.y + Math.sin(a) * rr * 0.85;
      if (!isLand(x, y) || coastDist(x, y) < 14 || nearPeak(x, y, 16)) continue;
      if (lakeData.some((l) => Math.hypot(l.x - x, l.y - y) < l.r + 6)) continue;
      placed++;
      forest += fo.conifer || rand() < 0.25
        ? `M${f(x)} ${f(y - 5)}L${f(x + 3)} ${f(y + 1)}L${f(x - 3)} ${f(y + 1)}Z`
        : `M${f(x - 2.6)} ${f(y)}a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0Z`;
    }
  }

  // Quiet wave marks in open water.
  let waves = "";
  for (let tries = 0, placed = 0; tries < 2000 && placed < 70; tries++) {
    const x = 70 + rand() * (WORLD_W - 140);
    const y = 70 + rand() * (WORLD_H - 140);
    if (isLand(x, y) || coastDist(x, y) < 38) continue;
    placed++;
    waves += `M${f(x)} ${f(y)}q4 -3 8 0t8 0`;
  }

  // Landmark sites: well inside the land, clear of peaks and lakes, evenly spaced.
  const genSites = (minD: number, attempts: number, taken: Pt[]): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i < attempts; i++) {
      const x = 40 + rand() * (WORLD_W - 80);
      const y = 40 + rand() * (WORLD_H - 80);
      if (!isLand(x, y) || coastDist(x, y) < 30 || nearPeak(x, y, 20)) continue;
      if (lakeData.some((l) => Math.hypot(l.x - x, l.y - y) < l.r + 16)) continue;
      if (taken.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < minD)) continue;
      if (out.some(([tx, ty]) => Math.hypot(tx - x, ty - y) < minD)) continue;
      out.push([x, y]);
    }
    return out;
  };
  const sitesA = genSites(46, 7000, []);
  const sitesB = genSites(30, 9000, sitesA);

  return {
    coast,
    peaks,
    spines: RANGES.map((r) => smooth(r.spine, false)),
    spineScale: RANGES.map((r) => r.size),
    forest,
    lakes,
    rivers,
    waves,
    labels: LABELS,
    sitesA,
    sitesB,
    isLand,
    coastDist,
  };
}

let cache: World | null = null;
export function getWorld(): World {
  if (!cache) cache = build();
  return cache;
}