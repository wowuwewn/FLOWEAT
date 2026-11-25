"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import evalReport from "../../../docs/ai/evaluation/vision-latest.json";
import evalV1 from "../../../docs/ai/evaluation/vision-v1-2026-11-24.json";
import { ROLES, SceneAnalyzer, type FrameOut, type Role } from "@/core/vision/analysis";
import { COCO, MODELS } from "@/core/vision/detector";
import { centroid, SCENES, type Scene } from "@/core/vision/scenes";
import { evaluate, type EvaluationReport } from "@/core/predict/evaluate";
import { METHOD_LABEL } from "@/core/predict/forecast";
import { demoClock, getEngine, worldAt } from "@/core/world";
import { currentScenario } from "@/client/session";
import { createLiveDetector, frameAt, setVisionLinked, TABLE_REASONS, TABLE_STATES, useReplay, useVisionLinked, type LiveDetector, type Replay } from "@/client/vision";
import { CommonsMap } from "@/components/map/CommonsMap";
import { Logo } from "@/components/brand/Logo";

const LANE_COLOR = ["#2448db", "#8b3fd9", "#0e8f86"];
const ROLE_COLOR: Record<Role, string> = { other: "#9aa6bd", ordering: "#2448db", waiting: "#e0a21b", passer: "#c2410c", seated: "#12805a", companion: "#8b3fd9" };
const ROLE_LABEL: Record<Role, string> = { other: "사람", ordering: "주문 중", waiting: "대기", passer: "지나감", seated: "착석", companion: "동행" };
const STATE_COLOR = { occupied: "#a0533b", apparently_empty: "#12805a", uncertain: "#8b94a5" };
const STATE_LABEL = { occupied: "사용 중", apparently_empty: "비어 보임", uncertain: "판단 어려움" };
const REASON_LABEL: Record<string, string> = { person: "앉은 사람", bag_hold: "가방으로 맡음", brief_absence: "잠깐 자리 비움", tableware: "그릇·컵만 남음", occluded: "가려짐", empty: "단서 없음", warming_up: "관찰 시작" };
const ITEM_LABEL: Record<number, string> = { [COCO.backpack]: "가방", [COCO.handbag]: "가방", [COCO.suitcase]: "가방", [COCO.cup]: "컵", [COCO.bowl]: "그릇", [COCO.bottle]: "병", [COCO.laptop]: "노트북", [COCO.cellPhone]: "휴대폰", [COCO.book]: "책" };
const SCENE_TAB: Record<string, string> = { bank_oblique: "키오스크 줄 · 권장 카메라", bank: "키오스크 줄 · 정면 카메라", tables: "테이블", counter: "카운터 (실제 영상)" };

type Mode = "replay" | "live";

function fromReplay(f: Replay["frames"][number], scene: Scene): FrameOut {
  return {
    t: f.t,
    persons: f.p.map(([id, x, y, w, h, r, lane]) => ({ id, x, y, w, h, role: ROLES[r], lane })),
    items: f.i.map(([cls, x, y, w, h]) => ({ cls, x, y, w, h })),
    lanes: f.l.map(([u, e, wt, c, p], i) => ({ kioskId: scene.lanes[i]?.kioskId ?? "", inUse: u === 1, elapsed: e >= 0 ? e : null, waiting: wt, companions: c, passing: p })),
    tables: f.tb.map(([s, n, r], i) => ({ id: scene.tables[i]?.id ?? "", state: TABLE_STATES[s], persons: n, items: 0, reason: TABLE_REASONS[r] })),
  };
}

export default function OpsPage() {
  const [sceneId, setSceneId] = useState("bank_oblique");
  const scene = SCENES.find((s) => s.id === sceneId)!;
  const replay = useReplay(sceneId);
  const [mode, setMode] = useState<Mode>("replay");
  const [modelId, setModelId] = useState("yolox_nano");
  const [frame, setFrame] = useState<FrameOut | null>(null);
  const [liveStatus, setLiveStatus] = useState("");
  const linked = useVisionLinked();

  return (
    <div className="min-h-dvh bg-[#f3f4f7] text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <Logo size={26} />
            <div>
              <p className="text-[12px] font-semibold text-ink-3">운영 · AI 분석 (시연)</p>
              <h1 className="text-[18px] leading-tight font-bold">영상에서 줄과 자리를 읽는 과정</h1>
            </div>
          </div>
          <nav className="flex gap-2 text-[13.5px] font-semibold">
            <Link href="/" className="rounded-full border border-line px-3.5 py-1.5">체험 홈</Link>
            <Link href="/app" className="rounded-full border border-line px-3.5 py-1.5">학생 앱</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1320px] items-start gap-4 px-3 py-4 sm:px-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 rounded-2xl bg-white p-3 sm:p-4" aria-labelledby="stage-h">
          <h2 id="stage-h" className="sr-only">
            테스트 영상 분석
          </h2>
          <div className="flex flex-wrap gap-1 rounded-xl bg-[#f0f2f6] p-1" role="tablist" aria-label="영상 선택">
            {SCENES.map((s) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={sceneId === s.id}
                onClick={() => {
                  setSceneId(s.id);
                  setFrame(null);
                }}
                className={`rounded-lg px-3.5 py-1.5 text-[13.5px] font-semibold ${sceneId === s.id ? "bg-white text-navy shadow-sm" : "text-ink-2"}`}
              >
                {SCENE_TAB[s.id]}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            <b className="text-ink">{scene.kind === "semi_synthetic" ? "합성 테스트 영상" : "공개 테스트 영상"}</b> — {scene.standsFor}를 대신해요. 카메라: {scene.camera}. 실제 학교 CCTV가 아니에요.
          </p>

          <Stage key={`${sceneId}-${mode}-${modelId}`} scene={scene} replay={replay} mode={mode} modelId={modelId} onFrame={setFrame} onStatus={setLiveStatus} />

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
            <div className="flex gap-1 rounded-full bg-[#f0f2f6] p-1" role="radiogroup" aria-label="분석 방식">
              {(["replay", "live"] as const).map((m) => (
                <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`rounded-full px-3.5 py-1.5 font-semibold ${mode === m ? "bg-navy text-white" : "text-ink-2"}`}>
                  {m === "replay" ? "기록된 분석 재생" : "이 브라우저에서 직접 분석"}
                </button>
              ))}
            </div>
            {mode === "live" && (
              <label className="flex items-center gap-2">
                모델
                <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1">
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({(m.bytes / 1e6).toFixed(1)}MB)
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <p className="mt-2 flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-2" aria-live="polite">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${mode === "live" ? "bg-free" : "bg-blue"}`} aria-hidden />
            <span>{mode === "replay" ? (replay ? `${replay.model}, 서버 CPU에서 미리 분석한 결과를 영상과 맞춰 재생 (${replay.stats.inferenceMsMean}ms/프레임)` : "불러오는 중…") : liveStatus || "준비하는 중…"}</span>
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2" aria-label="범례">
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <li key={r} className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm border-2" style={{ borderColor: ROLE_COLOR[r] }} />
                {ROLE_LABEL[r]}
              </li>
            ))}
            <li>● 판정 기준점 ({scene.anchor === "top" ? "머리" : scene.anchor === "bottom" ? "발" : "몸 중심"})</li>
          </ul>
          <div className="mt-3 flex flex-col gap-3 rounded-xl bg-[#f5f6f9] p-3 sm:flex-row sm:items-center" aria-labelledby="link-h">
            <div className="min-w-0 flex-1">
              <h2 id="link-h" className="text-[14px] font-bold">
                학생 앱에 연결
              </h2>
              <p className="text-[12.5px] leading-relaxed text-ink-2">
                켜면 권장 카메라 영상의 줄 인원·이용 중 여부·이용 시간이 왼쪽 키오스크 3대에, 테이블 영상이 중앙 칸막이석 4개에 들어가요. 나머지는 시뮬레이션이에요.
              </p>
            </div>
            <button role="switch" aria-checked={linked} onClick={() => setVisionLinked(!linked)} className={`flex h-11 shrink-0 items-center justify-between gap-3 rounded-xl px-4 text-[14px] font-semibold sm:w-[200px] ${linked ? "bg-blue text-white" : "bg-white ring-1 ring-line"}`}>
              {linked ? "연결됨 (이 브라우저)" : "연결 안 됨"}
              <span className={`h-6 w-11 rounded-full p-0.5 ${linked ? "bg-white/30" : "bg-line-2"}`}>
                <span className={`block size-5 rounded-full bg-white transition-transform ${linked ? "translate-x-5" : ""}`} />
              </span>
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <Signals scene={scene} frame={frame} replay={replay} />
          <CameraView scene={scene} />
        </aside>

        <Evaluation />
        <PredictionEval />
      </main>
    </div>
  );
}

function Stage({ scene, replay, mode, modelId, onFrame, onStatus }: { scene: Scene; replay: Replay | null; mode: Mode; modelId: string; onFrame: (f: FrameOut) => void; onStatus: (s: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const W = 960;
  const H = 540;

  useEffect(() => {
    const v = video.current!;
    const ctx = canvas.current!.getContext("2d")!;
    let raf = 0;
    let stopped = false;
    let det: LiveDetector | null = null;
    let busy = false;
    let lastRun = -1;
    let analyzer = new SceneAnalyzer(scene, W, H);
    let lastT = 0;
    let latest: FrameOut | null = null;
    const ms: number[] = [];
    const poly = (pts: [number, number][]) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
      ctx.closePath();
    };
    // every label claims a rectangle; later labels try other spots or are skipped (box colour still tells the role)
    let placed: { x: number; y: number; w: number; h: number }[] = [];
    const free = (r: { x: number; y: number; w: number; h: number }) =>
      r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H && placed.every((q) => r.x + r.w + 2 <= q.x || q.x + q.w + 2 <= r.x || r.y + r.h + 2 <= q.y || q.y + q.h + 2 <= r.y);
    // keep labels legible when the 960px canvas is shown small (phones): grow them in canvas units
    let k = 1;
    const tag = (text: string, x: number, y: number, bg: string) => {
      ctx.font = `700 ${14 * k}px 'Pretendard Variable', sans-serif`;
      const tw = ctx.measureText(text).width;
      const w = tw + 16 * k;
      const h = 24 * k;
      const spots = [0, -1.15, 1.15, -2.3, 2.3].map((m) => ({ x: Math.min(W - w, Math.max(0, x - w / 2)), y: y - h / 2 + m * h, w, h }));
      const r = spots.find(free);
      if (!r) return;
      placed.push(r);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, w, h, h / 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(text, r.x + 8 * k, r.y + h * 0.7);
    };

    // centroid count labels (Supervision-style zone annotation)
    const drawZoneTags = (f: FrameOut | null) => {
      scene.lanes.forEach((l, i) => {
        const lo = f?.lanes[i];
        const [cx, cy] = centroid(l.queue);
        tag(`${l.kioskId} 대기 ${lo?.waiting ?? 0}`, cx * W, cy * H, LANE_COLOR[i % LANE_COLOR.length]);
        const [sx, sy] = centroid(l.service);
        if (lo?.inUse) tag(`${l.kioskId} 주문 중 ${Math.round(lo.elapsed ?? 0)}초`, sx * W, sy * H + 22, "#0b1f4d");
      });
      scene.tables.forEach((t, i) => {
        const tt = f?.tables[i];
        const [cx, cy] = centroid(t.poly);
        tag(`${t.label} ${tt ? STATE_LABEL[tt.state] : "…"}`, cx * W, cy * H, tt ? STATE_COLOR[tt.state] : "#8b94a5");
      });
    };

    const draw = (f: FrameOut | null) => {
      ctx.clearRect(0, 0, W, H);
      placed = [];
      const shown = canvas.current?.clientWidth || W;
      k = Math.min(2.2, Math.max(1, (W / shown) * 0.8));
      scene.lanes.forEach((l, i) => {
        const c = LANE_COLOR[i % LANE_COLOR.length];
        poly(l.queue);
        ctx.fillStyle = c + "1f";
        ctx.strokeStyle = c;
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.fill();
        ctx.stroke();
        poly(l.service);
        ctx.setLineDash([]);
        ctx.fillStyle = c + "33";
        ctx.fill();
        ctx.stroke();
      });
      scene.tables.forEach((t, i) => {
        const st = f?.tables[i]?.state;
        poly(t.poly);
        const c = st ? STATE_COLOR[st] : "#8b94a5";
        ctx.fillStyle = c + "26";
        ctx.strokeStyle = c;
        ctx.lineWidth = 2.5;
        ctx.fill();
        ctx.stroke();
      });
      if (f) {
        const pending: (() => void)[] = [];
        for (const it of f.items) {
          ctx.strokeStyle = "#f2b705";
          ctx.lineWidth = 2;
          ctx.strokeRect(it.x, it.y, it.w, it.h);
          ctx.fillStyle = "#f2b705";
          ctx.font = "600 12px 'Pretendard Variable', sans-serif";
          ctx.fillText(ITEM_LABEL[it.cls] ?? "물건", it.x + 2, it.y - 4);
        }
        for (const p of f.persons) {
          const c = ROLE_COLOR[p.role];
          ctx.strokeStyle = c;
          ctx.lineWidth = 2.5;
          ctx.strokeRect(p.x, p.y, p.w, p.h);
          const label = `${ROLE_LABEL[p.role]}`;
          pending.push(() => {
            ctx.font = `700 ${12 * k}px 'Pretendard Variable', sans-serif`;
            const lw = ctx.measureText(label).width + 8 * k;
            const lh = 17 * k;
            const spot = [
              { x: p.x, y: p.y - lh, w: lw, h: lh },
              { x: p.x, y: p.y + 2, w: lw, h: lh },
              { x: p.x, y: p.y + p.h + 2, w: lw, h: lh },
            ].find(free);
            if (spot) {
              placed.push(spot);
              ctx.fillStyle = c;
              ctx.fillRect(spot.x, spot.y, lw, lh);
              ctx.fillStyle = "#fff";
              ctx.fillText(label, spot.x + 4 * k, spot.y + lh * 0.74);
            }
          });
          const ay = scene.anchor === "top" ? p.y : scene.anchor === "bottom" ? p.y + p.h : p.y + p.h / 2;
          ctx.beginPath();
          ctx.arc(p.x + p.w / 2, ay, 4, 0, Math.PI * 2);
          ctx.fillStyle = c;
          ctx.fill();
        }
        // zone summaries claim space first (they matter most), then per-person labels fill the gaps
        drawZoneTags(f);
        pending.forEach((fn) => fn());
      } else drawZoneTags(null);
    };

    const tick = async () => {
      if (stopped) return;
      const t = v.currentTime;
      if (t + 0.5 < lastT) analyzer = new SceneAnalyzer(scene, W, H);
      lastT = t;
      if (mode === "replay" && replay) {
        latest = fromReplay(frameAt(replay, t), scene);
        onFrame(latest);
      } else if (mode === "live" && det && !busy && v.readyState >= 2 && Math.abs(t - lastRun) >= 0.2) {
        busy = true;
        lastRun = t;
        try {
          const r = await det.detect(v, W, H);
          ms.push(r.ms);
          if (ms.length > 30) ms.shift();
          latest = analyzer.step(r.dets, t);
          onFrame(latest);
          onStatus(`${det.modelId}, ${det.backend === "webgpu" ? "WebGPU" : `WASM ${det.threads}스레드`}, 이 기기에서 ${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(0)}ms/프레임 · ${det.choice.reason}`);
        } finally {
          busy = false;
        }
      }
      draw(latest);
      raf = requestAnimationFrame(tick);
    };
    v.play().catch(() => {});
    (async () => {
      if (mode === "live") {
        onStatus("모델을 내려받고 준비하는 중…");
        try {
          det = await createLiveDetector(modelId, (m) => !stopped && onStatus(m));
          onStatus(`${det.modelId} 준비됨 · ${det.choice.reason}`);
        } catch (e) {
          onStatus(`이 브라우저에서는 직접 분석을 시작하지 못했어요. 기록된 분석 재생을 쓰세요. (${(e as Error).message?.slice(0, 60)})`);
        }
      }
      raf = requestAnimationFrame(tick);
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      det?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, replay, mode, modelId]);

  return (
    <div className="relative mt-3 overflow-hidden rounded-xl bg-black">
      <video ref={video} className="block aspect-video w-full" muted loop playsInline controls preload="auto" aria-label={`${scene.title} 테스트 영상`}>
        <source src={scene.file.replace(".mp4", ".webm")} type="video/webm" />
        <source src={scene.file} type="video/mp4" />
      </video>
      <canvas ref={canvas} width={960} height={540} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />
      <p className="absolute right-2 bottom-12 max-w-[70%] truncate rounded bg-black/55 px-2 py-0.5 text-[11px] text-white/85">{scene.attribution}, {scene.license}</p>
    </div>
  );
}

function Signals({ scene, frame, replay }: { scene: Scene; frame: FrameOut | null; replay: Replay | null }) {
  return (
    <section className="rounded-2xl bg-white p-4" aria-labelledby="sig-h" aria-live="polite">
      <h2 id="sig-h" className="text-[15px] font-bold">
        학생 앱으로 보내는 값
      </h2>
      <p className="text-[12.5px] text-ink-3">영상과 사람 정보는 보내지 않고 아래 집계만 써요.</p>
      {!frame ? (
        <p className="mt-3 text-ink-3">영상 재생을 기다리는 중…</p>
      ) : scene.lanes.length ? (
        <ul className="mt-3 space-y-2">
          {scene.lanes.map((l, i) => {
            const lo = frame.lanes[i];
            const samples = (replay?.sessions ?? []).filter((s) => s.lane === i && s.end <= frame.t).slice(-4).map((s) => Math.round(s.end - s.start));
            return (
              <li key={l.kioskId} className="rounded-xl border-l-4 bg-[#f6f7f9] px-3 py-2.5" style={{ borderColor: LANE_COLOR[i % LANE_COLOR.length] }}>
                <div className="flex items-baseline justify-between">
                  <p className="text-[13.5px] font-bold">
                    {l.kioskId} {l.label}
                  </p>
                  <p className="num text-[13px] font-semibold">{lo?.inUse ? `주문 중 ${Math.round(lo.elapsed ?? 0)}초` : "비어 있음"}</p>
                </div>
                <p className="num mt-0.5 text-[13px] text-ink-2">
                  대기 <b className="text-ink">{lo?.waiting ?? 0}명</b>, 동행 {lo?.companions ?? 0}, 지나감 {lo?.passing ?? 0} (대기에서 제외)
                </p>
                {samples.length > 0 && <p className="num mt-0.5 text-[12.5px] text-ink-3">측정된 이용 시간 {samples.join(", ")}초 → 처리 속도 계산에 사용</p>}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {scene.tables.map((t, i) => {
            const tt = frame.tables[i];
            return (
              <li key={t.id} className="rounded-xl border-l-4 bg-[#f6f7f9] px-3 py-2" style={{ borderColor: STATE_COLOR[tt?.state ?? "uncertain"] }}>
                <p className="text-[12.5px] text-ink-3">
                  {t.label} · {t.kind === "quad" ? "4인 테이블" : "1인석"}
                </p>
                <p className="text-[14.5px] font-bold">{tt ? STATE_LABEL[tt.state] : "…"}</p>
                <p className="text-[12px] text-ink-3">{tt ? REASON_LABEL[tt.reason] : ""}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Student map viewpoint vs. assumed camera viewpoint — explained on a top-down plan. */
function CameraView({ scene }: { scene: Scene }) {
  const world = useMemo(() => worldAt(getEngine("2026-11-24", "peak"), { dateKey: "2026-11-24", tSec: 12 * 3600 + 22 * 60, realTime: false }), []);
  const cams: Record<string, { at: [number, number]; to: [number, number]; spread: number }> = {
    bank: { at: [-0.8, 6.0], to: [-12, 6.0], spread: 0.5 },
    bank_oblique: { at: [-1.4, 12.4], to: [-11, 1.5], spread: 0.45 },
  };
  const cam = cams[scene.id];
  return (
    <section className="rounded-2xl bg-white p-4" aria-labelledby="cam-h">
      <h2 id="cam-h" className="text-[15px] font-bold">
        학생 지도 시점과 카메라 시점
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">학생 앱은 정문에서 안쪽을 보는 시점이에요. AI 카메라는 다른 곳에서 줄을 봐요. 아래 카메라 위치는 가정이고 실제 설치 위치는 정해지지 않았어요.</p>
      <div className="mt-2 overflow-hidden rounded-xl border border-line">
        <CommonsMap
          kiosks={world.kiosks}
          pitch={90}
          width={360}
          height={260}
          interactive={false}
          hideLabels
          overlay={(P) => {
            if (!cam) return null;
            const a = P([cam.at[0], cam.at[1], 0]);
            const dir = [cam.to[0] - cam.at[0], cam.to[1] - cam.at[1]];
            const len = Math.hypot(dir[0], dir[1]);
            const ux = dir[0] / len;
            const uy = dir[1] / len;
            const rot = (s: number): [number, number] => [ux * Math.cos(s) - uy * Math.sin(s), ux * Math.sin(s) + uy * Math.cos(s)];
            const [l1, l2] = rot(cam.spread);
            const [r1, r2] = rot(-cam.spread);
            const L = P([cam.at[0] + l1 * 9, cam.at[1] + l2 * 9, 0]);
            const R = P([cam.at[0] + r1 * 9, cam.at[1] + r2 * 9, 0]);
            return (
              <g>
                <path d={`M${a.x},${a.y}L${L.x},${L.y}L${R.x},${R.y}Z`} fill="rgba(36,72,219,.14)" stroke="#2448db" strokeDasharray="4 3" />
                <circle cx={a.x} cy={a.y} r={6} fill="#2448db" stroke="#fff" strokeWidth={2} />
                <text x={a.x + 10} y={a.y + 16} fontSize={11} fontWeight={700} fill="#2448db">
                  카메라 (가정)
                </text>
              </g>
            );
          }}
        />
      </div>
      {!cam && <p className="mt-2 text-[12.5px] text-ink-3">이 영상은 공개 영상의 원래 시점이라 지도 위 위치가 없어요.</p>}
    </section>
  );
}

function Evaluation() {
  type R = (typeof evalReport.results)[number];
  const rows = evalReport.results as R[];
  const nano = rows.find((r) => r.model === "yolox_nano")!;
  const v1 = (evalV1 as { results: { model: string; tables: { confusion: Record<string, number> } }[] }).results.find((r) => r.model === "yolox_nano")!;
  const b = nano.bank as Record<string, { waitingCountMAEAll: number; orderingAccuracy: number[]; servicesMatched: number; servicesTrue: number; serviceDurationMAEsec: number; overcountShare: number; inferenceMsMean: number }>;
  return (
    <section className="rounded-2xl bg-white p-5 xl:col-span-2" aria-labelledby="ev-h">
      <h2 id="ev-h" className="text-[17px] font-bold">
        인식 검증 결과
      </h2>
      <p className="mt-1 text-[12.5px] text-ink-3">
        정답: 합성 영상은 생성 프로그램이 기록한 정확한 정답, 공개 영상은 Claude Code가 육안으로 단 라벨(사람 검수 필요). 분석 {evalReport.analysisFps}fps, {evalReport.runtime}. 실제 1947 COMMONS 정확도가 아니에요.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div>
          <h3 className="text-[14px] font-bold">카메라 위치 비교 (같은 사람들, 키오스크 3대)</h3>
          <table className="num mt-2 w-full text-[13px]">
            <thead className="text-left text-[12px] text-ink-3">
              <tr>
                <th className="py-1 font-medium" />
                <th className="py-1 font-medium">정면</th>
                <th className="py-1 font-medium">비스듬히 (권장)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <td className="py-1.5">대기 인원 오차</td>
                <td>{b.bank.waitingCountMAEAll}명</td>
                <td className="font-bold">{b.bank_oblique.waitingCountMAEAll}명</td>
              </tr>
              <tr className="border-t border-line">
                <td className="py-1.5">가운데 줄 주문 중 판정</td>
                <td>{Math.round(b.bank.orderingAccuracy[1] * 100)}%</td>
                <td className="font-bold">{Math.round(b.bank_oblique.orderingAccuracy[1] * 100)}%</td>
              </tr>
              <tr className="border-t border-line">
                <td className="py-1.5">이용 기록 찾음</td>
                <td>
                  {b.bank.servicesMatched}/{b.bank.servicesTrue}
                </td>
                <td className="font-bold">
                  {b.bank_oblique.servicesMatched}/{b.bank_oblique.servicesTrue}
                </td>
              </tr>
              <tr className="border-t border-line">
                <td className="py-1.5">이용 시간 오차</td>
                <td>{b.bank.serviceDurationMAEsec}초</td>
                <td className="font-bold">{b.bank_oblique.serviceDurationMAEsec}초</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[12.5px] text-ink-2">줄과 나란히 정면에서 보면 앞사람이 뒷사람을 가려 한 명으로 합쳐져요. 줄을 옆에서 비스듬히 보는 위치가 더 정확했어요.</p>
        </div>
        <div>
          <h3 className="text-[14px] font-bold">자리 판정 (테이블 4개 영상)</h3>
          <p className="num mt-2 text-[13px] text-ink-2">
            이용할 수 없는 자리를 빈자리로 잘못 보여 준 경우 <b className="text-ink">{nano.tables.availability.shownAvailableWrongly}/{nano.tables.availability.notAvailableFrames}칸</b>
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">
            v1에서 “빈자리 0/8”로 보였던 8칸은 다시 확인해 보니, 앉아 있던 사람이 테이블 바로 옆에 서 있거나 노트북을 두고 잠깐 일어난 장면이었어요. 이 영상에는 실제로 비워진 테이블이 없어서 ‘빈자리를 찾아내는 능력’은 이 영상으로 확인할 수 없어요. 대신 v2는 실제로 비워진 자리를 약 4초 안에 빈자리로 바꾸고, 가방은 ‘맡은 자리’, 그릇만 남으면 ‘판단 어려움’, 지나가는 사람에 가려지면 이전 상태 유지를 단위 테스트로 검증했어요.
          </p>
          <p className="num mt-2 text-[12px] text-ink-3">v1 착석 기준 혼동: 사용 중→빈자리 {v1.tables.confusion.occ_empty}, 빈자리→빈자리 {v1.tables.confusion.empty_empty}</p>
        </div>
        <div>
          <h3 className="text-[14px] font-bold">모델과 속도</h3>
          <ul className="mt-2 space-y-2 text-[13px]">
            {rows.map((r) => (
              <li key={r.model} className="rounded-xl bg-[#f6f7f9] px-3 py-2">
                <p className="font-bold">
                  {MODELS.find((m) => m.id === r.model)?.name} {r.model === "yolox_nano" && <span className="ml-1 rounded bg-ice px-1.5 py-0.5 text-[11px] text-blue-ink">기본</span>}
                </p>
                <p className="num text-ink-2">
                  {r.license}, {r.sizeMB}MB, 서버 CPU {r.counter.inferenceMsMean}ms/프레임, 카운터 이용 판정 {(r.counter.inUseAccuracy * 100).toFixed(1)}%, 권장 카메라 대기 오차{" "}
                  {(r.bank as typeof b).bank_oblique.waitingCountMAEAll}명
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12.5px] text-ink-2">Tiny가 일부 지표에서 조금 낫지만 2.5–3배 느리고 5.5배 커서 휴대폰 브라우저용 기본은 Nano예요.</p>
        </div>
      </div>
    </section>
  );
}

function PredictionEval() {
  const [r, setR] = useState<EvaluationReport | null>(null);
  const scenario = useMemo(() => (typeof window === "undefined" ? "peak" : currentScenario()), []);
  useEffect(() => {
    const id = setTimeout(() => setR(evaluate(demoClock(Date.now()).dateKey, scenario)), 50);
    return () => clearTimeout(id);
  }, [scenario]);
  const engine = useMemo(() => (r ? getEngine(demoClock(Date.now()).dateKey, scenario) : null), [r, scenario]);
  return (
    <section className="rounded-2xl bg-white p-5 xl:col-span-2" aria-labelledby="pred-h">
      <h2 id="pred-h" className="text-[17px] font-bold">
        예측 모델 검증 (이 브라우저에서 지금 계산)
      </h2>
      <p className="mt-1 text-[12.5px] text-ink-3">시뮬레이션 기록 6일 중 앞 4일로 학습, 뒤 2일로 검증. 실제 학식 정확도가 아니에요.</p>
      {!r ? (
        <p className="mt-3 text-ink-3">검증 계산 중…</p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div>
            <h3 className="text-[14px] font-bold">키오스크 대기시간</h3>
            <p className="num mt-1 text-[22px] font-bold">
              {Math.round(r.eta.maeModelSec)}초 <span className="text-[13px] font-medium text-ink-3">vs 인원만 {Math.round(r.eta.maeBaselineSec)}초</span>
            </p>
            <p className="num text-[13px] text-ink-2">
              {r.eta.n}건, 범위 적중 {(r.eta.coverage * 100).toFixed(0)}%. 줄이 더 짧은데 더 오래 걸린 비교 쌍 {(r.eta.shorterLineSlowerShare * 100).toFixed(0)}%.
            </p>
          </div>
          <div>
            <h3 className="text-[14px] font-bold">메뉴 준비시간</h3>
            <p className="num mt-1 text-[22px] font-bold">
              {Math.round(r.prep.maeModelSec)}초 <span className="text-[13px] font-medium text-ink-3">vs 메뉴 평균만 {Math.round(r.prep.maeBaselineSec)}초</span>
            </p>
            <p className="num text-[13px] text-ink-2">
              {r.prep.n}건, 범위 적중 {(r.prep.coverage * 100).toFixed(0)}%. 실제 완료는 직원이 누를 때만 표시해요.
            </p>
          </div>
          <div>
            <h3 className="text-[14px] font-bold">5–15분 혼잡 예측</h3>
            {engine?.linesForecast.sufficient ? (
              <ul className="num mt-1 space-y-0.5 text-[13px]">
                {engine.linesForecast.evals.map((e) => (
                  <li key={e.horizonSec}>
                    {e.horizonSec / 60}분 뒤: {METHOD_LABEL[e.best]} {e.mae[e.best].toFixed(1)}명 (현재값 유지 {e.mae.persistence.toFixed(1)}명)
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[13px] text-ink-2">기록이 부족해 예측하지 않아요.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
