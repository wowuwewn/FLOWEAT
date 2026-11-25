/**
 * Vision evaluation v2.
 *   VIDEO_DIR=... npx tsx scripts/vision/eval.ts
 * - counter / tables: real test videos vs visual labels (data/labels, need human review)
 * - bank: semi-synthetic 3-lane queue video vs exact ground truth (data/labels/bank_gt.json)
 * Writes docs/ai/evaluation/vision-latest.json (previous run kept as vision-v1-2026-11-24.json).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { MODELS } from "../../src/core/vision/detector";
import { runScene } from "./run-offline";

const videoDir = process.env.VIDEO_DIR ?? join(process.cwd(), "data/videos");
const counterLabels = JSON.parse(readFileSync("data/labels/counter.json", "utf8"));
const tableLabels = JSON.parse(readFileSync("data/labels/tables.json", "utf8"));
const bankGt = JSON.parse(readFileSync("data/labels/bank_gt.json", "utf8"));
const only = process.env.MODELS?.split(",");

const nearest = <T extends { t: number }>(frames: T[], t: number) => frames.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const r3 = (x: number) => +x.toFixed(3);

(async () => {
  const results: Record<string, unknown>[] = [];
  for (const m of MODELS.filter((x) => !only || only.includes(x.id))) {
    // ---- counter (single lane, real video)
    const c = await runScene("counter", m.id, 5, videoDir, { write: false });
    let inUseCorrect = 0;
    let personErr = 0;
    for (const lf of counterLabels.frames) {
      const f = nearest(c.frames, lf.t);
      if ((f.lanes[0].inUse ? 1 : 0) === lf.inUse) inUseCorrect++;
      personErr += Math.abs(f.persons.length - lf.persons);
    }
    const truth: [number, number][] = counterLabels.sessions;
    const durErr: number[] = [];
    for (const [s, e] of truth) {
      const best = c.sessions.map((d) => ({ d, ov: Math.min(e, d.end) - Math.max(s, d.start) })).sort((a, b) => b.ov - a.ov)[0];
      if (best && best.ov > 0) durErr.push(Math.abs(best.d.end - best.d.start - (e - s)));
    }

    // ---- tables (real video)
    const tb = await runScene("tables", m.id, 5, videoDir, { write: false });
    const conf: Record<string, number> = { occ_occ: 0, occ_unc: 0, occ_empty: 0, empty_occ: 0, empty_unc: 0, empty_empty: 0 };
    for (const lf of tableLabels.frames) {
      const f = nearest(tb.frames, lf.t);
      lf.occupied.forEach((truthOcc: number, i: number) => {
        const st = f.tables[i].state;
        conf[`${truthOcc ? "occ" : "empty"}_${st === "occupied" ? "occ" : st === "uncertain" ? "unc" : "empty"}`]++;
      });
    }
    // availability semantics: a table is "not available" when seated OR held (owner nearby / items left)
    let notAvail = 0;
    let shownAvailableWrongly = 0;
    let trueEmpty = 0;
    let emptyFound = 0;
    for (const lf of tableLabels.frames) {
      const f = nearest(tb.frames, lf.t);
      (lf.state as string[]).forEach((st, i) => {
        if (st === "empty") {
          trueEmpty++;
          if (f.tables[i].state === "apparently_empty") emptyFound++;
        } else {
          notAvail++;
          if (f.tables[i].state === "apparently_empty") shownAvailableWrongly++;
        }
      });
    }
    const occTotal = conf.occ_occ + conf.occ_unc + conf.occ_empty;
    const emptyTotal = conf.empty_occ + conf.empty_unc + conf.empty_empty;

    // ---- bank (3 lanes, semi-synthetic, exact GT) — two camera placements, same people
    const bank: Record<string, unknown> = {};
    for (const sceneId of ["bank", "bank_oblique"]) {
    const b = await runScene(sceneId, m.id, 5, videoDir, { write: false });
    const laneWaitErr: number[][] = [[], [], []];
    const laneOrderOk: number[][] = [[], [], []];
    let overCount = 0;
    let frames = 0;
    for (const g of bankGt.frames) {
      if (g.t < 3 || Math.abs(g.t * 5 - Math.round(g.t * 5)) > 1e-6) continue;
      const f = nearest(b.frames, g.t);
      frames++;
      g.lanes.forEach((gl: { ordering: number; waiting: number }, i: number) => {
        laneWaitErr[i].push(Math.abs(f.lanes[i].waiting - gl.waiting));
        laneOrderOk[i].push((f.lanes[i].inUse ? 1 : 0) === gl.ordering ? 1 : 0);
        if (f.lanes[i].waiting > gl.waiting) overCount++;
      });
    }
    // waiting count baseline: everyone inside the line zone, no role logic
    const svcErr: number[] = [];
    let svcMatched = 0;
    for (const e of bankGt.service as { lane: number; start: number; end: number }[]) {
      const best = b.sessions.filter((s) => s.lane === e.lane).map((s) => ({ s, ov: Math.min(e.end, s.end) - Math.max(e.start, s.start) })).sort((x, y) => y.ov - x.ov)[0];
      if (best && best.ov > 0) {
        svcMatched++;
        svcErr.push(Math.abs(best.s.end - best.s.start - (e.end - e.start)));
      }
    }
    const waitErr: number[] = [];
    for (const w of b.waits) {
      const g = (bankGt.service as { lane: number; join: number; start: number }[]).filter((e) => e.lane === w.lane && e.join > 0).sort((x, y) => Math.abs(x.start - w.start) - Math.abs(y.start - w.start))[0];
      if (g && Math.abs(g.start - w.start) < 3) waitErr.push(Math.abs(w.start - w.join - (g.start - g.join)));
    }

    bank[sceneId] = {
        frames,
        waitingCountMAE: laneWaitErr.map((a) => r3(mean(a))),
        waitingCountMAEAll: r3(mean(laneWaitErr.flat())),
        orderingAccuracy: laneOrderOk.map((a) => r3(mean(a))),
        overcountShare: r3(overCount / (frames * 3)),
        servicesTrue: bankGt.service.length,
        servicesMatched: svcMatched,
        serviceDurationMAEsec: +mean(svcErr).toFixed(2),
        observedWaits: b.waits.length,
        observedWaitMAEsec: +mean(waitErr).toFixed(2),
        inferenceMsMean: b.stats.inferenceMsMean,
        inferenceMsP95: b.stats.inferenceMsP95,
      };
    }
    const r = {
      model: m.id,
      license: m.license,
      sizeMB: +(m.bytes / 1e6).toFixed(1),
      counter: {
        labelledFrames: counterLabels.frames.length,
        inUseAccuracy: r3(inUseCorrect / counterLabels.frames.length),
        personCountMAE: r3(personErr / counterLabels.frames.length),
        sessionsTrue: truth.length,
        sessionsDetected: c.sessions.length,
        sessionDurationMAEsec: +mean(durErr).toFixed(2),
        inferenceMsMean: c.stats.inferenceMsMean,
      },
      tables: {
        labelledTableFrames: occTotal + emptyTotal,
        confusion: conf,
        occupiedShownEmptyRate: r3(conf.occ_empty / Math.max(1, occTotal)),
        occupiedRecall: r3(conf.occ_occ / Math.max(1, occTotal)),
        emptyShownEmpty: r3(conf.empty_empty / Math.max(1, emptyTotal)),
        availability: { notAvailableFrames: notAvail, shownAvailableWrongly, trueEmptyFrames: trueEmpty, emptyFound },
        inferenceMsMean: tb.stats.inferenceMsMean,
      },
      bank,
    };
    results.push(r);
    console.log(JSON.stringify(r));
  }
  mkdirSync("docs/ai/evaluation", { recursive: true });
  writeFileSync(
    "docs/ai/evaluation/vision-latest.json",
    JSON.stringify({ generatedAt: new Date().toISOString(), analyzer: "v2 (multi-lane)", runtime: "onnxruntime-node CPU (4 vCPU, no GPU)", analysisFps: 5, results }, null, 2) + "\n",
  );
})();
