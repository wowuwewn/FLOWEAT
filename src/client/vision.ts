"use client";
/**
 * Vision on the client:
 *  - replay of recorded inference (public/vision/*.json), always available
 *  - live in-browser inference with onnxruntime-web (WebGPU → WASM fallback)
 *  - "link to student app": maps replayed signals onto one kiosk and four tables
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { decodeYolox, MODELS, preprocess, type Detection } from "@/core/vision/detector";
import type { TableState } from "@/core/vision/analysis";
import { SCENES } from "@/core/vision/scenes";
import type { WorldOptions } from "@/core/world";

export const ROLE_NAMES = ["other", "service", "queue", "passer", "seated"] as const;
export const TABLE_STATES: TableState[] = ["apparently_empty", "occupied", "uncertain"];

export interface ReplayFrame {
  t: number;
  p: [number, number, number, number, number, number][];
  i: [number, number, number, number, number][];
  s?: [number, number];
  q?: [number, number];
  tb?: number[];
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
  sessions: { start: number; end: number }[];
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
export function visionOverrides(counter: Replay | null, tables: Replay | null, nowMs: number): Pick<WorldOptions, "kioskOverride" | "zoneOverride"> {
  const out: Pick<WorldOptions, "kioskOverride" | "zoneOverride"> = {};
  const counterScene = SCENES.find((s) => s.id === "counter")!;
  const tablesScene = SCENES.find((s) => s.id === "tables")!;
  if (counter) {
    const f = frameAt(counter, (nowMs / 1000) % counter.duration);
    out.kioskOverride = {
      [counterScene.mapsTo.kioskId!]: {
        people: f.q?.[0] ?? 0,
        inServiceElapsed: f.s && f.s[0] ? Math.max(0, f.s[1]) : null,
        source: "recorded_inference",
      },
    };
  }
  if (tables) {
    const f = frameAt(tables, (nowMs / 1000) % tables.duration);
    out.zoneOverride = {
      [tablesScene.mapsTo.zoneId!]: { states: (f.tb ?? []).map((s) => TABLE_STATES[s]), source: "recorded_inference" },
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

export interface LiveDetector {
  modelId: string;
  backend: "webgpu" | "wasm";
  threads: number;
  detect(source: CanvasImageSource, width: number, height: number): Promise<{ dets: Detection[]; ms: number }>;
  dispose(): void;
}

export async function createLiveDetector(modelId: string): Promise<LiveDetector> {
  const ort = await getOrt();
  const spec = MODELS.find((m) => m.id === modelId)!;
  const tryCreate = async (ep: "webgpu" | "wasm") => ort.InferenceSession.create(spec.file, { executionProviders: [ep], graphOptimizationLevel: "all" });
  let backend: "webgpu" | "wasm" = "wasm";
  let session;
  const forceWasm = new URLSearchParams(location.search).get("ep") === "wasm";
  if ("gpu" in navigator && !forceWasm) {
    try {
      const adapter = await Promise.race([
        (navigator as unknown as { gpu: { requestAdapter(): Promise<unknown> } }).gpu.requestAdapter(),
        new Promise<null>((r) => setTimeout(() => r(null), 2500)),
      ]);
      if (adapter) {
        session = await Promise.race([tryCreate("webgpu"), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("webgpu timeout")), 8000))]);
        backend = "webgpu";
      }
    } catch {
      session = undefined;
    }
  }
  session ??= await tryCreate("wasm");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return {
    modelId,
    backend,
    threads: ort.env.wasm.numThreads ?? 1,
    async detect(source, width, height) {
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(source, 0, 0, width, height);
      const img = ctx.getImageData(0, 0, width, height);
      const { data, lb } = preprocess(img.data, width, height, 4, spec.inputSize);
      const t0 = performance.now();
      const res = await session!.run({ images: new ort.Tensor("float32", data, [1, 3, spec.inputSize, spec.inputSize]) });
      const ms = performance.now() - t0;
      const out = res[session!.outputNames[0]].data as Float32Array;
      return { dets: decodeYolox(out, lb, { scoreThr: 0.25 }), ms };
    },
    dispose() {
      session?.release?.();
    },
  };
}
