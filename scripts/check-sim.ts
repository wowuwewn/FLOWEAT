import { simulateDay, DAY_START, SNAP_SEC } from "../src/core/sim/simulator";
import { ZONES } from "../src/core/layout";
for (const sc of ["peak","calm","skew"] as const) {
  const t0 = performance.now();
  const s = simulateDay("2026-11-24", sc);
  const ms = performance.now() - t0;
  const waits = s.groups.filter(g=>g.serviceStart>0).map(g=>g.serviceStart-g.queueJoin);
  const prep = s.orders.filter(o=>o.ready>0).map(o=>o.ready-o.accept);
  const at = (hhmm:number)=>Math.floor(((Math.floor(hhmm/100)*3600+(hhmm%100)*60)-DAY_START)/SNAP_SEC);
  console.log(sc, `ms=${ms.toFixed(0)} groups=${s.groups.length} txs=${s.txs.length} orders=${s.orders.length}`);
  console.log(" avg wait", (waits.reduce((a,b)=>a+b,0)/waits.length).toFixed(0), "max", Math.max(...waits), " avg prep", (prep.reduce((a,b)=>a+b,0)/prep.length).toFixed(0), "max", Math.max(...prep));
  for (const hm of [1130,1200,1215,1230,1300,1330]) {
    const i = at(hm);
    const q = s.queuePeople.map(a=>a[i]).join(",");
    const busy = ZONES.map((z,zi)=>`${s.zoneBusy[zi][i]}/${z.tables}`).join(" ");
    const bl = s.brandBacklog.map(a=>a[i]).join(",");
    console.log(`  ${hm} q=[${q}] tables ${busy} backlog=[${bl}] hall=${s.peopleInHall[i]}`);
  }
  const seatedFail = s.groups.filter(g=>g.serviceEnd>0 && g.seatedAt<0).length;
  console.log(" not seated by end:", seatedFail);
}
