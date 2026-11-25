/**
 * Held-out interval check for the 5–15 min forecasts: fit on 6 simulated days, test on a 7th
 * (each day held out once). Nominal coverage is FORECAST_INTERVAL.target (80 %).
 *   npx tsx scripts/forecast-coverage.ts [peak|skew|calm]
 */
import { fitForecast, forecastCoverage, FORECAST_INTERVAL } from "../src/core/predict/forecast";
import { simulateDay, type ScenarioId } from "../src/core/sim/simulator";
import { linesSeries, tablesSeries } from "../src/core/world";

const scenario = (process.argv[2] ?? "peak") as ScenarioId;
const days = Array.from({ length: 7 }, (_, i) => simulateDay(`2026-11-25#h${i + 1}`, scenario));
for (const [name, toSeries, bounds] of [["lines", linesSeries, [0, Infinity]], ["tables", tablesSeries, [0, 1]]] as const) {
  const acc = new Map<number, { cov: number[]; mae: number[]; per: number[] }>();
  days.forEach((d, i) => {
    const model = fitForecast(days.filter((_, j) => j !== i).map(toSeries), undefined, bounds as [number, number]);
    for (const r of forecastCoverage(model, toSeries(d))) {
      const a = acc.get(r.horizonSec) ?? { cov: [], mae: [], per: [] };
      a.cov.push(r.coverage);
      a.mae.push(r.mae);
      a.per.push(r.maePersistence);
      acc.set(r.horizonSec, a);
    }
  });
  const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
  for (const [h, a] of acc) {
    console.log(`${scenario} ${name} ${h / 60}m  coverage ${(mean(a.cov) * 100).toFixed(0)}% (min ${(Math.min(...a.cov) * 100).toFixed(0)}, max ${(Math.max(...a.cov) * 100).toFixed(0)}, target ${FORECAST_INTERVAL.target * 100}%)  MAE ${mean(a.mae).toFixed(3)} vs persistence ${mean(a.per).toFixed(3)}`);
  }
}
