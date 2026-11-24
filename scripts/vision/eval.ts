/**
 * Compares detector models on the labelled test videos.
 *   VIDEO_DIR=... npm run vision:eval
 * Writes docs/ai/evaluation/vision-latest.{json,md}. Labels: data/labels/*.json
 * (visual labels by Claude Code at 2-second intervals — need human review).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { MODELS } from "../../src/core/vision/detector";
import { runScene } from "./run-offline";

const videoDir = process.env.VIDEO_DIR ?? join(process.cwd(), "data/videos");
const counterLabels = JSON.parse(readFileSync("data/labels/counter.json", "utf8"));
const tableLabels = JSON.parse(readFileSync("data/labels/tables.json", "utf8"));

const nearest = <T extends { t: number }>(frames: T[], t: number) => frames.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));

(async () => {
  const results: Record<string, unknown>[] = [];
  for (const m of MODELS) {
    const c = await runScene("counter", m.id, 5, videoDir, { write: false });
    let inUseCorrect = 0;
    let personErr = 0;
    for (const lf of counterLabels.frames) {
      const f = nearest(c.frames, lf.t);
      if ((f.service?.inUse ? 1 : 0) === lf.inUse) inUseCorrect++;
      personErr += Math.abs(f.persons.length - lf.persons);
    }
    // session duration error, matching each true session with the most-overlapping detected one
    const truth: [number, number][] = counterLabels.sessions;
    const durErr: number[] = [];
    let matched = 0;
    for (const [s, e] of truth) {
      let best = null as null | { start: number; end: number };
      let bestOv = 0;
      for (const d of c.sessions) {
        const ov = Math.min(e, d.end) - Math.max(s, d.start);
        if (ov > bestOv) {
          bestOv = ov;
          best = d;
        }
      }
      if (best) {
        matched++;
        durErr.push(Math.abs(best.end - best.start - (e - s)));
      }
    }

    const tb = await runScene("tables", m.id, 5, videoDir, { write: false });
    const conf = { occ_occ: 0, occ_unc: 0, occ_empty: 0, empty_occ: 0, empty_unc: 0, empty_empty: 0 };
    for (const lf of tableLabels.frames) {
      const f = nearest(tb.frames, lf.t);
      lf.occupied.forEach((truthOcc: number, i: number) => {
        const st = f.tables![i].state;
        const k = `${truthOcc ? "occ" : "empty"}_${st === "occupied" ? "occ" : st === "uncertain" ? "unc" : "empty"}` as keyof typeof conf;
        conf[k]++;
      });
    }
    const occTotal = conf.occ_occ + conf.occ_unc + conf.occ_empty;
    const emptyTotal = conf.empty_occ + conf.empty_unc + conf.empty_empty;
    const r = {
      model: m.id,
      license: m.license,
      sizeMB: +(m.bytes / 1e6).toFixed(1),
      counter: {
        labelledFrames: counterLabels.frames.length,
        inUseAccuracy: +(inUseCorrect / counterLabels.frames.length).toFixed(3),
        personCountMAE: +(personErr / counterLabels.frames.length).toFixed(3),
        sessionsTrue: truth.length,
        sessionsDetected: c.sessions.length,
        sessionsMatched: matched,
        sessionDurationMAEsec: +(durErr.reduce((a, b) => a + b, 0) / Math.max(1, durErr.length)).toFixed(2),
        inferenceMsMean: c.stats.inferenceMsMean,
      },
      tables: {
        labelledTableFrames: occTotal + emptyTotal,
        confusion: conf,
        occupiedShownEmptyRate: +(conf.occ_empty / Math.max(1, occTotal)).toFixed(3),
        occupiedRecall: +(conf.occ_occ / Math.max(1, occTotal)).toFixed(3),
        emptyShownEmpty: +(conf.empty_empty / Math.max(1, emptyTotal)).toFixed(3),
        inferenceMsMean: tb.stats.inferenceMsMean,
      },
    };
    results.push(r);
    console.log(JSON.stringify(r));
  }
  mkdirSync("docs/ai/evaluation", { recursive: true });
  const report = { generatedAt: new Date().toISOString(), runtime: "onnxruntime-node CPU (4 vCPU, no GPU)", analysisFps: 5, results };
  writeFileSync("docs/ai/evaluation/vision-latest.json", JSON.stringify(report, null, 2) + "\n");
})();
