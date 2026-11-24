"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import evalReport from "../../../docs/ai/evaluation/vision-latest.json";
import { SceneAnalyzer, type FrameOut } from "@/core/vision/analysis";
import { COCO, MODELS } from "@/core/vision/detector";
import { SCENES, type Scene } from "@/core/vision/scenes";
import { evaluate, type EvaluationReport } from "@/core/predict/evaluate";
import { METHOD_LABEL } from "@/core/predict/forecast";
import { demoClock, getEngine } from "@/core/world";
import { currentScenario } from "@/client/session";
import { createLiveDetector, frameAt, ROLE_NAMES, setVisionLinked, TABLE_STATES, useReplay, useVisionLinked, type LiveDetector, type Replay } from "@/client/vision";

const ROLE_COLOR: Record<string, string> = { other: "#9aa6bd", service: "#2160e0", queue: "#e0a21b", passer: "#c2410c", seated: "#12805a" };
const ROLE_LABEL: Record<string, string> = { other: "사람", service: "이용 중", queue: "대기", passer: "지나감", seated: "착석" };
const STATE_COLOR = { occupied: "#a0533b", apparently_empty: "#12805a", uncertain: "#8b94a5" };
const STATE_LABEL = { occupied: "사용 중", apparently_empty: "비어 보임", uncertain: "판단 어려움" };
const ITEM_LABEL: Record<number, string> = { [COCO.backpack]: "가방", [COCO.handbag]: "가방", [COCO.suitcase]: "가방", [COCO.cup]: "컵", [COCO.bowl]: "그릇", [COCO.bottle]: "병", [COCO.laptop]: "노트북", [COCO.cellPhone]: "휴대폰", [COCO.book]: "책" };

type Mode = "replay" | "live";

/** Normalised replay frame → the same shape the live analyzer produces. */
function fromReplay(f: Replay["frames"][number], scene: Scene): FrameOut {
  const tables = scene.zones.filter((z) => z.type === "table");
  return {
    t: f.t,
    persons: f.p.map(([id, x, y, w, h, r]) => ({ id, x, y, w, h, role: ROLE_NAMES[r] })),
    items: f.i.map(([cls, x, y, w, h]) => ({ cls, x, y, w, h })),
    service: f.s ? { inUse: f.s[0] === 1, elapsed: f.s[1] >= 0 ? f.s[1] : null } : undefined,
    queue: f.q ? { waiting: f.q[0], passing: f.q[1] } : undefined,
    tables: f.tb ? f.tb.map((s, i) => ({ id: tables[i].id, state: TABLE_STATES[s], persons: 0, items: 0 })) : undefined,
  };
}

export default function OpsPage() {
  const [sceneId, setSceneId] = useState(SCENES[0].id);
  const scene = SCENES.find((s) => s.id === sceneId)!;
  const replay = useReplay(sceneId);
  const [mode, setMode] = useState<Mode>("replay");
  const [modelId, setModelId] = useState("yolox_nano");
  const [frame, setFrame] = useState<FrameOut | null>(null);
  const [live, setLive] = useState<{ det: LiveDetector | null; status: string; ms: number[] }>({ det: null, status: "", ms: [] });
  const linked = useVisionLinked();

  return (
    <div className="min-h-dvh bg-floor">
      <header className="bg-navy px-6 py-5 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] opacity-80">FLOWEAT 운영·AI 분석 (시연용)</p>
            <h1 className="text-[26px] leading-tight font-bold">영상에서 줄과 자리를 읽는 과정</h1>
          </div>
          <nav className="flex gap-2 text-[14px]">
            <Link href="/demo" className="rounded-full border border-white/30 px-4 py-2">시연 허브</Link>
            <Link href="/" className="rounded-full border border-white/30 px-4 py-2">학생 화면</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 xl:grid-cols-[1fr_380px]">
        <section className="rounded-[var(--radius-card)] bg-surface p-4" aria-labelledby="stage-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="stage-h" className="text-[17px] font-bold">
              테스트 영상 분석
            </h2>
            <div className="flex gap-1 rounded-full bg-floor p-1" role="tablist" aria-label="영상 선택">
              {SCENES.map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={sceneId === s.id}
                  onClick={() => {
                    setSceneId(s.id);
                    setFrame(null);
                  }}
                  className={`rounded-full px-4 py-1.5 text-[14px] font-semibold ${sceneId === s.id ? "bg-surface text-navy shadow-sm" : "text-ink-2"}`}
                >
                  {s.id === "counter" ? "키오스크 앞" : "테이블"}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-1 text-[13.5px] text-ink-2">
            {scene.title} — 1947 COMMONS의 {scene.standsFor}를 대신하는 공개 테스트 영상이에요. 실제 학교 CCTV가 아니에요.
          </p>

          <Stage key={`${sceneId}-${mode}-${modelId}`} scene={scene} replay={replay} mode={mode} modelId={modelId} onFrame={setFrame} onLive={setLive} />

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[13.5px]">
            <div className="flex gap-1 rounded-full bg-floor p-1" role="radiogroup" aria-label="분석 방식">
              {(["replay", "live"] as const).map((m) => (
                <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={`rounded-full px-4 py-1.5 font-semibold ${mode === m ? "bg-navy text-white" : "text-ink-2"}`}>
                  {m === "replay" ? "기록된 분석 재생" : "이 브라우저에서 직접 분석"}
                </button>
              ))}
            </div>
            {mode === "live" && (
              <label className="flex items-center gap-2">
                모델
                <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1">
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({(m.bytes / 1e6).toFixed(1)}MB)
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span className="text-ink-3">
              {mode === "replay"
                ? replay
                  ? `${replay.model} · 서버 CPU에서 미리 분석 (프레임당 ${replay.stats.inferenceMsMean}ms)`
                  : "불러오는 중…"
                : live.status}
            </span>
          </div>
          <Legend />
        </section>

        <aside className="space-y-4">
          <SignalPanel scene={scene} frame={frame} replay={replay} />
          <section className="rounded-[var(--radius-card)] bg-surface p-5" aria-labelledby="link-h">
            <h2 id="link-h" className="text-[16px] font-bold">
              학생 화면에 연결
            </h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
              켜면 키오스크 앞 영상의 분석값이 ‘왼쪽 가운데’ 키오스크에, 테이블 영상이 ‘중앙 칸막이석’ 4개 테이블에 들어가요. 나머지는 시뮬레이션이에요.
            </p>
            <button
              role="switch"
              aria-checked={linked}
              onClick={() => setVisionLinked(!linked)}
              className={`mt-3 flex h-11 w-full items-center justify-between rounded-xl px-4 text-[15px] font-semibold ${linked ? "bg-blue text-white" : "bg-floor"}`}
            >
              {linked ? "연결됨 (이 브라우저)" : "연결 안 됨"}
              <span className={`h-6 w-11 rounded-full p-0.5 ${linked ? "bg-white/30" : "bg-line-2"}`}>
                <span className={`block size-5 rounded-full bg-white transition-transform ${linked ? "translate-x-5" : ""}`} />
              </span>
            </button>
          </section>
        </aside>

        <ModelComparison />
        <PredictionEval />
      </main>
    </div>
  );
}

function Stage({
  scene,
  replay,
  mode,
  modelId,
  onFrame,
  onLive,
}: {
  scene: Scene;
  replay: Replay | null;
  mode: Mode;
  modelId: string;
  onFrame: (f: FrameOut) => void;
  onLive: (s: { det: LiveDetector | null; status: string; ms: number[] }) => void;
}) {
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

    const draw = (f: FrameOut | null) => {
      ctx.clearRect(0, 0, W, H);
      for (const z of scene.zones) {
        const st = f?.tables?.find((t) => t.id === z.id)?.state;
        ctx.beginPath();
        z.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
        ctx.closePath();
        const color = z.type === "service" ? "#2160e0" : z.type === "queue" ? "#e0a21b" : st ? STATE_COLOR[st] : "#8b94a5";
        ctx.fillStyle = color + "26";
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash(z.type === "table" ? [] : [8, 6]);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        const [lx, ly] = z.poly[0];
        const label = z.type === "table" ? `${z.label} · ${st ? STATE_LABEL[st] : "…"}` : z.label;
        ctx.font = "600 15px 'Pretendard Variable', sans-serif";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = color;
        ctx.fillRect(lx * W + 4, ly * H + 4, tw + 12, 22);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, lx * W + 10, ly * H + 20);
      }
      if (!f) return;
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
        ctx.lineWidth = 3;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        const label = `#${p.id} ${ROLE_LABEL[p.role]}`;
        ctx.font = "700 13px 'Pretendard Variable', sans-serif";
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = c;
        ctx.fillRect(p.x, p.y - 20, tw + 10, 20);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, p.x + 5, p.y - 5);
        // foot point used for zone tests
        ctx.beginPath();
        ctx.arc(p.x + p.w / 2, p.y + p.h, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const tick = async () => {
      if (stopped) return;
      const t = v.currentTime;
      if (t + 0.5 < lastT) analyzer = new SceneAnalyzer(scene, W, H); // looped
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
          const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
          onLive({ det, status: `${det.modelId} · ${det.backend === "webgpu" ? "WebGPU" : `WASM ${det.threads}스레드`} · 프레임당 ${avg.toFixed(0)}ms (이 기기에서 측정)`, ms: [...ms] });
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
        onLive({ det: null, status: "모델을 내려받고 준비하는 중…", ms: [] });
        try {
          det = await createLiveDetector(modelId);
          onLive({ det, status: `${det.modelId} 준비됨 (${det.backend === "webgpu" ? "WebGPU" : "WASM"})`, ms: [] });
        } catch (e) {
          onLive({ det: null, status: `이 브라우저에서는 직접 분석을 시작하지 못했어요. 기록된 분석 재생을 사용하세요. (${(e as Error).message?.slice(0, 80)})`, ms: [] });
        }
      }
      v.play().catch(() => {});
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
    <div className="relative mt-3 overflow-hidden rounded-2xl bg-black">
      <video ref={video} className="block aspect-video w-full" muted loop playsInline controls preload="auto" aria-label={`${scene.title} 테스트 영상`}>
        <source src={scene.file.replace(".mp4", ".webm")} type="video/webm" />
        <source src={scene.file} type="video/mp4" />
      </video>
      <canvas ref={canvas} width={960} height={540} className="pointer-events-none absolute inset-0 h-[calc(100%-0px)] w-full" aria-hidden />
      <p className="absolute right-2 bottom-12 rounded bg-black/55 px-2 py-0.5 text-[11px] text-white/85">
        {scene.attribution} · {scene.license}
      </p>
    </div>
  );
}

function Legend() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2" aria-label="표시 범례">
      {Object.entries(ROLE_LABEL).map(([k, v]) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border-2" style={{ borderColor: ROLE_COLOR[k] }} />
          {v}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm border-2 border-[#f2b705]" />
        물건 단서
      </li>
      <li>점선 = 이용·대기 구역, 실선 = 테이블</li>
    </ul>
  );
}

function SignalPanel({ scene, frame, replay }: { scene: Scene; frame: FrameOut | null; replay: Replay | null }) {
  return (
    <section className="rounded-[var(--radius-card)] bg-surface p-5" aria-labelledby="sig-h" aria-live="polite">
      <h2 id="sig-h" className="text-[16px] font-bold">
        학생 화면으로 보내는 값
      </h2>
      <p className="text-[12.5px] text-ink-3">영상은 보내지 않고, 아래 집계값만 써요.</p>
      {!frame ? (
        <p className="mt-4 text-ink-3">영상 재생을 기다리는 중…</p>
      ) : scene.id === "counter" ? (
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="키오스크" value={frame.service?.inUse ? "이용 중" : "비어 있음"} sub={frame.service?.elapsed != null ? `${Math.round(frame.service.elapsed)}초째` : " "} />
          <Stat label="대기 인원" value={`${frame.queue?.waiting ?? 0}명`} sub={`지나간 사람 ${frame.queue?.passing ?? 0}명 제외`} />
          <div className="col-span-2">
            <dt className="text-[13px] text-ink-3">측정된 이용 시간 (처리 속도 계산에 쓰임)</dt>
            <dd className="num mt-1 flex flex-wrap gap-1.5 text-[14px]">
              {(replay?.sessions ?? []).filter((s) => s.end <= frame.t).map((s, i) => (
                <span key={i} className="rounded-full bg-floor px-2.5 py-0.5">
                  {(s.end - s.start).toFixed(0)}초
                </span>
              ))}
            </dd>
          </div>
        </dl>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {(frame.tables ?? []).map((t) => {
            const z = scene.zones.find((x) => x.id === t.id)!;
            return (
              <li key={t.id} className="rounded-xl border-l-4 bg-floor px-3 py-2" style={{ borderColor: STATE_COLOR[t.state] }}>
                <p className="text-[13px] text-ink-3">{z.label}</p>
                <p className="text-[15px] font-bold">{STATE_LABEL[t.state]}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="text-[22px] font-bold">{value}</dd>
      <dd className="text-[12.5px] text-ink-3">{sub}</dd>
    </div>
  );
}

function ModelComparison() {
  type R = (typeof evalReport.results)[number];
  const rows = evalReport.results as R[];
  return (
    <section className="rounded-[var(--radius-card)] bg-surface p-5 xl:col-span-2" aria-labelledby="cmp-h">
      <h2 id="cmp-h" className="text-[17px] font-bold">
        모델 비교 (테스트 영상, 수작업 라벨 기준)
      </h2>
      <p className="mt-1 text-[13px] text-ink-3">
        라벨: 2초 간격 프레임을 Claude Code가 육안으로 표시 (사람 검수 필요). 분석 {evalReport.analysisFps}fps, {evalReport.runtime}. 실제 학식 현장 정확도가 아니에요.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="num w-full min-w-[720px] text-left text-[14px]">
          <thead className="text-[12.5px] text-ink-3">
            <tr className="border-b border-line">
              <th className="py-2 pr-3 font-semibold">모델</th>
              <th className="py-2 pr-3 font-semibold">라이선스 · 크기</th>
              <th className="py-2 pr-3 font-semibold">키오스크 이용 판정 정확도</th>
              <th className="py-2 pr-3 font-semibold">사람 수 MAE</th>
              <th className="py-2 pr-3 font-semibold">이용 시간 오차</th>
              <th className="py-2 pr-3 font-semibold">사용 중 → 빈자리 오표시</th>
              <th className="py-2 font-semibold">CPU 추론 (프레임)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.model} className="border-b border-line last:border-0">
                <td className="py-2.5 pr-3 font-semibold">{MODELS.find((m) => m.id === r.model)?.name}{r.model === "yolox_nano" && <span className="ml-1.5 rounded bg-ice px-1.5 py-0.5 text-[11.5px] text-blue-ink">기본</span>}</td>
                <td className="py-2.5 pr-3">{r.license} · {r.sizeMB}MB</td>
                <td className="py-2.5 pr-3">{(r.counter.inUseAccuracy * 100).toFixed(1)}% <span className="text-ink-3">({r.counter.labelledFrames}프레임)</span></td>
                <td className="py-2.5 pr-3">{r.counter.personCountMAE}</td>
                <td className="py-2.5 pr-3">±{r.counter.sessionDurationMAEsec}초 <span className="text-ink-3">({r.counter.sessionsMatched}/{r.counter.sessionsTrue}회)</span></td>
                <td className="py-2.5 pr-3">{(r.tables.occupiedShownEmptyRate * 100).toFixed(0)}% <span className="text-ink-3">({r.tables.labelledTableFrames}칸)</span></td>
                <td className="py-2.5">{r.counter.inferenceMsMean}–{r.tables.inferenceMsMean}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[13px] text-ink-2">
        YOLOX-Nano를 기본으로 골랐어요. 정확도는 Tiny와 같거나 조금 높고, 크기는 5.5배 작고 2배 이상 빨라 휴대폰 브라우저에서도 돌릴 수 있어요. 둘 다 Apache-2.0이라 가중치를 함께 배포할 수 있어요. 비어 있던 테이블 8칸 중 4칸은 ‘판단 어려움’, 4칸은 8초 유지 규칙 때문에 ‘사용 중’으로 남았어요 — 잠깐 일어난 사람의 자리를 빈자리로 보이지 않게 한 의도된 동작이에요.
      </p>
    </section>
  );
}

function PredictionEval() {
  const [r, setR] = useState<EvaluationReport | null>(null);
  const [ms, setMs] = useState(0);
  const scenario = useMemo(() => (typeof window === "undefined" ? "peak" : currentScenario()), []);
  useEffect(() => {
    const id = setTimeout(() => {
      const t0 = performance.now();
      const rep = evaluate(demoClock(Date.now()).dateKey, scenario);
      setMs(performance.now() - t0);
      setR(rep);
    }, 50);
    return () => clearTimeout(id);
  }, [scenario]);
  const engine = useMemo(() => (r ? getEngine(demoClock(Date.now()).dateKey, scenario) : null), [r, scenario]);
  return (
    <section className="rounded-[var(--radius-card)] bg-surface p-5 xl:col-span-2" aria-labelledby="pred-h">
      <h2 id="pred-h" className="text-[17px] font-bold">
        예측 모델 검증 (이 브라우저에서 지금 계산)
      </h2>
      <p className="mt-1 text-[13px] text-ink-3">시뮬레이션 기록 6일 중 앞 4일로 학습, 뒤 2일로 검증. 시뮬레이터에 숨겨 둔 규칙을 얼마나 찾아내는지 보는 검증이고, 실제 학식 정확도가 아니에요.</p>
      {!r ? (
        <p className="mt-4 text-ink-3">검증 계산 중…</p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <div>
            <h3 className="text-[14px] font-bold">키오스크 대기시간</h3>
            <p className="num mt-1 text-[24px] font-bold">
              {Math.round(r.eta.maeModelSec)}초 <span className="text-[14px] font-medium text-ink-3">vs 인원만 {Math.round(r.eta.maeBaselineSec)}초</span>
            </p>
            <p className="num text-[13px] text-ink-2">평균 절대 오차, {r.eta.n}건. 예측 범위 적중 {(r.eta.coverage * 100).toFixed(0)}% (목표 60%)</p>
            <p className="num mt-1 text-[13px] text-ink-2">줄이 더 짧은데 더 오래 걸린 경우: 비교 쌍의 {(r.eta.shorterLineSlowerShare * 100).toFixed(0)}%</p>
            <ul className="num mt-2 grid grid-cols-3 gap-1 text-[12px] text-ink-3">
              {r.eta.perKiosk.map((k) => (
                <li key={k.id}>
                  {k.id} {Math.round(k.maeModelSec)}/{Math.round(k.maeBaselineSec)}초
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-[14px] font-bold">메뉴 준비시간</h3>
            <p className="num mt-1 text-[24px] font-bold">
              {Math.round(r.prep.maeModelSec)}초 <span className="text-[14px] font-medium text-ink-3">vs 메뉴 평균만 {Math.round(r.prep.maeBaselineSec)}초</span>
            </p>
            <p className="num text-[13px] text-ink-2">평균 절대 오차, {r.prep.n}건. 범위 적중 {(r.prep.coverage * 100).toFixed(0)}%</p>
            <p className="mt-1 text-[13px] text-ink-2">밀린 주문 수를 반영해서 오차가 줄었어요.</p>
          </div>
          <div>
            <h3 className="text-[14px] font-bold">5–15분 혼잡 예측</h3>
            {engine?.linesForecast.sufficient ? (
              <table className="num mt-1 w-full text-[13px]">
                <thead className="text-ink-3">
                  <tr>
                    <th className="text-left font-medium">줄 인원</th>
                    <th className="text-right font-medium">선택된 방식</th>
                    <th className="text-right font-medium">오차 vs 현재값 유지</th>
                  </tr>
                </thead>
                <tbody>
                  {engine.linesForecast.evals.map((e) => (
                    <tr key={e.horizonSec}>
                      <td>{e.horizonSec / 60}분 뒤</td>
                      <td className="text-right">{METHOD_LABEL[e.best]}</td>
                      <td className="text-right">
                        {e.mae[e.best].toFixed(1)} / {e.mae.persistence.toFixed(1)}명
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-1 text-[13px] text-ink-2">기록이 부족해 예측하지 않아요.</p>
            )}
          </div>
          <p className="text-[12px] text-ink-3 md:col-span-3">계산 시간 {ms.toFixed(0)}ms. 시나리오: {scenario}.</p>
        </div>
      )}
    </section>
  );
}
