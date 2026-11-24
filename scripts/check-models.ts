import { evaluate } from "../src/core/predict/evaluate";
import { getEngine, worldAt, demoClock, formatClock } from "../src/core/world";
for (const sc of ["peak","skew","calm"] as const) {
  const t0=performance.now(); const r = evaluate("2026-11-24", sc); const ms=performance.now()-t0;
  console.log(sc, ms.toFixed(0)+"ms", "ETA n",r.eta.n,"MAE model",r.eta.maeModelSec.toFixed(1),"base",r.eta.maeBaselineSec.toFixed(1),"cov",r.eta.coverage.toFixed(2),"inverted",r.eta.shorterLineSlowerShare.toFixed(2));
  console.log("  per kiosk", r.eta.perKiosk.map(k=>`${k.id}:${k.maeModelSec.toFixed(0)}/${k.maeBaselineSec.toFixed(0)}`).join(" "));
  console.log("  PREP n",r.prep.n,"MAE model",r.prep.maeModelSec.toFixed(1),"base",r.prep.maeBaselineSec.toFixed(1),"cov",r.prep.coverage.toFixed(2));
}
const t0=performance.now(); const e = getEngine("2026-11-24","peak"); console.log("engine ms", (performance.now()-t0).toFixed(0), e.buildMs.toFixed(0));
console.log("forecast evals lines", e.linesForecast.evals.map(x=>`${x.horizonSec/60}m best=${x.best} mae=${JSON.stringify(Object.fromEntries(Object.entries(x.mae).map(([k,v])=>[k,+v.toFixed(2)])))}`).join(" | "));
console.log("forecast evals tables", e.tablesForecast.evals.map(x=>`${x.horizonSec/60}m best=${x.best} ${x.mae[x.best].toFixed(3)} vs ${x.mae.persistence.toFixed(3)}`).join(" | "));
for (const hm of [ [12,10], [12,25], [12,40] ]) {
  const t1=performance.now();
  const w = worldAt(e, { dateKey:"2026-11-24", tSec: hm[0]*3600+hm[1]*60, realTime:false });
  console.log(formatClock(w.clock.tSec), (performance.now()-t1).toFixed(1)+"ms", w.kiosks.map(k=>`${k.id} ${k.people}p ${Math.round(k.p50)}s${k.isFastest?"*":""}${k.similar?"~":""}`).join(" "));
  console.log("   tables", (w.overall.tableRateLow*100).toFixed(0)+"-"+(w.overall.tableRateHigh*100).toFixed(0)+"%", w.overall.tableLevel, " brands", w.brands.map(b=>`${b.name}:${Math.round(b.p50/60)}m(${b.backlog})`).join(" "));
  console.log("   fc lines", w.forecast.lines?.map(p=>`${p.horizonSec/60}m ${p.value.toFixed(1)} [${p.lo.toFixed(1)},${p.hi.toFixed(1)}]`).join(" "));
}
console.log(demoClock(Date.now()));
