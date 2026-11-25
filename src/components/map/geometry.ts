/**
 * Schematic world for the student map, in metres. ONLY verified relations are encoded:
 * main entrance, 3 kiosks per side, users on the outer side facing the aisle
 * (left bank faces right, right bank faces left), queues forming behind users,
 * a central walkway wider than v1. Every distance here is a drawing convention,
 * not a measurement — the UI labels the map "개념 배치".
 * x: lateral (left negative), y: depth from the entrance line, z: height.
 */
import { KIOSKS } from "@/core/layout";

export type V3 = [number, number, number];

export const WORLD = {
  aisleHalf: 4.6, // central walkway half-width (wider than v1)
  viewHalf: 9.2, // initial framing half-width; lines beyond stay reachable by panning
  kioskX: 5.2, // kiosk centre distance from the axis
  kioskDepth: [0, 2.6, 6.0, 9.4] as const, // y by schematic depth index 1..3
  userOffset: 0.95, // user stands this far outside the kiosk
  slot: 0.78, // spacing between people in a line
  floor: { x0: -12.5, x1: 12.5, y0: 0, y1: 60 },
  verifiedDepth: 11.6, // beyond this the space is unverified → fog
  door: 2.2,
};

export function kioskPos(id: string): { x: number; y: number; side: "left" | "right"; out: -1 | 1 } {
  const k = KIOSKS.find((q) => q.id === id)!;
  const out = k.side === "left" ? -1 : 1;
  return { x: out * WORLD.kioskX, y: WORLD.kioskDepth[k.depth], side: k.side, out };
}

/** foot position of the n-th person (0 = ordering) at kiosk id */
export function personPos(id: string, n: number): V3 {
  const k = kioskPos(id);
  return [k.x + k.out * (WORLD.userOffset + n * WORLD.slot), k.y, 0];
}

// ----------------------------------------------------------------- camera
export interface Camera {
  eye: V3;
  target: V3;
  f: number;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Camera behind the entrance looking in. pitch 90 = straight down (2D plan). */
export function entranceCamera(pitchDeg: number, distance = 17): Camera {
  const target: V3 = [0, 6.4, 0];
  const p = (pitchDeg * Math.PI) / 180;
  return { eye: [0, target[1] - distance * Math.cos(p), distance * Math.sin(p)], target, f: 1 };
}

export interface Projector {
  (p: V3): { x: number; y: number; depth: number };
  eye: V3;
}

export function projector(cam: Camera, view: { w: number; h: number; pad: number }, fitPts: V3[]): Projector {
  const fwd = norm(sub(cam.target, cam.eye));
  const upRef: V3 = Math.abs(fwd[2]) > 0.99 ? [0, 1, 0] : [0, 0, 1];
  const right = norm(cross(fwd, upRef));
  const up = cross(right, fwd);
  const raw = (p: V3) => {
    const d = sub(p, cam.eye);
    const z = Math.max(0.1, dot(d, fwd));
    return { x: dot(d, right) / z, y: -dot(d, up) / z, depth: z };
  };
  const pts = fitPts.map(raw);
  const x0 = Math.min(...pts.map((q) => q.x));
  const x1 = Math.max(...pts.map((q) => q.x));
  const y0 = Math.min(...pts.map((q) => q.y));
  const y1 = Math.max(...pts.map((q) => q.y));
  const s = Math.min((view.w - 2 * view.pad) / (x1 - x0), (view.h - 2 * view.pad) / (y1 - y0));
  const ox = (view.w - (x1 - x0) * s) / 2 - x0 * s;
  const oy = (view.h - (y1 - y0) * s) / 2 - y0 * s;
  const fn = ((p: V3) => {
    const r = raw(p);
    return { x: r.x * s + ox, y: r.y * s + oy, depth: r.depth };
  }) as Projector;
  fn.eye = cam.eye;
  return fn;
}

export function pathOf(pts: { x: number; y: number }[], close = true): string {
  return pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("") + (close ? "Z" : "");
}

/** Axis-aligned box → visible faces (painter-ready). */
export function boxFaces(P: Projector, c: V3, size: V3): { d: string; shade: "top" | "side" | "front"; depth: number; normal: V3 }[] {
  const [cx, cy, cz] = c;
  const [sx, sy, sz] = size.map((v) => v / 2) as V3;
  const v = (dx: number, dy: number, dz: number): V3 => [cx + dx * sx, cy + dy * sy, cz + dz * sz];
  const faces: { pts: V3[]; normal: V3; shade: "top" | "side" | "front" }[] = [
    { pts: [v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], normal: [0, 0, 1], shade: "top" },
    { pts: [v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)], normal: [0, -1, 0], shade: "front" },
    { pts: [v(-1, 1, -1), v(1, 1, -1), v(1, 1, 1), v(-1, 1, 1)], normal: [0, 1, 0], shade: "front" },
    { pts: [v(-1, -1, -1), v(-1, 1, -1), v(-1, 1, 1), v(-1, -1, 1)], normal: [-1, 0, 0], shade: "side" },
    { pts: [v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], normal: [1, 0, 0], shade: "side" },
  ];
  return faces
    .filter((f) => {
      const center = f.pts.reduce<V3>((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
      return dot(f.normal, sub(P.eye, center)) > 0;
    })
    .map((f) => ({ d: pathOf(f.pts.map(P)), shade: f.shade, depth: P(c).depth, normal: f.normal }));
}
