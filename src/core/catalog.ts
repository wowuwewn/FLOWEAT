import catalogJson from "./data/catalog.json";

export type CookType =
  | "side" | "rice_bowl" | "curry" | "stew" | "noodle_soup" | "cold_noodle" | "fried" | "wok" | "snack" | "grill";

export type BrandVerification = "operator_listed" | "field_observed" | "visit_report";

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
}

export interface Menu {
  id: string;
  brandId: string;
  name: string;
  listedPriceKrw: number | null;
  cookType: CookType;
  isSide: boolean;
}

export const catalog = catalogJson as unknown as {
  generatedAt: string;
  source: { evidence: string; priceSource: string; priceStatus: string; asOf: string };
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
