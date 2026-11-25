"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { brands, COOK_TYPE_LABEL, getBrand, getMenu, menusOf } from "@/core/catalog";
import { kioskById } from "@/core/layout";
import type { CartLine, PlaceOrderResult } from "@/core/orders/types";
import { demoClock, prepForMenu } from "@/core/world";
import { BackendError } from "@/client/backend";
import { liveBacklogOf, useBackend, useDemoContext, useSessionOrders, useWorld } from "@/client/hooks";
import { currentKiosk } from "@/client/session";
import { Qr } from "@/components/Qr";
import { BrandMark } from "@/components/brand/BrandMark";
import { Logo } from "@/components/brand/Logo";
import { won, prepText } from "@/lib/format";

type Step = "attract" | "menu" | "pay" | "tickets";

export default function KioskPage() {
  const { backend, info } = useBackend();
  const demo = useDemoContext();
  const [kioskId, setKioskId] = useState("L2");
  useEffect(() => setKioskId(currentKiosk()), []);
  const sessionOrders = useSessionOrders(backend, demo?.session);
  const liveBacklog = useMemo(() => liveBacklogOf(sessionOrders.orders), [sessionOrders.orders]);
  const { world, engine } = useWorld(demo?.scenario);

  const [step, setStep] = useState<Step>("attract");
  const [brandId, setBrandId] = useState(brands[0].id);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [result, setResult] = useState<PlaceOrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [large, setLarge] = useState(false);
  const [idle, setIdle] = useState(0);
  const [inFrame, setInFrame] = useState(false);
  useEffect(() => setInFrame(window.top !== window.self), []);

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
    return e && Number.isFinite(e.p50) ? prepText(e.p50, e.p80) : null;
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
  const brandPrep = (id: string) => {
    const v = world?.brands.find((b) => b.id === id);
    return v && Number.isFinite(v.p50) ? prepText(v.p50, v.p80) : null;
  };
  const cartBrands = [...new Set(cart.map((l) => getMenu(l.menuId)?.brandId))].filter(Boolean) as string[];
  const STEPS: { id: Step[]; label: string }[] = [
    { id: ["menu"], label: "메뉴 선택" },
    { id: ["pay"], label: "결제" },
    { id: ["tickets"], label: "번호표" },
  ];
  const onLocalhost = typeof window !== "undefined" && /^(localhost|127\.)/.test(window.location.hostname);

  return (
    <div className={`flex min-h-dvh items-stretch justify-center bg-[#0b1630] ${large ? "text-[118%]" : ""}`} onPointerDown={touch}>
      <div className="relative flex h-dvh w-full max-w-[820px] flex-col overflow-hidden bg-floor">
        {/* header */}
        <header className="flex shrink-0 items-center gap-3 bg-navy px-4 py-3 text-white sm:px-6 sm:py-4">
          <Logo size={34} tone="white" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] leading-tight font-medium opacity-75">1947 COMMONS</p>
            {step === "attract" ? (
              <p className="text-[20px] leading-tight font-bold sm:text-[22px]">주문하기</p>
            ) : (
              <ol className="mt-0.5 flex items-center gap-1 text-[13px] sm:gap-1.5 sm:text-[14px]" aria-label="주문 단계">
                {STEPS.map((st, i) => {
                  const cur = st.id.includes(step);
                  const idx = STEPS.findIndex((x) => x.id.includes(step));
                  return (
                    <li key={st.label} className="flex items-center gap-1 sm:gap-1.5" aria-current={cur ? "step" : undefined}>
                      {i > 0 && <span aria-hidden className="opacity-70">›</span>}
                      <span className={`whitespace-nowrap ${cur ? "font-bold" : i < idx ? "opacity-85" : "opacity-70"}`}>{st.label}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
          <button onClick={() => setLarge((v) => !v)} aria-pressed={large} className={`shrink-0 rounded-full border px-3.5 py-2 text-[14px] font-semibold sm:px-4 sm:text-[15px] ${large ? "border-white bg-white text-navy" : "border-white/30"}`}>
            글자 크게
          </button>
        </header>

        <AnimatePresence mode="wait">
          {step === "attract" && (
            <motion.div key="attract" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-6 pb-5 sm:px-8 sm:pt-8">
              <h1 className="text-[26px] leading-tight font-[800] tracking-[-0.03em] sm:text-[32px]">무엇을 드시겠어요?</h1>
              <p className="mt-1.5 text-[15px] text-ink-2 sm:text-[16px]">매장을 고르거나 아래 버튼을 누르세요. 여러 매장을 한 번에 주문할 수 있어요.</p>
              <ul className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                {brands.map((b) => {
                  const pr = brandPrep(b.id);
                  return (
                    <li key={b.id}>
                      <button
                        onClick={() => {
                          setBrandId(b.id);
                          setStep("menu");
                        }}
                        className="flex h-full w-full items-center gap-3 rounded-[var(--radius-tile)] bg-surface p-3 text-left shadow-[0_1px_0_var(--color-line)] active:scale-[.98] sm:p-4"
                        aria-label={`${b.name} 메뉴 보기${pr ? `, 준비 예상 ${pr}` : ""}`}
                      >
                        <BrandMark brandId={b.id} name={b.name} size={42} />
                        <span className="min-w-0">
                          <span className="block truncate text-[16px] font-bold sm:text-[17px]">{b.name}</span>
                          <span className="block truncate text-[12.5px] text-ink-3">{pr ? `준비 ${pr}` : b.cuisine}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-auto pt-6">
                <button onClick={() => setStep("menu")} className="h-[72px] w-full rounded-[22px] bg-blue text-[24px] font-bold text-white shadow-[0_10px_30px_rgba(33,96,224,.35)] active:brightness-95 sm:h-20 sm:text-[26px]">
                  화면을 눌러 주문하세요
                </button>
                <p className="mt-3 text-center text-[13.5px] text-ink-3">메뉴마다 지금 주문량을 반영한 준비시간 예측을 함께 보여 드려요.</p>
              </div>
            </motion.div>
          )}

          {step === "menu" && (
            <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1">
                <nav aria-label="매장" className="no-scrollbar w-[104px] shrink-0 overflow-y-auto border-r border-line bg-surface sm:w-[176px]">
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
                        className={`relative flex min-h-[64px] w-full items-center gap-2.5 border-l-4 px-2.5 py-2 text-left sm:min-h-[70px] sm:px-3.5 ${on ? "border-blue bg-ice" : "border-transparent"}`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[15px] leading-tight font-bold sm:text-[16.5px] ${on ? "text-navy" : ""}`}>{b.name}</span>
                          <span className="mt-0.5 hidden truncate text-[12.5px] text-ink-3 sm:block">{b.cuisine}</span>
                        </span>
                        {n > 0 && <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-blue text-[12.5px] font-bold text-white" aria-label={`${n}개 담음`}>{n}</span>}
                      </button>
                    );
                  })}
                </nav>
                <section className="min-w-0 flex-1 overflow-y-auto px-3 pt-3 pb-4 sm:px-4" aria-label={`${getBrand(brandId)?.name} 메뉴`}>
                  <div className="mb-3 flex items-center gap-3 rounded-[var(--radius-tile)] bg-surface px-3.5 py-3">
                    <BrandMark brandId={brandId} name={getBrand(brandId)?.name ?? ""} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[18px] leading-tight font-bold">{getBrand(brandId)?.name}</p>
                      <p className="truncate text-[13px] text-ink-3">{getBrand(brandId)?.cuisine}</p>
                    </div>
                    {brandPrep(brandId) && (
                      <p className="shrink-0 text-right">
                        <span className="block text-[11.5px] text-ink-3">준비 예상</span>
                        <span className="num block text-[16px] font-bold">{brandPrep(brandId)}</span>
                      </p>
                    )}
                  </div>
                  <ul className="grid grid-cols-1 gap-2.5 min-[560px]:grid-cols-2">
                    {menusOf(brandId).map((m) => {
                      const q = cart.find((l) => l.menuId === m.id)?.qty ?? 0;
                      const prep = m.isSide ? null : prepLine(m.id);
                      return (
                        <li key={m.id}>
                          <button
                            onClick={() => add(m.id)}
                            className={`relative flex min-h-[104px] w-full flex-col justify-between rounded-[var(--radius-tile)] border-2 bg-surface p-3.5 text-left transition-colors active:scale-[.99] ${q ? "border-blue" : "border-transparent"}`}
                          >
                            <span className="pr-6 text-[17px] leading-snug font-bold">{m.name}</span>
                            <span className="mt-2 flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
                              <span className="num text-[16.5px] font-semibold">{won(m.listedPriceKrw)}</span>
                              <span className="flex items-center gap-1.5 text-[12.5px]">
                                <span className="rounded-full bg-floor px-2 py-0.5 font-semibold text-ink-2">{m.isSide ? "사이드" : COOK_TYPE_LABEL[m.cookType]}</span>
                                {prep && <span className="font-semibold text-ink-2">{prep}</span>}
                              </span>
                            </span>
                            {q > 0 && <span className="num absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-full bg-blue text-[14px] font-bold text-white">{q}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-4 text-[12.5px] leading-relaxed text-ink-3">가격은 공개 목록의 참고 가격이에요. 준비시간은 지금 주문량을 반영한 예측이에요.</p>
                </section>
              </div>

              {/* cart */}
              <div className="shrink-0 border-t border-line bg-surface px-4 pt-3 pb-4 shadow-[0_-8px_24px_rgba(17,26,46,.06)] sm:px-5">
                {cart.length > 0 ? (
                  <ul className="mb-2.5 max-h-[24vh] space-y-1.5 overflow-y-auto" aria-label="장바구니">
                    {cart.map((l) => {
                      const m = getMenu(l.menuId)!;
                      return (
                        <li key={l.menuId} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[15.5px]">
                            <span className="text-ink-3">{getBrand(m.brandId)?.name}</span> {m.name}
                          </span>
                          <button onClick={() => dec(l.menuId)} className="grid size-10 place-items-center rounded-full bg-floor text-[20px] font-bold" aria-label={`${m.name} 하나 빼기`}>
                            −
                          </button>
                          <span className="num w-5 text-center text-[16px] font-bold">{l.qty}</span>
                          <button onClick={() => add(l.menuId)} className="grid size-10 place-items-center rounded-full bg-floor text-[20px] font-bold" aria-label={`${m.name} 하나 더`}>
                            +
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mb-2.5 text-[15px] text-ink-3">메뉴를 누르면 여기에 담겨요.</p>
                )}
                {brandCount > 1 && (
                  <p className="mb-2.5 rounded-xl bg-ice px-3 py-2 text-[13.5px] font-semibold text-blue-ink">
                    매장이 {brandCount}곳이라 번호표가 {brandCount}장 나와요.
                  </p>
                )}
                <div className="flex items-center gap-2.5">
                  <button onClick={reset} className="h-16 shrink-0 rounded-2xl bg-floor px-4 text-[17px] font-semibold sm:px-6">
                    처음으로
                  </button>
                  <button
                    disabled={cart.length === 0}
                    onClick={() => setStep("pay")}
                    className="flex h-16 min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl bg-blue px-4 text-[18px] font-bold text-white disabled:bg-line-2 sm:px-6 sm:text-[19px]"
                  >
                    <span className="whitespace-nowrap">
                      <span className="num">{count}</span>개 결제하기
                    </span>
                    <span className="num truncate">{won(total)}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "pay" && (
            <motion.div key="pay" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-8">
              <div className="m-auto flex w-full max-w-md flex-col">
                <p className="text-center text-[16px] font-semibold text-ink-2">결제 금액</p>
                <p className="num mt-1 text-center text-[48px] leading-tight font-[800] tracking-[-0.03em]">{won(total)}</p>
                <ul className="mt-5 space-y-2" aria-label="매장별 주문">
                  {cartBrands.map((bid) => {
                    const b = getBrand(bid)!;
                    const lines = cart.filter((l) => getMenu(l.menuId)?.brandId === bid);
                    return (
                      <li key={bid} className="flex items-start gap-3 rounded-[var(--radius-tile)] bg-surface p-3.5">
                        <BrandMark brandId={bid} name={b.name} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[15.5px] font-bold">{b.name}</p>
                          <p className="text-[13.5px] text-ink-2">{lines.map((l) => `${getMenu(l.menuId)?.name} ×${l.qty}`).join(", ")}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-ice px-2.5 py-1 text-[12px] font-bold text-blue-ink">번호표 1장</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-4 rounded-xl bg-[#e9ecf3] px-4 py-3 text-[14px] leading-relaxed text-ink-2">
                  시연용 <b className="text-ink">모의 결제</b>예요. 실제로 돈이 나가거나 카드 정보를 받지 않아요.
                </p>
                {error && (
                  <p role="alert" className="mt-3 rounded-xl bg-very-bg px-4 py-3 text-[15px] font-semibold text-very">
                    {error}
                  </p>
                )}
                <div className="flex flex-col gap-2.5 pt-7">
                  <button onClick={pay} disabled={busy || !backend} className="h-16 rounded-2xl bg-blue text-[20px] font-bold text-white disabled:opacity-60">
                    {busy ? "결제하는 중…" : "모의 결제 완료"}
                  </button>
                  <button onClick={() => setStep("menu")} className="h-14 rounded-2xl bg-surface text-[17px] font-semibold">
                    메뉴로 돌아가기
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "tickets" && result && (
            <motion.div key="tickets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-5 pb-5 sm:px-5">
              <h1 className="text-[24px] font-bold sm:text-[26px]">번호표 {result.tickets.length}장이 나왔어요</h1>
              <p className="mt-1 text-[15px] text-ink-2 sm:text-[16px]">
                {info?.kind === "device"
                  ? "번호표 아래 ‘학생 앱에 연결’을 누르면 QR을 찍은 것처럼 이 브라우저의 학생 앱에 연결돼요."
                  : "번호표의 QR을 휴대폰 카메라로 찍으면, 음식이 준비됐을 때 알려 드려요."}
              </p>
              {info?.kind === "device" && (
                <p className="mt-2 rounded-xl bg-[#fff4dc] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[#5c3d00]" role="note">
                  한 기기 체험 중이라 <b>다른 휴대폰 카메라로 QR을 찍으면 주문을 찾을 수 없어요.</b> 기기 간 연동은 공용 저장소를 연결한 뒤에 가능해요.
                </p>
              )}
              <p className="sr-only">
              </p>
              {onLocalhost && info?.kind === "server" && (
                <p className="mt-2 rounded-xl bg-normal-bg px-4 py-2.5 text-[14px] text-normal">
                  이 화면을 localhost로 열어서 다른 기기에서는 QR 주소에 접속할 수 없어요. 같은 Wi-Fi의 IP 주소로 키오스크를 열어 주세요.
                </p>
              )}
              <ul className="mt-4 grid grid-cols-1 content-start gap-3 min-[560px]:grid-cols-2">
                {result.tickets.map(({ order, token }) => {
                  const b = getBrand(order.brandId)!;
                  const url = `${origin}/o/${token}`;
                  return (
                    <li key={order.id} className="relative overflow-hidden rounded-[18px] bg-surface shadow-[0_1px_0_var(--color-line)]" data-testid="ticket">
                      <div className="flex items-start justify-between gap-3 p-4 pb-3">
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 text-[16px] font-bold">
                            <BrandMark brandId={b.id} name={b.name} size={26} />
                            <span className="truncate">{b.name}</span>
                          </p>
                          <p className="num mt-2 text-[54px] leading-none font-[800] tracking-[-0.04em] text-navy" data-testid="ticket-number">
                            {order.displayNumber}
                          </p>
                        </div>
                        <Qr value={url} size={120} label={`${b.name} ${order.displayNumber}번 주문 추적 QR`} />
                      </div>
                      <div className="border-t border-dashed border-line-2 px-4 pt-2.5 pb-4">
                        <ul className="space-y-0.5 text-[14.5px] text-ink-2">
                          {order.items.map((i) => (
                            <li key={i.menuId}>
                              {i.name} <span className="num">×{i.qty}</span>
                            </li>
                          ))}
                        </ul>
                        {order.prepEstimate && <p className="mt-1.5 text-[13.5px] font-semibold">준비 예상 {prepText(order.prepEstimate.p50, order.prepEstimate.p80)}</p>}
                        <a
                          href={url}
                          target={inFrame ? "student" : "_blank"}
                          rel="noreferrer"
                          data-testid="ticket-link"
                          title={url}
                          className={`mt-3 flex min-h-11 items-center justify-center rounded-xl px-3 text-center text-[14px] font-bold ${info?.kind === "device" ? "bg-navy text-white" : "bg-floor text-[12.5px] font-medium text-ink-3"}`}
                        >
                          {info?.kind === "device" ? "학생 앱에 연결 (이 기기에서 열기)" : <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>}
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-auto flex gap-2.5 pt-5">
                <button onClick={() => window.print()} className="h-14 flex-1 rounded-2xl bg-surface text-[17px] font-semibold">
                  번호표 인쇄
                </button>
                <button onClick={reset} className="h-14 flex-[2] rounded-2xl bg-navy text-[18px] font-bold text-white">
                  처음 화면으로
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-t border-line bg-surface px-4 py-2 text-[12px] text-ink-3 sm:px-5">
          <span>모의 키오스크 · {kiosk?.label ?? kioskId}</span>
          <span className="whitespace-nowrap">
            {demo ? <>세션 {demo.session}</> : null}
            {info?.kind === "device" ? " · 한 기기 체험" : ""}
            {!inFrame && (
              <>
                {" · "}
                <Link href="/" className="underline">
                  체험 홈
                </Link>
              </>
            )}
          </span>
        </footer>
      </div>
    </div>
  );
}
