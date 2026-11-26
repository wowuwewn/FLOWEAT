"use client";
/**
 * Vision on the client:
 *  - replay of recorded inference (public/vision/*.json), always available
 *  - live in-browser inference with onnxruntime-web (WebGPU → WASM fallback)
 *  - "link to student app": maps replayed signals onto one kiosk and four tables
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { decodeYolox, MODELS, preprocess, type Detection } from "@/core/vision/detector";
import { ROLES, type TableState } from "@/core/vision/analysis";
import { SCENES } from "@/core/vision/scenes";
import type { WorldOptions } from "@/core/world";

export const ROLE_NAMES = ROLES;
export const TABLE_STATES: TableState[] = ["apparently_empty", "occupied", "uncertain"];
export const TABLE_REASONS = ["person", "bag_hold", "brief_absence", "tableware", "occluded", "empty", "warming_up"] as const;

export interface ReplayFrame {
  t: number;
  /** [id, x, y, w, h, roleIndex, lane] */
  p: [number, number, number, number, number, number, number][];
  i: [number, number, number, number, number][];
  /** per lane: [inUse, elapsed(-1), waiting, companions, passing] */
  l: [number, number, number, number, number][];
  /** per table: [stateIndex, persons, reasonIndex] */
  tb: [number, number, number][];
}
export interface Replay {
  scene: string;
  model: string;
  fps: number;
  width: number;
  height: number;
  duration: number;
  generatedAt: string;
  stats: { frames: number; inferenceMsMean: number; inferenceMsP95: number; runtime: string };
  sessions: { lane: number; start: number; end: number }[];
  waits: { lane: number; join: number; start: number }[];
  frames: ReplayFrame[];
}

const cache = new Map<string, Promise<Replay>>();
export function loadReplay(scene: string): Promise<Replay> {
  if (!cache.has(scene)) cache.set(scene, fetch(`/vision/${scene}.json`).then((r) => r.json()));
  return cache.get(scene)!;
}

export function frameAt(r: Replay, t: number): ReplayFrame {
  const i = Math.max(0, Math.min(r.frames.length - 1, Math.round(t * r.fps)));
  return r.frames[i];
}

export function useReplay(scene: string): Replay | null {
  const [r, setR] = useState<Replay | null>(null);
  useEffect(() => {
    let alive = true;
    loadReplay(scene).then((x) => alive && setR(x)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [scene]);
  return r;
}

// ------------------------------------------------------------ link toggle
const LINK_KEY = "floweat.visionLink";
const LINK_EVENT = "floweat:vision-link";
export function visionLinked(): boolean {
  try {
    return localStorage.getItem(LINK_KEY) === "1";
  } catch {
    return false;
  }
}
export function setVisionLinked(on: boolean) {
  try {
    localStorage.setItem(LINK_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(LINK_EVENT));
}
export function useVisionLinked(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(LINK_EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(LINK_EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    visionLinked,
    () => false,
  );
}

/** World overrides from the replays, looping each video on the wall clock (same on all devices). */
export function visionOverrides(lanesReplay: Replay | null, tables: Replay | null, nowMs: number): Pick<WorldOptions, "kioskOverride" | "zoneOverride"> {
  const out: Pick<WorldOptions, "kioskOverride" | "zoneOverride"> = {};
  if (lanesReplay) {
    const scene = SCENES.find((s) => s.id === lanesReplay.scene)!;
    const tv = (nowMs / 1000) % lanesReplay.duration;
    const f = frameAt(lanesReplay, tv);
    out.kioskOverride = {};
    scene.lanes.forEach((lane, i) => {
      const l = f.l[i];
      if (!l) return;
      // most recent completed uses on this kiosk (seconds), newest first
      const samples = lanesReplay.sessions.filter((s) => s.lane === i && s.end <= tv).slice(-6).reverse().map((s) => s.end - s.start);
      out.kioskOverride![lane.kioskId] = { people: l[2], inServiceElapsed: l[0] ? Math.max(0, l[1]) : null, companions: l[3], serviceSamples: samples, source: "recorded_inference" };
    });
  }
  if (tables) {
    const scene = SCENES.find((s) => s.id === tables.scene)!;
    const f = frameAt(tables, (nowMs / 1000) % tables.duration);
    out.zoneOverride = {
      [scene.mapsTo.zoneId!]: { states: f.tb.map((s) => TABLE_STATES[s[0]]), source: "recorded_inference" },
    };
  }
  return out;
}

// ------------------------------------------------------------ live inference
type Ort = typeof import("onnxruntime-web");
let ortPromise: Promise<Ort> | null = null;

async function getOrt(): Promise<Ort> {
  ortPromise ??= import("onnxruntime-web").then((ort) => {
    ort.env.wasm.wasmPaths = "/ort/";
    ort.env.wasm.numThreads = typeof crossOriginIsolated !== "undefined" && crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
    return ort;
  });
  return ortPromise;
}

export type ExecutionProvider = "webgpu" | "wasm";

export interface RuntimeChoice {
  ep: ExecutionProvider;
  /** median ms per inference measured on this device right before choosing */
  bench: Partial<Record<ExecutionProvider, number>>;
  /** short Korean explanation shown on the ops page */
  reason: string;
  cached: boolean;
}

export interface LiveDetector {
  modelId: string;
  backend: ExecutionProvider;
  threads: number;
  choice: RuntimeChoice;
  detect(source: CanvasImageSource, width: number, height: number): Promise<{ dets: Detection[]; ms: number }>;
  dispose(): void;
}

const CHOICE_KEY = (modelId: string) => `floweat.ep.v2.${modelId}`;
const CHOICE_TTL = 14 * 24 * 3600 * 1000;
const timeout = <T,>(p: Promise<T>, ms: number, what: string) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${what} timeout`)), ms))]);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

type Session = Awaited<ReturnType<Ort["InferenceSession"]["create"]>>;

async function bench(ort: Ort, session: Session, size: number, runs: number, warmupMs: number): Promise<number> {
  const input = new Float32Array(3 * size * size);
  for (let i = 0; i < input.length; i += 97) input[i] = (i % 255) / 1;
  const feed = () => ({ images: new ort.Tensor("float32", input, [1, 3, size, size]) });
  await timeout(session.run(feed()), warmupMs, "warm-up"); // first run compiles kernels / shaders
  const ms: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    await timeout(session.run(feed()), Math.max(2000, warmupMs / 2), "bench");
    ms.push(performance.now() - t0);
  }
  return median(ms);
}

/** A software ("fallback") WebGPU adapter is usually far slower than multi-threaded WASM. */
async function usableGpuAdapter(): Promise<{ ok: boolean; why?: string }> {
  if (!("gpu" in navigator)) return { ok: false, why: "WebGPU 미지원" };
  type Adapter = { isFallbackAdapter?: boolean; info?: { isFallbackAdapter?: boolean; vendor?: string; architecture?: string; description?: string } };
  const gpu = (navigator as unknown as { gpu: { requestAdapter(o?: object): Promise<Adapter | null> } }).gpu;
  const adapter = await Promise.race([gpu.requestAdapter({ powerPreference: "high-performance" }).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
  if (!adapter) return { ok: false, why: "GPU 어댑터 없음" };
  const info = adapter.info ?? {};
  const desc = `${info.vendor ?? ""} ${info.architecture ?? ""} ${info.description ?? ""}`.toLowerCase();
  if (adapter.isFallbackAdapter || info.isFallbackAdapter || /swiftshader|llvmpipe|software|microsoft basic/.test(desc)) return { ok: false, why: "소프트웨어 GPU" };
  return { ok: true };
}

/**
 * Picks the execution provider by measuring, not by assumption:
 *   1. WASM (multi-threaded when cross-origin isolated) is always created first — it is the safe baseline.
 *   2. WebGPU is tried only on a hardware adapter; it must finish warm-up in time and beat WASM by 20%.
 *   3. The decision is cached per device for 14 days; `?ep=wasm|webgpu` forces one, `?ep=auto` re-measures.
 *   4. While running, a WebGPU session that errors or slows down far past its benchmark falls back to WASM.
 */
export async function createLiveDetector(modelId: string, onProgress?: (msg: string) => void): Promise<LiveDetector> {
  const ort = await getOrt();
  const spec = MODELS.find((m) => m.id === modelId)!;
  const create = (ep: ExecutionProvider) => ort.InferenceSession.create(spec.file, { executionProviders: [ep], graphOptimizationLevel: "all" });
  const param = new URLSearchParams(location.search).get("ep");
  const threads = ort.env.wasm.numThreads ?? 1;
  const wasmLabel = `WASM ${threads}스레드`;

  let cached: { ep: ExecutionProvider; bench: RuntimeChoice["bench"]; at: number } | null = null;
  try {
    const raw = localStorage.getItem(CHOICE_KEY(modelId));
    cached = raw ? JSON.parse(raw) : null;
    if (cached && Date.now() - cached.at > CHOICE_TTL) cached = null;
  } catch {
    cached = null;
  }
  if (param === "auto") cached = null;

  onProgress?.("모델을 내려받고 WASM으로 준비하는 중…");
  const wasm = await create("wasm");
  let gpu: Session | null = null;
  let choice: RuntimeChoice;

  if (param === "wasm") {
    choice = { ep: "wasm", bench: {}, reason: `${wasmLabel} (주소에서 지정)`, cached: false };
  } else if (cached && param !== "webgpu") {
    if (cached.ep === "webgpu") {
      try {
        gpu = await timeout(create("webgpu"), 8000, "webgpu");
      } catch {
        gpu = null;
      }
    }
    const ep: ExecutionProvider = cached.ep === "webgpu" && gpu ? "webgpu" : "wasm";
    choice = { ep, bench: cached.bench, reason: `이 기기에서 전에 측정한 결과로 ${ep === "webgpu" ? "WebGPU" : wasmLabel} 사용`, cached: true };
  } else {
    onProgress?.("이 기기에서 실행 방식을 측정하는 중…");
    const b: RuntimeChoice["bench"] = { wasm: await bench(ort, wasm, spec.inputSize, 3, 15000) };
    let why = "";
    const adapter = param === "webgpu" ? { ok: true } : await usableGpuAdapter();
    if (adapter.ok) {
      try {
        gpu = await timeout(create("webgpu"), 8000, "webgpu");
        b.webgpu = await bench(ort, gpu, spec.inputSize, 3, 6000);
      } catch (e) {
        why = (e as Error).message.includes("timeout") ? "WebGPU 준비가 너무 느림" : "WebGPU 실행 실패";
        gpu?.release?.();
        gpu = null;
      }
    } else why = adapter.why ?? "";
    const gpuWins = gpu && b.webgpu != null && (param === "webgpu" || b.webgpu < b.wasm! * 0.8);
    if (!gpuWins && gpu) {
      gpu.release?.();
      gpu = null;
    }
    const ep: ExecutionProvider = gpuWins ? "webgpu" : "wasm";
    const fmt = (x?: number) => (x == null ? "–" : `${x.toFixed(0)}ms`);
    choice = {
      ep,
      bench: b,
      cached: false,
      reason:
        b.webgpu != null
          ? `측정 결과 WebGPU ${fmt(b.webgpu)} · WASM ${fmt(b.wasm)} → ${ep === "webgpu" ? "WebGPU" : wasmLabel} 선택`
          : `${wasmLabel} 선택 (${why || "WebGPU 미사용"}, WASM ${fmt(b.wasm)})`,
    };
    try {
      localStorage.setItem(CHOICE_KEY(modelId), JSON.stringify({ ep, bench: b, at: Date.now() }));
    } catch {
      /* private mode */
    }
  }

  let active: Session = choice.ep === "webgpu" && gpu ? gpu : wasm;
  let backend: ExecutionProvider = active === wasm ? "wasm" : "webgpu";
  const recent: number[] = [];
  const demote = (why: string) => {
    if (backend !== "webgpu") return;
    backend = "wasm";
    active = wasm;
    choice = { ...choice, ep: "wasm", reason: `${why} → ${wasmLabel}로 전환` };
    try {
      localStorage.setItem(CHOICE_KEY(modelId), JSON.stringify({ ep: "wasm", bench: choice.bench, at: Date.now() }));
    } catch {
      /* ignore */
    }
  };
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return {
    modelId,
    get backend() {
      return backend;
    },
    threads,
    get choice() {
      return choice;
    },
    async detect(source, width, height) {
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(source, 0, 0, width, height);
      const img = ctx.getImageData(0, 0, width, height);
      const { data, lb } = preprocess(img.data, width, height, 4, spec.inputSize);
      const feed = { images: new ort.Tensor("float32", data, [1, 3, spec.inputSize, spec.inputSize]) };
      const t0 = performance.now();
      let res;
      try {
        res = await active.run(feed);
      } catch (e) {
        if (backend !== "webgpu") throw e;
        demote("WebGPU 실행 오류");
        res = await active.run(feed);
      }
      const ms = performance.now() - t0;
      if (backend === "webgpu") {
        recent.push(ms);
        if (recent.length > 8) recent.shift();
        const ref = Math.max(choice.bench.webgpu ?? 0, choice.bench.wasm ?? 0);
        if (recent.length >= 5 && ref > 0 && median(recent) > Math.max(150, ref * 2.5)) demote("WebGPU가 측정보다 크게 느려짐");
      }
      const out = res[active.outputNames[0]].data as Float32Array;
      return { dets: decodeYolox(out, lb, { scoreThr: 0.25 }), ms };
    },
    dispose() {
      wasm.release?.();
      gpu?.release?.();
    },
  };
}
