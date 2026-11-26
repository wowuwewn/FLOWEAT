"use client";
/**
 * Shared pickup monitor. Field check (2026-11-26): the two call monitors show the SAME order-number
 * screen, not one set of brands each. What the 2026-11-25 photo shows is that one screen has five
 * brand columns at a time, in two groups:
 *   group 1: (first column cut off in the photo — 바비든든 is the only brand left) · 포포420 · 가오슝 · 폭풍분식 · 값찌개
 *   group 2: 경성카츠 · 도쿄야 · 51장국밥 · 광뚝 · 비비고고
 * In that photo the two monitors happened to show different groups at the same moment, so the real
 * screen most likely pages between the groups; how and when it switches is not known.
 * FLOWEAT shows one screen and keeps every monitor identical: the page is a pure function of the
 * shared order list and the clock — the group with the most recent call (last 30 s) first, otherwise
 * it alternates every PAGE_MS on wall-clock boundaries — so two TVs (`?screen=1`, `?screen=2`, or
 * any old `?screen=A|B` link) always show the same page, the same numbers and the same undo.
 * Red only marks a number called in the last 30 s — FLOWEAT's demo rule (the real colours' meaning
 * is unknown), said so in the footer.
 */
import { useEffect, useMemo, useState } from "react";
import { getBrand } from "@/core/catalog";
import { monitorOrders } from "@/core/orders/service";
import type { StaffOrder } from "@/core/orders/types";
import { useBackend, useDemoContext, useNow, useSessionOrders, useWorld } from "@/client/hooks";
import { formatClock, simulatedReadyNumbers } from "@/core/world";
import { MONITOR_GROUPS, MONITOR_NEW_MS as NEW_MS, monitorPage } from "@/core/monitor";

const PER_COLUMN = 7;

export default function MonitorPage() {
  const { backend, info } = useBackend();
  const demo = useDemoContext();
  const { orders, loaded } = useSessionOrders(backend, demo?.session);
  const now = useNow(1000);
  const ready = useMemo(() => monitorOrders(orders, now), [orders, now]);
  const { world, engine } = useWorld(demo?.scenario);
  const simNums = useMemo(() => (engine && world ? simulatedReadyNumbers(engine, world.clock.tSec) : {}), [engine, world]);
  // the page depends on the clock: render group 1 on the server and pick the live page after mount
  // (otherwise server and browser can disagree by a tick → hydration mismatch)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const page = mounted ? monitorPage(ready, now) : 0;

  return (
    <div className="flex h-dvh min-h-[360px] flex-col overflow-hidden bg-[#2a2d33] text-[#14233f]">
      <main className="grid min-h-0 flex-1 p-[max(6px,0.8vw)]" aria-live="polite">
        <Screen page={page} ready={ready} sims={simNums} now={now} />
      </main>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-[#1d2025] px-[max(12px,1.6vw)] py-[max(5px,0.6vw)] text-[clamp(11px,0.85vw,15px)] text-white/85">
        <span>
          모니터 2대 같은 화면 · <b className="num text-[#ff7b80]">123</b> 방금 호출 · <b className="num">123</b> 체험 주문 · <span className="num text-white/55">512</span> 시뮬레이션
        </span>
        <span className="text-white/60">
          {world ? `시연 ${formatClock(world.clock.tSec)} · ` : ""}세션 {demo?.session ?? "–"} · {!loaded ? "연결하는 중" : info?.kind === "device" ? "한 기기 체험" : "시연 서버와 연결됨"}
        </span>
      </footer>
    </div>
  );
}

function Screen({ page, ready, sims, now }: { page: number; ready: StaffOrder[]; sims: Record<string, { n: number }[]>; now: number }) {
  return (
    <section
      style={{ containerType: "size" }}
      className="flex min-h-0 flex-col overflow-hidden rounded-[max(4px,0.4vw)] bg-gradient-to-b from-[#86c0ee] to-[#a9d4f6] ring-[max(3px,0.35vw)] ring-[#0c0d10]"
      aria-label="호출 모니터 (1·2번 같은 화면)"
    >
      <h1 className="shrink-0 pt-[2.2cqh] pb-[1.6cqh] text-center text-[clamp(16px,min(5.4cqw,9cqh),72px)] leading-none font-[800] tracking-[-0.02em] text-[#14233f]">주문 번호 리스트</h1>
      <div className="grid min-h-0 flex-1 grid-cols-5 gap-[0.9cqw] px-[1.4cqw]">
        {MONITOR_GROUPS[page].map((bid) => {
          const b = getBrand(bid)!;
          const mine = ready.filter((o) => o.brandId === bid).slice(0, PER_COLUMN);
          const sim = (sims[bid] ?? []).slice(0, Math.max(0, PER_COLUMN - mine.length));
          return (
            <div key={bid} className="flex min-h-0 flex-col" aria-label={`${b.name} 호출 번호`} role="group">
              <h2 className="shrink-0 truncate rounded-t-[1cqw] bg-[#e7f2fc] px-[0.6cqw] py-[1.3cqh] text-center text-[clamp(11px,min(2.9cqw,6cqh),40px)] font-bold text-[#14233f]">{b.name}</h2>
              <ol className="flex min-h-0 flex-1 flex-col items-center gap-[0.6cqh] overflow-hidden bg-[#f4f9fe]/90 pt-[1.2cqh]">
                {mine.map((o) => {
                  // from the shared call time, not from when this tab first saw it: every TV agrees
                  const isNew = o.readyAt != null && now - o.readyAt < NEW_MS;
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
      <div className="flex shrink-0 items-center justify-center gap-[1cqw] py-[1.6cqh]">
        <p className="text-center text-[clamp(10px,min(2.3cqw,4.6cqh),32px)] font-semibold text-[#14233f]">주문하신 번호가 표시되면 음식을 찾아가 주세요.</p>
        <span className="flex gap-[0.6cqw]" role="img" aria-label={`${page + 1} / ${MONITOR_GROUPS.length} 페이지`}>
          {MONITOR_GROUPS.map((_, i) => (
            <span key={i} className={`size-[clamp(6px,1.1cqw,14px)] rounded-full ${i === page ? "bg-[#14233f]" : "bg-[#14233f]/25"}`} />
          ))}
        </span>
      </div>
    </section>
  );
}
