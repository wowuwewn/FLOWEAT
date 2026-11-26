import type { StaffOrder } from "./orders/types";

/**
 * The shared call screen (both monitors show the same screen — field check 2026-11-26).
 * Five brand columns at a time, in the two groups seen in the 2026-11-25 photo.
 * Group 1's first column is cut off in that photo; 바비든든 is the only brand left (unconfirmed).
 */
export const MONITOR_GROUPS: string[][] = [
  ["babi", "popo420", "kaohsiung", "pokpung", "gapjjigae"],
  ["gyeongseong", "tokyoya", "jang51", "gwangttuk", "bibigogo"],
];
export const MONITOR_NEW_MS = 30_000;
export const MONITOR_PAGE_MS = 10_000;

/**
 * Which group every monitor shows at `now`. A pure function of the shared order list and the clock,
 * so any number of screens agree: the group of the most recent call (last 30 s) wins, otherwise the
 * groups alternate on wall-clock boundaries. How the real screen pages is not known.
 */
export function monitorPage(ready: Pick<StaffOrder, "brandId" | "readyAt">[], now: number): number {
  let best: { brandId: string; readyAt: number } | null = null;
  for (const o of ready) if (o.readyAt != null && now - o.readyAt < MONITOR_NEW_MS && (!best || o.readyAt > best.readyAt)) best = { brandId: o.brandId, readyAt: o.readyAt };
  if (best) {
    const g = MONITOR_GROUPS.findIndex((grp) => grp.includes(best!.brandId));
    if (g >= 0) return g;
  }
  return Math.floor(now / MONITOR_PAGE_MS) % MONITOR_GROUPS.length;
}
