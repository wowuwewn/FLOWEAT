"use client";
/**
 * Commons Floor — the student map. Viewpoint: standing at the main entrance, looking in.
 * Draws only verified relations; everything beyond the entrance area is shown as
 * unverified space. Pinch / drag / wheel / double-tap zoom, tap a kiosk to select.
 */
import { useMemo, useRef, useState } from "react";
import type { KioskView } from "@/core/world";
import { minuteRange } from "@/lib/format";
import { boxFaces, entranceCamera, kioskPos, pathOf, personPos, projector, WORLD, type V3 } from "./geometry";

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
}

export function CommonsMap({ kiosks, selected = null, onSelect, layer = "queue", pitch = 68, height = 420, width = 390, interactive = true, className, overlay, hideLabels }: Props) {
  const W = width;
  const H = height;
  const P = useMemo(() => {
    const f = WORLD.floor;
    const fit: V3[] = [
      [-WORLD.viewHalf, -0.6, 0],
      [WORLD.viewHalf, -0.6, 0],
      [-WORLD.viewHalf, WORLD.verifiedDepth + 1.4, 0],
      [WORLD.viewHalf, WORLD.verifiedDepth + 1.4, 0],
      [0, WORLD.kioskDepth[3], 2.4],
    ];
    return projector(entranceCamera(pitch), { w: W, h: H, pad: 10 }, fit);
  }, [pitch, W, H]);

  // ---------------------------------------------------------------- zoom & pan
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
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
        },
        onPointerCancel: (e: React.PointerEvent) => pointers.current.delete(e.pointerId),
        onWheel: (e: React.WheelEvent) => {
          // plain wheel keeps scrolling the page; Ctrl+wheel / trackpad pinch zooms
          if (!e.ctrlKey) return;
          const p = toLocal(e.clientX, e.clientY);
          zoomAt(p.x, p.y, e.deltaY < 0 ? 1.15 : 1 / 1.15);
        },
        onDoubleClick: (e: React.MouseEvent) => {
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
  const f = WORLD.floor;
  const floorPts = [P([f.x0, 0, 0]), P([f.x1, 0, 0]), P([f.x1, WORLD.verifiedDepth, 0]), P([f.x0, WORLD.verifiedDepth, 0])];
  const fogPts = [P([f.x0, WORLD.verifiedDepth, 0]), P([f.x1, WORLD.verifiedDepth, 0]), P([f.x1, f.y1, 0]), P([f.x0, f.y1, 0])];
  const grid: string[] = [];
  for (let x = f.x0; x <= f.x1 + 0.01; x += 1.25) grid.push(pathOf([P([x, 0, 0]), P([x, WORLD.verifiedDepth, 0])], false));
  for (let y = 1.25; y < WORLD.verifiedDepth; y += 1.25) grid.push(pathOf([P([f.x0, y, 0]), P([f.x1, y, 0])], false));

  const similarCount = kiosks.filter((k) => k.similar).length;
  const highlightSimilar = similarCount < kiosks.length;
  const dim = layer !== "queue";

  type Drawable = { depth: number; el: React.ReactNode };
  const drawables: Drawable[] = [];

  // entrance: low cut-away brick wall with a glass door
  const wallH = 0.45;
  for (const [x0, x1] of [
    [f.x0, -WORLD.door],
    [WORLD.door, f.x1],
  ]) {
    for (const face of boxFaces(P, [(x0 + x1) / 2, -0.12, wallH / 2], [x1 - x0, 0.24, wallH])) {
      drawables.push({
        depth: face.depth + 50,
        el: <path key={`wall${x0}-${face.shade}-${face.normal.join("")}`} d={face.d} fill={face.shade === "top" ? "#b8634a" : "#9c4a33"} />,
      });
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
        opacity={dim ? 0.4 : 1}
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
  const fogLabel = P([0, WORLD.verifiedDepth + 1.3, 0]);

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
        aria-label="정문에서 식당 안쪽을 본 개념 지도. 왼쪽과 오른쪽에 키오스크가 3대씩 있고, 줄은 주문하는 사람 뒤 바깥쪽으로 서요."
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
          <path d={pathOf(fogPts)} fill="url(#fogHatch)" />
          <path d={pathOf(fogPts)} fill="url(#fog)" />
          <path d={pathOf(floorPts)} fill="#dfe3e9" />
          {/* central walkway: lighter, wider than v1 */}
          <path d={pathOf([P([-WORLD.aisleHalf, 0, 0]), P([WORLD.aisleHalf, 0, 0]), P([WORLD.aisleHalf, WORLD.verifiedDepth, 0]), P([-WORLD.aisleHalf, WORLD.verifiedDepth, 0])])} fill="#e9ecf1" />
          {grid.map((d, i) => (
            <path key={i} d={d} stroke="#cfd5de" strokeWidth={0.6} fill="none" />
          ))}
          <path d={pathOf([P([f.x0, WORLD.verifiedDepth, 0]), P([f.x1, WORLD.verifiedDepth, 0])], false)} stroke="#9aa5b8" strokeWidth={1.2} strokeDasharray="5 5" fill="none" />
          <text x={fogLabel.x} y={fogLabel.y} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#5b6578">
            {layer === "seats" ? "좌석 위치는 확인 전이라 아래 목록으로 보여 드려요" : layer === "pickup" ? "수령 카운터 위치는 확인 전이에요" : "아직 확인 전인 공간"}
          </text>
          {drawables.map((d) => d.el)}
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
