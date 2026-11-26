/**
 * Neutral brand marker: first letter on a soft tile. Deliberately NOT the stores' real logos
 * or colours (we have no rights to them) — the hue only helps tell rows apart.
 */
const HUES = [
  ["#fdebd9", "#9a4a12"],
  ["#e6eefc", "#1d3fc4"],
  ["#e2f4ea", "#12704f"],
  ["#fbe4e6", "#a3242b"],
  ["#efe6fb", "#5b35a8"],
  ["#fdf2cf", "#7a5a00"],
  ["#dff3f6", "#0d6170"],
  ["#f6e6dc", "#8a4a2a"],
  ["#e9ecf3", "#334061"],
  ["#e8f1dc", "#4a6b16"],
] as const;

// fixed per brand (not by list position) so reordering brands never recolours them
const HUE_ORDER = ["gapjjigae", "gyeongseong", "babi", "popo420", "bibigogo", "gwangttuk", "pokpung", "tokyoya", "kaohsiung", "jang51"];

export function brandHue(brandId: string) {
  const i = Math.max(0, HUE_ORDER.indexOf(brandId));
  return HUES[i % HUES.length];
}

export function BrandMark({ brandId, name, size = 44, className = "" }: { brandId: string; name: string; size?: number; className?: string }) {
  const [bg, fg] = brandHue(brandId);
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center font-[800] tracking-[-0.04em] ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), background: bg, color: fg, fontSize: Math.round(size * 0.44) }}
    >
      {name.replace(/^\d+/, "").slice(0, 1) || name.slice(0, 1)}
    </span>
  );
}
