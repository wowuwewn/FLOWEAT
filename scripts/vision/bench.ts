/**
 * Queue-counting benchmark on the semi-synthetic kiosk-bank videos (exact ground truth).
 *
 *   npm run vision:bench -- dev            # development seeds (used while tuning)
 *   npm run vision:bench -- holdout        # sealed seeds, run once after the analyzer is frozen
 *   DETECTOR=oracle npm run vision:bench -- dev   # perfect detections from the generator's boxes
 *
 * Videos come from scripts/vision/make-synth-set.sh (data/cache/synth/<split>/).
 * Detections are cached per video (data/cache/dets/), so analyzers can be compared on identical input.
 * Compares three ways to count the waiting line (src/core/vision/analysis.ts QueueMode):
 *   roi, tracked (v2), hybrid (v3)
 * Writes docs/ai/evaluation/queue-bench-<split>[-oracle].json
 */
import * as ort from "onnxruntime-node";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { COCO, decodeYolox, MODELS, preprocess, type Detection } from "../../src/core/vision/detector";
import { ANALYSIS_PARAMS, SceneAnalyzer, type QueueMode } from "../../src/core/vision/analysis";
import { inPoly, SCENES, type Pt } from "../../src/core/vision/scenes";
import { readFrames } from "./frames";

const SPLIT = process.argv[2] ?? "dev";
const DETECTOR = process.env.DETECTOR ?? "yolox_nano"; // or "oracle"
const FPS = 5;
const W = 960;
const H = 540;
const MODES: QueueMode[] = (process.env.MODES?.split(",") as QueueMode[]) ?? ["roi", "tracked", "hybrid"];
const dir = join("data/cache/synth", SPLIT);
// parameter search on the DEV split only: PARAMS='{"holdMisses":4}' (never tune on holdout)
if (process.env.PARAMS) {
  if (SPLIT === "holdout") throw new Error("PARAMS overrides are not allowed on the holdout split");
  Object.assign(ANALYSIS_PARAMS, JSON.parse(process.env.PARAMS));
}
const QUIET = !!process.env.QUIET;

type Box = [string, number, number, number, number, number]; // role, lane, id, footX, footY, heightPx
interface Gt {
  seed: number;
  fps: number;
  service: { lane: number; id: number; join: number; start: number; end: number }[];
  frames: { t: number; lanes: { ordering: number; waiting: number }[]; boxes: Box[] }[];
}

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const r3 = (x: number) => (Number.isFinite(x) ? +x.toFixed(3) : null);

async function detections(name: string, gt: Gt): Promise<{ t: number; dets: Detection[] }[]> {
  if (DETECTOR === "oracle") {
    return gt.frames
      .filter((f) => Math.abs(f.t * FPS - Math.round(f.t * FPS)) < 1e-6)
      .map((f) => ({
        t: f.t,
        dets: f.boxes.map(([, , , fx, fy, h]) => ({ x: fx - 0.19 * h, y: fy - h, w: 0.38 * h, h, score: 0.9, cls: COCO.person })),
      }));
  }
  const cache = join("data/cache/dets", DETECTOR, SPLIT, `${name}.json`);
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8"));
  const model = MODELS.find((m) => m.id === DETECTOR)!;
  const session = await ort.InferenceSession.create(join(process.cwd(), "public", model.file), { intraOpNumThreads: 4 });
  const out: { t: number; dets: Detection[] }[] = [];
  for await (const f of readFrames(join(dir, `${name}.mp4`), FPS, W, H)) {
    const { data, lb } = preprocess(f.data, W, H, 3, model.inputSize);
    const r = await session.run({ images: new ort.Tensor("float32", data, [1, 3, model.inputSize, model.inputSize]) });
    out.push({ t: +f.t.toFixed(2), dets: decodeYolox(r.output.data as Float32Array, lb, { scoreThr: 0.25 }) });
  }
  mkdirSync(join("data/cache/dets", DETECTOR, SPLIT), { recursive: true });
  writeFileSync(cache, JSON.stringify(out));
  return out;
}

function evaluate(name: string, gt: Gt, dets: { t: number; dets: Detection[] }[], mode: QueueMode) {
  const sceneId = name.endsWith("_oblique") ? "bank_oblique" : "bank";
  const scene = SCENES.find((s) => s.id === sceneId)!;
  const an = new SceneAnalyzer(scene, W, H, { queueMode: mode });
  const outs = dets.map((d) => an.step(d.dets, d.t));
  an.finish(150);
  const byT = new Map(gt.frames.map((f) => [Math.round(f.t * 100), f]));
  const err: number[] = [];
  const hist: Record<number, Record<number, number>> = {};
  const over: number[] = [];
  const under: number[] = [];
  let orderOk = 0;
  let orderN = 0;
  // (frame, lane) pairs where someone who is NOT waiting stands/walks inside the line zone
  const transient = { passer: { n: 0, over: 0 }, moving: { n: 0, over: 0 } };
  for (const o of outs) {
    if (o.t < 3) continue; // warm-up
    const g = byT.get(Math.round(o.t * 100));
    if (!g) continue;
    g.lanes.forEach((gl, i) => {
      const est = o.lanes[i].waiting;
      err.push(Math.abs(est - gl.waiting));
      ((hist[gl.waiting] ??= {})[est - gl.waiting] ??= 0);
      hist[gl.waiting][est - gl.waiting]++;
      over.push(Math.max(0, est - gl.waiting));
      under.push(Math.max(0, gl.waiting - est));
      orderOk += (o.lanes[i].inUse ? 1 : 0) === gl.ordering ? 1 : 0;
      orderN++;
      const lane = scene.lanes[i];
      const inZone = (b: Box) => {
        const head: Pt = [b[3] / W, (b[4] - b[5]) / H];
        return inPoly(head, lane.queue) && !inPoly(head, lane.service);
      };
      const passerIn = g.boxes.some((b) => b[0] === "passer" && inZone(b));
      const movingIn = g.boxes.some((b) => (b[0] === "passer" || b[0] === "approach" || b[0] === "leave") && inZone(b));
      if (passerIn) {
        transient.passer.n++;
        if (est > gl.waiting) transient.passer.over++;
      }
      if (movingIn) {
        transient.moving.n++;
        if (est > gl.waiting) transient.moving.over++;
      }
    });
  }
  // service sessions
  const svcErr: number[] = [];
  let matched = 0;
  const used = new Set<number>();
  for (const e of gt.service) {
    const best = an.sessions
      .map((s, k) => ({ s, k, ov: s.lane === e.lane ? Math.min(e.end, s.end) - Math.max(e.start, s.start) : -1 }))
      .sort((a, b) => b.ov - a.ov)[0];
    if (best && best.ov > 0) {
      matched++;
      used.add(best.k);
      svcErr.push(Math.abs(best.s.end - best.s.start - (e.end - e.start)));
    }
  }
  return {
    hist,
    waitMAE: mean(err),
    overMean: mean(over),
    underMean: mean(under),
    overShare: over.filter((x) => x > 0).length / over.length,
    underShare: under.filter((x) => x > 0).length / under.length,
    passerOverShare: transient.passer.n ? transient.passer.over / transient.passer.n : NaN,
    passerPairs: transient.passer.n,
    movingOverShare: transient.moving.n ? transient.moving.over / transient.moving.n : NaN,
    orderingAcc: orderOk / orderN,
    servicesTrue: gt.service.length,
    servicesMatched: matched,
    falseSessions: an.sessions.length - used.size,
    serviceDurMAE: mean(svcErr),
  };
}

(async () => {
  if (!existsSync(dir)) throw new Error(`no videos in ${dir} — run scripts/vision/make-synth-set.sh ${SPLIT}`);
  const names = readdirSync(dir).filter((f) => f.endsWith("_gt.json")).map((f) => f.replace("_gt.json", "")).sort();
  const rows: Record<string, unknown>[] = [];
  const errorModel: Record<string, Record<string, Record<string, number>>> = {};
  for (const name of names) {
    const gt: Gt = JSON.parse(readFileSync(join(dir, `${name}_gt.json`), "utf8"));
    const d = await detections(name, gt);
    for (const mode of MODES) {
      const m = evaluate(name, gt, d, mode);
      const { hist, ...metrics } = m;
      rows.push({ video: name, seed: gt.seed, camera: name.endsWith("_oblique") ? "oblique" : "straight", mode, ...metrics });
      // pooled count-error distribution per true count → used by the wait-time evaluation (src/core/predict)
      const pooled = (errorModel[mode] ??= {});
      for (const [g, e] of Object.entries(hist)) for (const [d, n] of Object.entries(e)) {
        const b = (pooled[g] ??= {});
        b[d] = (b[d] ?? 0) + n;
      }
    }
  }
  const metricKeys = ["waitMAE", "overMean", "underMean", "overShare", "underShare", "passerOverShare", "movingOverShare", "orderingAcc", "serviceDurMAE"] as const;
  const summary: Record<string, Record<string, unknown>> = {};
  for (const camera of ["straight", "oblique", "all"]) {
    for (const mode of MODES) {
      const sel = rows.filter((r) => r.mode === mode && (camera === "all" || r.camera === camera));
      const s: Record<string, unknown> = { videos: sel.length };
      for (const k of metricKeys) s[k] = r3(mean(sel.map((r) => r[k] as number).filter(Number.isFinite)));
      s.servicesMatched = `${sel.reduce((a, r) => a + (r.servicesMatched as number), 0)}/${sel.reduce((a, r) => a + (r.servicesTrue as number), 0)}`;
      s.falseSessions = sel.reduce((a, r) => a + (r.falseSessions as number), 0);
      s.waitMAEBySeed = Object.fromEntries(sel.map((r) => [`${r.seed}_${r.camera}`, r3(r.waitMAE as number)]));
      summary[`${camera}/${mode}`] = s;
    }
  }
  if (QUIET) {
    const a = summary["all/hybrid"] ?? summary[`all/${MODES[0]}`];
    console.log(JSON.stringify({ params: process.env.PARAMS, waitMAE: a.waitMAE, overShare: a.overShare, underMean: a.underMean, passerOverShare: a.passerOverShare, movingOverShare: a.movingOverShare }));
    return;
  }
  console.table(Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([kk]) => kk !== "waitMAEBySeed"))])));
  mkdirSync("docs/ai/evaluation", { recursive: true });
  const file = `docs/ai/evaluation/queue-bench-${SPLIT}${DETECTOR === "oracle" ? "-oracle" : ""}.json`;
  writeFileSync(
    file,
    JSON.stringify({ generatedAt: new Date().toISOString(), split: SPLIT, detector: DETECTOR, analysisFps: FPS, note: "semi-synthetic videos with exact ground truth; NOT footage of 1947 COMMONS", summary, countErrorModel: errorModel, rows: rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? r3(v) : v]))) }, null, 1) + "\n",
  );
  console.log("wrote", file);
})();
