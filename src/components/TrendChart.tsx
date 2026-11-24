"use client";
import type { ForecastPoint } from "@/core/predict/forecast";

/**
 * Observed (solid) vs forecast (dashed + band) — the same visual grammar everywhere.
 * x: last 45 min → +15 min. No gridlines; one baseline and a "now" tick.
 */
export function TrendChart({
  t,
  values,
  forecast,
  yMax,
  label,
  color = "var(--color-navy)",
  height = 76,
  width = 320,
}: {
  t: number[];
  values: number[];
  forecast: ForecastPoint[] | null;
  yMax: number;
  label: string;
  color?: string;
  height?: number;
  width?: number;
}) {
  const W = width;
  const H = height;
  const pad = { l: 2, r: 2, t: 8, b: 18 };
  if (t.length < 2) return null;
  const now = t[t.length - 1];
  const x0 = now - 45 * 60;
  const x1 = now + 15 * 60;
  const sx = (s: number) => pad.l + ((s - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const sy = (v: number) => pad.t + (1 - Math.min(1, v / yMax)) * (H - pad.t - pad.b);
  const path = t.map((s, i) => `${i ? "L" : "M"}${sx(s).toFixed(1)},${sy(values[i]).toFixed(1)}`).join("");
  const last = values[values.length - 1];
  const fc = forecast ?? [];
  const fcPath = fc.length ? `M${sx(now)},${sy(last)}` + fc.map((p) => `L${sx(now + p.horizonSec)},${sy(p.value)}`).join("") : "";
  const band = fc.length
    ? `M${sx(now)},${sy(last)}` +
      fc.map((p) => `L${sx(now + p.horizonSec)},${sy(p.hi)}`).join("") +
      [...fc].reverse().map((p) => `L${sx(now + p.horizonSec)},${sy(p.lo)}`).join("") +
      "Z"
    : "";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--color-line)" />
      {band && <path d={band} fill={color} opacity={0.1} />}
      <path d={path} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
      {fcPath && <path d={fcPath} fill="none" stroke={color} strokeWidth={2} strokeDasharray="3 4" strokeLinecap="round" />}
      <line x1={sx(now)} x2={sx(now)} y1={pad.t - 4} y2={H - pad.b + 4} stroke="var(--color-ink-3)" strokeWidth={1} />
      <circle cx={sx(now)} cy={sy(last)} r={3.6} fill={color} />
      {W >= 240 && (
        <text x={pad.l} y={H - 4} fontSize="10.5" className="fill-ink-3">
          45분 전
        </text>
      )}
      <text x={sx(now)} y={H - 4} fontSize="10.5" textAnchor="middle" className="fill-ink-2" fontWeight={600}>
        지금
      </text>
      <text x={W - pad.r} y={H - 4} fontSize="10.5" textAnchor="end" className="fill-ink-3">
        +15분
      </text>
    </svg>
  );
}
