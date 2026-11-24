/**
 * Detector abstraction shared by the browser (onnxruntime-web) and Node (onnxruntime-node).
 * Only pre/post-processing lives here; the runtime session is injected, so models can be
 * swapped by adding a registry entry (see MODELS) without touching the analysis code.
 */

export interface Detection {
  /** box in source-frame pixels */
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
  cls: number;
}

export interface ModelSpec {
  id: string;
  name: string;
  file: string;
  inputSize: number;
  family: "yolox";
  license: string;
  source: string;
  params: string;
  /** published COCO val AP (paper / repo), for context — not our measurement */
  publishedAP: string;
  bytes: number;
}

export const MODELS: ModelSpec[] = [
  {
    id: "yolox_nano",
    name: "YOLOX-Nano",
    file: "/models/yolox_nano.onnx",
    inputSize: 416,
    family: "yolox",
    license: "Apache-2.0",
    source: "https://github.com/Megvii-BaseDetection/YOLOX (release 0.1.1rc0)",
    params: "0.91M",
    publishedAP: "25.8 (416)",
    bytes: 3_659_407,
  },
  {
    id: "yolox_tiny",
    name: "YOLOX-Tiny",
    file: "/models/yolox_tiny.onnx",
    inputSize: 416,
    family: "yolox",
    license: "Apache-2.0",
    source: "https://github.com/Megvii-BaseDetection/YOLOX (release 0.1.1rc0)",
    params: "5.06M",
    publishedAP: "32.8 (416)",
    bytes: 20_219_662,
  },
];

/** COCO classes we use as cues. */
export const COCO = {
  person: 0,
  backpack: 24,
  handbag: 26,
  suitcase: 28,
  bottle: 39,
  cup: 41,
  bowl: 45,
  chair: 56,
  diningTable: 60,
  laptop: 63,
  cellPhone: 67,
  book: 73,
} as const;

export const ITEM_CUES: number[] = [COCO.backpack, COCO.handbag, COCO.suitcase, COCO.bottle, COCO.cup, COCO.bowl, COCO.laptop, COCO.cellPhone, COCO.book];
export const KEEP_CLASSES = new Set<number>([COCO.person, ...ITEM_CUES]);

export interface Letterbox {
  scale: number;
  size: number;
}

/**
 * RGB(A) frame → YOLOX input tensor data (1×3×S×S, BGR order, 0–255, pad 114).
 * YOLOX ≥0.1.1 models take raw pixel values without mean/std normalisation.
 */
export function preprocess(pixels: Uint8Array | Uint8ClampedArray, width: number, height: number, channels: 3 | 4, size: number): { data: Float32Array; lb: Letterbox } {
  const scale = Math.min(size / width, size / height);
  const nw = Math.round(width * scale);
  const nh = Math.round(height * scale);
  const plane = size * size;
  const data = new Float32Array(3 * plane).fill(114);
  for (let y = 0; y < nh; y++) {
    const sy = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(width - 1, Math.floor(x / scale));
      const si = (sy * width + sx) * channels;
      const di = y * size + x;
      data[di] = pixels[si + 2]; // B
      data[plane + di] = pixels[si + 1]; // G
      data[2 * plane + di] = pixels[si]; // R
    }
  }
  return { data, lb: { scale, size } };
}

let gridCache: { size: number; grid: Float32Array } | null = null;
function grids(size: number): Float32Array {
  if (gridCache?.size === size) return gridCache.grid;
  const out: number[] = [];
  for (const stride of [8, 16, 32]) {
    const n = size / stride;
    for (let gy = 0; gy < n; gy++) for (let gx = 0; gx < n; gx++) out.push(gx, gy, stride);
  }
  gridCache = { size, grid: new Float32Array(out) };
  return gridCache.grid;
}

/** Decodes raw YOLOX output [1, N, 85] into detections in source coordinates. */
export function decodeYolox(output: Float32Array, lb: Letterbox, opts: { scoreThr?: number; classes?: Set<number> } = {}): Detection[] {
  const thr = opts.scoreThr ?? 0.3;
  const keep = opts.classes ?? KEEP_CLASSES;
  const g = grids(lb.size);
  const n = g.length / 3;
  const dets: Detection[] = [];
  for (let i = 0; i < n; i++) {
    const o = i * 85;
    const obj = output[o + 4];
    if (obj < thr * 0.5) continue;
    let best = -1;
    let bestScore = 0;
    for (const c of keep) {
      const s = obj * output[o + 5 + c];
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    if (best < 0 || bestScore < (best === COCO.person ? thr : thr * 0.8)) continue;
    const stride = g[i * 3 + 2];
    const cx = (output[o] + g[i * 3]) * stride;
    const cy = (output[o + 1] + g[i * 3 + 1]) * stride;
    const w = Math.exp(output[o + 2]) * stride;
    const h = Math.exp(output[o + 3]) * stride;
    dets.push({ x: (cx - w / 2) / lb.scale, y: (cy - h / 2) / lb.scale, w: w / lb.scale, h: h / lb.scale, score: bestScore, cls: best });
  }
  return nms(dets, 0.45);
}

export function iou(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const u = a.w * a.h + b.w * b.h - inter;
  return u > 0 ? inter / u : 0;
}

/** Class-aware greedy NMS. */
export function nms(dets: Detection[], thr: number): Detection[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const out: Detection[] = [];
  for (const d of sorted) {
    if (out.every((k) => k.cls !== d.cls || iou(k, d) < thr)) out.push(d);
  }
  return out;
}
