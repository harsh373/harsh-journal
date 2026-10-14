import { getWorld, hashString, rng, WORLD_H, WORLD_W } from "./world";
import type { Pt } from "./world";

// A landmark's position is decided exactly once, when the quote is created, and then
// stored with the quote. Nothing here ever moves an existing landmark.

const MIN_GAP = 26;

function nearestTaken(x: number, y: number, taken: { x: number; y: number }[]): number {
  let m = Infinity;
  for (const t of taken) {
    const d = Math.hypot(t.x - x, t.y - y);
    if (d < m) m = d;
  }
  return m;
}

function bestOf(sites: Pt[], taken: { x: number; y: number }[], rand: () => number): Pt | null {
  let best: Pt | null = null;
  let bestScore = -1;
  for (const [x, y] of sites) {
    const nearest = nearestTaken(x, y, taken);
    if (nearest < MIN_GAP) continue;
    // Favour open ground, with a seeded wobble so the spread looks natural, not gridded.
    const score = Math.min(nearest, 260) * (0.65 + 0.7 * rand());
    if (score > bestScore) {
      bestScore = score;
      best = [x, y];
    }
  }
  return best;
}

export function pickLandmarkSite(taken: { x: number; y: number }[], seed: string): { x: number; y: number } {
  const world = getWorld();
  const rand = rng(hashString(seed));

  const site = bestOf(world.sitesA, taken, rand) ?? bestOf(world.sitesB, taken, rand);
  if (site) return { x: site[0], y: site[1] };

  // Every prepared site is taken (hundreds of quotes). Search the land for any free spot.
  for (let i = 0; i < 4000; i++) {
    const x = 40 + rand() * (WORLD_W - 80);
    const y = 40 + rand() * (WORLD_H - 80);
    if (world.isLand(x, y) && world.coastDist(x, y) > 20 && nearestTaken(x, y, taken) >= 18) return { x, y };
  }
  // Last resort: stack gently near an existing landmark rather than fail to save.
  const base = taken[taken.length - 1] ?? { x: WORLD_W / 2, y: WORLD_H / 2 };
  return { x: base.x + 12, y: base.y + 12 };
}