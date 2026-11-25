/**
 * Space configuration for 1947 COMMONS. Swap this file (or load JSON with the same shape)
 * when verified floor data arrives — no UI rewrite needed.
 *
 * Verified (user field observation): main entrance as reference point; 3 kiosks on the
 * left and 3 on the right; each kiosk has its own queue extending outward; all kiosks
 * sell the same menu; kiosks carry no visible numbers.
 * Verified 2026-11-24 (user): left-bank users face right, right-bank users face left
 * (screens face outward); each queue forms behind the person ordering; the central
 * walkway is wider than the v1 drawing.
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
  version: "2026-11-25-floor-guide",
  status: "guide_based" as const,
  note: "정문 기준 좌우 3대와 바깥쪽 대기열은 현장에서 확인한 관계예요. 매장 구역·카페·화장실 위치는 정문 옆 ‘혜당관 1F’ 안내도(2026-11-25 촬영)를 따라 그렸고, 안내도 오른쪽이 사진에서 잘려 그 부분은 ‘매장이 이어짐’으로만 표시해요. 거리·크기·좌석 배치·모니터 위치는 실측이 아니에요.",
  totalSeatsOfficial: 600,
};

// ------------------------------------------------------------------ floor guide (2026-11-25)
/**
 * Plan read off the "단국대학교 혜당관 1F" guide on the entrance glass (photo IMG_0747, private).
 * Units are the same schematic metres as the map; they come from guide pixels × 0.05 with the
 * entrance at the origin, chosen because that scale puts the guide's kiosk marks where our
 * user-verified kiosk banks already are (±5 from the axis). It is NOT a measured scale.
 *
 * Assumption: the guide is drawn as seen from the entrance (entrance at the bottom, "현재 위치"
 * pin next to the left kiosks), so its left/right equal ours.
 */
export type GuideStatus =
  /** guide label AND a current brand (kiosk tab + monitor, 2026-11-25) */
  | "guide_current"
  /** guide label AND a 2026-11-25 counter photo showing the same neighbour */
  | "guide_photo"
  /** guide shows an old store; a 2026-11-25 photo puts a current brand next to its neighbour */
  | "inferred"
  /** guide shows a store that is not in the current kiosk/monitor list; who is there now is unknown */
  | "outdated"
  /** the guide photo is cut off here; the user confirmed the remaining stores continue */
  | "continues";

export interface CounterSlot {
  id: string;
  band: "yellow" | "blue";
  /** centre x and half-width along the band (schematic units) */
  x: number;
  half: number;
  /** brand now believed to be here (null = unknown) */
  brandId: string | null;
  /** brands that may be here (for "continues": the ones not placed elsewhere) */
  candidates?: string[];
  guideLabel: string | null;
  status: GuideStatus;
  note: string;
}

export const FLOOR_GUIDE = {
  source: "혜당관 1F 안내도 사진(2026-11-25, 비공개 보관) + 카운터 사진 2장",
  scaleNote: "안내도 픽셀 × 0.05. 실측 축척이 아니에요.",
  hall: { x0: -47.5, x1: 22.5, y1Left: 40.25, stepX: 8, y1Right: 33.25 },
  /** area hidden in the guide photo (privacy patch / glare) */
  hidden: [{ x0: -36, x1: -20.5, y0: 0, y1: 15.75, label: "안내도 사진에서 가려진 부분" }],
  bands: {
    yellow: { x0: -31, x1: 7.25, y0: 24.75, y1: 40 },
    blue: { x0: 6.75, x1: 34, y0: 17.75, y1: 32.5, cutAt: 22.5 },
  },
  cafe: { x0: -46.5, x1: -38.25, y0: 16, y1: 29.75, name: "카페1847", note: "안내도에 별도 키오스크 표기. 식사 키오스크 6대와 별개이고 같은 주문 시스템인지 몰라요." },
  restroom: { x0: -47, x1: -35.75, y0: 33.75, y1: 39 },
  stairs: { x0: -35.5, x1: -32, y0: 33.5, y1: 39 },
  /** green shape in the middle of the guide — its use is not labelled */
  unlabelled: [[-13, 19.5], [5, 19.5], [5, 10.75], [-4, 10.75]] as [number, number][],
  counters: [
    { id: "Y1", band: "yellow", x: -27, half: 2.9, brandId: "babi", guideLabel: "바비든든", status: "guide_current", note: "안내도 표기" },
    { id: "Y2", band: "yellow", x: -21, half: 2.9, brandId: "popo420", guideLabel: "포포420", status: "guide_current", note: "안내도 표기" },
    { id: "Y3", band: "yellow", x: -15.1, half: 2.9, brandId: "kaohsiung", guideLabel: "중식대장", status: "inferred", note: "안내도에는 지금 없는 ‘중식대장’. 현장 사진에서 폭풍분식 바로 옆에 가오슝 간판이 보여 이 자리로 추정해요(교체 여부 미확인)." },
    { id: "Y4", band: "yellow", x: -9.25, half: 2.9, brandId: "pokpung", guideLabel: "폭풍분식", status: "guide_photo", note: "안내도 표기 + 현장 사진(가오슝과 이웃)" },
    { id: "Y5", band: "yellow", x: -3.25, half: 2.9, brandId: "gapjjigae", guideLabel: "값찌개", status: "guide_photo", note: "안내도 표기 + 현장 사진(경성카츠와 이웃)" },
    { id: "Y6", band: "yellow", x: 2.75, half: 2.9, brandId: "gyeongseong", guideLabel: "경성카츠", status: "guide_photo", note: "안내도 표기 + 현장 사진(값찌개와 이웃)" },
    { id: "B1", band: "blue", x: 11, half: 2.9, brandId: null, candidates: ["bibigogo", "tokyoya", "gwangttuk"], guideLabel: "뽀까뽀까", status: "outdated", note: "안내도에는 ‘뽀까뽀까’. 지금 키오스크·모니터에 없는 매장이라 현재 어느 매장인지 몰라요." },
    { id: "B2", band: "blue", x: 17, half: 2.9, brandId: "jang51", guideLabel: "51장국밥", status: "guide_current", note: "안내도 표기" },
    { id: "B3", band: "blue", x: 27.5, half: 6.2, brandId: null, candidates: ["bibigogo", "tokyoya", "gwangttuk"], guideLabel: null, status: "continues", note: "안내도 사진이 여기서 잘렸어요. 나머지 매장(비비고고·도쿄야·광뚝)이 이어진다고 현장에서 확인했지만 순서는 몰라요." },
  ] as CounterSlot[],
};

/** Where to look for a brand's pickup counter, with how sure we are. */
export function counterFor(brandId: string): { slots: CounterSlot[]; status: GuideStatus } {
  const exact = FLOOR_GUIDE.counters.find((c) => c.brandId === brandId);
  if (exact) return { slots: [exact], status: exact.status };
  const maybe = FLOOR_GUIDE.counters.filter((c) => c.candidates?.includes(brandId));
  return { slots: maybe, status: "continues" };
}

export const COUNTER_STATUS_LABEL: Record<GuideStatus, string> = {
  guide_current: "안내도 기준",
  guide_photo: "안내도 + 현장 사진",
  inferred: "추정",
  outdated: "안내도 옛 매장",
  continues: "위치 미확정",
};

export function totalSeats(observedOnly = false): number {
  return ZONES.filter((z) => !observedOnly || z.observed).reduce((s, z) => s + z.tables * z.seatsPerTable, 0);
}

/** One-line pickup hint for a brand, honest about how sure it is. */
export function pickupHint(brandId: string): { where: string; sure: boolean; status: GuideStatus } {
  const { slots, status } = counterFor(brandId);
  const name = (id: string | null | undefined) => (id ? (BRAND_NAMES[id] ?? "") : "");
  if (status === "continues") return { where: "오른쪽 파란 매장 구역 안쪽 (정확한 자리는 확인 전)", sure: false, status };
  const c = slots[0];
  const row = FLOOR_GUIDE.counters.filter((x) => x.band === c.band);
  const i = row.indexOf(c);
  const nb = [row[i - 1], row[i + 1]].filter((x) => x && x.brandId).map((x) => name(x!.brandId));
  const band = c.band === "yellow" ? "안쪽 노란 매장 구역" : "오른쪽 파란 매장 구역";
  const between = nb.length === 2 ? `${nb[0]}${andParticle(nb[0])} ${nb[1]} 사이` : nb.length === 1 ? `${nb[0]} 옆` : "";
  return { where: `${band}${between ? `, ${between}` : ""}${status === "inferred" ? " (추정)" : ""}`, sure: status !== "inferred", status };
}
const BRAND_NAMES: Record<string, string> = {
  babi: "바비든든", bibigogo: "비비고고", popo420: "포포420", kaohsiung: "가오슝", pokpung: "폭풍분식",
  gapjjigae: "값찌개", gyeongseong: "경성카츠", tokyoya: "도쿄야", jang51: "51장국밥", gwangttuk: "광뚝",
};

/** 과/와 after a Korean word (digits read in Korean). */
function andParticle(word: string): string {
  const ch = word.at(-1) ?? "";
  if (/[0-9]/.test(ch)) return "013678".includes(ch) ? "과" : "와";
  const code = ch.charCodeAt(0) - 0xac00;
  return code >= 0 && code < 11172 && code % 28 !== 0 ? "과" : "와";
}
