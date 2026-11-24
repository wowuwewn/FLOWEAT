/**
 * Short-term (5–15 min) forecast of total kiosk-line people and observed table use.
 * Candidate methods are compared by leave-one-day-out backtest; the best per
 * (target, horizon) is used, with an empirical 10–90% residual interval.
 * If there are fewer than 3 history days, the forecast is withheld.
 */
import { mean, quantile } from "../sim/rng";

export type ForecastMethod = "persistence" | "damped_trend" | "profile_anomaly";
export const METHOD_LABEL: Record<ForecastMethod, string> = {
  persistence: "현재값 유지",
  damped_trend: "최근 추세 감쇠",
  profile_anomaly: "평소 패턴 + 현재 차이",
};

/** A day's time series sampled at a fixed step (seconds). */
export interface Series {
  t0: number;
  step: number;
  values: Float64Array;
}

const at = (s: Series, t: number) => {
  const i = Math.round((t - s.t0) / s.step);
  return s.values[Math.max(0, Math.min(s.values.length - 1, i))];
};

function predict(method: ForecastMethod, today: Series, profile: (t: number) => number, t: number, h: number): number {
  const y = at(today, t);
  if (method === "persistence") return y;
  if (method === "damped_trend") {
    const slope = (y - at(today, t - 600)) / 600;
    return y + slope * h * 0.5;
  }
  const phi = Math.pow(0.55, h / 300);
  return profile(t + h) + (y - profile(t)) * phi;
}

function profileOf(days: Series[]): (t: number) => number {
  return (t: number) => mean(days.map((d) => at(d, t)));
}

export interface ForecastEval {
  horizonSec: number;
  mae: Record<ForecastMethod, number>;
  best: ForecastMethod;
  lo: number; // residual quantile 10%
  hi: number; // residual quantile 90%
  n: number;
}

export interface ForecastModel {
  history: Series[];
  evals: ForecastEval[];
  bounds: [number, number];
  sufficient: boolean;
}

export function fitForecast(history: Series[], horizons = [300, 600, 900], bounds: [number, number] = [0, Infinity], window: [number, number] = [11 * 3600 + 20 * 60, 13 * 3600 + 40 * 60]): ForecastModel {
  if (history.length < 3) return { history, evals: [], bounds, sufficient: false };
  const methods: ForecastMethod[] = ["persistence", "damped_trend", "profile_anomaly"];
  const evals: ForecastEval[] = horizons.map((h) => {
    const errs: Record<ForecastMethod, number[]> = { persistence: [], damped_trend: [], profile_anomaly: [] };
    history.forEach((day, di) => {
      const profile = profileOf(history.filter((_, j) => j !== di));
      for (let t = window[0]; t + h <= window[1]; t += 120) {
        const actual = at(day, t + h);
        for (const m of methods) errs[m].push(actual - clamp(predict(m, day, profile, t, h), bounds));
      }
    });
    const mae = Object.fromEntries(methods.map((m) => [m, mean(errs[m].map(Math.abs))])) as Record<ForecastMethod, number>;
    const best = methods.reduce((a, b) => (mae[b] < mae[a] ? b : a));
    const sorted = [...errs[best]].sort((a, b) => a - b);
    return { horizonSec: h, mae, best, lo: quantile(sorted, 0.1), hi: quantile(sorted, 0.9), n: sorted.length };
  });
  return { history, evals, bounds, sufficient: true };
}

function clamp(v: number, [lo, hi]: [number, number]) {
  return Math.max(lo, Math.min(hi, v));
}

export interface ForecastPoint {
  horizonSec: number;
  value: number;
  lo: number;
  hi: number;
  method: ForecastMethod;
  maeModel: number;
  maePersistence: number;
}

export function forecastAt(model: ForecastModel, today: Series, t: number): ForecastPoint[] | null {
  if (!model.sufficient) return null;
  const profile = profileOf(model.history);
  return model.evals.map((e) => {
    const v = clamp(predict(e.best, today, profile, t, e.horizonSec), model.bounds);
    return {
      horizonSec: e.horizonSec,
      value: v,
      lo: clamp(v + e.lo, model.bounds),
      hi: clamp(v + e.hi, model.bounds),
      method: e.best,
      maeModel: e.mae[e.best],
      maePersistence: e.mae.persistence,
    };
  });
}
