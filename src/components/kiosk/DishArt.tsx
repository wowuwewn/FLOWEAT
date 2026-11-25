import type { Menu } from "@/core/catalog";

/**
 * Drawn dish illustrations for the mock kiosk. The real kiosk uses food photos; we have no rights
 * to them, so each tile gets a simple plate/bowl drawing picked from the cook type and a few
 * words in the menu name (colour only — not a claim about how the dish looks).
 */
type Vessel = "plate" | "bowl" | "pot" | "steel" | "board" | "can" | "rice";

function palette(name: string): { food: string; accent: string } {
  if (/자장|짜파/.test(name)) return { food: "#3b2a1f", accent: "#f3d36b" };
  if (/김치|얼큰|마라|매운|로제|짬뽕|떡볶이|라볶이|고추|SO~HOT|카라이|제육|닭갈비/.test(name)) return { food: "#d9512f", accent: "#f4c24a" };
  if (/크림|곰탕|사골|순대|돈코츠|칼국수|만국밥|우동|쌀국수|칼제비|만두국|물냉면/.test(name)) return { food: "#efe3c8", accent: "#6aa84f" };
  if (/카레/.test(name)) return { food: "#8a5a22", accent: "#f2f0e6" };
  if (/된장|불고기|간장|데리야끼|함바그|동파육|장어|찜닭|우육/.test(name)) return { food: "#7a4a2a", accent: "#7fb069" };
  if (/돈카츠|카츠|튀김|가라아게|빠스|링/.test(name)) return { food: "#d99a3e", accent: "#e9eef0" };
  if (/비빔|포케|샐러드/.test(name)) return { food: "#6aa84f", accent: "#f08a5d" };
  if (/마요|오므라이스/.test(name)) return { food: "#f2cf55", accent: "#e46c4c" };
  if (/순두부|짬뽕/.test(name)) return { food: "#e2733f", accent: "#f7e7b5" };
  return { food: "#c98a4b", accent: "#7fb069" };
}

function vesselOf(m: Pick<Menu, "name" | "cookType" | "isSide">): Vessel {
  if (/음료/.test(m.name)) return "can";
  if (/공기밥|밥 추가/.test(m.name)) return "rice";
  if (/김밥/.test(m.name)) return "board";
  if (m.cookType === "stew" || /찌개|순두부|뚝배기/.test(m.name)) return "pot";
  if (m.cookType === "cold_noodle") return "steel";
  if (m.cookType === "noodle_soup" || /국밥|곰탕|라면|우동/.test(m.name)) return "bowl";
  return "plate";
}

export function DishArt({ menu, size = 96, dim = false }: { menu: Pick<Menu, "name" | "cookType" | "isSide">; size?: number; dim?: boolean }) {
  const { food, accent } = palette(menu.name);
  const v = vesselOf(menu);
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className={dim ? "opacity-45 grayscale-[.6]" : undefined}>
      <ellipse cx="50" cy="88" rx="34" ry="5" fill="rgba(20,25,35,.10)" />
      {v === "plate" && (
        <>
          <circle cx="50" cy="50" r="38" fill="#2c3038" />
          <circle cx="50" cy="50" r="31" fill="#3a3f48" />
          <ellipse cx="44" cy="52" rx="19" ry="15" fill="#f6f3ea" />
          <path d="M48 36c12-4 24 4 22 16-1 9-10 14-19 12-9-2-15-9-13-17 1-5 5-9 10-11z" fill={food} />
          <circle cx="60" cy="42" r="4" fill={accent} />
          <circle cx="54" cy="58" r="3" fill={accent} opacity=".8" />
        </>
      )}
      {v === "bowl" && (
        <>
          <circle cx="50" cy="50" r="38" fill="#f3f4f6" stroke="#d8dbe0" strokeWidth="2" />
          <circle cx="50" cy="50" r="31" fill={food} />
          <path d="M30 50c6-6 12 6 18 0s12 6 18 0 8 4 8 4" stroke="#fff7e2" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity=".85" />
          <path d="M28 58c6-6 12 6 18 0s12 6 18 0" stroke="#fff7e2" strokeWidth="2.6" fill="none" strokeLinecap="round" opacity=".7" />
          <circle cx="62" cy="40" r="5" fill={accent} />
          <circle cx="40" cy="38" r="3.5" fill="#3d7a3a" />
        </>
      )}
      {v === "pot" && (
        <>
          <rect x="4" y="44" width="16" height="6" rx="3" fill="#2c3038" />
          <rect x="80" y="44" width="16" height="6" rx="3" fill="#2c3038" />
          <circle cx="50" cy="50" r="36" fill="#2c3038" />
          <circle cx="50" cy="50" r="30" fill={food} />
          <rect x="38" y="40" width="12" height="10" rx="2" fill="#fbf6e9" />
          <rect x="54" y="52" width="10" height="9" rx="2" fill="#fbf6e9" />
          <circle cx="46" cy="60" r="4" fill={accent} />
          <path d="M60 36l6 4" stroke="#3d7a3a" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {v === "steel" && (
        <>
          <circle cx="50" cy="50" r="38" fill="#d9dde3" stroke="#b9c0ca" strokeWidth="2" />
          <circle cx="50" cy="50" r="31" fill={/비빔/.test(menu.name) ? "#c9452f" : "#e9e2cf"} />
          <path d="M32 46c8-8 14 8 22 0s12 6 14 4M30 56c8-8 14 8 22 0s12 6 16 2" stroke="#f4ecd8" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle cx="50" cy="44" r="6" fill="#fff" />
          <circle cx="50" cy="44" r="3" fill="#f1c232" />
        </>
      )}
      {v === "board" && (
        <>
          <rect x="12" y="30" width="76" height="42" rx="12" fill="#2c3038" />
          {[28, 43, 58, 73].map((x) => (
            <g key={x}>
              <circle cx={x} cy="51" r="9" fill="#1f2a1f" />
              <circle cx={x} cy="51" r="6.5" fill="#f6f3ea" />
              <circle cx={x - 1.5} cy="50" r="2" fill="#f1c232" />
              <circle cx={x + 2} cy="53" r="1.8" fill="#e46c4c" />
            </g>
          ))}
        </>
      )}
      {v === "rice" && (
        <>
          <path d="M18 46h64c0 20-14 34-32 34S18 66 18 46z" fill="#2c3038" />
          <ellipse cx="50" cy="46" rx="32" ry="9" fill="#f7f5ef" />
          <ellipse cx="50" cy="42" rx="22" ry="7" fill="#ffffff" />
        </>
      )}
      {v === "can" && (
        <>
          {[30, 52, 41].map((x, i) => (
            <g key={i}>
              <rect x={x - 9} y={i === 2 ? 40 : 22} width="18" height="36" rx="4" fill={["#7a3fb0", "#2f9a4a", "#d23a35"][i]} />
              <rect x={x - 9} y={i === 2 ? 40 : 22} width="18" height="5" rx="2" fill="#cfd4da" />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
