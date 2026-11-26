"use client";
/**
 * Shared pickup monitor, modelled on the two light-blue "주문 번호 리스트" screens photographed on
 * 2026-11-25: five brand columns per screen, numbers listed under each brand.
 *   screen A: (cut off in the photo — 바비든든 is the only brand left) · 포포420 · 가오슝 · 폭풍분식 · 값찌개
 *   screen B: 경성카츠 · 도쿄야 · 51장국밥 · 광뚝 · 비비고고
 * `?screen=A|B` shows one screen full size (one TV each); otherwise both side by side / stacked.
 * The real screens use red and black numbers whose meaning we do not know; here red only marks a
 * number called in the last 30 s — FLOWEAT's own demo rule, said so in the legend.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { getBrand } from "@/core/catalog";
import { monitorOrders } from "@/core/orders/service";
import type { StaffOrder } from "@/core/orders/types";
import { useBackend, useDemoContext, useNow, useSessionOrders, useWorld } from "@/client/hooks";
import { formatClock, simulatedReadyNumbers } from "@/core/world";

const SCREENS: Record<"A" | "B", string[]> = {
  A: ["babi", "popo420", "kaohsiung", "pokpung", "gapjjigae"],
  B: ["gyeongseong", "tokyoya", "jang51", "gwangttuk", "bibigogo"],
};
const NEW_MS = 30_000;
const PER_COLUMN = 7;

export default function MonitorPage() {
  const { backend, info } = useBackend();
  const demo = useDemoContext();
  const { orders, loaded } = useSessionOrders(backend, demo?.session);
  const now = useNow(1000);
  const ready = useMemo(() => monitorOrders(orders, now), [orders, now]);
  const { world, engine } = useWorld(demo?.scenario);
  const simNums = useMemo(() => (engine && world ? simulatedReadyNumbers(engine, world.clock.tSec) : {}), [engine, world]);
  const [only, setOnly] = useState<"A" | "B" | null>(null);
  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get("screen");
    if (s === "A" || s === "B") setOnly(s);
  }, []);
  // when a number first appears on this screen (an undone call leaves; if it comes back it is new again)
  const seen = useRef<Map<string, number>>(new Map());
  const ids = new Set(ready.map((o) => o.id));
  for (const id of [...seen.current.keys()]) if (!ids.has(id)) seen.current.delete(id);
  for (const o of ready) if (!seen.current.has(o.id)) seen.current.set(o.id, Date.now());

  const screens = only ? [only] : (["A", "B"] as const);
  return (
    <div className="flex h-dvh min-h-[360px] flex-col overflow-hidden bg-[#2a2d33] text-[#14233f]">
      <main className={`grid min-h-0 flex-1 gap-[max(6px,0.8vw)] p-[max(6px,0.8vw)] ${screens.length === 2 ? "grid-rows-2 [@media(min-aspect-ratio:7/5)]:grid-cols-2 [@media(min-aspect-ratio:7/5)]:grid-rows-1" : ""}`} aria-live="polite">
        {screens.map((sc) => (
          <Screen key={sc} id={sc} ready={ready} sims={simNums} seen={seen.current} now={now} />
        ))}
      </main>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-[#1d2025] px-[max(12px,1.6vw)] py-[max(5px,0.6vw)] text-[clamp(11px,0.85vw,15px)] text-white/85">
        <span>
          <b className="num text-[#ff7b80]">123</b> 방금 호출 · <b className="num">123</b> 체험 주문 · <span className="num text-white/55">512</span> 시뮬레이션
        </span>
        <span className="text-white/60">
          {world ? `시연 ${formatClock(world.clock.tSec)} · ` : ""}세션 {demo?.session ?? "–"} · {!loaded ? "연결하는 중" : info?.kind === "device" ? "한 기기 체험" : "시연 서버와 연결됨"}
        </span>
      </footer>
    </div>
  );
}

function Screen({ id, ready, sims, seen, now }: { id: "A" | "B"; ready: StaffOrder[]; sims: Record<string, { n: number }[]>; seen: Map<string, number>; now: number }) {
  return (
    <section
      style={{ containerType: "size" }}
      className="flex min-h-0 flex-col overflow-hidden rounded-[max(4px,0.4vw)] bg-gradient-to-b from-[#86c0ee] to-[#a9d4f6] ring-[max(3px,0.35vw)] ring-[#0c0d10]"
      aria-label={`호출 모니터 ${id === "A" ? "1" : "2"}`}
    >
      <h1 className="shrink-0 pt-[2.2cqh] pb-[1.6cqh] text-center text-[clamp(16px,min(5.4cqw,9cqh),72px)] leading-none font-[800] tracking-[-0.02em] text-[#14233f]">주문 번호 리스트</h1>
      <div className="grid min-h-0 flex-1 grid-cols-5 gap-[0.9cqw] px-[1.4cqw]">
        {SCREENS[id].map((bid) => {
          const b = getBrand(bid)!;
          const mine = ready.filter((o) => o.brandId === bid).slice(0, PER_COLUMN);
          const sim = (sims[bid] ?? []).slice(0, Math.max(0, PER_COLUMN - mine.length));
          return (
            <div key={bid} className="flex min-h-0 flex-col" aria-label={`${b.name} 호출 번호`} role="group">
              <h2 className="shrink-0 truncate rounded-t-[1cqw] bg-[#e7f2fc] px-[0.6cqw] py-[1.3cqh] text-center text-[clamp(11px,min(2.9cqw,6cqh),40px)] font-bold text-[#14233f]">{b.name}</h2>
              <ol className="flex min-h-0 flex-1 flex-col items-center gap-[0.6cqh] overflow-hidden bg-[#f4f9fe]/90 pt-[1.2cqh]">
                {mine.map((o) => {
                  const isNew = now - (seen.get(o.id) ?? 0) < NEW_MS;
                  return (
                    <li
                      key={o.id}
                      data-testid="monitor-number"
                      data-new={isNew || undefined}
                      aria-label={`${b.name} ${o.displayNumber}번${isNew ? ", 방금 호출" : ""}`}
                      className={`num w-[88%] rounded-[0.8cqw] text-center text-[clamp(16px,min(4.6cqw,9.5cqh),84px)] leading-[1.12] font-[850] tracking-[-0.02em] ${isNew ? "text-[#d21f26] [animation:monitor-new_1.2s_ease-in-out_4]" : "text-[#14233f]"}`}
                    >
                      {o.displayNumber}
                    </li>
                  );
                })}
                {sim.map((x) => (
                  <li key={`sim-${x.n}`} className="num text-center text-[clamp(13px,min(3.4cqw,7cqh),60px)] leading-[1.2] font-[650] text-[#5a6a84]" aria-label={`시뮬레이션 손님 ${x.n}번`}>
                    {x.n}
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
      <p className="shrink-0 py-[1.6cqh] text-center text-[clamp(10px,min(2.3cqw,4.6cqh),32px)] font-semibold text-[#14233f]">주문하신 번호가 표시되면 음식을 찾아가 주세요.</p>
    </section>
  );
}
