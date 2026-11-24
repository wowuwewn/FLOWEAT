/**
 * Test-video scenes and their analysis regions (normalised 0–1 coordinates).
 * These are licensed public test videos standing in for the school CCTV (not yet
 * permitted). Region configs are data — real camera ROIs replace them later.
 */
export type Pt = [number, number];

export interface ZoneSpec {
  id: string;
  label: string;
  type: "service" | "queue" | "table";
  poly: Pt[];
  /** for tables: expected person height range (fraction of frame height) seated there */
  personH?: [number, number];
  /** for tables: the desk surface, where item cues (bag, cup…) count */
  desk?: Pt[];
  /** for tables: a seated person's box top is below this line (normalised y); higher = standing */
  seatedTopMin?: number;
}

export interface Scene {
  id: string;
  title: string;
  file: string;
  /** stands in for which part of 1947 COMMONS */
  standsFor: string;
  mapsTo: { kioskId?: string; zoneId?: string };
  attribution: string;
  license: "CC BY 4.0";
  sourceUrl: string;
  zones: ZoneSpec[];
}

const W = 960;
const H = 540;
const r = (x: number, y: number): Pt => [x / W, y / H];
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [r(x0, y0), r(x1, y0), r(x1, y1), r(x0, y1)];

export const SCENES: Scene[] = [
  {
    id: "counter",
    title: "한 명씩 쓰는 스탠딩 테이블",
    file: "/media/counter.mp4",
    standsFor: "키오스크 한 대 앞 이용 구역과 그 옆 통행·대기 구역",
    mapsTo: { kioskId: "L2" },
    attribution: "Intel IoT DevKit sample-videos, one-by-one-person-detection.mp4",
    license: "CC BY 4.0",
    sourceUrl: "https://github.com/intel-iot-devkit/sample-videos",
    zones: [
      // where a user stands while using the "kiosk" (the counter)
      { id: "service", label: "이용 중 구역", type: "service", poly: rect(400, 330, 720, 540) },
      // people standing still here would be the waiting line; walkers are excluded
      { id: "queue", label: "대기 구역", type: "queue", poly: rect(0, 330, 400, 540) },
    ],
  },
  {
    id: "tables",
    title: "테이블 4개가 보이는 실내",
    file: "/media/tables.mp4",
    standsFor: "중앙 칸막이석 테이블 4개",
    mapsTo: { zoneId: "center" },
    attribution: "Intel IoT DevKit sample-videos, classroom.mp4",
    license: "CC BY 4.0",
    sourceUrl: "https://github.com/intel-iot-devkit/sample-videos",
    zones: [
      { id: "T1", label: "앞 왼쪽", type: "table", poly: rect(20, 270, 345, 455), desk: rect(0, 435, 345, 540), personH: [0.24, 0.6], seatedTopMin: 240 / H },
      { id: "T2", label: "앞 오른쪽", type: "table", poly: rect(430, 270, 770, 455), desk: rect(420, 430, 770, 540), personH: [0.24, 0.6], seatedTopMin: 240 / H },
      { id: "T3", label: "뒤 왼쪽", type: "table", poly: rect(205, 225, 372, 350), desk: rect(215, 335, 362, 385), personH: [0.1, 0.26], seatedTopMin: 215 / H },
      { id: "T4", label: "뒤 오른쪽", type: "table", poly: rect(395, 225, 600, 350), desk: rect(400, 335, 600, 385), personH: [0.1, 0.26], seatedTopMin: 215 / H },
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
