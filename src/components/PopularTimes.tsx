"use client";
import type { TimeSlot } from "@/core/world";
import { formatClock } from "@/core/world";

/**
 * "Usual vs now" bars (inspired by popular-times charts): light bars = usual level,
 * solid = today so far, hatched = short-term forecast. Text always accompanies colour.
 */
export function PopularTimes({ slots, max, label, unit, color = "#2448db" }: { slots: TimeSlot[]; max: number; label: string; unit: (v: number) => string; color?: string }) {
  const W = 340;
  const H = 104;
  const base = H - 20;
  const padX = 14;
  const bw = (W - padX * 2) / slots.length;
  const nowIdx = slots.findIndex((s) => s.isNow);
  const y = (v: number) => base - Math.min(1, v / max) * (base - 10);
  const now = slots.find((s) => s.isNow);
  const desc = `${label}. ${now ? `지금 ${unit(now.today ?? 0)}, 평소 이 시간 ${unit(now.usual)}.` : ""}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={desc}>
      <defs>
        <pattern id="fcHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill={color} opacity="0.12" />
          <rect width="1.6" height="5" fill={color} opacity="0.55" />
        </pattern>
      </defs>
      {slots.map((s, i) => {
        const x = padX + i * bw + 2;
        const w = bw - 4;
        return (
          <g key={s.t}>
            <rect x={x} y={y(s.usual)} width={w} height={base - y(s.usual)} rx={3} fill="#dfe4ec" />
            {s.today !== null && <rect x={x + w * 0.18} y={y(s.today)} width={w * 0.64} height={base - y(s.today)} rx={2.5} fill={color} opacity={s.isNow ? 1 : 0.55} />}
            {s.forecast !== null && <rect x={x + w * 0.18} y={y(s.forecast)} width={w * 0.64} height={base - y(s.forecast)} rx={2.5} fill="url(#fcHatch)" />}
            {s.isNow && (
              <>
                <line x1={x + w / 2} x2={x + w / 2} y1={4} y2={base} stroke="#0b1f4d" strokeWidth={1} strokeDasharray="2 2" />
                <text x={x + w / 2} y={H - 4} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#0b1f4d">
                  지금
                </text>
              </>
            )}
            {!s.isNow && i % 3 === 0 && Math.abs(i - nowIdx) > 1 && (
              <text x={x + w / 2} y={H - 4} textAnchor="middle" fontSize={10} fill="#5b6578" className="num">
                {formatClock(s.t)}
              </text>
            )}
          </g>
        );
      })}
      <line x1={0} x2={W} y1={base + 0.5} y2={base + 0.5} stroke="#c9cfda" />
    </svg>
  );
}

export function PopularLegend() {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-3">
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-3 rounded-sm bg-[#dfe4ec]" />
        평소
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-3 rounded-sm bg-blue" />
        오늘
      </span>
      <span className="flex items-center gap-1">
        <span className="hatch inline-block h-2.5 w-3 rounded-sm" />
        예측
      </span>
      <span>시뮬레이션 기록 기준</span>
    </p>
  );
}
