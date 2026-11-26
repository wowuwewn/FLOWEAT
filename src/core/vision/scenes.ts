/**
 * Camera scenes and their analysis regions (normalised 0–1 image coordinates).
 * Licensed test videos stand in for school CCTV (not permitted). Region configs are
 * data — real camera ROIs replace them without code changes.
 *
 * Student map viewpoint (standing at the entrance) and camera viewpoints are different:
 * each scene states its ASSUMED camera position; none is a verified installation.
 */
export type Pt = [number, number];

export interface LaneSpec {
  kioskId: string;
  label: string;
  /** where the person ordering stands */
  service: Pt[];
  /** where the line forms (behind the person ordering) */
  queue: Pt[];
}

export interface TableSpec {
  id: string;
  label: string;
  /** "quad" = inseparable 4-seat table, "single" = one-person seat */
  kind: "quad" | "single";
  seats: number;
  poly: Pt[];
  /** the surface where item cues (bag, cup, bowl…) count */
  desk?: Pt[];
  /** expected seated person height range (fraction of frame height) */
  personH?: [number, number];
  /** a seated person's box top is below this line (normalised y); higher = standing */
  seatedTopMin?: number;
}

export interface Scene {
  id: string;
  title: string;
  file: string;
  kind: "real_test_video" | "semi_synthetic";
  standsFor: string;
  camera: string;
  mapsTo: { kioskIds?: string[]; zoneId?: string };
  attribution: string;
  license: "CC BY 4.0";
  sourceUrl: string;
  /**
   * Which box point decides zone membership. "top" (head) survives occlusion by kiosks
   * and by people standing in front, so it suits cameras that see lines from behind kiosks.
   */
  anchor: "bottom" | "center" | "top";
  lanes: LaneSpec[];
  tables: TableSpec[];
}

const W = 960;
const H = 540;
const r = (x: number, y: number): Pt => [x / W, y / H];
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [r(x0, y0), r(x1, y0), r(x1, y1), r(x0, y1)];

// ---- semi-synthetic kiosk bank: same camera math as scripts/vision/make_bank_video.py
interface Cam { x: number; z: number; yaw: number; f: number }
const HORIZON = 92;
const CAM_H = 2.6;
/** zone drawn at head height so it matches the "top" anchor */
const HEAD = 1.7;
function projector(c: Cam) {
  const yaw = (c.yaw * Math.PI) / 180;
  return (X: number, Z: number, Y = 0): Pt => {
    const dx = X - c.x;
    const dz = Z - c.z;
    const xc = dx * Math.cos(yaw) + dz * Math.sin(yaw);
    const zc = Math.max(0.3, -dx * Math.sin(yaw) + dz * Math.cos(yaw));
    return [(480 + (c.f * xc) / zc) / W, (HORIZON + (c.f * (CAM_H - Y)) / zc) / H];
  };
}
const BANK_X = [-2.3, 0, 2.3];
function bankLanes(c: Cam): LaneSpec[] {
  const proj = projector(c);
  const trap = (X: number, z0: number, z1: number, half: number): Pt[] => [proj(X - half, z0, HEAD), proj(X + half, z0, HEAD), proj(X + half, z1, HEAD), proj(X - half, z1, HEAD)];
  return BANK_X.map((X, i) => ({
    kioskId: `L${i + 1}`,
    label: ["정문 쪽", "가운데", "안쪽"][i],
    service: trap(X, 1.85, 2.5, 0.5),
    queue: trap(X, 2.5, 8.5, 0.55),
  }));
}
export const BANK_CAMERAS = {
  bank: { x: 0, z: 0, yaw: 0, f: 205 },
  bank_oblique: { x: 3.4, z: 0.4, yaw: 50, f: 300 },
};

export const SCENES: Scene[] = [
  {
    id: "bank_oblique",
    title: "왼쪽 키오스크 3대, 비스듬한 카메라 (합성)",
    file: "/media/bank_oblique.mp4",
    kind: "semi_synthetic",
    standsFor: "정문 왼쪽 키오스크 3대와 각각의 대기열",
    camera: "키오스크 줄의 옆쪽 위에서 약 50° 비스듬히 보는 가정 시점 (가정, 설치 미확정 — 정면과 장단점이 있음)",
    mapsTo: { kioskIds: ["L1", "L2", "L3"] },
    attribution: "사람 이미지: Intel IoT DevKit sample-videos one-by-one-person-detection.mp4 (CC BY 4.0)를 잘라 FLOWEAT이 합성",
    license: "CC BY 4.0",
    sourceUrl: "https://github.com/intel-iot-devkit/sample-videos",
    anchor: "top",
    lanes: bankLanes(BANK_CAMERAS.bank_oblique),
    tables: [],
  },
  {
    id: "bank",
    title: "왼쪽 키오스크 3대, 정면 카메라 (합성)",
    file: "/media/bank.mp4",
    kind: "semi_synthetic",
    standsFor: "정문 왼쪽 키오스크 3대와 각각의 대기열",
    camera: "중앙 통로에서 줄 방향과 나란히 정면으로 보는 가정 시점 (비교용)",
    mapsTo: { kioskIds: ["L1", "L2", "L3"] },
    attribution: "사람 이미지: Intel IoT DevKit sample-videos one-by-one-person-detection.mp4 (CC BY 4.0)를 잘라 FLOWEAT이 합성",
    license: "CC BY 4.0",
    sourceUrl: "https://github.com/intel-iot-devkit/sample-videos",
    anchor: "top",
    lanes: bankLanes(BANK_CAMERAS.bank),
    tables: [],
  },
  {
    id: "counter",
    title: "한 명씩 쓰는 스탠딩 테이블",
    file: "/media/counter.mp4",
    kind: "real_test_video",
    standsFor: "키오스크 한 대 앞 이용 구역과 옆 통행·대기 구역",
    camera: "카운터 뒤쪽 위에서 내려다보는 공개 영상 시점",
    mapsTo: { kioskIds: ["R2"] },
    attribution: "Intel IoT DevKit sample-videos, one-by-one-person-detection.mp4",
    license: "CC BY 4.0",
    sourceUrl: "https://github.com/intel-iot-devkit/sample-videos",
    anchor: "bottom",
    lanes: [{ kioskId: "R2", label: "카운터", service: rect(400, 330, 720, 540), queue: rect(0, 330, 400, 540) }],
    tables: [],
  },
  {
    id: "tables",
    title: "테이블 4개가 보이는 실내",
    file: "/media/tables.mp4",
    kind: "real_test_video",
    standsFor: "중앙 칸막이석 4인 테이블 4개",
    camera: "방 앞쪽 위에서 비스듬히 내려다보는 공개 영상 시점",
    mapsTo: { zoneId: "center" },
    attribution: "Intel IoT DevKit sample-videos, classroom.mp4",
    license: "CC BY 4.0",
    sourceUrl: "https://github.com/intel-iot-devkit/sample-videos",
    anchor: "bottom",
    lanes: [],
    tables: [
      { id: "T1", label: "앞 왼쪽", kind: "quad", seats: 4, poly: rect(20, 270, 345, 455), desk: rect(0, 435, 345, 540), personH: [0.24, 0.6], seatedTopMin: 240 / H },
      { id: "T2", label: "앞 오른쪽", kind: "quad", seats: 4, poly: rect(430, 270, 770, 455), desk: rect(420, 430, 770, 540), personH: [0.24, 0.6], seatedTopMin: 240 / H },
      { id: "T3", label: "뒤 왼쪽", kind: "quad", seats: 4, poly: rect(205, 225, 372, 350), desk: rect(215, 335, 362, 385), personH: [0.1, 0.26], seatedTopMin: 215 / H },
      { id: "T4", label: "뒤 오른쪽", kind: "quad", seats: 4, poly: rect(395, 225, 600, 350), desk: rect(400, 335, 600, 385), personH: [0.1, 0.26], seatedTopMin: 215 / H },
    ],
  },
];

export function sceneById(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}

export function inPoly([x, y]: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polyBounds(poly: Pt[]): { x0: number; y0: number; x1: number; y1: number } {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

export function centroid(poly: Pt[]): Pt {
  const n = poly.length;
  return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
}
