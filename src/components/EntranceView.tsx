"use client";
/**
 * Entrance View — the cafeteria as you see it standing at the main entrance, looking in.
 * Only verified relations are drawn: entrance, 3 kiosks per side, queues running outward.
 * Distances, angles, counters, monitors and seats are deliberately absent.
 */
import type { KioskView } from "@/core/world";
import { minuteRange, WAIT_LEVEL, WAIT_LEVEL_HEX } from "@/lib/format";

const W = 360;
const ROW_Y: Record<number, number> = { 3: 62, 2: 142, 1: 222 }; // depth 3 = 안쪽 (top)
const KIOSK_W = 38;
const KIOSK_H = 46;
const LEFT_KX = 116;
const RIGHT_KX = W - 116 - KIOSK_W;
const DOT_R = 4.4;
const DOT_GAP = 10.6;
const MAX_DOTS = 8;

interface Props {
  kiosks: KioskView[];
  selected?: string | null;
  onSelect?: (id: string) => void;
  /** smaller labels for the home preview */
  compact?: boolean;
}

export function EntranceView({ kiosks, selected, onSelect, compact }: Props) {
  const anySimilarOnly = kiosks.filter((k) => k.similar).length;
  const summary = kiosks
    .map((k) => `${k.label} 키오스크, 대기 ${k.people}명, 주문 시작까지 ${minuteRange(k.p20, k.p80)}`)
    .join(". ");
  return (
    <figure className="relative m-0">
      <svg
        viewBox={`0 0 ${W} 330`}
        className="block h-auto w-full select-none"
        role="group"
        aria-label={`정문에서 안쪽을 본 키오스크 배치. ${summary}`}
      >
        <defs>
          <linearGradient id="aisle" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--color-oak-soft)" stopOpacity="0.95" />
            <stop offset="1" stopColor="var(--color-oak-soft)" stopOpacity="0" />
          </linearGradient>
          <pattern id="glass" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#dfeafb" />
            <rect width="2" height="6" fill="#cddcf5" />
          </pattern>
        </defs>

        {/* walking direction from the door into the hall */}
        <rect x={W / 2 - 34} y={20} width={68} height={282} fill="url(#aisle)" />
        <text x={W / 2} y={14} textAnchor="middle" className="fill-ink-3" fontSize="11" fontWeight={500}>
          식당 안쪽
        </text>

        {/* entrance wall: brick, with the glass main door in the middle */}
        <rect x={0} y={300} width={W / 2 - 40} height={7} rx={1.5} fill="var(--color-brick)" />
        <rect x={W / 2 + 40} y={300} width={W / 2 - 40} height={7} rx={1.5} fill="var(--color-brick)" />
        <rect x={W / 2 - 38} y={299} width={36} height={9} rx={1.5} fill="url(#glass)" stroke="#9db6e0" strokeWidth={1} />
        <rect x={W / 2 + 2} y={299} width={36} height={9} rx={1.5} fill="url(#glass)" stroke="#9db6e0" strokeWidth={1} />
        <text x={W / 2} y={324} textAnchor="middle" className="fill-ink" fontSize="12.5" fontWeight={700}>
          정문
        </text>

        {kiosks.map((k) => {
          const cy = ROW_Y[k.depth];
          const left = k.side === "left";
          const kx = left ? LEFT_KX : RIGHT_KX;
          const isSel = selected === k.id;
          const highlight = k.similar && anySimilarOnly < kiosks.length;
          const color = WAIT_LEVEL_HEX[k.level];
          const shown = Math.min(k.people, MAX_DOTS);
          const extra = k.people - shown;
          const dir = left ? -1 : 1;
          const dotStart = left ? kx - 12 : kx + KIOSK_W + 12;
          const textX = left ? kx - 10 : kx + KIOSK_W + 10;
          return (
            <g
              key={k.id}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={`${k.label} 키오스크. 대기 ${k.people}명. 주문 시작까지 ${minuteRange(k.p20, k.p80)}. ${WAIT_LEVEL[k.level].label}${k.similar ? ". 가장 빠른 줄과 비슷해요" : ""}`}
              aria-pressed={onSelect ? isSel : undefined}
              onClick={() => onSelect?.(k.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(k.id);
                }
              }}
              className={onSelect ? "cursor-pointer outline-none [&:focus-visible>.focus]:opacity-100" : undefined}
            >
              {/* generous hit area */}
              <rect x={left ? 0 : kx - 6} y={cy - 38} width={left ? kx + KIOSK_W + 6 : W - kx + 6} height={76} fill="transparent" />
              <rect className="focus opacity-0" x={left ? 2 : kx - 6} y={cy - 36} width={left ? kx + KIOSK_W + 4 : W - kx + 4} height={72} rx={14} fill="none" stroke="var(--color-blue)" strokeWidth={2.5} />
              {isSel && (
                <rect x={left ? 2 : kx - 6} y={cy - 36} width={left ? kx + KIOSK_W + 4 : W - kx + 4} height={72} rx={14} fill="var(--color-ice)" />
              )}

              {/* queue dots running outward */}
              {Array.from({ length: shown }, (_, i) => (
                <circle
                  key={i}
                  cx={dotStart + dir * i * DOT_GAP}
                  cy={cy + 13}
                  r={DOT_R}
                  fill={color}
                  style={{ transition: "cx 600ms var(--ease-out-soft), fill 400ms" }}
                />
              ))}
              {k.people > 0 && (
                <text
                  x={dotStart + dir * (shown * DOT_GAP + (extra > 0 ? 22 : 2))}
                  y={cy + 17}
                  textAnchor={left ? "end" : "start"}
                  fontSize="11"
                  className="num fill-ink-3"
                >
                  {extra > 0 ? "" : `${k.people}명`}
                </text>
              )}
              {extra > 0 && (
                <text x={dotStart + dir * shown * DOT_GAP + dir * 2} y={cy + 17} textAnchor={left ? "end" : "start"} fontSize="11" fontWeight={700} fill={color} className="num">
                  {k.people}명
                </text>
              )}
              {k.people === 0 && (
                <text x={dotStart} y={cy + 17} textAnchor={left ? "end" : "start"} fontSize="11" className="fill-ink-3">
                  줄 없음
                </text>
              )}

              {/* ETA */}
              <text
                x={textX}
                y={cy - 4}
                textAnchor={left ? "end" : "start"}
                fontSize={compact ? 19 : 20}
                fontWeight={750}
                className={`num ${highlight ? "fill-blue-ink" : "fill-ink"}`}
              >
                {minuteRange(k.p20, k.p80)}
              </text>

              {/* kiosk unit, screen facing the queue */}
              <rect
                x={kx}
                y={cy - KIOSK_H / 2}
                width={KIOSK_W}
                height={KIOSK_H}
                rx={9}
                fill={highlight ? "var(--color-blue)" : "var(--color-surface)"}
                stroke={highlight ? "var(--color-blue)" : "var(--color-line-2)"}
                strokeWidth={1.5}
              />
              <rect
                x={left ? kx + 5 : kx + KIOSK_W - 5 - 9}
                y={cy - 14}
                width={9}
                height={28}
                rx={2.5}
                fill={highlight ? "rgba(255,255,255,.9)" : "var(--color-navy)"}
                opacity={highlight ? 1 : 0.85}
              />

            </g>
          );
        })}

        {/* side captions */}
        <text x={8} y={300 - 10} fontSize="11" className="fill-ink-3" fontWeight={500}>
          왼쪽 3대
        </text>
        <text x={W - 8} y={300 - 10} textAnchor="end" fontSize="11" className="fill-ink-3" fontWeight={500}>
          오른쪽 3대
        </text>
      </svg>
    </figure>
  );
}
