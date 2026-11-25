/**
 * Plausibility check of the simulation (calibration.json) — prints the numbers judges would see.
 *   npx tsx scripts/sim-sanity.ts [scenario]
 */
import { brands } from "../src/core/catalog";
import { CALIBRATION, simulateDay, type ScenarioId } from "../src/core/sim/simulator";
import { quantile } from "../src/core/sim/rng";

export function sanity(scenario: ScenarioId = "peak", days = 7) {
  let maxLine = 0;
  let maxAll = 0;
  const prep: number[][] = brands.map(() => []);
  const waits: number[] = [];
  for (let d = 0; d < days; d++) {
    const sim = simulateDay(`sanity-2026-11-${10 + d}`, scenario);
    for (let i = 0; i < sim.snapTimes.length; i++) {
      let all = 0;
      for (const q of sim.queuePeople) {
        maxLine = Math.max(maxLine, q[i]);
        all += q[i];
      }
      maxAll = Math.max(maxAll, all);
    }
    for (const o of sim.orders) if (o.ready > 0) prep[o.brand].push(o.ready - o.accept);
    for (const g of sim.groups) if (g.serviceStart > 0) waits.push(g.serviceStart - g.queueJoin);
  }
  const q = (a: number[], p: number) => quantile([...a].sort((x, y) => x - y), p);
  return {
    maxPeoplePerLine: maxLine,
    maxPeopleAllLines: maxAll,
    kioskWaitP50Min: +(q(waits, 0.5) / 60).toFixed(1),
    kioskWaitP90Min: +(q(waits, 0.9) / 60).toFixed(1),
    prepP80Min: Object.fromEntries(brands.map((b, i) => [b.name, +(q(prep[i], 0.8) / 60).toFixed(1)])),
    limits: CALIBRATION.plausibility,
  };
}

if (process.argv[1]?.endsWith("sim-sanity.ts")) console.log(JSON.stringify(sanity((process.argv[2] as ScenarioId) ?? "peak"), null, 1));
