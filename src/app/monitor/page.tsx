"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { brands } from "@/core/catalog";
import { monitorOrders } from "@/core/orders/service";
import { useBackend, useDemoContext, useNow, useSessionOrders, useWorld } from "@/client/hooks";
import { formatClock, simulatedReadyNumbers } from "@/core/world";
import { Logo } from "@/components/brand/Logo";

/** Shared pickup monitor: ready numbers only, per brand — mirrors the existing screens. */
export default function MonitorPage() {
  const { backend, info } = useBackend();
  const demo = useDemoContext();
  const { orders, loaded } = useSessionOrders(backend, demo?.session);
  const now = useNow(5000);
  const ready = useMemo(() => monitorOrders(orders, now), [orders, now]);
  const { world, engine } = useWorld(demo?.scenario);
  const simNums = useMemo(() => (engine && world ? simulatedReadyNumbers(engine, world.clock.tSec) : {}), [engine, world]);
  const fresh = useRef<Map<string, number>>(new Map());
  const [, force] = useState(0);
  useEffect(() => {
    let changed = false;
    // an undone completion leaves the board; if it comes back it should flash again
    const ids = new Set(ready.map((o) => o.id));
    for (const id of [...fresh.current.keys()]) if (!ids.has(id)) fresh.current.delete(id);
    for (const o of ready) {
      if (!fresh.current.has(o.id)) {
        fresh.current.set(o.id, Date.now());
        changed = true;
      }
    }
    if (changed) force((x) => x + 1);
  }, [ready]);

  return (
    <div className="flex h-dvh min-h-[360px] flex-col overflow-hidden bg-[#0b1f4d] text-white">
      <header className="flex shrink-0 items-end justify-between gap-3 px-[max(14px,2.6vw)] pt-[max(12px,2vw)] pb-[max(8px,1vw)]">
        <div className="min-w-0">
          <h1 className="flex items-center gap-[max(8px,0.9vw)] text-[clamp(22px,3.2vw,64px)] leading-none font-[800] tracking-[-0.03em]">
            <Logo size={44} tone="white" className="size-[1.05em]" />
            준비된 주문
          </h1>
          <p className="mt-[max(4px,0.5vw)] truncate text-[clamp(12.5px,1.25vw,24px)] opacity-75">번호가 보이면 매장 카운터에서 받아 가세요</p>
        </div>
        <p className="num shrink-0 text-right text-[clamp(18px,2.1vw,40px)] leading-none font-bold opacity-90">
          {world ? formatClock(world.clock.tSec) : ""}
          <span className="mt-1 block text-[clamp(10.5px,0.9vw,16px)] font-medium opacity-70">시연 시각</span>
        </p>
      </header>
      <main style={{ containerType: "size" }} className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-[1px] bg-white/10 [@media(min-aspect-ratio:6/5)]:grid-cols-5" aria-live="polite">
        {brands.map((b) => {
          const nums = ready.filter((o) => o.brandId === b.id).slice(0, 6);
          const sims = (simNums[b.id] ?? []).slice(0, Math.max(0, 5 - nums.length));
          return (
            <section key={b.id} className="flex min-h-0 flex-col overflow-hidden bg-[#0b1f4d] px-[max(10px,1.3vw)] pt-[max(6px,1vw)] pb-[max(6px,1vw)]" aria-label={`${b.name} 준비 완료 번호`}>
              <h2 className="shrink-0 truncate border-b border-white/15 pb-[max(4px,0.5vw)] text-[clamp(13px,min(4.2cqw,2.8cqh),28px)] [@media(min-aspect-ratio:6/5)]:text-[clamp(13px,min(1.6cqw,4cqh),28px)] font-bold">{b.name}</h2>
              <ul className="mt-[max(4px,0.6vw)] flex min-h-0 flex-wrap content-start items-baseline gap-x-[max(8px,1vw)] overflow-hidden">
                {nums.map((o) => {
                  const isNew = Date.now() - (fresh.current.get(o.id) ?? 0) < 12_000;
                  return (
                    <li
                      key={o.id}
                      data-testid="monitor-number"
                      aria-label={`체험 주문 ${o.displayNumber}번`}
                      className={`num rounded-lg text-[clamp(20px,min(9cqw,6cqh),80px)] [@media(min-aspect-ratio:6/5)]:text-[clamp(20px,min(4.4cqw,9cqh),80px)] leading-[1.15] font-[800] tracking-[-0.03em] ${isNew ? "text-[#ffd34d] [animation:monitor-flash_1.6s_ease-in-out_3]" : "text-white"}`}
                    >
                      {o.displayNumber}
                    </li>
                  );
                })}
                {sims.map((x) => (
                  <li key={`sim-${x.n}`} className="num text-[clamp(14px,min(5.8cqw,3.9cqh),52px)] [@media(min-aspect-ratio:6/5)]:text-[clamp(14px,min(2.9cqw,5.8cqh),52px)] leading-[1.35] font-[600] tracking-[-0.02em] text-white/50" aria-label={`시뮬레이션 손님 ${x.n}번`}>
                    {x.n}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </main>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-[max(14px,2.6vw)] py-[max(6px,0.8vw)] text-[clamp(11px,0.9vw,16px)]">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span className="num font-[800]">123</span>
            <span className="opacity-75">진한 번호: 이 체험에서 실제로 주문·완료한 번호</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="num font-semibold text-white/60">512</span>
            <span className="opacity-75">흐린 번호: 시뮬레이션 손님</span>
          </span>
        </span>
        <span className="opacity-60">
          세션 {demo?.session ?? "–"} · {!loaded ? "연결하는 중" : info?.kind === "device" ? "한 기기 체험" : "시연 서버와 연결됨"}
        </span>
      </footer>
    </div>
  );
}
