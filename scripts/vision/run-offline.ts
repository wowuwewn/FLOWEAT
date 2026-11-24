/**
 * Offline batch inference on the licensed test videos.
 *   npm run vision:run -- [modelId] [fps]
 * 1) transcodes each source video to a web-friendly H.264 file in public/media
 * 2) runs the ONNX detector (onnxruntime-node, CPU) with the SAME pre/post-processing,
 *    tracker and zone logic as the browser
 * 3) writes public/vision/<scene>.json — the "recorded_inference" timeline replayed in the app
 * Source videos are read from $VIDEO_DIR (default: ./data/videos), not committed.
 */
import * as ort from "onnxruntime-node";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decodeYolox, MODELS, preprocess, type Detection } from "../../src/core/vision/detector";
import { SceneAnalyzer, type FrameOut } from "../../src/core/vision/analysis";
import { SCENES } from "../../src/core/vision/scenes";
import { readFrames, probe } from "./frames";

const SOURCES: Record<string, string> = {
  counter: "one-by-one-person-detection.mp4",
  tables: "classroom.mp4",
};
const ROLE = { other: 0, service: 1, queue: 2, passer: 3, seated: 4 } as const;
const TSTATE = { apparently_empty: 0, occupied: 1, uncertain: 2 } as const;

export async function runScene(sceneId: string, modelId: string, fps: number, videoDir: string, opts: { write?: boolean; onDetections?: (i: number, d: Detection[]) => void } = {}) {
  const scene = SCENES.find((s) => s.id === sceneId)!;
  const model = MODELS.find((m) => m.id === modelId)!;
  const src = join(videoDir, SOURCES[sceneId]);
  const W = 960;
  const H = 540;
  const session = await ort.InferenceSession.create(join(process.cwd(), "public", model.file), { intraOpNumThreads: 4 });
  const analyzer = new SceneAnalyzer(scene, W, H);
  const frames: FrameOut[] = [];
  const times: number[] = [];
  const info = await probe(src);
  for await (const f of readFrames(src, fps, W, H)) {
    const { data, lb } = preprocess(f.data, W, H, 3, model.inputSize);
    const t0 = performance.now();
    const r = await session.run({ images: new ort.Tensor("float32", data, [1, 3, model.inputSize, model.inputSize]) });
    times.push(performance.now() - t0);
    const dets = decodeYolox(r.output.data as Float32Array, lb, { scoreThr: 0.25 });
    opts.onDetections?.(f.index, dets);
    frames.push(analyzer.step(dets, f.t));
  }
  analyzer.finish(info.duration);
  const sorted = [...times].sort((a, b) => a - b);
  const stats = {
    frames: frames.length,
    inferenceMsMean: +(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1),
    inferenceMsP95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
    runtime: "onnxruntime-node (CPU, 4 threads)",
  };
  const r1 = (v: number) => Math.round(v);
  const compact = {
    scene: sceneId,
    model: modelId,
    fps,
    width: W,
    height: H,
    duration: info.duration,
    generatedAt: new Date().toISOString(),
    dataMode: "recorded_inference",
    stats,
    sessions: analyzer.sessions.map((s) => ({ start: +s.start.toFixed(2), end: +s.end.toFixed(2) })),
    frames: frames.map((f) => ({
      t: +f.t.toFixed(2),
      p: f.persons.map((p) => [p.id, r1(p.x), r1(p.y), r1(p.w), r1(p.h), ROLE[p.role]]),
      i: f.items.map((i) => [i.cls, r1(i.x), r1(i.y), r1(i.w), r1(i.h)]),
      ...(f.service ? { s: [f.service.inUse ? 1 : 0, f.service.elapsed === null ? -1 : +f.service.elapsed.toFixed(1)] } : {}),
      ...(f.queue ? { q: [f.queue.waiting, f.queue.passing] } : {}),
      ...(f.tables ? { tb: f.tables.map((t) => TSTATE[t.state]) } : {}),
    })),
  };
  if (opts.write !== false) {
    mkdirSync(join(process.cwd(), "public/vision"), { recursive: true });
    writeFileSync(join(process.cwd(), `public/vision/${sceneId}.json`), JSON.stringify(compact));
  }
  return { compact, stats, frames, sessions: analyzer.sessions };
}

function transcode(sceneId: string, videoDir: string) {
  const out = join(process.cwd(), "public/media", `${sceneId}.mp4`);
  if (existsSync(out)) return;
  mkdirSync(join(process.cwd(), "public/media"), { recursive: true });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(videoDir, SOURCES[sceneId]), "-vf", "scale=960:540,fps=15", "-c:v", "libx264", "-crf", "30", "-preset", "slow", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", out]);
}

if (process.argv[1]?.endsWith("run-offline.ts")) {
  const modelId = process.argv[2] ?? "yolox_nano";
  const fps = Number(process.argv[3] ?? 5);
  const videoDir = process.env.VIDEO_DIR ?? join(process.cwd(), "data/videos");
  (async () => {
    for (const s of SCENES) {
      transcode(s.id, videoDir);
      const { stats, sessions } = await runScene(s.id, modelId, fps, videoDir);
      console.log(s.id, modelId, JSON.stringify(stats), `sessions=${sessions.length}`, sessions.map((x) => (x.end - x.start).toFixed(1)).join(","));
    }
  })();
}
