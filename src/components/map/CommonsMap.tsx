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
import type { KioskView, ZoneView } from "@/core/world";
import { FIXTURES, SEAT_UNITS, ZONE_LABEL_AT, zoneStates, type CellState, type SeatUnit } from "./dining";
import { kioskPos, personPos, WORLD, type V3 } from "./geometry";

export type MapLayer = "queue" | "seats" | "pickup";

const MAX_PEOPLE = 9;
/** 2.5D: the floor is tilted away from the viewer (depth squashed by S) and heights rise by Z per metre. */
const S = 0.6;
const Z = 0.78;
const G = FLOOR_GUIDE;
const H_ = G.hall;

/**
 * The kiosk the map routes to when nothing is selected: only when a small group (≤4) is clearly
 * faster. When five or six are within the "similar" band nobody is singled out.
 */
export function recommendedKiosk(kiosks: KioskView[]): KioskView | null {
  const fast = kiosks.filter((k) => k.similar);
  if (!fast.length || fast.length > 4) return null;
  const depth = (id: string) => kioskPos(id).y;
  return [...fast].sort((a, b) => a.p50 - b.p50 || depth(a.id) - depth(b.id))[0];
}

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
  /** pickup layer: a store picked from the list — the map points at it instead of your orders */
  focusBrand?: string | null;
  /** seat zones (for colouring the concept table layout on the seats layer) */
  zones?: ZoneView[];
  /** extra controls shown bottom-left (e.g. the VR preview button) */
  extra?: React.ReactNode;
}

/** Frame a world rectangle into the viewport (y up in world, down on screen). */
function frame(x0: number, x1: number, y0: number, y1: number, W: number, H: number, top: number, bottom: number): Cam {
  const k = Math.min((W - 24) / (x1 - x0), (H - top - bottom) / ((y1 - y0) * S));
  // shift so the rectangle sits centred in the space between the top chips and the bottom controls
  const cy = (y0 + y1) / 2 + ((top - bottom) / 2) / (k * S);
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
  focusBrand = null,
  zones = [],
  extra,
}: Props) {
  const W = width;
  const H = height;
  const narrow = W < 560;
  const mine = useMemo(() => new Set(focusBrand && layer === "pickup" ? [focusBrand] : highlightBrands), [highlightBrands, focusBrand, layer]);

  const target = useMemo<Cam>(() => {
    if (layer === "queue" && !narrow) {
      // wide screens: kiosks plus the counters behind them, so the queue sits in its room
      const f = frame(-24, 24, -2.5, 27, W, H, noticeTop, padBottom);
      // entrance on the bottom edge; spare height shows more of the hall behind
      return { ...f, y: -2.5 + (H / 2 - padBottom) / (f.k * S) };
    }
    if (layer === "queue") {
      // widen just enough that the longest line stays on screen
      const longest = Math.max(0, ...kiosks.map((k) => Math.min(k.people + (k.inService ? 1 : 0), MAX_PEOPLE)));
      const half = Math.max(fitHalf, WORLD.kioskX + WORLD.userOffset + longest * WORLD.slot + 0.4);
      const f = frame(-half, half, -2.6, WORLD.kioskDepth[3] + 2.4, W, H, noticeTop, padBottom);
      // entrance sits on the bottom edge (the strip outside holds the zoom controls)
      return { ...f, y: -2.6 + (H / 2 - padBottom) / (f.k * S) };
    }
    if (layer === "pickup" && narrow) {
      // phones: zoom to the counters so names fit; centre on the student's counter if known
      const slot = G.counters.find((c) => (c.brandId && mine.has(c.brandId)) || c.candidates?.some((b) => mine.has(b)));
      const k = Math.min(Math.max(10.5, W / 40), (H - noticeTop - padBottom) / (30 * S));
      const half = W / 2 / k;
      const cx = slot ? Math.max(-33 + half, Math.min(30 - half, slot.x)) : -12;
      return { x: cx, y: 25 + (padBottom - noticeTop) / 2 / (k * S), k };
    }
    if (layer === "seats" && narrow) return frame(-32, 12, -2, 24, W, H, noticeTop, padBottom);
    return frame(H_.x0 - 0.5, narrow ? 28 : 34, -2, H_.y1Left + 0.8, W, H, noticeTop, padBottom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, W, H, fitHalf, padBottom, noticeTop, narrow, mine, Math.max(0, ...kiosks.map((k) => k.people))]);

  const [cam, setCam] = useGlide(target);
  const P = (p: V3 | [number, number] | number[]) => ({ x: W / 2 + (p[0] - cam.x) * cam.k, y: H / 2 - (p[1] - cam.y) * cam.k * S - (p[2] ?? 0) * cam.k * Z });
  const path = (pts: number[][], close = true) => pts.map((q, i) => { const s = P(q); return `${i ? "L" : "M"}${s.x.toFixed(1)},${s.y.toFixed(1)}`; }).join("") + (close ? "Z" : "");
  const rect = (x0: number, x1: number, y0: number, y1: number, z = 0) => path([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]);
  /** an extruded block: front face (towards the entrance) + top face */
  const box = (x0: number, x1: number, y0: number, y1: number, h: number, top: string, front: string, key?: string, extra?: React.SVGProps<SVGGElement>) => (
    <g key={key} {...extra}>
      <path d={path([[x0, y0, 0], [x1, y0, 0], [x1, y0, h], [x0, y0, h]])} fill={front} />
      <path d={rect(x0, x1, y0, y1, h)} fill={top} />
    </g>
  );

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
      const wy = c.y - (sy - H / 2) / (c.k * S);
      return clampCam({ k, x: wx - (sx - W / 2) / k, y: wy + (sy - H / 2) / (k * S) });
    });
  // +/- buttons zoom toward what matters (the chosen line or your counter), not the empty aisle
  const routeKiosk = layer === "queue" ? (kiosks.find((k) => k.id === selected) ?? recommendedKiosk(kiosks)) : null;
  const myCounter = layer === "pickup" ? G.counters.find((c) => c.brandId && mine.has(c.brandId)) : undefined;
  const focus: [number, number] | null = routeKiosk
    ? (() => {
        const p = kioskPos(routeKiosk.id);
        return [p.x + p.out * 2.2, p.y];
      })()
    : layer === "queue"
      ? [-WORLD.kioskX - 2, WORLD.kioskDepth[2]]
      : myCounter
        ? [myCounter.x, (myCounter.band === "yellow" ? G.bands.yellow.y0 : G.bands.blue.y0) + 1]
        : null;
  const zoomButton = (f: number) =>
    setCam((c) => {
      const k = Math.max(kMin, Math.min(kMax, c.k * f));
      if (f < 1 || !focus) return clampCam({ ...c, k });
      // keep the focus on screen and pull it toward the centre as we zoom in
      return clampCam({ k, x: c.x + (focus[0] - c.x) * 0.55, y: c.y + (focus[1] - c.y) * 0.55 });
    });
  const local = (cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
  };
  const moved = Math.abs(cam.k - target.k) / target.k > 0.02 || Math.hypot(cam.x - target.x, (cam.y - target.y) * S) * cam.k > 6;
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
            setCam((c) => clampCam({ ...c, x: c.x - dx / c.k, y: c.y + dy / (c.k * S) }));
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
  const statesByZone = useMemo(() => {
    const m = new Map<string, CellState[]>();
    for (const z of zones) {
      const n = SEAT_UNITS.filter((u) => u.zone === z.id).length;
      if (n) m.set(z.id, zoneStates(n, Math.min(n, z.apparentlyEmpty), Math.min(n - Math.min(n, z.apparentlyEmpty), z.uncertain)));
    }
    return m;
  }, [zones]);
  const stateOf = (u: SeatUnit): CellState | null => statesByZone.get(u.zone)?.[u.i] ?? null;
  const fastIds = new Set(kiosks.filter((k) => k.similar).length <= 4 ? kiosks.filter((k) => k.similar).map((k) => k.id) : []);
  const route: [number, number][] | null = (() => {
    if (hideLabels) return null;
    if (routeKiosk) {
      const p = kioskPos(routeKiosk.id);
      const total = (routeKiosk.inService ? 1 : 0) + Math.min(routeKiosk.people, MAX_PEOPLE);
      const endX = p.x + p.out * (WORLD.userOffset + total * WORLD.slot);
      const lane = p.y - 1.3;
      return [[0, -1.2], [0, lane], [endX, lane], [endX, p.y - 0.5]];
    }
    if (myCounter) {
      const y0 = myCounter.band === "yellow" ? yb.y0 : bb.y0;
      const lane = y0 - 1.6;
      return [[0, -1.2], [0, lane], [myCounter.x, lane], [myCounter.x, y0 - 0.3]];
    }
    return null;
  })();

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

        {/* hall floor */}
        <path d={path(hall)} fill="#ffffff" />

        {/* far walls (back + left), extruded */}
        {(() => {
          const t = 0.45;
          const wh = 1.7;
          const top = "#c3c9d2";
          const front = "#dfe3e8";
          return (
            <g pointerEvents="none">
              {box(H_.stepX, H_.x1 + 12, H_.y1Right, H_.y1Right + t, wh, top, front)}
              {box(H_.x0 - t, H_.stepX + t, H_.y1Left, H_.y1Left + t, wh, top, front)}
              {box(H_.stepX, H_.stepX + t, H_.y1Right, H_.y1Left, wh, top, front)}
              {box(H_.x0 - t, H_.x0, 0, H_.y1Left, wh, top, front)}
            </g>
          );
        })()}

        {/* counters: kitchen floor + extruded counter strip, per guide colour */}
        <g opacity={layer === "queue" && narrow ? 0.6 : 1} pointerEvents="none">
          <path d={rect(yb.x0, yb.x1, yb.y0, yb.y1)} fill="#f8f1dc" />
          <path d={rect(yb.x1, bb.x1, bb.y0, bb.y1)} fill="#e9f1fa" />
          {box(G.cafe.x0, G.cafe.x1, G.cafe.y0, G.cafe.y1, 1.4, "#f6ebe4", "#e6d2c4")}
          {box(G.restroom.x0, G.restroom.x1, G.restroom.y0, G.restroom.y1, 1.4, "#eef0f3", "#dde1e7")}
          {box(G.stairs.x0, G.stairs.x1, G.stairs.y0, G.stairs.y1, 1.4, "#eef0f3", "#dde1e7")}
          {G.counters.map((c) => {
            const y0 = c.band === "yellow" ? yb.y0 : bb.y0;
            const on = layer === "pickup" && ((c.brandId && mine.has(c.brandId)) || (!c.brandId && c.candidates?.some((b) => mine.has(b))));
            const yellow = c.band === "yellow";
            return (
              <g key={c.id}>
                {box(c.x - c.half + 0.08, c.x + c.half - 0.08, y0, y0 + 1.5, 1.0, on ? "#1e62e6" : yellow ? "#ecdca9" : "#c6d8ee", on ? "#1550c4" : yellow ? "#d9c486" : "#a9c3e2")}
              </g>
            );
          })}
        </g>

        {/* call monitors hang in front of the counters (positions arbitrary) */}
        <g pointerEvents="none">
          {FIXTURES.filter((f) => f.kind === "monitor").map((f) => {
            const z0 = f.z0 ?? 2.4;
            const z1 = z0 + 1.1;
            return (
              <g key={f.id}>
                <path d={path([[(f.x0 + f.x1) / 2, f.y0, z1], [(f.x0 + f.x1) / 2, f.y0, z1 + 0.8]], false)} stroke="#8a929e" strokeWidth={1} />
                <path d={path([[f.x0, f.y0, z0], [f.x1, f.y0, z0], [f.x1, f.y0, z1], [f.x0, f.y0, z1]])} fill="#cfe4ff" stroke="#1b2130" strokeWidth={1.5} />
              </g>
            );
          })}
        </g>

        {/* the guide photo is cut off on the right: fade the hall out instead of inventing it */}
        <rect x={fadeA} y={0} width={Math.max(0, W - fadeA)} height={H} fill="url(#cutFade)" />

        {/* the flow line on the floor: entrance → back of the chosen line, or → your pickup counter */}
        {route && <FlowLine pts={route.map((q) => P(q))} k={cam.k} />}

        {/* dining area: concept layout, far rows first */}
        <g pointerEvents="none">
          {FIXTURES.filter((f) => f.kind !== "monitor").map((f) =>
            box(f.x0, f.x1, f.y0, f.y1, f.h, f.kind === "planter" ? "#9cc9a4" : f.kind === "tray" ? "#c9ced6" : "#bcd6f2", f.kind === "planter" ? "#78ad83" : f.kind === "tray" ? "#aab1bb" : "#94b8e0", f.id),
          )}
          {[...SEAT_UNITS].sort((u, v) => v.y - u.y).map((u, n) => (
            <Table key={n} u={u} state={layer === "seats" ? stateOf(u) : null} box={box} />
          ))}
        </g>

        {/* kiosks + the people in each line, far rows first */}
        {[...kiosks].sort((a, b) => kioskPos(b.id).y - kioskPos(a.id).y).map((k) => {
          const pos = kioskPos(k.id);
          const isSel = selected === k.id;
          const people = Math.min(k.people, MAX_PEOPLE);
          const total = (k.inService ? 1 : 0) + people;
          const end = pos.x + pos.out * (WORLD.userOffset + Math.max(1, total - 0.4) * WORLD.slot);
          const dim = layer !== "queue" || (routeKiosk && routeKiosk.id !== k.id && !fastIds.has(k.id));
          const fast = layer === "queue" && fastIds.has(k.id);
          const r = Math.max(2.6, cam.k * 0.26);
          const c = P([pos.x, pos.y, 2.4]);
          const pin = Math.max(9, Math.min(13, cam.k * 0.55));
          const blue = fast || isSel;
          return (
            <g key={k.id} opacity={dim ? 0.55 : 1} onClick={(e) => { e.stopPropagation(); tap(k.id); }} className={onSelect ? "cursor-pointer" : undefined}>
              {isSel && <path d={rect(Math.min(pos.x + pos.out * 0.45, end), Math.max(pos.x + pos.out * 0.45, end), pos.y - 0.45, pos.y + 0.45)} fill="rgba(30,98,230,.16)" />}
              {/* people: a shadow on the floor and a standing body */}
              {Array.from({ length: total }, (_, n) => {
                const f = personPos(k.id, n);
                const g0 = P([f[0], f[1], 0]);
                const g1 = P([f[0], f[1], 1.25]);
                const ordering = k.inService && n === 0;
                return (
                  <g key={n}>
                    <ellipse cx={g0.x} cy={g0.y} rx={r * 1.1} ry={r * 0.55} fill="#101828" fillOpacity={0.12} />
                    <rect x={g1.x - r} y={g1.y - r} width={r * 2} height={g0.y - g1.y + r * 0.4} rx={r} fill={ordering ? "#191b1f" : "#8a929e"} />
                  </g>
                );
              })}
              {/* the kiosk itself: a small dark stand with a lit screen facing the user */}
              {box(pos.x - 0.32, pos.x + 0.32, pos.y - 0.42, pos.y + 0.42, 1.1, "#5d6673", "#3a4049")}
              <path d={path([[pos.x + pos.out * 0.32, pos.y - 0.3, 0.5], [pos.x + pos.out * 0.32, pos.y + 0.3, 0.5], [pos.x + pos.out * 0.32, pos.y + 0.3, 1.0], [pos.x + pos.out * 0.32, pos.y - 0.3, 1.0]])} fill={blue ? "#7fb0ff" : "#a9b4c4"} />
              {/* floating pin above it */}
              <path d={`M${c.x},${c.y + pin * 0.2}L${c.x},${P([pos.x, pos.y, 1.1]).y}`} stroke={blue ? "#1e62e6" : "#4d535c"} strokeWidth={1.5} />
              {isSel && <circle cx={c.x} cy={c.y} r={pin + 5} fill="#1e62e6" fillOpacity={0.2} />}
              <circle cx={c.x} cy={c.y} r={pin} fill={blue ? "#1e62e6" : "#4d535c"} stroke="#ffffff" strokeWidth={2} filter="url(#chip)" />
              <g transform={`translate(${c.x},${c.y}) scale(${pin / 11})`} fill="none" stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <rect x={-3.6} y={-5} width={7.2} height={6.4} rx={1.2} />
                <path d="M0 1.4v2.8M-2.6 4.6h5.2" />
              </g>
            </g>
          );
        })}

        {/* front glass wall, low so it never hides the first kiosks; open at the door */}
        <g pointerEvents="none">
          {box(-WORLD.door - 26, -WORLD.door, -0.4, 0, 0.5, "#c3c9d2", "#d3d8df")}
          {box(H_.x0 - 0.45, -WORLD.door - 26, -0.4, 0, 0.5, "#c3c9d2", "#d3d8df")}
          {box(WORLD.door, H_.x1 + 12, -0.4, 0, 0.5, "#c3c9d2", "#d3d8df")}
        </g>
        {/* entrance: where you start */}
        {(() => {
          const a = P([0, -2.4]);
          const b = P([0, -0.6]);
          return (
            <g pointerEvents="none">
              <path d={`M${a.x},${a.y}L${b.x},${b.y}`} stroke="#1e62e6" strokeOpacity={0.5} strokeWidth={3} strokeLinecap="round" />
              <path d={`M${b.x - 6},${b.y + 6}L${b.x},${b.y}L${b.x + 6},${b.y + 6}`} fill="none" stroke="#1e62e6" strokeOpacity={0.5} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          );
        })()}

        {/* place labels (hall layers): plain text with a halo, like a map */}
        {showPlaces && (
          <g pointerEvents="none" fontSize={fs} fontWeight={600} textAnchor="middle" paintOrder="stroke" stroke="#ffffff" strokeWidth={3.2} strokeLinejoin="round">
            {layer === "seats" && narrow ? (
              <text {...xy(P([(yb.x0 + yb.x1) / 2, yb.y0 + 4.2]))} fill="#6b5714">
                매장 카운터
              </text>
            ) : G.counters.map((c) => (
              <CounterName key={c.id} c={c} P={P} W={W} fs={fs} mine={mine} label={c.brandId ? highlightLabels[c.brandId] : undefined} layer={layer} />
            ))}
            <text {...xy(P([(G.cafe.x0 + G.cafe.x1) / 2, (G.cafe.y0 + G.cafe.y1) / 2]))} fill="#8a6a58">
              카페1847
            </text>
            <text {...xy(P([(G.restroom.x0 + G.restroom.x1) / 2, (G.restroom.y0 + G.restroom.y1) / 2 - 0.4]))} fill="#7b8290">
              화장실
            </text>
            {!route && (
              <text {...xy(P([0, 6.2]))} fill="#7b8290" fontSize={fs - 1}>
                키오스크
              </text>
            )}
            {FIXTURES.filter((f) => f.label && (layer === "pickup" || f.kind !== "monitor")).map((f) => (
              <text key={f.id} {...xy(P([(f.x0 + f.x1) / 2, f.kind === "monitor" ? f.y0 : f.y0 - 0.8, f.kind === "monitor" ? (f.z0 ?? 2.4) + 1.6 : 0]))} fill={f.kind === "monitor" ? "#1550c4" : "#7b8290"} fontWeight={f.kind === "monitor" ? 650 : 500} fontSize={fs - 2}>
                {f.kind === "monitor" ? f.label.replace("호출 ", "") : f.label}
              </text>
            ))}
            {layer === "seats" &&
              (Object.keys(ZONE_LABEL_AT) as SeatUnit["zone"][]).map((z) => (
                <text key={z} {...xy(P(ZONE_LABEL_AT[z]))} fill={z === "rest" ? "#8a919c" : "#4d535c"} fontWeight={600} fontSize={fs - 1}>
                  {ZONE_NAME[z]}
                </text>
              ))}
          </g>
        )}

        <g pointerEvents="none">
          <text x={door.x} y={door.y + 17} textAnchor="middle" fontSize={12} fontWeight={700} fill="#191b1f" paintOrder="stroke" stroke="#eceef1" strokeWidth={3}>
            정문
          </text>
        </g>
        {overlay?.((p) => P(p))}
      </svg>

      {!hideLabels && (
        <div className="absolute left-3 flex items-center gap-2" style={{ bottom: narrow ? Math.max(4, padBottom - 8) : padBottom + 8 }}>
          {extra}
          <span className="t-micro font-semibold text-ink-3 [text-shadow:0_0_3px_#eceef1,0_0_3px_#eceef1]">개념 배치 · 실제와 달라요</span>
        </div>
      )}
      {interactive && (
        <div
          className={`absolute right-3 flex overflow-hidden rounded-xl bg-white shadow-[0_1px_4px_rgba(16,24,40,.16)] ${narrow ? "flex-row [&>button]:size-9 [&>button+button]:border-t-0 [&>button+button]:border-l" : "flex-col"}`}
          style={{ bottom: narrow ? Math.max(4, padBottom - 8) : padBottom + 8 }}
        >
          <button aria-label="지도 확대" onClick={() => zoomButton(1.45)} className="grid size-10 place-items-center text-ink-2">
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden><path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
          <button aria-label="지도 축소" onClick={() => zoomButton(1 / 1.45)} className="grid size-10 place-items-center border-t border-line text-ink-2">
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden><path d="M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
          {moved && (
            <button aria-label="처음 보기로" onClick={() => setCam(target)} className="grid size-10 place-items-center border-t border-line text-ink-2">
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden><path d="M3.5 7.5v-4h4M12.5 3.5h4v4M16.5 12.5v4h-4M7.5 16.5h-4v-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const ZONE_NAME: Record<SeatUnit["zone"], string> = { window: "창가 1인석", center: "중앙 칸막이석", long: "긴 테이블석", booth: "부스석", rest: "그 밖의 좌석" };

const TABLE_TONE: Record<CellState | "plain", [string, string]> = {
  free: ["#2bb673", "#15895a"],
  busy: ["#d5d9df", "#b9bfc8"],
  unsure: ["#eef0f3", "#cfd4db"],
  plain: ["#ece6dc", "#d8cfc1"],
};

type BoxFn = (x0: number, x1: number, y0: number, y1: number, h: number, top: string, front: string, key?: string) => React.ReactNode;

/** One table (or window seat) with its chairs, extruded. Colour = estimated state on the seats layer. */
function Table({ u, state, box }: { u: SeatUnit; state: CellState | null; box: BoxFn }) {
  const [top, front] = TABLE_TONE[u.kind === "rest" ? "plain" : (state ?? "plain")];
  const chair: [string, string] = state === "free" ? ["#9fdcbc", "#7cc8a2"] : ["#dfe2e7", "#c9ced6"];
  const { x, y, hx, hy } = u;
  if (u.kind === "single") {
    return (
      <g>
        {box(x - hx, x + hx, y - hy, y + hy, 0.45, top, front)}
        {box(x - hx * 0.9, x + hx * 0.9, y + hy, y + hy + 0.12, 0.95, top, front)}
      </g>
    );
  }
  const c = 0.22;
  return (
    <g opacity={u.kind === "rest" ? 0.7 : 1}>
      {/* back chairs, table, front chairs */}
      {u.kind === "booth"
        ? box(x - hx - 0.1, x + hx + 0.1, y + hy + 0.15, y + hy + 0.45, 1.1, chair[0], chair[1])
        : box(x - hx * 0.6 - c, x - hx * 0.6 + c, y + hy + 0.12, y + hy + 0.12 + 2 * c, 0.45, chair[0], chair[1])}
      {u.kind !== "booth" && box(x + hx * 0.6 - c, x + hx * 0.6 + c, y + hy + 0.12, y + hy + 0.12 + 2 * c, 0.45, chair[0], chair[1])}
      {u.kind === "quad" && box(x - hx - 0.15, x + hx + 0.15, y + hy + 0.6, y + hy + 0.7, 1.1, "#d9cbb6", "#c7b496")}
      {box(x - hx, x + hx, y - hy, y + hy, 0.75, top, front)}
      {u.kind === "booth"
        ? box(x - hx - 0.1, x + hx + 0.1, y - hy - 0.45, y - hy - 0.15, 1.1, chair[0], chair[1])
        : box(x - hx * 0.6 - c, x - hx * 0.6 + c, y - hy - 0.12 - 2 * c, y - hy - 0.12, 0.45, chair[0], chair[1])}
      {u.kind !== "booth" && box(x + hx * 0.6 - c, x + hx * 0.6 + c, y - hy - 0.12 - 2 * c, y - hy - 0.12, 0.45, chair[0], chair[1])}
    </g>
  );
}

/** Route on the floor: blue line, white chevrons pointing the way, a pin at the end. */
function FlowLine({ pts, k }: { pts: { x: number; y: number }[]; k: number }) {
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
  const chevrons: { x: number; y: number; a: number }[] = [];
  const step = Math.max(26, k * 2.2);
  let carry = step * 0.6;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    let t = carry;
    while (t < len - 8) {
      chevrons.push({ x: a.x + ((b.x - a.x) * t) / len, y: a.y + ((b.y - a.y) * t) / len, a: ang });
      t += step;
    }
    carry = t - len;
  }
  const end = pts[pts.length - 1];
  return (
    <g pointerEvents="none">
      <path d={d} fill="none" stroke="#ffffff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#1e62e6" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
      {chevrons.map((c, i) => (
        <path key={i} d="M-2,-2.6L1.2,0L-2,2.6" transform={`translate(${c.x},${c.y}) rotate(${c.a})`} fill="none" stroke="#ffffff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <g transform={`translate(${end.x},${end.y})`}>
        <path d="M0,0C-3,-5 -7,-8 -7,-13A7,7 0 1 1 7,-13C7,-8 3,-5 0,0Z" fill="#1e62e6" stroke="#ffffff" strokeWidth={1.8} />
        <circle cy={-13} r={2.6} fill="#ffffff" />
      </g>
    </g>
  );
}

function cxy(p: { x: number; y: number }) {
  return { cx: p.x, cy: p.y };
}

function xy(p: { x: number; y: number }) {
  return { x: p.x, y: p.y };
}

/** Brand name inside its counter zone; unconfirmed slots get a short grey "미확인". */
function CounterName({ c, P, W, fs, mine, label, layer }: { c: CounterSlot; P: (p: [number, number]) => { x: number; y: number }; W: number; fs: number; mine: Set<string>; label?: string; layer: MapLayer }) {
  const y0 = c.band === "yellow" ? FLOOR_GUIDE.bands.yellow.y0 : FLOOR_GUIDE.bands.blue.y0;
  const at = P([c.x, y0 + 4.2]);
  const name = c.brandId ? getBrand(c.brandId)?.name : null;
  const on = (c.brandId && mine.has(c.brandId)) || (!c.brandId && c.candidates?.some((b) => mine.has(b)));
  const ink = c.band === "yellow" ? "#6b5714" : "#2f5687";
  if (c.status === "continues") {
    return on && layer === "pickup" ? (
      <text x={Math.min(at.x, W - 8)} y={at.y + fs + 6} fill="#1e62e6" fontSize={fs - 1} textAnchor={at.x > W - 70 ? "end" : "middle"}>
        → 이 방향 어딘가 (미확인)
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
          <path d="M0,2 l-6,8 h12 z" fill="#1e62e6" />
          <rect x={-(label ? label.length * 8 + 18 : 40) / 2} y={9} width={label ? label.length * 8 + 18 : 40} height={26} rx={13} fill="#1e62e6" stroke="#ffffff" strokeWidth={2} />
          <text y={26.5} fill="#fff" fontSize={13} fontWeight={700} className="num">
            {label ?? (c.brandId ? "여기" : "후보")}
          </text>
        </g>
      )}
    </g>
  );
}
