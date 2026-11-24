"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { brands, getBrand } from "@/core/catalog";
import type { StaffOrder } from "@/core/orders/types";
import { useBackend, useDemoContext, useNow, useSessionOrders } from "@/client/hooks";
import { saveStaffBrand, savedStaffBrand } from "@/client/session";
import { elapsed, minuteRange } from "@/lib/format";

export default function StaffPage() {
  const { backend, info } = useBackend();
  const demo = useDemoContext();
  const [brandId, setBrandId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const b = savedStaffBrand();
    if (b && getBrand(b)) setBrandId(b);
    setReady(true);
  }, []);
  const { orders, loaded } = useSessionOrders(backend, demo?.session);
  const now = useNow(1000);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const mine = useMemo(() => orders.filter((o) => o.brandId === brandId), [orders, brandId]);
  const open = mine.filter((o) => o.status === "accepted").sort((a, b) => a.acceptedAt - b.acceptedAt);
  const done = mine
    .filter((o) => o.status === "ready" || o.status === "closed")
    .sort((a, b) => (b.readyAt ?? 0) - (a.readyAt ?? 0))
    .slice(0, 8);

  const act = async (o: StaffOrder, undo = false) => {
    if (!backend || !demo) return;
    setPending((p) => new Set(p).add(o.id));
    setError(null);
    try {
      await backend.setReady(demo.session, o.id, `${undo ? "undo" : "ready"}:${o.id}:v${o.version}`, undo);
    } catch {
      setError("처리하지 못했어요. 네트워크를 확인하고 다시 눌러 주세요.");
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(o.id);
        return n;
      });
    }
  };

  if (!ready) return <div className="min-h-dvh bg-floor" />;

  if (!brandId) {
    return (
      <div className="min-h-dvh bg-floor px-5 py-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-[14px] font-semibold text-ink-3">직원용 주문 관리 (모의)</p>
          <h1 className="mt-1 text-[26px] font-bold">어느 매장 화면인가요?</h1>
          <p className="mt-1 text-[15px] text-ink-2">한 번 고르면 이 기기에 저장돼요.</p>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {brands.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => {
                    saveStaffBrand(b.id);
                    setBrandId(b.id);
                  }}
                  className="flex h-24 w-full flex-col justify-center rounded-[var(--radius-tile)] bg-surface px-5 text-left"
                >
                  <span className="text-[19px] font-bold">{b.name}</span>
                  <span className="text-[13.5px] text-ink-3">{b.cuisine}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const brand = getBrand(brandId)!;
  return (
    <div className="min-h-dvh bg-floor">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-6 gap-y-2 bg-navy px-6 py-4 text-white">
        <div className="flex-1">
          <p className="text-[13px] opacity-80">주문 관리 (모의)</p>
          <h1 className="text-[24px] leading-tight font-bold">{brand.name}</h1>
        </div>
        <dl className="flex gap-6 text-center">
          <div>
            <dt className="text-[12.5px] opacity-80">조리할 주문</dt>
            <dd className="num text-[26px] leading-tight font-bold" data-testid="open-count">
              {open.length}
            </dd>
          </div>
          <div>
            <dt className="text-[12.5px] opacity-80">완료</dt>
            <dd className="num text-[26px] leading-tight font-bold">{mine.filter((o) => o.status !== "accepted").length}</dd>
          </div>
        </dl>
        <button
          onClick={() => {
            setBrandId(null);
          }}
          className="rounded-full border border-white/30 px-4 py-2 text-[14px] font-semibold"
        >
          매장 바꾸기
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-5">
        {error && (
          <p role="alert" className="mb-4 rounded-xl bg-very-bg px-4 py-3 font-semibold text-very">
            {error}
          </p>
        )}
        {!loaded ? (
          <p className="py-16 text-center text-ink-3">주문을 불러오는 중…</p>
        ) : open.length === 0 ? (
          <div className="rounded-[var(--radius-card)] bg-surface px-6 py-14 text-center">
            <p className="text-[20px] font-bold">조리할 주문이 없어요</p>
            <p className="mt-1 text-[15px] text-ink-2">키오스크에서 {brand.name} 메뉴를 주문하면 여기에 바로 나타나요.</p>
          </div>
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2" aria-label="조리할 주문">
            <AnimatePresence initial={false}>
              {open.map((o) => {
                const waited = now - o.acceptedAt;
                const late = o.prepEstimate && waited > o.prepEstimate.p80 * 1000;
                return (
                  <motion.li
                    key={o.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    className="flex items-stretch gap-4 rounded-[var(--radius-card)] bg-surface p-4"
                    data-testid="staff-order"
                  >
                    <div className="w-24 shrink-0">
                      <p className="num text-[44px] leading-none font-[800] tracking-[-0.04em] text-navy">{o.displayNumber}</p>
                      <p className={`num mt-2 text-[14px] font-semibold ${late ? "text-busy" : "text-ink-3"}`}>{elapsed(o.acceptedAt, now)} 지남</p>
                    </div>
                    <ul className="min-w-0 flex-1 space-y-1 text-[17px]">
                      {o.items.map((i) => (
                        <li key={i.menuId} className="flex justify-between gap-2">
                          <span className="truncate">{i.name}</span>
                          <span className="num font-bold">{i.qty}</span>
                        </li>
                      ))}
                      {o.prepEstimate && (
                        <li className="pt-1 text-[13px] text-ink-3">예측 {minuteRange(o.prepEstimate.p50 * 0.85, o.prepEstimate.p80)}</li>
                      )}
                    </ul>
                    <button
                      onClick={() => act(o)}
                      disabled={pending.has(o.id)}
                      className="w-28 shrink-0 rounded-2xl bg-free text-[20px] font-bold text-white active:scale-[.98] disabled:opacity-60"
                      aria-label={`${o.displayNumber}번 완료`}
                    >
                      완료
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        {done.length > 0 && (
          <section className="mt-8" aria-labelledby="done-h">
            <h2 id="done-h" className="mb-2 text-[15px] font-bold text-ink-2">
              최근 완료 (모니터와 학생 휴대폰에 표시됨)
            </h2>
            <ul className="flex flex-wrap gap-2">
              {done.map((o) => {
                const canUndo = o.status === "ready" && o.readyAt && now - o.readyAt < 10_000;
                return (
                  <li key={o.id} className="flex items-center gap-2 rounded-full bg-surface py-1.5 pr-1.5 pl-4">
                    <span className="num text-[18px] font-bold">{o.displayNumber}</span>
                    <span className="text-[13px] text-ink-3">{o.status === "closed" ? "수령 확인" : "완료"}</span>
                    {canUndo ? (
                      <button onClick={() => act(o, true)} className="rounded-full bg-floor px-3 py-1.5 text-[13px] font-semibold">
                        되돌리기 {Math.ceil((10_000 - (now - o.readyAt!)) / 1000)}
                      </button>
                    ) : (
                      <span className="w-1" />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
      <footer className="px-6 pb-6 text-[12.5px] text-ink-3">
        실제 매장 주문 시스템이 아닌 시연용 화면이에요. 세션 {demo?.session} {info?.kind === "device" ? "· 한 기기 체험" : ""}{" "}
        <Link href="/demo" className="underline">
          시연 허브
        </Link>
      </footer>
    </div>
  );
}
