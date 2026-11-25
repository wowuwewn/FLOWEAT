/**
 * Backtests on SIMULATED history. Results describe how well the algorithms recover
 * the simulator's hidden behaviour — they are not field accuracy at 1947 COMMONS.
 */
import { brands } from "../catalog";
import { KIOSKS } from "../layout";
import { mean } from "../sim/rng";
import { simulateDay, snapIndex, type ScenarioId, type SimResult } from "../sim/simulator";
import { mulberry32 } from "../sim/rng";
import { observe } from "./count-noise";
import { estimateWait, fitEtaPrior, fitServiceStats } from "./eta";
import { baselinePrep, estimatePrep, fitPrepModel } from "./prep";

export interface EtaVariant {
  /** what the model saw and whether it knew the count was noisy */
  label: string;
  maeSec: number;
  /** share of actual waits inside the shown [p20, p80] (nominal 60 %) */
  coverage: number | null;
}

export interface EtaBacktest {
  /** perfect counts vs camera-like counts, model vs simple baselines */
  variants: EtaVariant[];
  n: number;
  maeModelSec: number;
  maeBaselineSec: number;
  coverage: number; // share of actual waits inside [p20, p80]
  perKiosk: { id: string; n: number; maeModelSec: number; maeBaselineSec: number }[];
  /** cases where the line with fewer people actually had a longer wait */
  shorterLineSlowerShare: number;
}

export function backtestEta(train: SimResult[], test: SimResult[]): EtaBacktest {
  const prior = fitEtaPrior(train);
  const rows: { k: number; err: number; base: number; inside: boolean }[] = [];
  type V = { err: number[]; inside: number[] };
  const v: Record<string, V> = {};
  const add = (key: string, err: number, inside: boolean | null) => {
    const x = (v[key] ??= { err: [], inside: [] });
    x.err.push(err);
    if (inside !== null) x.inside.push(inside ? 1 : 0);
  };
  const noise = mulberry32(20261125);
  for (const day of test) {
    for (const g of day.groups) {
      if (g.serviceStart < 0 || g.id % 2 !== 0) continue; // subsample for speed
      const t = g.queueJoin;
      const stats = fitServiceStats(day.txs, KIOSKS.length, t, prior);
      const i = snapIndex(day, t);
      const since = day.serviceSince[g.kiosk][i];
      const busy = since >= 0 ? t - since : null;
      const actual = g.serviceStart - g.queueJoin;
      const e = estimateWait({ kiosk: g.kiosk, people: g.peopleAheadAtJoin, inServiceElapsed: busy, t }, stats, prior, 200, "bt");
      rows.push({ k: g.kiosk, err: Math.abs(e.p50 - actual), base: Math.abs(e.baselineSec - actual), inside: actual >= e.p20 && actual <= e.p80 });
      add("model · 정확한 인원", Math.abs(e.p50 - actual), actual >= e.p20 && actual <= e.p80);
      add("기준선 · 인원×전체 평균 · 정확한 인원", Math.abs(e.baselineSec - actual), null);
      // camera-like counts from the measured counter error (hybrid)
      const seen = observe(noise, g.peopleAheadAtJoin, "hybrid");
      const naive = estimateWait({ kiosk: g.kiosk, people: seen, inServiceElapsed: busy, t }, stats, prior, 200, "bt");
      add("model · 카메라 인원(오차 무시)", Math.abs(naive.p50 - actual), actual >= naive.p20 && actual <= naive.p80);
      const aware = estimateWait({ kiosk: g.kiosk, people: seen, inServiceElapsed: busy, t, countFrom: "hybrid" }, stats, prior, 200, "bt");
      add("model · 카메라 인원(오차 반영)", Math.abs(aware.p50 - actual), actual >= aware.p20 && actual <= aware.p80);
      add("기준선 · 인원×전체 평균 · 카메라 인원", Math.abs(seen * prior.txPerPerson * stats.pooledMeanSec - actual), null);
      // naive per-kiosk baseline: camera count × this kiosk's recent median transaction × tx per person
      const kMed = Number.isFinite(stats.rawMedian[g.kiosk]) ? stats.rawMedian[g.kiosk] : stats.pooledMeanSec;
      add("기준선 · 인원×이 기기 최근 중앙값 · 카메라 인원", Math.abs(seen * prior.txPerPerson * kMed + (busy !== null ? Math.max(0, kMed - busy) : 0) - actual), null);
    }
  }
  // how often is "fewer people" not "faster"? compare kiosk pairs at snapshots
  let pairs = 0;
  let inverted = 0;
  for (const day of test) {
    for (let i = 0; i < day.snapTimes.length; i += 8) {
      for (let a = 0; a < KIOSKS.length; a++) for (let b = a + 1; b < KIOSKS.length; b++) {
        const pa = day.queuePeople[a][i];
        const pb = day.queuePeople[b][i];
        if (pa === pb || pa + pb < 4) continue;
        const wa = nextServiceWait(day, a, day.snapTimes[i]);
        const wb = nextServiceWait(day, b, day.snapTimes[i]);
        if (wa < 0 || wb < 0) continue;
        pairs++;
        if ((pa < pb && wa > wb) || (pb < pa && wb > wa)) inverted++;
      }
    }
  }
  return {
    variants: Object.entries(v).map(([label, x]) => ({ label, maeSec: mean(x.err), coverage: x.inside.length ? mean(x.inside) : null })),
    n: rows.length,
    maeModelSec: mean(rows.map((r) => r.err)),
    maeBaselineSec: mean(rows.map((r) => r.base)),
    coverage: mean(rows.map((r) => (r.inside ? 1 : 0))),
    perKiosk: KIOSKS.map((k, ki) => {
      const rs = rows.filter((r) => r.k === ki);
      return { id: k.id, n: rs.length, maeModelSec: mean(rs.map((r) => r.err)), maeBaselineSec: mean(rs.map((r) => r.base)) };
    }),
    shorterLineSlowerShare: pairs ? inverted / pairs : 0,
  };
}

/** Actual wait of the first group that joined kiosk k at or after t. */
function nextServiceWait(day: SimResult, k: number, t: number): number {
  for (const g of day.groups) if (g.kiosk === k && g.queueJoin >= t && g.serviceStart > 0) return g.serviceStart - g.queueJoin;
  return -1;
}

export interface PrepBacktest {
  n: number;
  maeModelSec: number;
  maeBaselineSec: number;
  coverage: number;
  perBrand: { id: string; name: string; n: number; maeModelSec: number; maeBaselineSec: number }[];
}

export function backtestPrep(train: SimResult[], test: SimResult[]): PrepBacktest {
  const model = fitPrepModel(train.flatMap((d) => d.orders), brands.length);
  const rows: { b: number; err: number; base: number; inside: boolean }[] = [];
  for (const day of test) {
    for (const o of day.orders) {
      if (o.ready < 0) continue;
      const e = estimatePrep(model, o.brand, o.mainType, o.items, o.backlogAhead);
      if (!Number.isFinite(e.p50)) continue;
      const y = o.ready - o.accept;
      rows.push({ b: o.brand, err: Math.abs(e.p50 - y), base: Math.abs(baselinePrep(model, o.brand, o.mainType) - y), inside: y >= e.p20 && y <= e.p80 });
    }
  }
  return {
    n: rows.length,
    maeModelSec: mean(rows.map((r) => r.err)),
    maeBaselineSec: mean(rows.map((r) => r.base)),
    coverage: mean(rows.map((r) => (r.inside ? 1 : 0))),
    perBrand: brands.map((b, bi) => {
      const rs = rows.filter((r) => r.b === bi);
      return { id: b.id, name: b.name, n: rs.length, maeModelSec: mean(rs.map((r) => r.err)), maeBaselineSec: mean(rs.map((r) => r.base)) };
    }),
  };
}

export interface EvaluationReport {
  scenario: ScenarioId;
  trainDays: number;
  testDays: number;
  eta: EtaBacktest;
  prep: PrepBacktest;
}

const reports = new Map<string, EvaluationReport>();

/** Chronological split: first 4 simulated days train, next 2 test. */
export function evaluate(dateKey: string, scenario: ScenarioId): EvaluationReport {
  const k = `${dateKey}|${scenario}`;
  const hit = reports.get(k);
  if (hit) return hit;
  const days = Array.from({ length: 6 }, (_, i) => simulateDay(`${dateKey}#h${i + 1}`, scenario));
  const train = days.slice(0, 4);
  const test = days.slice(4);
  const r: EvaluationReport = { scenario, trainDays: train.length, testDays: test.length, eta: backtestEta(train, test), prep: backtestPrep(train, test) };
  reports.set(k, r);
  return r;
}
