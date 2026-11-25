"use client";
/**
 * Commons Floor — the student map. Viewpoint: standing at the main entrance, looking in.
 * Kiosk banks and queues: user-verified relations. Hall outline, counter bands, cafe, restroom:
 * read off the "혜당관 1F" guide at the entrance (2026-11-25) — schematic, no measured scale.
 * The queue layer frames the kiosks; the seat and pickup layers pull back to the whole hall.
 * Pinch / drag / wheel / double-tap zoom, tap a kiosk to select.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { getBrand } from "@/core/catalog";
import { FLOOR_GUIDE, type CounterSlot } from "@/core/layout";
import type { KioskView } from "@/core/world";
import { minuteRange } from "@/lib/format";
import { boxFaces, entranceCamera, hallView, kioskPos, lerpView, pathOf, personPos, projector, queueView, WORLD, type V3, type ViewSpec } from "./geometry";

export type MapLayer = "queue" | "seats" | "pickup";

const LEVEL_TINT: Record<KioskView["level"], string> = {
  free: "rgba(18,140,96,.20)",
  normal: "rgba(224,162,27,.24)",
  busy: "rgba(239,106,35,.24)",
  very_busy: "rgba(216,52,58,.26)",
};
const LEVEL_DOT: Record<KioskView["level"], string> = { free: "#14a06f", normal: "#e0a21b", busy: "#ef6a23", very_busy: "#d8343a" };
const MAX_PEOPLE = 8;

interface Props {
  kiosks: KioskView[];
  selected?: string | null;
  onSelect?: (id: string | null) => void;
  layer?: MapLayer;
  pitch?: number;
  height?: number;
  width?: number;
  interactive?: boolean;
  className?: string;
  /** extra SVG drawn in map space (e.g. assumed camera positions) */
  overlay?: (P: (p: V3) => { x: number; y: number }) => React.ReactNode;
  /** hide ETA pills (for small explanatory minimaps) */
  hideLabels?: boolean;
  /** lateral half-width (m) that must fit on screen at first view */
  fitHalf?: number;
  /** reserve space at the bottom (controls / captions) and push spare height into the fog */
  padBottom?: number;
  /** px from the top for the layer notice chip (clear of overlaid headers) */
  noticeTop?: number;
  /** brands to emphasise on the pickup layer (the student's active orders) */
  highlightBrands?: string[];
}

const LAYER_NOTICE: Partial<Record<MapLayer, string>> = {
  seats: "테이블 배치는 확인 전이라 구역별 현황은 아래 목록으로 보여 드려요",
  pickup: "정문 안내도 기준 대략 위치예요 · 거리와 크기는 실측이 아니에요",
};

const BAND = {
  yellow: { top: "#f7e7a6", side: "#e3cd78", front: "#ecd88a", stroke: "#cdb45e" },
  blue: { top: "#cfe2f3", side: "#a9c6e3", front: "#bcd5ec", stroke: "#8fb0d4" },
};

function useTweenedView(target: ViewSpec): ViewSpec {
  const [cur, setCur] = useState(target);
  const from = useRef(target);
  const key = JSON.stringify(target);
  useEffect(() => {
    const start = from.current;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || JSON.stringify(start) === key) {
      from.current = target;
      setCur(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 650);
      const e = 1 - Math.pow(1 - p, 3);
      const v = lerpView(start, target, e);
      from.current = v;
      setCur(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return cur;
}

export function CommonsMap({ kiosks, selected = null, onSelect, layer = "queue", pitch = 68, height = 420, width = 390, interactive = true, className, overlay, hideLabels, fitHalf = WORLD.viewHalf, padBottom, noticeTop = 4, highlightBrands = [] }: Props) {
  const W = width;
  const H = height;
  const hall = layer !== "queue";
  const target = useMemo(() => (hall ? hallView(H / W) : queueView(pitch, fitHalf)), [hall, H, W, pitch, fitHalf]);
  const v = useTweenedView(target);
  const P = useMemo(() => {
    const fit: V3[] = [
      [v.x0, v.y0, 0],
      [v.x1, v.y0, 0],
      [v.x0, v.y1, 0],
      [v.x1, v.y1, 0],
      [v.tx, v.y1 - 1, v.z],
    ];
    return projector(entranceCamera(v.pitch, v.distance, v.tx, v.ty), { w: W, h: H, pad: 10, padBottom: padBottom ?? 10, alignBottom: padBottom != null && !hall }, fit);
  }, [v, W, H, padBottom, hall]);
  // 0 in the kiosk view → 1 in the hall view (fades kiosk ETA pills out, counter labels in)
  const hallT = Math.max(0, Math.min(1, (v.distance - 17) / (95 - 17)));

  // ---------------------------------------------------------------- zoom & pan
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  useEffect(() => setView({ k: 1, x: 0, y: 0 }), [hall]);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; startDist?: number; startK?: number; lastTap?: number }>({ moved: 0 });
  const toLocal = (cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
  };
  const clamp = (v: { k: number; x: number; y: number }) => {
    const k = Math.min(3.2, Math.max(1, v.k));
    const maxX = (W * (k - 1)) / 1;
    const maxY = (H * (k - 1)) / 1;
    return { k, x: Math.min(0, Math.max(-maxX, v.x)), y: Math.min(0, Math.max(-maxY, v.y)) };
  };
  const zoomAt = (px: number, py: number, factor: number) =>
    setView((v) => {
      const k = Math.min(3.2, Math.max(1, v.k * factor));
      const f = k / v.k;
      return clamp({ k, x: px - (px - v.x) * f, y: py - (py - v.y) * f });
    });

  const handlers = interactive
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          gesture.current.moved = 0;
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            gesture.current.startDist = Math.hypot(a.x - b.x, a.y - b.y);
            gesture.current.startK = view.k;
          }
        },
        onPointerMove: (e: React.PointerEvent) => {
          const prev = pointers.current.get(e.pointerId);
          if (!prev) return;
          const cur = { x: e.clientX, y: e.clientY };
          pointers.current.set(e.pointerId, cur);
          if (pointers.current.size === 2 && gesture.current.startDist) {
            const [a, b] = [...pointers.current.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            const m = toLocal((a.x + b.x) / 2, (a.y + b.y) / 2);
            const target = (gesture.current.startK ?? 1) * (d / gesture.current.startDist);
            gesture.current.moved += 10;
            setView((v) => {
              const k = Math.min(3.2, Math.max(1, target));
              const f = k / v.k;
              return clamp({ k, x: m.x - (m.x - v.x) * f, y: m.y - (m.y - v.y) * f });
            });
            return;
          }
          const r = svgRef.current!.getBoundingClientRect();
          const dx = ((cur.x - prev.x) / r.width) * W;
          const dy = ((cur.y - prev.y) / r.height) * H;
          gesture.current.moved += Math.abs(dx) + Math.abs(dy);
          if (view.k > 1) setView((v) => clamp({ ...v, x: v.x + dx, y: v.y + dy }));
        },
        onPointerUp: (e: React.PointerEvent) => {
          pointers.current.delete(e.pointerId);
          if (pointers.current.size < 2) gesture.current.startDist = undefined;
          // touch double-tap zoom (mobile browsers do not reliably fire dblclick)
          if (e.pointerType !== "mouse" && gesture.current.moved < 8 && pointers.current.size === 0) {
            const t = performance.now();
            const last = gesture.current.lastTap;
            if (last && t - last < 320) {
              gesture.current.lastTap = undefined;
              const p = toLocal(e.clientX, e.clientY);
              if (view.k > 2.4) setView({ k: 1, x: 0, y: 0 });
              else zoomAt(p.x, p.y, 1.6);
            } else gesture.current.lastTap = t;
          }
        },
        onPointerCancel: (e: React.PointerEvent) => pointers.current.delete(e.pointerId),
        onWheel: (e: React.WheelEvent) => {
          // plain wheel keeps scrolling the page; Ctrl+wheel / trackpad pinch zooms
          if (!e.ctrlKey) return;
          const p = toLocal(e.clientX, e.clientY);
          zoomAt(p.x, p.y, e.deltaY < 0 ? 1.15 : 1 / 1.15);
        },
        onDoubleClick: (e: React.MouseEvent) => {
          if ((e.nativeEvent as PointerEvent).pointerType === "touch") return;
          const p = toLocal(e.clientX, e.clientY);
          if (view.k > 2.4) setView({ k: 1, x: 0, y: 0 });
          else zoomAt(p.x, p.y, 1.6);
        },
      }
    : {};
  const tap = (id: string | null) => {
    if (gesture.current.moved > 8) return;
    onSelect?.(id);
  };

  // ---------------------------------------------------------------- scene
  const G = FLOOR_GUIDE;
  const h = G.hall;
  const floorPts = [P([h.x0, 0, 0]), P([h.x1, 0, 0]), P([h.x1, h.y1Right, 0]), P([h.stepX, h.y1Right, 0]), P([h.stepX, h.y1Left, 0]), P([h.x0, h.y1Left, 0])];
  // the guide photo is cut off on the right: the hall continues, but we do not know how
  const cutPts = [P([h.x1, 0, 0]), P([h.x1 + 14, 0, 0]), P([h.x1 + 14, h.y1Right, 0]), P([h.x1, h.y1Right, 0])];
  const grid: string[] = [];
  const gs = 2.5;
  for (let x = Math.ceil(h.x0 / gs) * gs; x < h.x1; x += gs) grid.push(pathOf([P([x, 0, 0]), P([x, x < h.stepX ? h.y1Left : h.y1Right, 0])], false));
  for (let y = gs; y < h.y1Left; y += gs) grid.push(pathOf([P([h.x0, y, 0]), P([y > h.y1Right ? h.stepX : h.x1, y, 0])], false));
  const mine = new Set(highlightBrands);

  const similarCount = kiosks.filter((k) => k.similar).length;
  const highlightSimilar = similarCount < kiosks.length;
  const dim = layer !== "queue";

  type Drawable = { depth: number; el: React.ReactNode };
  const drawables: Drawable[] = [];

  // entrance: low cut-away brick wall with a glass door; the other walls are the guide's outline
  const wallH = 0.45;
  const walls: [number, number, number, number, string][] = [
    [h.x0, -WORLD.door, -0.12, -0.12, "#b8634a"],
    [WORLD.door, h.x1, -0.12, -0.12, "#b8634a"],
    [h.x0 - 0.12, h.x0 - 0.12, 0, h.y1Left, "#c9ced8"],
    [h.x0, h.stepX, h.y1Left + 0.12, h.y1Left + 0.12, "#c9ced8"],
    [h.stepX, h.x1, h.y1Right + 0.12, h.y1Right + 0.12, "#c9ced8"],
  ];
  for (const [x0, x1, y0, y1, color] of walls) {
    const c: V3 = [(x0 + x1) / 2, (y0 + y1) / 2, wallH / 2];
    const size: V3 = [Math.max(0.24, x1 - x0), Math.max(0.24, y1 - y0), wallH];
    for (const face of boxFaces(P, c, size)) {
      drawables.push({
        depth: face.depth + 50,
        el: <path key={`wall${x0}-${y0}-${face.shade}-${face.normal.join("")}`} d={face.d} fill={face.shade === "top" ? color : color === "#b8634a" ? "#9c4a33" : "#b3bac7"} />,
      });
    }
  }

  // counter bands (yellow / blue on the guide), cafe, restroom and stairs as low blocks
  const block = (key: string, x0: number, x1: number, y0: number, y1: number, hgt: number, tone: { top: string; side: string; front: string; stroke: string }, opacity = 1) => {
    for (const face of boxFaces(P, [(x0 + x1) / 2, (y0 + y1) / 2, hgt / 2], [x1 - x0, y1 - y0, hgt])) {
      drawables.push({
        depth: face.depth,
        el: <path key={`${key}-${face.shade}-${face.normal.join("")}`} d={face.d} fill={tone[face.shade]} stroke={tone.stroke} strokeWidth={0.6} opacity={opacity} strokeLinejoin="round" />,
      });
    }
  };
  const yb = G.bands.yellow;
  const bb = G.bands.blue;
  // each band = kitchen area (lower, lighter) behind a counter strip facing the hall
  const KITCHEN = {
    yellow: { top: "#fbf3d2", side: "#eadfae", front: "#f1e7bd", stroke: "#e0d29a" },
    blue: { top: "#e5effa", side: "#c9dbee", front: "#d6e5f4", stroke: "#b5cbe4" },
  };
  block("ykit", yb.x0, yb.x1, yb.y0 + 1.6, yb.y1, 0.6, KITCHEN.yellow);
  block("yband", yb.x0, yb.x1, yb.y0, yb.y0 + 1.6, 1.1, BAND.yellow);
  block("bkit", yb.x1, bb.cutAt, bb.y0 + 1.6, bb.y1, 0.6, KITCHEN.blue);
  block("bband", yb.x1, bb.cutAt, bb.y0, bb.y0 + 1.6, 1.1, BAND.blue);
  block("bkitcut", bb.cutAt, bb.x1, bb.y0 + 1.6, bb.y1, 0.6, KITCHEN.blue, 0.45);
  block("bbandcut", bb.cutAt, bb.x1, bb.y0, bb.y0 + 1.6, 1.1, BAND.blue, 0.45);
  block("cafe", G.cafe.x0, G.cafe.x1, G.cafe.y0, G.cafe.y1, 0.9, { top: "#f5dccb", side: "#e2bfa7", front: "#ebcdb8", stroke: "#d1a98d" });
  block("wc", G.restroom.x0, G.restroom.x1, G.restroom.y0, G.restroom.y1, 0.9, { top: "#e6e9ee", side: "#cfd4dc", front: "#d9dde4", stroke: "#bcc3cf" });
  block("stairs", G.stairs.x0, G.stairs.x1, G.stairs.y0, G.stairs.y1, 0.9, { top: "#e6e9ee", side: "#cfd4dc", front: "#d9dde4", stroke: "#bcc3cf" });
  // slot dividers + highlight for the student's own brands
  for (const c of G.counters) {
    const y0 = c.band === "yellow" ? yb.y0 : bb.y0;
    const isMine = c.brandId ? mine.has(c.brandId) : !!c.candidates?.some((b) => mine.has(b));
    if (isMine && hall) {
      const pts = [P([c.x - c.half, y0 - 0.05, 1.12]), P([c.x + c.half, y0 - 0.05, 1.12]), P([c.x + c.half, y0 + 1.6, 1.12]), P([c.x - c.half, y0 + 1.6, 1.12])];
      drawables.push({ depth: P([c.x, y0, 1.1]).depth - 0.5, el: <path key={`mine${c.id}`} d={pathOf(pts)} fill="#2448db" opacity={0.85 * hallT} /> });
    }
    if (c.status !== "continues") {
      const x = c.x + c.half;
      if (x < (c.band === "yellow" ? yb.x1 - 0.5 : bb.x1)) {
        drawables.push({ depth: P([x, y0, 1.1]).depth - 0.4, el: <path key={`div${c.id}`} d={pathOf([P([x, y0, 1.11]), P([x, y0 + 1.6, 1.11])], false)} stroke={BAND[c.band].stroke} strokeWidth={1.2} /> });
      }
    }
  }

  kiosks.forEach((k) => {
    const pos = kioskPos(k.id);
    const isSel = selected === k.id;
    const people = Math.min(k.people, MAX_PEOPLE);
    // queue strip on the floor, tinted by level
    const stripEnd = pos.x + pos.out * (WORLD.userOffset + Math.max(1, people) * WORLD.slot + 0.4);
    const strip = [P([pos.x + pos.out * 0.45, pos.y - 0.42, 0]), P([stripEnd, pos.y - 0.42, 0]), P([stripEnd, pos.y + 0.42, 0]), P([pos.x + pos.out * 0.45, pos.y + 0.42, 0])];
    drawables.push({
      depth: 1e6,
      el: (
        <path
          key={`strip${k.id}`}
          d={pathOf(strip)}
          fill={isSel ? "rgba(36,72,219,.18)" : dim ? "rgba(120,130,150,.08)" : LEVEL_TINT[k.level]}
          stroke={isSel ? "#2448db" : "none"}
          strokeWidth={1.5}
          style={{ transition: "fill 400ms" }}
        />
      ),
    });
    // users face the kiosk: small arrow on the floor between user and kiosk
    const a = P([pos.x + pos.out * 0.55, pos.y, 0]);
    const b = P([pos.x + pos.out * 0.85, pos.y, 0]);
    drawables.push({ depth: 1e6 - 1, el: <path key={`dir${k.id}`} d={`M${b.x},${b.y}L${a.x},${a.y}`} stroke="#8592a8" strokeWidth={1.4} markerEnd="url(#arrowhead)" opacity={dim ? 0.3 : 0.8} /> });

    // kiosk body (white), screen faces the user (outer side)
    for (const face of boxFaces(P, [pos.x, pos.y, 0.8], [0.5, 0.78, 1.6])) {
      const isScreen = face.shade === "side" && face.normal[0] === pos.out;
      drawables.push({
        depth: face.depth,
        el: (
          <path
            key={`k${k.id}-${face.shade}-${face.normal.join("")}`}
            d={face.d}
            fill={isScreen ? "#1c2740" : face.shade === "top" ? "#ffffff" : face.shade === "side" ? "#e9ecf1" : "#f6f7f9"}
            stroke={isSel ? "#2448db" : "#c9cfda"}
            strokeWidth={isSel ? 1.6 : 0.8}
            strokeLinejoin="round"
          />
        ),
      });
    }

    // people: ordering (blue) + waiting (slate), back of the line fades a little
    const total = (k.inService ? 1 : 0) + people;
    for (let n = 0; n < total; n++) {
      const foot = personPos(k.id, n);
      const pf = P(foot);
      const ph = Math.max(6, Math.abs(pf.y - P([foot[0], foot[1], 1.7]).y), Math.abs(pf.x - P([foot[0] + 0.5, foot[1], 0]).x) * 2.2);
      const ordering = k.inService && n === 0;
      const w = ph * 0.38;
      drawables.push({
        depth: pf.depth,
        el: (
          <g key={`p${k.id}${n}`} style={{ transition: "transform 700ms cubic-bezier(.22,1,.36,1)" }} opacity={dim ? 0.35 : 1 - n * 0.04}>
            <ellipse cx={pf.x} cy={pf.y} rx={w * 0.62} ry={w * 0.22} fill="rgba(15,25,45,.16)" />
            <rect x={pf.x - w / 2} y={pf.y - ph * 0.74} width={w} height={ph * 0.66} rx={w * 0.45} fill={ordering ? "#2448db" : "#34425c"} />
            <circle cx={pf.x} cy={pf.y - ph * 0.86} r={ph * 0.13} fill={ordering ? "#2448db" : "#34425c"} />
          </g>
        ),
      });
    }
  });

  drawables.sort((a, b) => b.depth - a.depth);

  // labels on top
  const labels = kiosks.map((k) => {
    const pos = kioskPos(k.id);
    const anchor = P([pos.x + pos.out * 0.2, pos.y, 1.85]);
    const isSel = selected === k.id;
    const strong = highlightSimilar && k.similar;
    const text = minuteRange(k.p20, k.p80);
    const w = Math.max(54, text.length * 8.6 + 26);
    return (
      <g
        key={`l${k.id}`}
        transform={`translate(${anchor.x},${anchor.y - 4})`}
        role={onSelect ? "button" : undefined}
        tabIndex={onSelect ? 0 : undefined}
        aria-label={`${k.label} 키오스크, 대기 ${k.people}명, 주문 시작까지 ${text}${k.similar ? ", 가장 빠른 줄과 비슷" : ""}`}
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
        className={onSelect ? "cursor-pointer outline-none [&:focus-visible>rect:first-child]:stroke-[3]" : undefined}
        opacity={(dim ? 0.4 : 1) * (1 - hallT)}
        visibility={hallT > 0.95 ? "hidden" : undefined}
      >
        <rect x={-w / 2} y={-34} width={w} height={30} rx={15} fill={strong || isSel ? "#2448db" : "#ffffff"} stroke={isSel ? "#0b1f4d" : "rgba(15,25,45,.12)"} strokeWidth={isSel ? 2 : 1} filter="url(#pillShadow)" />
        <circle cx={-w / 2 + 13} cy={-19} r={4} fill={strong || isSel ? "#ffffff" : LEVEL_DOT[k.level]} />
        <text x={-w / 2 + 22} y={-14} fontSize={14.5} fontWeight={760} className="num" fill={strong || isSel ? "#fff" : "#0f1a33"}>
          {text}
        </text>
        <path d="M-5,-4.5 L0,1 L5,-4.5Z" fill={strong || isSel ? "#2448db" : "#ffffff"} />
      </g>
    );
  });

  const door = P([0, -0.1, 0]);

  // counter labels (hall layers): staggered so neighbours never collide on narrow screens
  const counterLabels = hallT > 0.05 && !hideLabels ? layoutCounterLabels(P, mine, W < 520).map((l) => <CounterLabel key={l.c.id} {...l} opacity={hallT} />) : null;
  const placeLabel = (x: number, y: number, z: number, text: string, sub?: string) => {
    const p = P([x, y, z]);
    return (
      <g key={`${text}${x}${y}`} transform={`translate(${p.x},${p.y})`} opacity={hallT} pointerEvents="none">
        <text textAnchor="middle" fontSize={11} fontWeight={700} fill="#5b6578" stroke="#fff" strokeWidth={3} paintOrder="stroke">
          {text}
        </text>
        {sub && (
          <text y={12} textAnchor="middle" fontSize={9.5} fill="#6b7486" stroke="#fff" strokeWidth={3} paintOrder="stroke">
            {sub}
          </text>
        )}
      </g>
    );
  };

  return (
    <div
      className={`relative overflow-hidden ${className ?? ""}`}
      data-testid="commons-map"
      // not zoomed: vertical swipes scroll the page (the map never traps the sheet); zoomed: drag pans the map
      style={{ touchAction: interactive && view.k > 1.01 ? "none" : "pan-y" }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full select-none"
        role="group"
        aria-label={hall ? "혜당관 1층 안내도를 바탕으로 한 개념 지도. 안쪽 벽을 따라 노란 매장 구역(바비든든, 포포420, 가오슝 추정, 폭풍분식, 값찌개, 경성카츠)이 있고, 오른쪽 파란 구역에 51장국밥과 나머지 매장이 이어져요. 왼쪽에 카페1847과 화장실이 있어요. 거리는 실측이 아니에요." : "정문에서 식당 안쪽을 본 개념 지도. 왼쪽과 오른쪽에 키오스크가 3대씩 있고, 줄은 주문하는 사람 뒤 바깥쪽으로 서요."}
        onClick={() => tap(null)}
        {...handlers}
      >
        <defs>
          <linearGradient id="fog" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#eef0f3" stopOpacity="0.2" />
            <stop offset="1" stopColor="#eef0f3" stopOpacity="1" />
          </linearGradient>
          <filter id="pillShadow" x="-20%" y="-40%" width="140%" height="180%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#0f1a33" floodOpacity="0.16" />
          </filter>
          <marker id="arrowhead" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L6,3 L0,6Z" fill="#8592a8" />
          </marker>
          <pattern id="fogHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <rect width="8" height="8" fill="#e7eaef" />
            <rect width="1.2" height="8" fill="#d6dbe3" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="#eef0f3" />
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          <path d={pathOf(cutPts)} fill="url(#fogHatch)" />
          <path d={pathOf(floorPts)} fill="#dfe3e9" />
          {/* central walkway from the door toward the counters: lighter, wider than v1 */}
          <path d={pathOf([P([-WORLD.aisleHalf, 0, 0]), P([WORLD.aisleHalf, 0, 0]), P([WORLD.aisleHalf, G.bands.blue.y0, 0]), P([-WORLD.aisleHalf, G.bands.blue.y0, 0])])} fill="#e9ecf1" />
          {grid.map((d, i) => (
            <path key={i} d={d} stroke="#cfd5de" strokeWidth={0.6} fill="none" opacity={1 - hallT * 0.5} />
          ))}
          {/* the guide's unlabelled green shape — drawn as an outline only, its use is unknown */}
          <path d={pathOf(G.unlabelled.map(([x, y]) => P([x, y, 0])))} fill="rgba(140,170,110,.10)" stroke="#a9bb94" strokeWidth={1} strokeDasharray="4 3" />
          {G.hidden.map((z) => (
            <path key={z.label} d={pathOf([P([z.x0, z.y0, 0]), P([z.x1, z.y0, 0]), P([z.x1, z.y1, 0]), P([z.x0, z.y1, 0])])} fill="url(#fogHatch)" opacity={0.9} />
          ))}
          {drawables.map((d) => d.el)}
          {hallT > 0.05 && !hideLabels && (
            <>
              {placeLabel((G.cafe.x0 + G.cafe.x1) / 2, (G.cafe.y0 + G.cafe.y1) / 2, 1, "카페1847", "별도 주문")}
              {placeLabel((G.restroom.x0 + G.restroom.x1) / 2, (G.restroom.y0 + G.restroom.y1) / 2, 1, "화장실")}
              {placeLabel(h.x1 + 6, 9, 0, "안내도 잘린 부분", "매장이 이어짐")}
              {placeLabel(-28, 7.5, 0, "안내도에서 가려짐")}
              {layer === "seats" && placeLabel(-17, 13, 0, "좌석 구역", "테이블 배치 미확인")}
              {layer === "seats" && placeLabel(14, 9, 0, "좌석 구역", "테이블 배치 미확인")}
              {placeLabel(-4, 15.5, 0, "안내도 표시", "용도 미표기")}
              {placeLabel(0, 4.2, 0, "키오스크 3대씩")}
            </>
          )}
          {counterLabels}
          {/* glass door threshold */}
          <path d={pathOf([P([-WORLD.door, -0.24, 0]), P([WORLD.door, -0.24, 0]), P([WORLD.door, 0, 0]), P([-WORLD.door, 0, 0])])} fill="#bcd2f4" stroke="#8fb0e6" strokeWidth={1} />
          {!hideLabels && labels}
          {overlay?.(P)}
          <g transform={`translate(${door.x},${door.y + 16})`}>
            <rect x={-30} y={-12} width={60} height={22} rx={11} fill="#0b1f4d" />
            <text y={4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
              정문
            </text>
          </g>
        </g>
      </svg>
      {LAYER_NOTICE[layer] && !hideLabels && (
        <p style={{ top: noticeTop }} className="pointer-events-none absolute inset-x-0 mx-auto w-fit max-w-[calc(100%-24px)] rounded-full bg-white/95 px-3 py-1.5 text-center text-[12px] leading-snug font-semibold text-ink-2 shadow-[0_2px_8px_rgba(15,26,51,.12)]" role="note">
          {LAYER_NOTICE[layer]}
        </p>
      )}
      {interactive && (
        <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
          {view.k > 1.01 && (
            <button onClick={() => setView({ k: 1, x: 0, y: 0 })} className="h-9 rounded-full bg-white/95 px-3 text-[12.5px] font-semibold text-ink-2 shadow-[0_2px_8px_rgba(15,26,51,.15)]">
              정문 시점으로
            </button>
          )}
          <div className="flex overflow-hidden rounded-full bg-white/95 shadow-[0_2px_8px_rgba(15,26,51,.15)]">
            <button aria-label="지도 확대" onClick={() => zoomAt(W / 2, H / 2, 1.4)} className="grid size-9 place-items-center text-[18px] font-bold text-ink-2">
              +
            </button>
            <button aria-label="지도 축소" onClick={() => zoomAt(W / 2, H / 2, 1 / 1.4)} disabled={view.k <= 1.01} className="grid size-9 place-items-center border-l border-line text-[18px] font-bold text-ink-2 disabled:opacity-35">
              −
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface PlacedLabel {
  c: CounterSlot;
  x: number;
  y: number;
  lift: number;
  w: number;
  text: string;
  sub: string | null;
  isMine: boolean;
  unsure: boolean;
  small: boolean;
}

/** Places counter labels above their slots, lifting a label to the next row while it would overlap one already placed. */
function layoutCounterLabels(P: (p: V3) => { x: number; y: number }, mine: Set<string>, small: boolean): PlacedLabel[] {
  const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const fs = small ? 10.5 : 12;
  return FLOOR_GUIDE.counters.map((c) => {
    const y0 = c.band === "yellow" ? FLOOR_GUIDE.bands.yellow.y0 : FLOOR_GUIDE.bands.blue.y0;
    const a = P([c.x, y0 + 0.8, 1.1]);
    const brand = c.brandId ? getBrand(c.brandId)?.name : null;
    const isMine = c.brandId ? mine.has(c.brandId) : !!c.candidates?.some((b) => mine.has(b));
    const unsure = c.status === "inferred" || c.status === "outdated" || c.status === "continues";
    const text = brand ?? (c.status === "continues" ? "나머지 매장" : "미확인");
    const sub = c.status === "inferred" ? "추정" : c.status === "outdated" ? `안내도: ${c.guideLabel}` : c.status === "continues" ? (small ? "3곳 · 순서 미확인" : "비비고고·도쿄야·광뚝") : null;
    const w = Math.max(text.length * fs * 0.92 + 14, sub ? sub.length * fs * 0.72 + 10 : 0);
    const h = sub ? fs * 2.5 : fs * 1.7;
    let lift = 6;
    for (let k = 0; k < 6; k++) {
      const box = { x0: a.x - w / 2 - 2, x1: a.x + w / 2 + 2, y0: a.y - lift - h, y1: a.y - lift };
      if (!placed.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1)) {
        placed.push(box);
        break;
      }
      lift += h + 3;
    }
    return { c, x: a.x, y: a.y, lift, w, text, sub, isMine, unsure, small };
  });
}

/** Brand label over a counter slot, with a leader line down to the counter. */
function CounterLabel({ c, x, y, lift, w, text, sub, isMine, unsure, small, opacity }: PlacedLabel & { opacity: number }) {
  const fs = small ? 10.5 : 12;
  const hgt = sub ? fs * 2.5 : fs * 1.7;
  return (
    <g transform={`translate(${x},${y - lift})`} opacity={opacity} pointerEvents="none" data-counter={c.id}>
      <path d={`M0,${lift}L0,0`} stroke={isMine ? "#2448db" : "#8592a8"} strokeWidth={1} />
      <circle cy={lift} r={2} fill={isMine ? "#2448db" : "#8592a8"} />
      <rect x={-w / 2} y={-hgt} width={w} height={hgt} rx={7} fill={isMine ? "#2448db" : "#ffffff"} stroke={isMine ? "#0b1f4d" : unsure ? "#8592a8" : "rgba(15,25,45,.16)"} strokeDasharray={unsure && !isMine ? "3 2" : undefined} filter="url(#pillShadow)" />
      <text y={sub ? -hgt + fs * 1.05 : -hgt / 2 + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={750} fill={isMine ? "#fff" : "#0f1a33"}>
        {text}
      </text>
      {sub && (
        <text y={-fs * 0.42} textAnchor="middle" fontSize={fs * 0.78} fontWeight={600} fill={isMine ? "#dfe6ff" : "#5b6578"}>
          {sub}
        </text>
      )}
    </g>
  );
}
