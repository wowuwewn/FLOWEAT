/**
 * Camera counting error, measured (src/core/data/count-error.json), as a sampler.
 *   observe(rng, trueCount)   → what the camera would report (for evaluation)
 *   plausibleTrue(rng, seen)  → a draw of the true count given what was seen (for the wait model)
 * Beyond the largest measured count, misses grow with the line: each extra person is missed with the
 * per-person miss rate measured at the largest count (people hide behind each other in long lines).
 */
import errJson from "../data/count-error.json";
import type { Rng } from "../sim/rng";

export type CounterMode = "hybrid" | "tracked" | "roi";
type Dist = { d: number; p: number }[];

const tables: Record<CounterMode, Dist[]> = {} as Record<CounterMode, Dist[]>;
for (const mode of ["hybrid", "tracked", "roi"] as CounterMode[]) {
  const m = (errJson.modes as Record<string, Record<string, Record<string, number>>>)[mode];
  const out: Dist[] = [];
  for (const [g, e] of Object.entries(m)) {
    const tot = Object.values(e).reduce((a, b) => a + b, 0);
    out[Number(g)] = Object.entries(e).map(([d, n]) => ({ d: Number(d), p: n / tot }));
  }
  tables[mode] = out;
}

function draw(rng: Rng, dist: Dist): number {
  let u = rng();
  for (const x of dist) if ((u -= x.p) <= 0) return x.d;
  return dist[dist.length - 1].d;
}

function stats(mode: CounterMode) {
  const t = tables[mode];
  const top = t.length - 1;
  const under = t[top].reduce((a, x) => a + (x.d < 0 ? -x.d * x.p : 0), 0);
  const over = t[top].reduce((a, x) => a + (x.d > 0 ? x.p : 0), 0);
  return { top, missRate: under / Math.max(1, top), overRate: over };
}

export function observe(rng: Rng, trueCount: number, mode: CounterMode = "hybrid"): number {
  const t = tables[mode];
  if (trueCount < t.length && t[trueCount]) return Math.max(0, trueCount + draw(rng, t[trueCount]));
  const { missRate, overRate } = stats(mode);
  let seen = trueCount;
  for (let i = 0; i < trueCount; i++) if (rng() < missRate) seen--;
  if (rng() < overRate) seen++;
  return Math.max(0, seen);
}

/** Inverse: undercounting dominates, so the true line is usually the same or a little longer. */
export function plausibleTrue(rng: Rng, seen: number, mode: CounterMode = "hybrid"): number {
  // P(true = g | seen) ∝ P(seen | g) with a flat prior over g ∈ [seen-2, seen+ceil(0.6·seen)+2]
  const lo = Math.max(0, seen - 2);
  const hi = seen + Math.ceil(seen * 0.6) + 2;
  const w: number[] = [];
  for (let g = lo; g <= hi; g++) w.push(likelihood(seen, g, mode));
  const tot = w.reduce((a, b) => a + b, 0);
  let u = rng() * tot;
  for (let i = 0; i < w.length; i++) if ((u -= w[i]) <= 0) return lo + i;
  return seen;
}

function likelihood(seen: number, g: number, mode: CounterMode): number {
  const t = tables[mode];
  if (g < t.length && t[g]) return t[g].find((x) => x.d === seen - g)?.p ?? 0;
  const { missRate, overRate } = stats(mode);
  // binomial misses (+ rare extra person)
  const pmf = (k: number) => (k < 0 || k > g ? 0 : binom(g, k) * missRate ** k * (1 - missRate) ** (g - k));
  return (1 - overRate) * pmf(g - seen) + overRate * pmf(g + 1 - seen);
}

function binom(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}
