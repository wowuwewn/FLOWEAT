/**
 * CONCEPT seating layout for the map (not surveyed). The real table positions in 1947 COMMONS
 * are not verified; the team asked for a plausible layout first so the map reads like a room.
 * Counts per zone match ZONES (window 30 · center 24 · long 16 · booth 12); "rest" are a few
 * grey tables standing in for the seats outside camera coverage. Units are schematic metres.
 * The map labels this "개념 배치".
 */
export type UnitKind = "single" | "quad" | "long" | "booth" | "rest";

export interface SeatUnit {
  zone: "window" | "center" | "long" | "booth" | "rest";
  kind: UnitKind;
  /** centre of the table top */
  x: number;
  y: number;
  /** half sizes of the table top */
  hx: number;
  hy: number;
  /** index within its zone (state assignment) */
  i: number;
}

function build(): SeatUnit[] {
  const out: SeatUnit[] = [];
  // window bar: 30 single seats along the front glass, left of the entrance
  for (let i = 0; i < 30; i++) out.push({ zone: "window", kind: "single", x: -44 + i * 0.95, y: 1.5, hx: 0.28, hy: 0.28, i });
  // centre: 6 × 4 four-seat tables with low partitions
  for (let j = 0; j < 4; j++) for (let c = 0; c < 6; c++) out.push({ zone: "center", kind: "quad", x: -30 + c * 2.6, y: 12.6 + j * 2.7, hx: 0.7, hy: 0.45, i: j * 6 + c });
  // long tables: 4 rows of 4 units, each unit seats 4
  for (let c = 0; c < 4; c++) for (let u = 0; u < 4; u++) out.push({ zone: "long", kind: "long", x: -12.6 + c * 3, y: 12.6 + u * 1.7, hx: 0.5, hy: 0.85, i: c * 4 + u });
  // booths: 2 rows of 6 on the right, under the blue counters
  for (let j = 0; j < 2; j++) for (let c = 0; c < 6; c++) out.push({ zone: "booth", kind: "booth", x: 4.6 + c * 3, y: 11.6 + j * 2.6, hx: 0.6, hy: 0.4, i: j * 6 + c });
  // outside camera coverage: plain grey tables
  for (let j = 0; j < 3; j++) for (let c = 0; c < 4; c++) out.push({ zone: "rest", kind: "rest", x: -30 + c * 3.4, y: 4 + j * 2.6, hx: 0.7, hy: 0.45, i: j * 4 + c });
  return out;
}

export const SEAT_UNITS = build();

export const ZONE_LABEL_AT: Record<SeatUnit["zone"], [number, number]> = {
  window: [-30, 2.9],
  center: [-23.5, 22.6],
  long: [-8.1, 20.6],
  booth: [12.1, 16.2],
  rest: [-35, 6.6],
};

export type CellState = "free" | "busy" | "unsure";

/** Spread a zone's counts over its units so free tables don't all sit in one corner. */
export function zoneStates(n: number, free: number, unsure: number): CellState[] {
  const ordered: CellState[] = [...Array<CellState>(free).fill("free"), ...Array<CellState>(unsure).fill("unsure")];
  while (ordered.length < n) ordered.push("busy");
  const out = new Array<CellState>(n);
  // 7 is coprime with every zone size we use (30, 24, 16, 12), so this is a permutation
  for (let i = 0; i < n; i++) out[(i * 7 + 3) % n] = ordered[i];
  return out;
}
