"use client";
/**
 * Commons Floor v3 — top-down 2D plan of the 1947 COMMONS hall.
 * Entrance at the bottom. Kiosk banks and queues: user-verified relations. Hall outline, counter
 * zones, cafe and restroom: the "혜당관 1F" guide (schematic, no measured scale). What is not
 * known is simply not drawn (seat layout, the cut-off right side fades out).
 * Each layer has its own framing; switching layers glides the camera. Drag / pinch / wheel / +−.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { getBrand } from "@/core/catalog";
import { FLOOR_GUIDE, type CounterSlot } from "@/core/layout";
import type { KioskView } from "@/core/world";
import { minuteRange } from "@/lib/format";
import { kioskPos, personPos, WORLD, type V3 } from "./geometry";

export type MapLayer = "queue" | "seats" | "pickup";

const DOT: Record<KioskView["level"], string> = { free: "#0e9f6e", normal: "#e5a00d", busy: "#f0782e", very_busy: "#e5484d" };
const MAX_PEOPLE = 9;
const G = FLOOR_GUIDE;
const H_ = G.hall;

interface Cam {
  x: number;
  y: number;
  k: number;
}

interface Props {
  kiosks: KioskView[];
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  layer?: MapLayer;
  /** kept for API compatibility (the plan is always top-down) */
  pitch?: number;
  height?: number;
  width?: number;
  interactive?: boolean;
  className?: string;
  /** extra SVG drawn in map space (e.g. assumed camera positions) */
  overlay?: (P: (p: V3) => { x: number; y: number }) => React.ReactNode;
  hideLabels?: boolean;
  /** lateral half-width (m) that must fit at first view in the queue layer */
  fitHalf?: number;
  /** px reserved at the bottom (controls / sheet edge) */
  padBottom?: number;
  /** px reserved at the top (overlaid chips) */
  noticeTop?: number;
  /** brands to emphasise on the pickup layer (the student's active orders) */
  highlightBrands?: string[];
  /** ticket numbers to pin on highlighted counters */
  highlightLabels?: Record<string, string>;
}

/** Frame a world rectangle into the viewport (y up in world, down on screen). */
function frame(x0: number, x1: number, y0: number, y1: number, W: number, H: number, top: number, bottom: number): Cam {
  const k = Math.min((W - 24) / (x1 - x0), (H - top - bottom) / (y1 - y0));
  const cy = (y0 + y1) / 2 + ((bottom - top) / 2) / k;
  return { x: (x0 + x1) / 2, y: cy, k };
}

function useGlide(target: Cam): [Cam, (c: Cam | ((c: Cam) => Cam)) => void] {
  const [cam, setCam] = useState(target);
  const cur = useRef(target);
  cur.current = cam;
  const key = `${target.x.toFixed(2)},${target.y.toFixed(2)},${target.k.toFixed(3)}`;
  useEffect(() => {
    const from = cur.current;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return setCam(target);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 520);
      const e = 1 - Math.pow(1 - p, 3);
      // zoom in log space so the glide feels even
      const k = Math.exp(Math.log(from.k) + (Math.log(target.k) - Math.log(from.k)) * e);
      setCam({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, k });
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [cam, setCam];
}

export function CommonsMap({
  kiosks,
  selected = null,
  onSelect,
  layer = "queue",
  height = 420,
  width = 390,
  interactive = true,
  className,
  overlay,
  hideLabels,
  fitHalf = 11.2,
  padBottom = 12,
  noticeTop = 12,
  highlightBrands = [],
  highlightLabels = {},
}: Props) {
  const W = width;
  const H = height;
  const narrow = W < 560;
  const mine = useMemo(() => new Set(highlightBrands), [highlightBrands]);

  const target = useMemo<Cam>(() => {
    if (layer === "queue" && !narrow) {
      // wide screens: kiosks plus the counters behind them, so the queue sits in its room
      const f = frame(-30, 26, -2, 29.5, W, H, noticeTop, padBottom);
      return { ...f, y: -2 + (H / 2 - padBottom) / f.k };
    }
    if (layer === "queue") {
      const f = frame(-fitHalf, fitHalf, -1.8, WORLD.kioskDepth[3] + 2.6, W, H, noticeTop, padBottom);
      // entrance sits on the bottom edge; any spare height shows more of the hall above
      return { ...f, y: -1.8 + (H / 2 - padBottom) / f.k };
    }
    if (layer === "pickup" && narrow) {
      // phones: zoom to the counters so names fit; centre on the student's counter if known
      const slot = G.counters.find((c) => (c.brandId && mine.has(c.brandId)) || c.candidates?.some((b) => mine.has(b)));
      const k = Math.min(Math.max(10.5, W / 40), (H - noticeTop - padBottom) / 26);
      const half = W / 2 / k;
      const cx = slot ? Math.max(-33 + half, Math.min(30 - half, slot.x)) : -12;
      return { x: cx, y: 27 + (padBottom - noticeTop) / 2 / k, k };
    }
    return frame(H_.x0 - 0.5, narrow ? 28 : 34, -2, H_.y1Left + 0.8, W, H, noticeTop, padBottom);
  }, [layer, W, H, fitHalf, padBottom, noticeTop, narrow, mine]);

  const [cam, setCam] = useGlide(target);
  const P = (p: V3 | [number, number]) => ({ x: W / 2 + (p[0] - cam.x) * cam.k, y: H / 2 - (p[1] - cam.y) * cam.k });
  const path = (pts: [number, number][], close = true) => pts.map((q, i) => { const s = P(q); return `${i ? "L" : "M"}${s.x.toFixed(1)},${s.y.toFixed(1)}`; }).join("") + (close ? "Z" : "");
  const rect = (x0: number, x1: number, y0: number, y1: number) => path([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

  // ------------------------------------------------------------ gestures
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const g = useRef<{ moved: number; dist?: number; k0?: number }>({ moved: 0 });
  const kMin = Math.min(target.k, frame(H_.x0, 34, -2, H_.y1Left, W, H, 0, 0).k) * 0.9;
  const kMax = 42;
  const clampCam = (c: Cam): Cam => ({ k: Math.max(kMin, Math.min(kMax, c.k)), x: Math.max(H_.x0, Math.min(34, c.x)), y: Math.max(-2, Math.min(H_.y1Left, c.y)) });
  const zoomAt = (sx: number, sy: number, f: number) =>
    setCam((c) => {
      const k = Math.max(kMin, Math.min(kMax, c.k * f));
      const wx = c.x + (sx - W / 2) / c.k;
      const wy = c.y - (sy - H / 2) / c.k;
      return clampCam({ k, x: wx - (sx - W / 2) / k, y: wy + (sy - H / 2) / k });
    });
  const local = (cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
  };
  const moved = Math.abs(cam.k - target.k) / target.k > 0.02 || Math.hypot(cam.x - target.x, cam.y - target.y) * cam.k > 6;
  const handlers = interactive
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          g.current.moved = 0;
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            g.current.dist = Math.hypot(a.x - b.x, a.y - b.y);
            g.current.k0 = cam.k;
          }
        },
        onPointerMove: (e: React.PointerEvent) => {
          const prev = pointers.current.get(e.pointerId);
          if (!prev) return;
          const cur = { x: e.clientX, y: e.clientY };
          pointers.current.set(e.pointerId, cur);
          if (pointers.current.size === 2 && g.current.dist) {
            const [a, b] = [...pointers.current.values()];
            const m = local((a.x + b.x) / 2, (a.y + b.y) / 2);
            const want = (g.current.k0 ?? cam.k) * (Math.hypot(a.x - b.x, a.y - b.y) / g.current.dist);
            g.current.moved += 10;
            zoomAt(m.x, m.y, want / cam.k);
            return;
          }
          if (e.buttons === 0 && e.pointerType === "mouse") return;
          const r = svgRef.current!.getBoundingClientRect();
          const dx = ((cur.x - prev.x) / r.width) * W;
          const dy = ((cur.y - prev.y) / r.height) * H;
          g.current.moved += Math.abs(dx) + Math.abs(dy);
          if (g.current.moved > 6) {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            setCam((c) => clampCam({ ...c, x: c.x - dx / c.k, y: c.y + dy / c.k }));
          }
        },
        onPointerUp: (e: React.PointerEvent) => {
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) g.current.dist = undefined;
        },
        onPointerCancel: (e: React.PointerEvent) => pointers.current.delete(e.pointerId),
        onWheel: (e: React.WheelEvent) => {
          if (!e.ctrlKey) return; // plain wheel scrolls the page
          const p = local(e.clientX, e.clientY);
          zoomAt(p.x, p.y, e.deltaY < 0 ? 1.15 : 1 / 1.15);
        },
        onDoubleClick: (e: React.MouseEvent) => {
          const p = local(e.clientX, e.clientY);
          zoomAt(p.x, p.y, 1.6);
        },
      }
    : {};
  const tap = (id: string | null) => {
    if (g.current.moved > 6) return;
    onSelect?.(id);
  };

  // ------------------------------------------------------------ scene
  const hall: [number, number][] = [[H_.x0, 0], [H_.x1 + 12, 0], [H_.x1 + 12, H_.y1Right], [H_.stepX, H_.y1Right], [H_.stepX, H_.y1Left], [H_.x0, H_.y1Left]];
  const yb = G.bands.yellow;
  const bb = G.bands.blue;
  const showPlaces = (layer !== "queue" || !narrow) && !hideLabels;
  const fs = Math.max(10.5, Math.min(13, cam.k * 1.1));
  const door = P([0, 0]);
  const fadeA = P([H_.x1 - 6, 0]).x;
  const fadeB = P([H_.x1 + 8, 0]).x;
  const allSimilar = kiosks.every((k) => k.similar);

  return (
    <div className={`relative overflow-hidden bg-canvas ${className ?? ""}`} data-testid="commons-map" style={{ touchAction: interactive ? "pan-y" : undefined }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full select-none"
        role="group"
        aria-label={
          layer === "queue"
            ? "1947 COMMONS 정문 주변 지도. 정문 양옆에 키오스크가 3대씩 있고, 줄은 주문하는 사람 뒤 바깥쪽으로 서요."
            : "1947 COMMONS 평면도. 안쪽 벽을 따라 매장 카운터가 있고, 오른쪽에 매장이 더 이어져요. 왼쪽에 카페1847과 화장실이 있어요. 거리는 실제와 달라요."
        }
        onClick={() => tap(null)}
        {...handlers}
      >
        <defs>
          <linearGradient id="cutFade" gradientUnits="userSpaceOnUse" x1={fadeA} x2={fadeB} y1="0" y2="0">
            <stop offset="0" stopColor="#eceef1" stopOpacity="0" />
            <stop offset="1" stopColor="#eceef1" stopOpacity="1" />
          </linearGradient>
          <filter id="chip" x="-20%" y="-30%" width="140%" height="170%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodColor="#101828" floodOpacity="0.14" />
          </filter>
          <filter id="lift" x="-5%" y="-5%" width="110%" height="120%">
            <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodColor="#101828" floodOpacity="0.10" />
          </filter>
        </defs>
        <rect width={W} height={H} fill="#eceef1" />

        {/* hall floor + walls */}
        <path d={path(hall)} fill="#ffffff" />
        <path d={path([[H_.x1 + 12, 0], [H_.x0, 0], [H_.x0, H_.y1Left], [H_.stepX, H_.y1Left], [H_.stepX, H_.y1Right], [H_.x1 + 12, H_.y1Right]], false)} fill="none" stroke="#c3c9d2" strokeWidth={Math.max(1.2, cam.k * 0.14)} strokeLinejoin="round" />

        {/* counters: kitchen + counter strip, per guide colour */}
        <g opacity={layer === "queue" && narrow ? 0.55 : 1}>
        <path d={rect(yb.x0, yb.x1, yb.y0, yb.y1)} fill="#f8f1dc" />
        <path d={rect(yb.x0, yb.x1, yb.y0, yb.y0 + 1.6)} fill="#ecdca9" filter="url(#lift)" />
        <path d={rect(yb.x1, bb.x1, bb.y0, bb.y1)} fill="#e9f1fa" />
        <path d={rect(yb.x1, bb.x1, bb.y0, bb.y0 + 1.6)} fill="#c6d8ee" filter="url(#lift)" />
        {G.counters.map((c) => {
          const y0 = c.band === "yellow" ? yb.y0 : bb.y0;
          const on = (c.brandId && mine.has(c.brandId)) || (!c.brandId && c.candidates?.some((b) => mine.has(b)));
          return (
            <g key={c.id}>
              {on && layer === "pickup" && <path d={rect(c.x - c.half, c.x + c.half, y0, y0 + 1.6)} fill="#1e62e6" />}
              {c.status !== "continues" && <path d={path([[c.x + c.half, y0], [c.x + c.half, y0 + 1.6]], false)} stroke={c.band === "yellow" ? "#d8c37f" : "#a9c3e2"} strokeWidth={1} />}
            </g>
          );
        })}
        <path d={rect(G.cafe.x0, G.cafe.x1, G.cafe.y0, G.cafe.y1)} fill="#f6ebe4" stroke="#e8d6ca" />
        <path d={rect(G.restroom.x0, G.restroom.x1, G.restroom.y0, G.restroom.y1)} fill="#f1f2f5" stroke="#dfe2e7" />
        <path d={rect(G.stairs.x0, G.stairs.x1, G.stairs.y0, G.stairs.y1)} fill="#f1f2f5" stroke="#dfe2e7" />
        </g>

        {/* the guide photo is cut off on the right: fade the hall out instead of inventing it */}
        <rect x={fadeA} y={0} width={Math.max(0, W - fadeA)} height={H} fill="url(#cutFade)" />

        {/* entrance */}
        <path d={path([[-WORLD.door, 0], [WORLD.door, 0]], false)} stroke="#ffffff" strokeWidth={Math.max(3, cam.k * 0.3)} />
        <path d={path([[-WORLD.door, 0], [WORLD.door, 0]], false)} stroke="#8fb2ee" strokeWidth={2} strokeDasharray="3 3" />

        {/* kiosks + queues */}
        {kiosks.map((k) => {
          const pos = kioskPos(k.id);
          const isSel = selected === k.id;
          const people = Math.min(k.people, MAX_PEOPLE);
          const total = (k.inService ? 1 : 0) + people;
          const end = pos.x + pos.out * (WORLD.userOffset + Math.max(1, total - 0.4) * WORLD.slot);
          const dim = layer !== "queue";
          const r = Math.max(2.4, cam.k * 0.26);
          return (
            <g key={k.id} opacity={dim ? 0.55 : 1}>
              <path
                d={rect(Math.min(pos.x + pos.out * 0.45, end), Math.max(pos.x + pos.out * 0.45, end), pos.y - 0.36, pos.y + 0.36)}
                fill={isSel ? "rgba(30,98,230,.16)" : "rgba(25,27,31,.05)"}
                stroke={isSel ? "#1e62e6" : "none"}
              />
              <path d={rect(pos.x - 0.32, pos.x + 0.32, pos.y - 0.46, pos.y + 0.46)} fill="#ffffff" stroke="#8a929e" strokeWidth={1.1} />
              <path d={rect(pos.out > 0 ? pos.x + 0.2 : pos.x - 0.32, pos.out > 0 ? pos.x + 0.32 : pos.x - 0.2, pos.y - 0.38, pos.y + 0.38)} fill="#252b36" />
              {Array.from({ length: total }, (_, n) => {
                const f = P(personPos(k.id, n));
                const ordering = k.inService && n === 0;
                return <circle key={n} cx={f.x} cy={f.y} r={r} fill={ordering ? "#1e62e6" : "#5d6673"} opacity={1 - n * 0.045} />;
              })}
            </g>
          );
        })}

        {/* place labels (hall layers): plain text with a halo, like a map */}
        {showPlaces && (
          <g pointerEvents="none" fontSize={fs} fontWeight={600} textAnchor="middle" paintOrder="stroke" stroke="#ffffff" strokeWidth={3.2} strokeLinejoin="round">
            {layer === "seats" && narrow ? (
              <>
                <text {...xy(P([(yb.x0 + yb.x1) / 2, yb.y0 + 4.2]))} fill="#6b5714">
                  매장 카운터
                </text>
                <text {...xy(P([-12, 13]))} fill="#7b8290">
                  식사 공간
                </text>
              </>
            ) : (
              G.counters.map((c) => <CounterName key={c.id} c={c} P={P} fs={fs} mine={mine} label={c.brandId ? highlightLabels[c.brandId] : undefined} layer={layer} />)
            )}
            <text {...xy(P([(G.cafe.x0 + G.cafe.x1) / 2, (G.cafe.y0 + G.cafe.y1) / 2]))} fill="#8a6a58">
              카페1847
            </text>
            <text {...xy(P([(G.restroom.x0 + G.restroom.x1) / 2, (G.restroom.y0 + G.restroom.y1) / 2 - 0.4]))} fill="#7b8290">
              화장실
            </text>
            <text {...xy(P([0, 6.2]))} fill="#7b8290" fontSize={fs - 1}>
              키오스크
            </text>
          </g>
        )}

        {/* ETA chips — the one boxed element: it is data */}
        {layer === "queue" && !hideLabels &&
          kiosks.map((k) => {
            const pos = kioskPos(k.id);
            const a = P([pos.x + pos.out * 1.35, pos.y + 0.95]);
            const isSel = selected === k.id;
            const strong = k.similar && !allSimilar;
            const text = minuteRange(k.p20, k.p80);
            const w = text.length * 7.6 + 30;
            const x = pos.out > 0 ? a.x - 6 : a.x - w + 6;
            const fill = isSel ? "#191b1f" : "#ffffff";
            return (
              <g
                key={`eta${k.id}`}
                transform={`translate(${x},${a.y - 26})`}
                role={onSelect ? "button" : undefined}
                tabIndex={onSelect ? 0 : undefined}
                aria-label={`${k.label} 키오스크, ${k.people}명, ${text}${strong ? ", 가장 빠른 편" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  tap(k.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect?.(k.id);
                  }
                }}
                className={onSelect ? "cursor-pointer outline-none [&:focus-visible>rect]:stroke-[#1e62e6] [&:focus-visible>rect]:stroke-[3]" : undefined}
              >
                <rect width={w} height={26} rx={13} fill={fill} filter="url(#chip)" stroke={strong && !isSel ? "#1e62e6" : "none"} strokeWidth={1.5} />
                <circle cx={13} cy={13} r={3.6} fill={isSel ? "#ffffff" : DOT[k.level]} />
                <text x={22} y={17.6} fontSize={13} fontWeight={700} fill={isSel ? "#ffffff" : strong ? "#1550c4" : "#191b1f"} className="num">
                  {text}
                </text>
              </g>
            );
          })}

        <g pointerEvents="none">
          <text x={door.x} y={door.y + 17} textAnchor="middle" fontSize={12} fontWeight={700} fill="#191b1f" paintOrder="stroke" stroke="#eceef1" strokeWidth={3}>
            정문
          </text>
        </g>
        {overlay?.((p) => P(p))}
      </svg>

      {interactive && (
        <div className="absolute right-3 flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_4px_rgba(16,24,40,.16)]" style={{ bottom: padBottom + 8 }}>
          <button aria-label="지도 확대" onClick={() => zoomAt(W / 2, H / 2, 1.4)} className="grid size-10 place-items-center text-ink-2">
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
          <button aria-label="지도 축소" onClick={() => zoomAt(W / 2, H / 2, 1 / 1.4)} className="grid size-10 place-items-center border-t border-line text-ink-2">
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden><path d="M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
          {moved && (
            <button aria-label="처음 보기로" onClick={() => setCam(target)} className="grid size-10 place-items-center border-t border-line text-ink-2">
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden><path d="M10 3l2 5h5l-4 3 1.5 5L10 13l-4.5 3L7 11 3 8h5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function xy(p: { x: number; y: number }) {
  return { x: p.x, y: p.y };
}

/** Brand name inside its counter zone; unconfirmed slots get a short grey "미확인". */
function CounterName({ c, P, fs, mine, label, layer }: { c: CounterSlot; P: (p: [number, number]) => { x: number; y: number }; fs: number; mine: Set<string>; label?: string; layer: MapLayer }) {
  const y0 = c.band === "yellow" ? FLOOR_GUIDE.bands.yellow.y0 : FLOOR_GUIDE.bands.blue.y0;
  const at = P([c.x, y0 + 4.2]);
  const name = c.brandId ? getBrand(c.brandId)?.name : null;
  const on = (c.brandId && mine.has(c.brandId)) || (!c.brandId && c.candidates?.some((b) => mine.has(b)));
  const ink = c.band === "yellow" ? "#6b5714" : "#2f5687";
  if (c.status === "continues") {
    return on && layer === "pickup" ? (
      <text x={at.x} y={at.y} fill="#1e62e6" fontSize={fs - 1}>
        이 방향 어딘가 (미확인)
      </text>
    ) : null;
  }
  const pin = P([c.x, y0 - 0.2]);
  return (
    <g>
      <text x={at.x} y={at.y} fill={name ? ink : "#9aa1ab"} fontWeight={name ? 650 : 500} fontSize={name ? fs : fs - 1}>
        {name ?? "미확인"}
      </text>
      {c.status === "inferred" && (
        <text x={at.x} y={at.y + fs + 1} fill="#9aa1ab" fontWeight={500} fontSize={fs - 2}>
          추정
        </text>
      )}
      {on && layer === "pickup" && (
        <g transform={`translate(${pin.x},${pin.y})`} stroke="none">
          <path d="M0,0 l-6,-8 h12 z" fill="#1e62e6" />
          <rect x={-(label ? label.length * 8 + 18 : 30) / 2} y={-34} width={label ? label.length * 8 + 18 : 30} height={26} rx={13} fill="#1e62e6" />
          <text y={-16.5} fill="#fff" fontSize={13} fontWeight={700} className="num">
            {label ?? "내 주문"}
          </text>
        </g>
      )}
    </g>
  );
}
