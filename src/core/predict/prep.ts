/**
 * Brand / menu preparation-time model: time from kiosk acceptance until the staff
 * marks the order ready. Excludes kiosk queue, seat search and eating.
 *
 * pred50 = base[brand, cookType] + slope[brand] × ordersAhead + extraItem × (items − 1)
 *  - base: median prep among orders that arrived when the kitchen was nearly idle
 *  - slope: least squares (through origin) of the residual on orders ahead
 *  - interval: brand-level quantiles of y / pred50 (multiplicative)
 * Fallbacks when samples are thin: brand-level → cook-type-level → "정보 부족".
 * Baseline for evaluation: menu median ignoring the current backlog.
 */
import type { CookType } from "../catalog";
import { median, quantile } from "../sim/rng";
import type { BrandOrderRecord } from "../sim/simulator";

export interface PrepModel {
  base: Map<string, { sec: number; n: number }>; // key `${brand}|${type}`
  typeBase: Map<CookType, number>;
  slope: number[]; // per brand index
  extraItemSec: number;
  ratioQ: { q20: number; q80: number }[]; // per brand index
  trainedOn: number;
}

const key = (b: number, c: CookType) => `${b}|${c}`;

export function fitPrepModel(records: BrandOrderRecord[], brandCount: number): PrepModel {
  const done = records.filter((r) => r.ready > 0);
  const lowLoad = done.filter((r) => r.backlogAhead <= 1);
  const groups = new Map<string, number[]>();
  const byType = new Map<CookType, number[]>();
  for (const r of lowLoad) {
    const y = r.ready - r.accept;
    const k = key(r.brand, r.mainType);
    groups.set(k, [...(groups.get(k) ?? []), y]);
    byType.set(r.mainType, [...(byType.get(r.mainType) ?? []), y]);
  }
  const typeBase = new Map<CookType, number>();
  for (const [t, ys] of byType) typeBase.set(t, median(ys));
  const base = new Map<string, { sec: number; n: number }>();
  for (const [k, ys] of groups) if (ys.length >= 4) base.set(k, { sec: median(ys), n: ys.length });

  const baseOf = (r: BrandOrderRecord) => base.get(key(r.brand, r.mainType))?.sec ?? typeBase.get(r.mainType) ?? 300;

  // extra item effect from single-vs-multi orders at low load
  const single = lowLoad.filter((r) => r.items === 1).map((r) => r.ready - r.accept - baseOf(r));
  const multi = lowLoad.filter((r) => r.items > 1).map((r) => (r.ready - r.accept - baseOf(r)) / (r.items - 1));
  const extraItemSec = multi.length >= 5 ? Math.max(0, median(multi) - (single.length ? median(single) : 0)) : 20;

  const slope: number[] = [];
  const ratioQ: { q20: number; q80: number }[] = [];
  for (let b = 0; b < brandCount; b++) {
    const rs = done.filter((r) => r.brand === b);
    let sxy = 0;
    let sxx = 0;
    for (const r of rs) {
      const resid = r.ready - r.accept - baseOf(r) - extraItemSec * (r.items - 1);
      sxy += r.backlogAhead * resid;
      sxx += r.backlogAhead * r.backlogAhead;
    }
    slope.push(sxx > 0 ? Math.max(0, sxy / sxx) : 60);
    const ratios = rs
      .map((r) => (r.ready - r.accept) / Math.max(30, baseOf(r) + slope[b] * r.backlogAhead + extraItemSec * (r.items - 1)))
      .sort((a, b2) => a - b2);
    ratioQ.push(ratios.length >= 10 ? { q20: quantile(ratios, 0.2), q80: quantile(ratios, 0.8) } : { q20: 0.8, q80: 1.35 });
  }
  return { base, typeBase, slope, extraItemSec, ratioQ, trainedOn: done.length };
}

export interface PrepEstimateSec {
  p20: number;
  p50: number;
  p80: number;
  basis: "menu" | "cook_type" | "insufficient";
  samples: number;
}

export function estimatePrep(model: PrepModel, brand: number, type: CookType, items: number, ordersAhead: number): PrepEstimateSec {
  const b = model.base.get(key(brand, type));
  const tb = model.typeBase.get(type);
  if (!b && tb === undefined) return { p20: NaN, p50: NaN, p80: NaN, basis: "insufficient", samples: 0 };
  const baseSec = b?.sec ?? tb!;
  const p50 = baseSec + model.slope[brand] * ordersAhead + model.extraItemSec * Math.max(0, items - 1);
  const q = model.ratioQ[brand];
  return { p20: p50 * q.q20, p50, p80: p50 * q.q80, basis: b ? "menu" : "cook_type", samples: b?.n ?? 0 };
}

/** Naive baseline: low-load median for that brand & type, ignoring backlog. */
export function baselinePrep(model: PrepModel, brand: number, type: CookType): number {
  return model.base.get(key(brand, type))?.sec ?? model.typeBase.get(type) ?? 300;
}
