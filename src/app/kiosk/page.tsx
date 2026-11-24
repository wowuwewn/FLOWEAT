"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { brands, getMenu, menusOf } from "@/core/catalog";
import { kioskById } from "@/core/layout";
import type { CartLine, PlaceOrderResult } from "@/core/orders/types";
import { demoClock, prepForMenu } from "@/core/world";
import { BackendError } from "@/client/backend";
import { liveBacklogOf, useBackend, useDemoContext, useSessionOrders, useWorld } from "@/client/hooks";
import { currentKiosk } from "@/client/session";
import { Qr } from "@/components/Qr";
import { minuteRange, won } from "@/lib/format";

type Step = "attract" | "menu" | "pay" | "tickets";

export default function KioskPage() {
  const { backend, info } = useBackend();
  const demo = useDemoContext();
  const [kioskId, setKioskId] = useState("L2");
  useEffect(() => setKioskId(currentKiosk()), []);
  const sessionOrders = useSessionOrders(backend, demo?.session);
  const liveBacklog = useMemo(() => liveBacklogOf(sessionOrders.orders), [sessionOrders.orders]);
  const { engine } = useWorld(demo?.scenario);

  const [step, setStep] = useState<Step>("attract");
  const [brandId, setBrandId] = useState(brands[0].id);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [result, setResult] = useState<PlaceOrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [large, setLarge] = useState(false);
  const [idle, setIdle] = useState(0);

  const reset = useCallback(() => {
    setStep("attract");
    setCart([]);
    setResult(null);
    setError(null);
    setBrandId(brands[0].id);
  }, []);

  // auto-return to start after inactivity (like real kiosks)
  useEffect(() => {
    if (step === "attract") return;
    const t = setInterval(() => setIdle((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [step]);
  useEffect(() => {
    const limit = step === "tickets" ? 90 : 120;
    if (step !== "attract" && idle >= limit) {
      reset();
      setIdle(0);
    }
  }, [idle, step, reset]);
  const touch = () => setIdle(0);

  const clock = demoClock(Date.now());
  const prepLine = (menuId: string) => {
    if (!engine) return null;
    const e = prepForMenu(engine, clock, menuId, liveBacklog[menuId.split("-")[0]] ?? 0);
    return e && Number.isFinite(e.p50) ? minuteRange(e.p50 * 0.85, e.p80) : null;
  };

  const add = (menuId: string) => {
    touch();
    setCart((c) => {
      const ex = c.find((l) => l.menuId === menuId);
      if (ex) return c.map((l) => (l.menuId === menuId ? { ...l, qty: Math.min(9, l.qty + 1) } : l));
      return [...c, { menuId, qty: 1 }];
    });
  };
  const dec = (menuId: string) => {
    touch();
    setCart((c) => c.flatMap((l) => (l.menuId === menuId ? (l.qty > 1 ? [{ ...l, qty: l.qty - 1 }] : []) : [l])));
  };

  const total = cart.reduce((s, l) => s + (getMenu(l.menuId)?.listedPriceKrw ?? 0) * l.qty, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const brandCount = new Set(cart.map((l) => getMenu(l.menuId)?.brandId)).size;

  const pay = async () => {
    if (!backend || !demo) return;
    setBusy(true);
    setError(null);
    try {
      const r = await backend.placeOrder(demo.session, kioskId, cart, demo.scenario);
      setResult(r);
      setStep("tickets");
      setIdle(0);
    } catch (e) {
      setError(e instanceof BackendError ? e.message : "주문을 처리하지 못했어요. 다시 시도하세요.");
    } finally {
      setBusy(false);
    }
  };

  const kiosk = kioskById(kioskId);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const onLocalhost = typeof window !== "undefined" && /^(localhost|127\.)/.test(window.location.hostname);

  return (
    <div
      className={`flex min-h-dvh items-stretch justify-center bg-[#0b1630] ${large ? "text-[118%]" : ""}`}
      onPointerDown={touch}
    >
      <div className="relative flex w-full max-w-[760px] flex-col bg-floor" style={{ minHeight: "100dvh" }}>
        {/* header */}
        <header className="flex items-center justify-between bg-navy px-6 py-4 text-white">
          <div>
            <p className="text-[13px] font-medium opacity-80">1947 COMMONS</p>
            <p className="text-[22px] leading-tight font-bold">주문하기</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLarge((v) => !v)}
              aria-pressed={large}
              className="rounded-full border border-white/30 px-4 py-2 text-[15px] font-semibold"
            >
              글자 크게
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {step === "attract" && (
            <motion.button
              key="attract"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setStep("menu")}
              className="flex flex-1 flex-col items-center justify-center gap-8 px-8 text-center"
            >
              <span className="grid grid-cols-2 gap-x-10 gap-y-3 text-[20px] font-semibold text-ink-2 sm:grid-cols-3">
                {brands.map((b) => (
                  <span key={b.id}>{b.name}</span>
                ))}
              </span>
              <span className="rounded-full bg-blue px-12 py-6 text-[28px] font-bold text-white shadow-[0_10px_30px_rgba(33,96,224,.35)]">
                화면을 눌러 주문하세요
              </span>
              <span className="max-w-md text-[16px] text-ink-2">
                모든 키오스크에서 같은 메뉴를 주문할 수 있어요. 메뉴마다 예상 준비시간을 함께 보여 드려요.
              </span>
            </motion.button>
          )}

          {step === "menu" && (
            <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col">
              <div className="flex min-h-0 flex-1">
                <nav aria-label="브랜드" className="no-scrollbar w-[150px] shrink-0 overflow-y-auto border-r border-line bg-surface sm:w-[180px]">
                  {brands.map((b) => {
                    const n = cart.filter((l) => getMenu(l.menuId)?.brandId === b.id).reduce((s, l) => s + l.qty, 0);
                    const on = b.id === brandId;
                    return (
                      <button
                        key={b.id}
                        onClick={() => {
                          setBrandId(b.id);
                          touch();
                        }}
                        aria-current={on}
                        className={`flex min-h-[68px] w-full flex-col justify-center border-l-4 px-4 text-left ${on ? "border-blue bg-ice" : "border-transparent"}`}
                      >
                        <span className={`text-[17px] font-bold ${on ? "text-navy" : ""}`}>{b.name}</span>
                        <span className="text-[13px] text-ink-3">
                          {b.cuisine}
                          {n > 0 && <span className="num ml-1 font-bold text-blue-ink">{n}개</span>}
                        </span>
                      </button>
                    );
                  })}
                </nav>
                <section className="min-w-0 flex-1 overflow-y-auto p-4" aria-label={`${brands.find((b) => b.id === brandId)?.name} 메뉴`}>
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {menusOf(brandId).map((m) => {
                      const q = cart.find((l) => l.menuId === m.id)?.qty ?? 0;
                      const prep = m.isSide ? null : prepLine(m.id);
                      return (
                        <li key={m.id}>
                          <button
                            onClick={() => add(m.id)}
                            className={`relative flex min-h-[112px] w-full flex-col justify-between rounded-[var(--radius-tile)] border-2 bg-surface p-4 text-left transition-colors ${q ? "border-blue" : "border-transparent"}`}
                          >
                            <span className="text-[18px] leading-snug font-bold">{m.name}</span>
                            <span className="mt-2 flex items-end justify-between gap-2">
                              <span className="num text-[17px] font-semibold">{won(m.listedPriceKrw)}</span>
                              {prep && <span className="text-[14px] font-semibold text-ink-2">준비 {prep}</span>}
                            </span>
                            {q > 0 && (
                              <span className="num absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-blue text-[15px] font-bold text-white">
                                {q}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-4 text-[13px] text-ink-3">
                    가격은 공개 목록의 참고 가격이에요. 준비시간은 지금 주문량을 반영한 예측이에요.
                  </p>
                </section>
              </div>

              {/* cart */}
              <div className="border-t border-line bg-surface px-5 pt-3 pb-5">
                {cart.length > 0 ? (
                  <ul className="mb-3 max-h-[28vh] space-y-2 overflow-y-auto" aria-label="장바구니">
                    {cart.map((l) => {
                      const m = getMenu(l.menuId)!;
                      return (
                        <li key={l.menuId} className="flex items-center gap-3">
                          <span className="min-w-0 flex-1 truncate text-[16px]">
                            <span className="text-ink-3">{brands.find((b) => b.id === m.brandId)?.name}</span> {m.name}
                          </span>
                          <button onClick={() => dec(l.menuId)} className="grid size-11 place-items-center rounded-full bg-floor text-[22px] font-bold" aria-label={`${m.name} 하나 빼기`}>
                            −
                          </button>
                          <span className="num w-6 text-center text-[17px] font-bold">{l.qty}</span>
                          <button onClick={() => add(l.menuId)} className="grid size-11 place-items-center rounded-full bg-floor text-[22px] font-bold" aria-label={`${m.name} 하나 더`}>
                            +
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mb-3 text-[16px] text-ink-3">메뉴를 누르면 담겨요.</p>
                )}
                <div className="flex items-center gap-3">
                  <button onClick={reset} className="h-16 rounded-2xl bg-floor px-6 text-[18px] font-semibold">
                    처음으로
                  </button>
                  <button
                    disabled={cart.length === 0}
                    onClick={() => setStep("pay")}
                    className="flex h-16 flex-1 items-center justify-between rounded-2xl bg-blue px-6 text-[19px] font-bold text-white disabled:bg-line-2"
                  >
                    <span>
                      <span className="num">{count}</span>개 결제하기
                    </span>
                    <span className="num">{won(total)}</span>
                  </button>
                </div>
                {brandCount > 1 && <p className="mt-2 text-[14px] text-ink-2">브랜드가 {brandCount}곳이라 번호표가 {brandCount}장 나와요.</p>}
              </div>
            </motion.div>
          )}

          {step === "pay" && (
            <motion.div key="pay" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <p className="text-[17px] font-semibold text-ink-2">결제 금액</p>
              <p className="num mt-1 text-[52px] font-[780] tracking-[-0.03em]">{won(total)}</p>
              <p className="mt-4 max-w-sm text-[16px] text-ink-2">
                시연용 모의 결제예요. 실제로 돈이 나가거나 카드 정보를 받지 않아요.
              </p>
              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-very-bg px-4 py-3 text-[15px] font-semibold text-very">
                  {error}
                </p>
              )}
              <div className="mt-8 flex w-full max-w-md flex-col gap-3">
                <button onClick={pay} disabled={busy || !backend} className="h-16 rounded-2xl bg-blue text-[20px] font-bold text-white disabled:opacity-60">
                  {busy ? "결제하는 중…" : "모의 결제 완료"}
                </button>
                <button onClick={() => setStep("menu")} className="h-14 rounded-2xl bg-surface text-[17px] font-semibold">
                  메뉴로 돌아가기
                </button>
              </div>
            </motion.div>
          )}

          {step === "tickets" && result && (
            <motion.div key="tickets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col px-5 pt-6 pb-6">
              <h1 className="text-[26px] font-bold">번호표 {result.tickets.length}장이 나왔어요</h1>
              <p className="mt-1 text-[16px] text-ink-2">
                번호표의 QR을 휴대폰 카메라로 찍으면, 음식이 준비됐을 때 알려 드려요.
              </p>
              {onLocalhost && info?.kind === "server" && (
                <p className="mt-2 rounded-xl bg-normal-bg px-4 py-2.5 text-[14px] text-normal">
                  이 화면을 localhost로 열어서 다른 기기에서는 QR 주소에 접속할 수 없어요. 같은 Wi-Fi의 IP 주소로 키오스크를 열어 주세요.
                </p>
              )}
              <ul className="mt-5 grid flex-1 grid-cols-1 content-start gap-4 sm:grid-cols-2">
                {result.tickets.map(({ order, token }) => {
                  const b = brands.find((x) => x.id === order.brandId)!;
                  const url = `${origin}/o/${token}`;
                  return (
                    <li key={order.id} className="rounded-[18px] bg-surface p-5 shadow-[0_1px_0_var(--color-line)]" data-testid="ticket">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[17px] font-bold">{b.name}</p>
                          <p className="num text-[56px] leading-none font-[800] tracking-[-0.04em] text-navy" data-testid="ticket-number">
                            {order.displayNumber}
                          </p>
                        </div>
                        <Qr value={url} size={132} label={`${b.name} ${order.displayNumber}번 주문 추적 QR`} />
                      </div>
                      <ul className="mt-3 space-y-0.5 text-[15px] text-ink-2">
                        {order.items.map((i) => (
                          <li key={i.menuId}>
                            {i.name} <span className="num">×{i.qty}</span>
                          </li>
                        ))}
                      </ul>
                      {order.prepEstimate && (
                        <p className="mt-2 text-[14px] font-semibold">
                          준비 예상 {minuteRange(order.prepEstimate.p50 * 0.85, order.prepEstimate.p80)}
                        </p>
                      )}
                      <a href={url} target="_blank" rel="noreferrer" data-testid="ticket-link" className="mt-3 block truncate rounded-lg bg-floor px-3 py-2 text-[12.5px] text-ink-3" title={url}>
                        {info?.kind === "device" ? "이 기기에서 열기 (한 기기 체험)" : url.replace(/^https?:\/\//, "")}
                      </a>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-5 flex gap-3">
                <button onClick={() => window.print()} className="h-16 flex-1 rounded-2xl bg-surface text-[18px] font-semibold">
                  번호표 인쇄
                </button>
                <button onClick={reset} className="h-16 flex-[2] rounded-2xl bg-navy text-[19px] font-bold text-white">
                  처음 화면으로
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="flex items-center justify-between border-t border-line bg-surface px-5 py-2.5 text-[12.5px] text-ink-3">
          <span>모의 키오스크, {kiosk?.label ?? kioskId} 기기로 설정됨</span>
          <span>
            {demo ? <>세션 {demo.session}</> : null} {info?.kind === "device" ? "· 한 기기 체험" : ""}{" "}
            <Link href="/demo" className="underline">
              시연 허브
            </Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
