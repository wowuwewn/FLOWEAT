import type { Menu } from "@/core/catalog";

/**
 * Line icons for menu tiles: what kind of dish, not what it looks like. One stroke weight, one
 * grid, so a wall of tiles reads as a system instead of a page of clip art.
 */
export type DishKind = "soup" | "stew" | "rice" | "curry" | "cutlet" | "kimbap" | "cold" | "poke" | "plainrice" | "can" | "side" | "noodle";

export function dishKind(m: Pick<Menu, "name" | "cookType" | "isSide">): DishKind {
  const n = m.name;
  if (/음료/.test(n)) return "can";
  if (/공기밥|밥 추가/.test(n)) return "plainrice";
  if (/냉면/.test(n) || m.cookType === "cold_noodle") return "cold";
  if (/김밥/.test(n)) return "kimbap";
  if (/포케|샐러드/.test(n)) return "poke";
  if (/카레/.test(n)) return "curry";
  if (/떡볶이|라볶이/.test(n)) return "stew";
  if (/라죽/.test(n)) return "soup";
  if (/찌개|순두부|뚝배기|찜닭/.test(n) || m.cookType === "stew") return /국밥|곰탕/.test(n) ? "soup" : "stew";
  if (/라면|우동|칼국수|칼제비|짬뽕|쌀국수|라멘|우육면|자장면|짜파|파스타/.test(n) || m.cookType === "noodle_soup") return /국밥|곰탕/.test(n) ? "soup" : "noodle";
  if (/국밥|곰탕/.test(n)) return "soup";
  if (/카츠|가라아게|튀김|빠스|링|만두|춘권|편육/.test(n)) return m.isSide ? "side" : "cutlet";
  if (m.isSide) return "side";
  return "rice";
}

const P: Record<DishKind, React.ReactNode> = {
  rice: (
    <>
      <path d="M5 15h22a11 11 0 0 1-22 0z" />
      <path d="M8 15c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" />
      <path d="M12 11.5l1.5 1M18 10.5l1 1.5M15 13l.5 1" />
    </>
  ),
  plainrice: (
    <>
      <path d="M6 15h20a10 10 0 0 1-20 0z" />
      <path d="M9 15c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
    </>
  ),
  soup: (
    <>
      <path d="M4 15h24a12 12 0 0 1-24 0z" />
      <path d="M8 19h16" />
      <path d="M12 6c-1 1.5 1 2.5 0 4M16 5c-1 1.5 1 2.5 0 4M20 6c-1 1.5 1 2.5 0 4" />
    </>
  ),
  noodle: (
    <>
      <path d="M4 16h24a12 12 0 0 1-24 0z" />
      <path d="M9 16c1-3 3-3 4 0s3 3 4 0 3-3 4 0" />
      <path d="M21 4l-4 12M25 5l-6 11" />
    </>
  ),
  cold: (
    <>
      <path d="M4 14h24l-2.5 9a5 5 0 0 1-4.8 3.5H11.3a5 5 0 0 1-4.8-3.5z" />
      <path d="M9 18c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0" />
      <circle cx="16" cy="9.5" r="2.5" />
    </>
  ),
  stew: (
    <>
      <path d="M6 13h20v8a5 5 0 0 1-5 5H11a5 5 0 0 1-5-5z" />
      <path d="M3 15h3M26 15h3" />
      <path d="M11 9c-1 1 1 2 0 3M16 8c-1 1 1 2 0 3M21 9c-1 1 1 2 0 3" />
    </>
  ),
  curry: (
    <>
      <ellipse cx="16" cy="18" rx="12" ry="7" />
      <path d="M16 11c-2 2.5-2 11.5 0 14" />
      <path d="M20 15.5h2M19.5 19.5h3" />
    </>
  ),
  cutlet: (
    <>
      <ellipse cx="16" cy="19" rx="12" ry="6.5" />
      <path d="M8 17.5l13-5 3 4.5-13 5z" />
      <path d="M12 16l2 4M16 14.5l2 4" />
    </>
  ),
  kimbap: (
    <>
      <circle cx="9" cy="16" r="4.5" />
      <circle cx="16" cy="16" r="4.5" />
      <circle cx="23" cy="16" r="4.5" />
      <circle cx="9" cy="16" r="1.4" />
      <circle cx="16" cy="16" r="1.4" />
      <circle cx="23" cy="16" r="1.4" />
    </>
  ),
  poke: (
    <>
      <path d="M4 15h24a12 12 0 0 1-24 0z" />
      <path d="M16 15V9M9.5 11.5L12 15M22.5 11.5L20 15" />
    </>
  ),
  side: (
    <>
      <ellipse cx="16" cy="20" rx="11" ry="5.5" />
      <circle cx="12.5" cy="16" r="3" />
      <circle cx="19.5" cy="16" r="3" />
      <circle cx="16" cy="12" r="3" />
    </>
  ),
  can: (
    <>
      <path d="M11 6h10l-1 2v17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8z" />
      <path d="M11.5 12h9M11.5 21h9" />
    </>
  ),
};

export function DishIcon({ kind, className }: { kind: DishKind; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {P[kind]}
    </svg>
  );
}
