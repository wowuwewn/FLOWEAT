import catalogJson from "./data/catalog.json";

export type CookType =
  | "side" | "rice_bowl" | "curry" | "stew" | "noodle_soup" | "cold_noodle" | "fried" | "wok" | "snack" | "grill";

export type BrandVerification = "field_verified" | "operator_listed" | "field_observed" | "visit_report";

export interface Brand {
  id: string;
  name: string;
  cuisine: string;
  verification: BrandVerification;
  verificationNote: string;
  latestOperatorReview: string | null;
  /** null until confirmed on site — never render a court number from the 2025 table */
  currentCourtNumber: number | null;
  /** null until the pickup counter position is verified */
  pickupNodeId: string | null;
  earlierVerification?: BrandVerification;
  fieldVerifiedAt?: string;
  /** position of the brand tab on the real kiosk (2 rows × 5) — tab order, NOT counter order */
  kioskTab?: { row: number; col: number };
  /** column on the real call monitors (photo 2026-11-25); confirmed=false where the photo is cut off */
  monitor?: { screen: "A" | "B"; column: number; confirmed: boolean };
}

/** What the real kiosk showed for this item on the field date. A snapshot, never live availability. */
export interface FieldSighting {
  order: number;
  date: string;
  source: string;
  priceKrw: number | null;
  /** "preparing" = the screen said 준비중 at that moment (NOT sold out) */
  display: "normal" | "preparing" | "unknown" | "price_unknown";
  badge: "NEW" | "BEST" | null;
  spicyIcon: boolean;
  note: string;
}

export interface Menu {
  id: string;
  brandId: string;
  name: string;
  listedPriceKrw: number | null;
  cookType: CookType;
  isSide: boolean;
  /** third-party listing price (undated); null when the item was only seen on site */
  referencePriceKrw: number | null;
  /** where listedPriceKrw comes from */
  priceBasis: "field" | "field_only" | "reference";
  /** name used by the third-party listing when the kiosk spells it differently */
  referenceName?: string;
  field: FieldSighting | null;
}

export const catalog = catalogJson as unknown as {
  generatedAt: string;
  source: { evidence: string; priceSource: string; priceStatus: string; asOf: string; field: { evidence: string; asOf: string; status: string; rows: number } };
  brands: Brand[];
  menus: Menu[];
};

export const brands: Brand[] = catalog.brands;
export const menus: Menu[] = catalog.menus;

const brandById = new Map(brands.map((b) => [b.id, b]));
const menuById = new Map(menus.map((m) => [m.id, m]));

export function getBrand(id: string): Brand | undefined {
  return brandById.get(id);
}
export function getMenu(id: string): Menu | undefined {
  return menuById.get(id);
}
export function menusOf(brandId: string): Menu[] {
  return menus.filter((m) => m.brandId === brandId);
}

export const COOK_TYPE_LABEL: Record<CookType, string> = {
  side: "사이드",
  rice_bowl: "덮밥·비빔밥",
  curry: "카레",
  stew: "찌개·국밥",
  noodle_soup: "국물면",
  cold_noodle: "냉면",
  fried: "튀김·돈카츠",
  wok: "볶음",
  snack: "분식·포케",
  grill: "구이",
};

/** Normalises Korean text for search (spaces, case, brackets). */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s()+~]/g, "");
}

export function searchMenus(q: string): Menu[] {
  const n = normalize(q);
  if (!n) return [];
  return menus.filter((m) => {
    const b = getBrand(m.brandId)!;
    return normalize(m.name).includes(n) || normalize(b.name).includes(n) || normalize(COOK_TYPE_LABEL[m.cookType]).includes(n);
  });
}

export const PRICE_BASIS_LABEL: Record<Menu["priceBasis"], string> = {
  field: "현장 키오스크 확인",
  field_only: "현장에서 새로 확인",
  reference: "참고 가격(미확인)",
};

/** Short provenance line for a menu price, e.g. "11/25 현장 확인" or "참고 가격". */
export function priceProvenance(m: Menu): string {
  if (m.priceBasis === "reference") return "참고 가격";
  const [, mm, dd] = (m.field?.date ?? "").split("-");
  return `${Number(mm)}/${Number(dd)} 현장 확인`;
}

/**
 * Demo-only "준비중" tiles for the mock kiosk: about half of the brands we saw on site get one
 * item marked 준비중 per simulated day (never their first four tiles, never sides), so the kiosk
 * can show the real screen's 준비중 state. Picked by hash — NOT real availability, and NOT the
 * 2026-11-25 snapshot (that is kept as data only, menu.field.display).
 */
export function demoPreparing(dateKey: string): Set<string> {
  const out = new Set<string>();
  const h = (s: string) => {
    let x = 2166136261;
    for (const ch of s) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
    return Math.abs(x);
  };
  for (const b of brands) {
    const list = menusOf(b.id);
    if (!list.some((m) => m.field) || h(dateKey + b.id) % 2) continue;
    const pool = list.slice(4).filter((m) => !m.isSide);
    if (pool.length) out.add(pool[h(b.id + dateKey) % pool.length].id);
  }
  return out;
}
