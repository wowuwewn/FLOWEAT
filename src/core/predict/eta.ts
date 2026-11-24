/**
 * Kiosk wait-time model: "time from joining this line until you start ordering".
 *
 * Inputs (all observable in a real deployment):
 *  - people waiting in the line (camera count)
 *  - whether the kiosk is in use and for how long (camera / kiosk log)
 *  - recent transaction durations per kiosk (kiosk log)
 *  - historical ratio of transactions per person (groups often pay once)
 *
 * Model: empirical-Bayes shrinkage of per-kiosk log service time towards the pooled
 * mean, then Monte-Carlo over (transactions ahead, service times, residual of the
 * current transaction). Baseline for comparison: people × pooled mean per person.
 */
import { mean, mulberry32, hashSeed, normal, quantile } from "../sim/rng";
import type { TxRecord } from "../sim/simulator";

export interface ServiceStats {
  /** per kiosk shrunken mean of log(duration) */
  mu: number[];
  /** pooled sd of log(duration) */
  sigma: number;
  /** samples per kiosk in the window */
  n: number[];
  /** raw per-kiosk median duration (s), NaN if no data */
  rawMedian: number[];
  pooledMeanSec: number;
}

export interface EtaPrior {
  /** pooled mean log duration from history */
  muPool: number;
  sigma: number;
  /** transactions per person in line */
  txPerPerson: number;
  /** how strongly the pooled prior counts (pseudo-observations) */
  priorWeight: number;
}

export function fitEtaPrior(history: { txs: TxRecord[]; groups: { size: number; txCount: number; serviceStart: number }[] }[]): EtaPrior {
  const logs: number[] = [];
  let tx = 0;
  let people = 0;
  for (const day of history) {
    for (const r of day.txs) logs.push(Math.log(Math.max(5, r.end - r.start)));
    for (const g of day.groups) if (g.serviceStart > 0) { tx += g.txCount; people += g.size; }
  }
  const mu = mean(logs);
  const sd = Math.sqrt(mean(logs.map((x) => (x - mu) ** 2)));
  return { muPool: mu, sigma: sd, txPerPerson: people > 0 ? tx / people : 0.7, priorWeight: 6 };
}

/** Fits per-kiosk service stats using transactions that ended in (t-window, t]. */
export function fitServiceStats(txs: TxRecord[], kiosks: number, t: number, prior: EtaPrior, windowSec = 1800): ServiceStats {
  const per: number[][] = Array.from({ length: kiosks }, () => []);
  for (const r of txs) {
    if (r.end <= t && r.end > t - windowSec) per[r.kiosk].push(Math.log(Math.max(5, r.end - r.start)));
  }
  const all = per.flat();
  const sigma2 = prior.sigma ** 2;
  // between-kiosk variance by method of moments (floored)
  const means = per.filter((a) => a.length >= 3).map(mean);
  const grand = all.length > 0 ? mean(all) : prior.muPool;
  const tau2 = Math.max(0.004, means.length >= 2 ? mean(means.map((m) => (m - grand) ** 2)) - sigma2 / Math.max(1, mean(per.map((a) => a.length))) : 0.01);
  // pooled centre blends today's window with the historical prior
  const muPool = (prior.priorWeight * prior.muPool + all.length * grand) / (prior.priorWeight + all.length);
  const mu = per.map((a) => {
    if (a.length === 0) return muPool;
    const w = tau2 / (tau2 + sigma2 / a.length);
    return w * mean(a) + (1 - w) * muPool;
  });
  return {
    mu,
    sigma: prior.sigma,
    n: per.map((a) => a.length),
    rawMedian: per.map((a) => (a.length ? Math.exp(quantile([...a].sort((x, y) => x - y), 0.5)) : NaN)),
    pooledMeanSec: Math.exp(muPool + sigma2 / 2),
  };
}

export interface EtaInput {
  kiosk: number;
  people: number;
  /** elapsed seconds of the transaction in progress, or null when idle */
  inServiceElapsed: number | null;
  t: number;
}

export interface EtaEstimate {
  p20: number;
  p50: number;
  p80: number;
  txAhead: number;
  meanServiceSec: number;
  baselineSec: number;
  samples: number;
  quality: "ok" | "low_sample";
}

export function estimateWait(input: EtaInput, stats: ServiceStats, prior: EtaPrior, draws = 400, seedKey = ""): EtaEstimate {
  const { kiosk, people, inServiceElapsed } = input;
  const rng = mulberry32(hashSeed(`${seedKey}|${kiosk}|${Math.floor(input.t / 15)}`));
  const mu = stats.mu[kiosk];
  const sigma = stats.sigma;
  const r = prior.txPerPerson;
  const out = new Float64Array(draws);
  for (let d = 0; d < draws; d++) {
    let total = 0;
    if (inServiceElapsed !== null) {
      // residual of the current transaction, conditional on having lasted `elapsed`
      let dur = 0;
      for (let tries = 0; tries < 24; tries++) {
        dur = Math.exp(mu + sigma * normal(rng));
        if (dur > inServiceElapsed) break;
      }
      total += dur > inServiceElapsed ? dur - inServiceElapsed : Math.max(3, inServiceElapsed * 0.12);
    }
    const mean = people * r;
    const sd = Math.sqrt(Math.max(0, people * r * (1 - r)));
    const tx = Math.max(people > 0 ? 1 : 0, Math.round(mean + sd * normal(rng)));
    for (let i = 0; i < tx; i++) total += Math.exp(mu + sigma * normal(rng));
    out[d] = total;
  }
  const sorted = Array.from(out).sort((a, b) => a - b);
  return {
    p20: quantile(sorted, 0.2),
    p50: quantile(sorted, 0.5),
    p80: quantile(sorted, 0.8),
    txAhead: people * r,
    meanServiceSec: Math.exp(mu + (sigma * sigma) / 2),
    baselineSec: people * r * stats.pooledMeanSec,
    samples: stats.n[kiosk],
    quality: stats.n[kiosk] >= 5 ? "ok" : "low_sample",
  };
}

export type WaitLevel = "free" | "normal" | "busy" | "very_busy";

export function waitLevel(p50Sec: number): WaitLevel {
  if (p50Sec < 120) return "free";
  if (p50Sec < 300) return "normal";
  if (p50Sec < 540) return "busy";
  return "very_busy";
}

/**
 * Marks kiosks whose expected wait is within the noise band of the fastest one.
 * Used so the UI shows "비슷해요" instead of pushing everyone to a single line.
 */
export function similarToFastest(p50s: number[]): boolean[] {
  const best = Math.min(...p50s);
  const band = Math.max(60, best * 0.25);
  return p50s.map((p) => p - best <= band);
}
