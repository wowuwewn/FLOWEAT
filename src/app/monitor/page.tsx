"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { brands } from "@/core/catalog";
import { monitorOrders } from "@/core/orders/service";
import { useBackend, useDemoContext, useNow, useSessionOrders, useWorld } from "@/client/hooks";
import { formatClock, simulatedReadyNumbers } from "@/core/world";

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
    for (const o of ready) {
      if (!fresh.current.has(o.id)) {
        fresh.current.set(o.id, Date.now());
        changed = true;
      }
    }
    if (changed) force((x) => x + 1);
  }, [ready]);

  return (
    <div className="flex min-h-dvh flex-col bg-[#0a1b3d] text-white">
      <header className="flex items-end justify-between px-[3vw] pt-[2.4vw] pb-[1.4vw]">
        <div>
          <h1 className="text-[clamp(28px,3.4vw,64px)] leading-none font-[800] tracking-[-0.03em]">준비된 주문</h1>
          <p className="mt-[0.6vw] text-[clamp(14px,1.3vw,24px)] opacity-75">번호가 보이면 매장 카운터에서 받아 가세요</p>
        </div>
        <p className="num text-right text-[clamp(20px,2.2vw,40px)] font-bold opacity-90">
          {world ? formatClock(world.clock.tSec) : ""}
          <span className="block text-[clamp(11px,0.9vw,16px)] font-medium opacity-70">시연 시각</span>
        </p>
      </header>
      <main className="grid flex-1 grid-cols-2 gap-[1px] bg-white/10 sm:grid-cols-3 lg:grid-cols-5" aria-live="polite">
        {brands.map((b) => {
          const nums = ready.filter((o) => o.brandId === b.id).slice(0, 6);
          const sims = (simNums[b.id] ?? []).slice(0, Math.max(0, 5 - nums.length));
          return (
            <section key={b.id} className="flex flex-col bg-[#0a1b3d] px-[1.4vw] pt-[1.2vw] pb-[1.6vw]" aria-label={`${b.name} 준비 완료 번호`}>
              <h2 className="border-b border-white/15 pb-[0.6vw] text-[clamp(16px,1.5vw,28px)] font-bold">{b.name}</h2>
              <ul className="mt-[0.8vw] flex flex-wrap gap-x-[1.2vw] gap-y-[0.4vw]">
                {nums.map((o) => {
                  const isNew = Date.now() - (fresh.current.get(o.id) ?? 0) < 12_000;
                  return (
                    <li
                      key={o.id}
                      data-testid="monitor-number"
                      className={`num rounded-lg px-1 text-[clamp(30px,3.6vw,72px)] leading-tight font-[800] tracking-[-0.03em] ${isNew ? "text-[#ffd34d] [animation:monitor-flash_1.6s_ease-in-out_3]" : ""}`}
                    >
                      {o.displayNumber}
                    </li>
                  );
                })}
                {sims.map((x) => (
                  <li key={`sim-${x.n}`} className="num px-1 text-[clamp(30px,3.6vw,72px)] leading-tight font-[700] tracking-[-0.03em] text-white/35" aria-label={`시뮬레이션 손님 ${x.n}번`}>
                    {x.n}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </main>
      <footer className="flex justify-between px-[3vw] py-[1vw] text-[clamp(11px,0.9vw,16px)] opacity-60">
        <span>FLOWEAT 시연용 호출 모니터, 세션 {demo?.session ?? "–"}. 흐린 번호는 시뮬레이션 손님이에요.</span>
        <span>{!loaded ? "연결하는 중" : info?.kind === "device" ? "한 기기 체험 모드" : "시연 서버와 연결됨"}</span>
      </footer>
    </div>
  );
}
