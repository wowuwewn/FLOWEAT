/**
 * Space configuration for 1947 COMMONS. Swap this file (or load JSON with the same shape)
 * when verified floor data arrives — no UI rewrite needed.
 *
 * Verified (user field observation): main entrance as reference point; 3 kiosks on the
 * left and 3 on the right; each kiosk has its own queue extending outward; all kiosks
 * sell the same menu; kiosks carry no visible numbers.
 * NOT verified: distances, angles, exact order along the depth axis, accessible kiosk
 * position, pickup counters, monitors, seating zone positions.
 */
export type Side = "left" | "right";

export interface KioskSpec {
  /** internal id — never shown to students as if printed on the device */
  id: "L1" | "L2" | "L3" | "R1" | "R2" | "R3";
  side: Side;
  /** 1 = closest to the entrance in our schematic (order along depth is schematic) */
  depth: 1 | 2 | 3;
  label: string;
  shortLabel: string;
  accessible: boolean | null;
}

export const KIOSKS: KioskSpec[] = [
  { id: "L1", side: "left", depth: 1, label: "왼쪽 정문 쪽", shortLabel: "정문 쪽", accessible: null },
  { id: "L2", side: "left", depth: 2, label: "왼쪽 가운데", shortLabel: "가운데", accessible: null },
  { id: "L3", side: "left", depth: 3, label: "왼쪽 안쪽", shortLabel: "안쪽", accessible: null },
  { id: "R1", side: "right", depth: 1, label: "오른쪽 정문 쪽", shortLabel: "정문 쪽", accessible: null },
  { id: "R2", side: "right", depth: 2, label: "오른쪽 가운데", shortLabel: "가운데", accessible: null },
  { id: "R3", side: "right", depth: 3, label: "오른쪽 안쪽", shortLabel: "안쪽", accessible: null },
];

export const KIOSK_IDS = KIOSKS.map((k) => k.id);
export function kioskById(id: string): KioskSpec | undefined {
  return KIOSKS.find((k) => k.id === id);
}

export interface ZoneSpec {
  id: string;
  name: string;
  /** what the zone looks like — element types seen in photos; positions are unknown */
  description: string;
  tables: number;
  seatsPerTable: number;
  /** demo assumption: this zone is inside a (hypothetical) camera view */
  observed: boolean;
}

/**
 * Seating zones. Zone TYPES come from photos (window single seats, partitioned centre
 * tables, long tables, booths). Table counts and camera coverage are DEMO ASSUMPTIONS
 * sized so the hall totals about 600 seats (official capacity).
 */
export const ZONES: ZoneSpec[] = [
  { id: "window", name: "창가 1인석", description: "창가를 따라 놓인 혼자 앉는 자리", tables: 30, seatsPerTable: 1, observed: true },
  { id: "center", name: "중앙 칸막이석", description: "원목 칸막이로 나뉜 4인 테이블", tables: 24, seatsPerTable: 4, observed: true },
  { id: "long", name: "긴 테이블석", description: "긴 원목 테이블을 4인씩 나눠 앉는 자리", tables: 16, seatsPerTable: 4, observed: true },
  { id: "booth", name: "부스석", description: "등받이가 있는 칸막이 부스", tables: 12, seatsPerTable: 4, observed: true },
  { id: "rest", name: "그 밖의 좌석", description: "카메라 관측 범위 밖으로 가정한 좌석", tables: 70, seatsPerTable: 4, observed: false },
];

export const LAYOUT_META = {
  version: "2026-11-24-relative",
  status: "relative_only" as const,
  note: "정문 기준 좌우 3대와 바깥쪽 대기열만 확인된 관계예요. 거리·각도·수령대·모니터·좌석 위치는 확인 전이라 지도에 그리지 않았어요.",
  totalSeatsOfficial: 600,
};

export function totalSeats(observedOnly = false): number {
  return ZONES.filter((z) => !observedOnly || z.observed).reduce((s, z) => s + z.tables * z.seatsPerTable, 0);
}
