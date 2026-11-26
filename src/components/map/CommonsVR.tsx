"use client";
/**
 * "식당 미리보기 (VR)" — a 360° look-around inside 1947 COMMONS, in the spirit of KORAIL Talk's
 * in-train VR preview: pick a spot from the tabs, drag to look around, labels float over what
 * matters (lines, counters, free tables). Rendered from the same schematic world as the map
 * (counters from the floor guide, kiosks from the field check, tables from the CONCEPT layout),
 * so it is a model, not a photo — the screen says so.
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getBrand } from "@/core/catalog";
import { FLOOR_GUIDE } from "@/core/layout";
import type { KioskView, ZoneView } from "@/core/world";
import { minuteRange } from "@/lib/format";
import { FIXTURES, SEAT_UNITS, zoneStates, type CellState, type SeatUnit } from "./dining";
import { kioskPos, personPos, WORLD } from "./geometry";

const G = FLOOR_GUIDE;
const H_ = G.hall;

interface Spot {
  id: string;
  label: string;
  x: number;
  y: number;
  yaw: number; // degrees, 0 = looking into the hall (+y)
  pitch: number;
}

const SPOTS: Spot[] = [
  { id: "door", label: "정문", x: 0, y: -0.6, yaw: 0, pitch: -10 },
  { id: "kiosk", label: "키오스크", x: 0, y: 1.4, yaw: -48, pitch: -12 },
  { id: "dining", label: "식사 공간", x: -1.2, y: 9.8, yaw: -38, pitch: -18 },
  { id: "counter", label: "매장 카운터", x: -12, y: 19, yaw: 0, pitch: -4 },
  { id: "right", label: "오른쪽 매장", x: 1.5, y: 11, yaw: 42, pitch: -12 },
];

interface Label {
  id: string;
  text: string;
  sub?: string;
  at: [number, number, number];
  tone: "kiosk" | "fast" | "zone" | "mine" | "place";
}

const ZONE_NAME: Record<string, string> = { window: "창가 1인석", center: "중앙 칸막이석", long: "긴 테이블석", booth: "부스석" };
const ZONE_AT: Record<string, [number, number]> = { window: [-30, 1.5], center: [-23.5, 16.6], long: [-8.1, 15.2], booth: [12.1, 12.9] };
const SHIRTS = [0x7f8fa6, 0xa3b1c2, 0x6b7a8f, 0xb8a99a, 0x8c9b8a, 0x9aa3b8];
const TONE: Record<CellState | "plain", number> = { free: 0x2bb673, busy: 0xc9ced6, unsure: 0xeef0f3, plain: 0xe6dccb };

export function CommonsVR({
  kiosks,
  zones,
  highlightBrands = [],
  highlightLabels = {},
  onClose,
}: {
  kiosks: KioskView[];
  zones: ZoneView[];
  highlightBrands?: string[];
  highlightLabels?: Record<string, string>;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState<Spot>(highlightBrands.length ? SPOTS[3] : SPOTS[0]);
  const api = useRef<{ goTo: (s: Spot) => void } | null>(null);
  const [failed, setFailed] = useState(false);

  // labels depend on live data; the scene is built once per open
  const labels: Label[] = [
    ...kiosks.map((k): Label => {
      const p = kioskPos(k.id);
      return { id: `k${k.id}`, text: minuteRange(k.p20, k.p80), sub: `${k.people}명 대기`, at: [p.x, p.y, 2.25], tone: k.similar && kiosks.filter((q) => q.similar).length <= 4 ? "fast" : "kiosk" };
    }),
    ...zones
      .filter((z) => ZONE_AT[z.id])
      .map((z): Label => ({ id: `z${z.id}`, text: ZONE_NAME[z.id], sub: `${z.apparentlyEmpty}${z.id === "window" ? "석" : "개"} 비어 보임`, at: [...ZONE_AT[z.id], 1.7], tone: "zone" })),
    ...G.counters
      .filter((c) => c.brandId && highlightBrands.includes(c.brandId))
      .map((c): Label => ({ id: `m${c.id}`, text: `내 주문 ${highlightLabels[c.brandId!] ?? ""}`.trim(), sub: getBrand(c.brandId!)?.name, at: [c.x, (c.band === "yellow" ? G.bands.yellow.y0 : G.bands.blue.y0) - 0.4, 1.9], tone: "mine" })),
  ];

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeef1f5);
    scene.fog = new THREE.Fog(0xeef1f5, 30, 70);
    const camera = new THREE.PerspectiveCamera(72, el.clientWidth / el.clientHeight, 0.1, 200);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd5dd, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.7);
    sun.position.set(-8, 18, 14);
    scene.add(sun);

    // world (x right, y into the hall, z up) → three (x, up, -y)
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);
    const mats = new Map<number, THREE.Material>();
    const mat = (c: number, opts: { opacity?: number } = {}) => {
      const key = c + (opts.opacity ?? 1) * 1e9;
      if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color: c, transparent: opts.opacity != null, opacity: opts.opacity ?? 1 }));
      return mats.get(key)!;
    };
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const edgeGeo = new THREE.EdgesGeometry(boxGeo);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x1b2130, transparent: true, opacity: 0.16 });
    const block = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: number, opacity?: number) => {
      const m = new THREE.Mesh(boxGeo, mat(color, opacity != null ? { opacity } : {}));
      m.scale.set(Math.abs(x1 - x0), Math.abs(z1 - z0), Math.abs(y1 - y0));
      m.position.copy(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
      if (opacity == null) m.add(new THREE.LineSegments(edgeGeo, edgeMat));
      scene.add(m);
      return m;
    };
    const sign = (text: string, x: number, y: number, z: number, w: number, bg: string, fg: string) => {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 128;
      const g = c.getContext("2d")!;
      g.fillStyle = bg;
      g.fillRect(0, 0, 512, 128);
      g.fillStyle = fg;
      g.font = "700 58px Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(text, 256, 68, 480);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.copy(V(x, y, z));
      scene.add(m);
    };

    // floor
    const shape = new THREE.Shape();
    const hall: [number, number][] = [[H_.x0, 0], [H_.x1 + 12, 0], [H_.x1 + 12, H_.y1Right], [H_.stepX, H_.y1Right], [H_.stepX, H_.y1Left], [H_.x0, H_.y1Left]];
    hall.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    const floor = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color: 0xf7f6f3 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshLambertMaterial({ color: 0xdfe3e8 }));
    outside.rotation.x = -Math.PI / 2;
    outside.position.set(0, -0.01, 30);
    scene.add(outside);

    // walls (3 m) — the front is glass with the entrance gap
    const WALL = 0xe9ebef;
    block(H_.x0 - 0.3, H_.x0, 0, H_.y1Left, 0, 3.2, WALL);
    block(H_.x0, H_.stepX, H_.y1Left, H_.y1Left + 0.3, 0, 3.2, WALL);
    block(H_.stepX, H_.stepX + 0.3, H_.y1Right, H_.y1Left, 0, 3.2, WALL);
    block(H_.stepX, H_.x1 + 12, H_.y1Right, H_.y1Right + 0.3, 0, 3.2, WALL);
    block(H_.x0, -WORLD.door, -0.15, 0, 0, 3.2, 0xbfd6f0, 0.28);
    block(WORLD.door, H_.x1 + 12, -0.15, 0, 0, 3.2, 0xbfd6f0, 0.28);
    block(H_.x0, H_.x1 + 12, -0.15, 0, 0, 0.12, 0xb9c0ca);

    // counters: kitchen floor, counter, back wall, brand sign
    const yb = G.bands.yellow;
    const bb = G.bands.blue;
    block(yb.x0, yb.x1, yb.y0, yb.y1, 0, 0.02, 0xf3e7c4);
    block(yb.x1, bb.x1, bb.y0, bb.y1, 0, 0.02, 0xdbe7f5);
    for (const c of G.counters) {
      const y0 = c.band === "yellow" ? yb.y0 : bb.y0;
      const mine = (c.brandId && highlightBrands.includes(c.brandId)) || false;
      const tone = mine ? 0x1e62e6 : c.band === "yellow" ? 0xe2cd8f : 0xa9c3e2;
      block(c.x - c.half + 0.1, c.x + c.half - 0.1, y0, y0 + 1.2, 0, 1.05, tone);
      block(c.x - c.half + 0.1, c.x + c.half - 0.1, y0 + 3.6, y0 + 3.8, 0, 3.0, c.band === "yellow" ? 0xf1e5c3 : 0xdce8f6);
      if (c.status !== "continues") {
        const name = c.brandId ? getBrand(c.brandId)?.name ?? "" : "미확인";
        sign(c.status === "inferred" ? `${name}(추정)` : name, c.x, y0 + 3.55, 2.45, Math.min(5, c.half * 1.7), mine ? "#1e62e6" : c.brandId ? "#191b1f" : "#9aa1ab", "#ffffff");
      }
    }
    // rooms
    block(G.cafe.x0, G.cafe.x1, G.cafe.y0, G.cafe.y1, 0, 3, 0xf1e4da);
    sign("카페1847", (G.cafe.x0 + G.cafe.x1) / 2 + 2, G.cafe.y0 - 0.05, 2.4, 3.6, "#8a6a58", "#ffffff");
    block(G.restroom.x0, G.restroom.x1, G.restroom.y0, G.restroom.y1, 0, 3, 0xe6e9ee);
    sign("화장실", (G.restroom.x0 + G.restroom.x1) / 2, G.restroom.y0 - 0.05, 2.4, 3, "#5f6772", "#ffffff");

    // food-court fixtures (arbitrary positions): call monitors, tray return, water, planters
    for (const f of FIXTURES) {
      if (f.kind === "monitor") {
        const z0 = f.z0 ?? 2.4;
        block(f.x0 - 0.1, f.x1 + 0.1, f.y0, f.y1 + 0.08, z0 - 0.1, z0 + 1.3, 0x1b2130);
        sign("주문 번호 리스트", (f.x0 + f.x1) / 2, f.y0 - 0.02, z0 + 0.95, f.x1 - f.x0 - 0.2, "#cfe4ff", "#14348f");
        sign(f.label, (f.x0 + f.x1) / 2, f.y0 - 0.02, z0 + 0.35, (f.x1 - f.x0) * 0.7, "#cfe4ff", "#3b4f8f");
        block((f.x0 + f.x1) / 2 - 0.04, (f.x0 + f.x1) / 2 + 0.04, f.y0 + 0.05, f.y0 + 0.13, z0 + 1.2, 3.2, 0x8a929e);
        continue;
      }
      const tone = f.kind === "planter" ? 0x7fb98a : f.kind === "tray" ? 0xb9c0ca : 0x9cc3ec;
      block(f.x0, f.x1, f.y0, f.y1, 0, f.h, tone);
      if (f.kind === "planter") {
        for (let y = f.y0 + 0.5; y < f.y1; y += 1.2) {
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), mat(0x4f9a5f));
          leaf.position.copy(V((f.x0 + f.x1) / 2, y, f.h + 0.3));
          scene.add(leaf);
        }
      }
      if (f.label) sign(f.label, (f.x0 + f.x1) / 2, f.y0 - 0.05, f.h + 0.45, Math.min(3, f.x1 - f.x0), "#5f6772", "#ffffff");
    }

    // kiosks + people
    const personGeo = { legs: new THREE.CylinderGeometry(0.13, 0.12, 0.84, 10), torso: new THREE.CapsuleGeometry(0.2, 0.34, 4, 10), head: new THREE.SphereGeometry(0.13, 14, 12) };
    for (const k of kiosks) {
      const p = kioskPos(k.id);
      block(p.x - 0.3, p.x + 0.3, p.y - 0.38, p.y + 0.38, 0, 1.55, 0x3a4049);
      block(p.out > 0 ? p.x + 0.3 : p.x - 0.32, p.out > 0 ? p.x + 0.32 : p.x - 0.3, p.y - 0.3, p.y + 0.3, 0.75, 1.45, 0x8fb5ff);
      const total = (k.inService ? 1 : 0) + Math.min(k.people, 9);
      for (let n = 0; n < total; n++) {
        const f = personPos(k.id, n);
        // simple figures: legs, torso (muted clothing colours), head
        const shirt = k.inService && n === 0 ? 0x2a3038 : SHIRTS[(n * 3 + k.id.charCodeAt(1)) % SHIRTS.length];
        const legs = new THREE.Mesh(personGeo.legs, mat(0x3b4250));
        legs.position.copy(V(f[0], f[1], 0.42));
        const torso = new THREE.Mesh(personGeo.torso, mat(shirt));
        torso.position.copy(V(f[0], f[1], 1.08));
        const head = new THREE.Mesh(personGeo.head, mat(0xe8c9a8));
        head.position.copy(V(f[0], f[1], 1.58));
        scene.add(legs, torso, head);
      }
    }

    // concept tables, coloured by estimated state
    const byZone = new Map<string, CellState[]>();
    for (const z of zones) {
      const n = SEAT_UNITS.filter((u) => u.zone === z.id).length;
      if (n) byZone.set(z.id, zoneStates(n, Math.min(n, z.apparentlyEmpty), Math.min(n - Math.min(n, z.apparentlyEmpty), z.uncertain)));
    }
    const chair = (x: number, y: number, h = 0.45, c = 0xd9dde3) => block(x - 0.2, x + 0.2, y - 0.2, y + 0.2, 0, h, c);
    for (const u of SEAT_UNITS as SeatUnit[]) {
      const st = u.kind === "rest" ? null : (byZone.get(u.zone)?.[u.i] ?? null);
      const top = TONE[st ?? "plain"];
      const ch = st === "free" ? 0x9fdcbc : 0xd9dde3;
      if (u.kind === "single") {
        block(u.x - 0.45, u.x + 0.45, 0.45, 0.85, 0, 1.05, 0xe6dccb);
        chair(u.x, u.y, 0.5, st === "free" ? 0x2bb673 : 0xc9ced6);
        continue;
      }
      block(u.x - u.hx, u.x + u.hx, u.y - u.hy, u.y + u.hy, 0, 0.74, top);
      if (u.kind === "booth") {
        block(u.x - u.hx - 0.1, u.x + u.hx + 0.1, u.y + u.hy + 0.1, u.y + u.hy + 0.45, 0, 1.15, ch);
        block(u.x - u.hx - 0.1, u.x + u.hx + 0.1, u.y - u.hy - 0.45, u.y - u.hy - 0.1, 0, 1.15, ch);
      } else {
        for (const sx of [-0.6, 0.6]) for (const sy of [-1, 1]) chair(u.x + sx * u.hx, u.y + sy * (u.hy + 0.35), 0.45, ch);
        if (u.kind === "quad") block(u.x - u.hx - 0.2, u.x + u.hx + 0.2, u.y + u.hy + 0.7, u.y + u.hy + 0.78, 0, 1.2, 0xd2bd9c);
      }
    }

    // camera control: yaw/pitch around the current spot, fov zoom
    const view = { x: spot.x, y: spot.y, yaw: spot.yaw, pitch: spot.pitch, fov: 72 };
    let tween: { from: typeof view; to: typeof view; t0: number } | null = null;
    const apply = () => {
      camera.position.copy(V(view.x, view.y, 1.6));
      const yaw = (view.yaw * Math.PI) / 180;
      const pitch = (view.pitch * Math.PI) / 180;
      const dir = V(Math.sin(yaw) * Math.cos(pitch), Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch));
      camera.lookAt(camera.position.clone().add(dir));
      // view.fov is the horizontal-ish field; portrait phones need a taller vertical fov to see as much
      const aspect = el.clientWidth / el.clientHeight;
      const vfov = aspect >= 1 ? view.fov : Math.min(108, (2 * Math.atan(Math.tan(((view.fov * 1.05) * Math.PI) / 360) / aspect) * 180) / Math.PI);
      camera.fov = vfov;
      camera.updateProjectionMatrix();
    };
    api.current = {
      goTo: (s) => {
        tween = { from: { ...view }, to: { x: s.x, y: s.y, yaw: s.yaw, pitch: s.pitch, fov: 72 }, t0: performance.now() };
      },
    };

    let drag: { x: number; y: number } | null = null;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch0 = 0;
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) drag = { x: e.clientX, y: e.clientY };
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
      }
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0) view.fov = Math.max(38, Math.min(85, view.fov * (pinch0 / d)));
        pinch0 = d;
        return;
      }
      if (!drag) return;
      const s = camera.fov / el.clientHeight;
      view.yaw -= (e.clientX - drag.x) * s;
      view.pitch = Math.max(-60, Math.min(35, view.pitch + (e.clientY - drag.y) * s));
      drag = { x: e.clientX, y: e.clientY };
      tween = null;
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size === 0) drag = null;
      pinch0 = 0;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      view.fov = Math.max(38, Math.min(85, view.fov + e.deltaY * 0.04));
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") view.yaw -= 10;
      if (e.key === "ArrowRight") view.yaw += 10;
      if (e.key === "ArrowUp") view.pitch = Math.min(35, view.pitch + 6);
      if (e.key === "ArrowDown") view.pitch = Math.max(-60, view.pitch - 6);
    };
    const cv = renderer.domElement;
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", key);
    const ro = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);

    let raf = 0;
    const tmp = new THREE.Vector3();
    const loop = (t: number) => {
      if (tween) {
        const p = Math.min(1, (t - tween.t0) / 700);
        const e = 1 - Math.pow(1 - p, 3);
        const a = tween.from;
        const b = tween.to;
        let dy = ((b.yaw - a.yaw + 540) % 360) - 180;
        if (Math.abs(dy) > 180) dy = 0;
        Object.assign(view, { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, yaw: a.yaw + dy * e, pitch: a.pitch + (b.pitch - a.pitch) * e, fov: a.fov + (b.fov - a.fov) * e });
        if (p >= 1) tween = null;
      }
      apply();
      renderer.render(scene, camera);
      // float the HTML labels over their 3D anchors
      const box = labelsRef.current;
      if (box) {
        for (const node of Array.from(box.children) as HTMLElement[]) {
          const at = node.dataset.at!.split(",").map(Number);
          tmp.copy(V(at[0], at[1], at[2])).project(camera);
          const dist = camera.position.distanceTo(V(at[0], at[1], at[2]));
          const visible = tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 && dist < 34;
          node.style.opacity = visible ? String(Math.max(0.35, Math.min(1, 1.4 - dist / 30))) : "0";
          node.style.transform = `translate(-50%,-100%) translate(${((tmp.x + 1) / 2) * el.clientWidth}px,${((1 - tmp.y) / 2) * el.clientHeight}px)`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("keydown", key);
      renderer.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const m = o.material as THREE.MeshBasicMaterial;
          m.map?.dispose();
          m.dispose();
        }
      });
      cv.remove();
    };
    // the scene is a snapshot of the moment the viewer opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0f1115] text-white" role="dialog" aria-modal="true" aria-label="식당 미리보기 VR">
      <div className="flex items-center justify-between gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2">
        <div className="min-w-0">
          <p className="text-[16px] font-bold">식당 미리보기 (VR)</p>
          <p className="text-[12px] text-white/70">드래그해서 둘러보기 · 개념 배치라 실제와 달라요</p>
        </div>
        <button onClick={onClose} className="h-10 shrink-0 rounded-full bg-white/12 px-4 text-[14px] font-semibold" autoFocus>
          닫기
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div ref={host} className="absolute inset-0" aria-hidden />
        {failed && <p className="absolute inset-0 grid place-items-center px-8 text-center text-[15px] text-white/80">이 브라우저에서는 3D 화면을 열 수 없어요.</p>}
        <div ref={labelsRef} className="pointer-events-none absolute inset-0" aria-hidden>
          {labels.map((l) => (
            <span
              key={l.id}
              data-at={l.at.join(",")}
              className={`absolute top-0 left-0 rounded-[10px] px-2.5 py-1 text-center whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,.25)] transition-opacity ${
                l.tone === "fast" || l.tone === "mine" ? "bg-[#1e62e6] text-white" : l.tone === "zone" ? "bg-white text-[#0b6e45]" : "bg-white text-[#191b1f]"
              }`}
              style={{ opacity: 0 }}
            >
              <span className="block text-[13px] leading-4 font-bold">{l.text}</span>
              {l.sub && <span className={`block text-[11px] leading-[14px] ${l.tone === "fast" || l.tone === "mine" ? "text-white/85" : "text-[#5f6772]"}`}>{l.sub}</span>}
            </span>
          ))}
        </div>
      </div>
      {/* like picking a car: jump between spots */}
      <div role="tablist" aria-label="위치 선택" className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-3 pb-[max(env(safe-area-inset-bottom),14px)]">
        {SPOTS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={spot.id === s.id}
            onClick={() => {
              setSpot(s);
              api.current?.goTo(s);
            }}
            className={`h-10 shrink-0 rounded-full px-4 text-[14px] font-semibold ${spot.id === s.id ? "bg-white text-[#191b1f]" : "bg-white/12 text-white"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CommonsVR;
