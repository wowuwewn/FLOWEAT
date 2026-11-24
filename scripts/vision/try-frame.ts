// Quick visual check: detect on one frame and draw boxes with ffmpeg.
import * as ort from "onnxruntime-node";
import { execFileSync } from "node:child_process";
import { readFrames } from "./frames";
import { decodeYolox, preprocess } from "../../src/core/vision/detector";

const [video, model, at, out, w = "960", h = "540"] = process.argv.slice(2);
(async () => {
  const s = await ort.InferenceSession.create(model);
  for await (const f of readFrames(video, 1, +w, +h)) {
    if (f.index < +at) continue;
    const { data, lb } = preprocess(f.data, f.width, f.height, 3, 416);
    const t0 = performance.now();
    const r = await s.run({ images: new ort.Tensor("float32", data, [1, 3, 416, 416]) });
    const dt = performance.now() - t0;
    const dets = decodeYolox(r.output.data as Float32Array, lb, { scoreThr: 0.3 });
    console.log(`inference ${dt.toFixed(1)}ms`, dets.map((d) => `${d.cls}:${d.score.toFixed(2)}@${d.x.toFixed(0)},${d.y.toFixed(0)},${d.w.toFixed(0)}x${d.h.toFixed(0)}`).join(" "));
    const boxes = dets.map((d) => `drawbox=x=${Math.max(0, d.x | 0)}:y=${Math.max(0, d.y | 0)}:w=${d.w | 0}:h=${d.h | 0}:color=${d.cls === 0 ? "lime" : "orange"}@0.9:t=3`).join(",");
    execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${f.width}x${f.height}`, "-i", "-", "-vf", boxes || "null", "-frames:v", "1", out], { input: f.data });
    break;
  }
})();
