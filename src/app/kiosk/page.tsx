"use client";
/**
 * Mock kiosk. The flow follows the real 1947 COMMONS kiosk seen on 2026-11-25 (start screen with a
 * 주문하기 button → yellow top bar with a home button → brand tabs in two rows of five → menu grid
 * with NEW/BEST/준비중 → order cart with total → payment → receipt). FLOWEAT's additions are marked
 * in blue: prep-time estimates and the order-tracking QR on each brand ticket. Payment is mock.
 * No operator logo, real food photos or brand logos are used (rights not cleared).
 */
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { brands, demoPreparing, getBrand, getMenu, menusOf, type Menu } from "@/core/catalog";
import { kioskById } from "@/core/layout";
import type { CartLine, PlaceOrderResult } from "@/core/orders/types";
import { demoClock, prepForMenu } from "@/core/world";
import { BackendError } from "@/client/backend";
import { liveBacklogOf, useBackend, useDemoContext, useSessionOrders, useWorld } from "@/client/hooks";
import { currentKiosk } from "@/client/session";
import { Qr } from "@/components/Qr";
import { DishArt } from "@/components/kiosk/DishArt";
import { won, prepText } from "@/lib/format";

type Step = "attract" | "menu" | "pay" | "tickets";
type ReceiptKind = "full" | "simple";

const YELLOW = "#f3e33a";

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
  const [receipt, setReceipt] = useState<ReceiptKind>("full");
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
    setReceipt("full");
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
  const preparing = useMemo(() => demoPreparing(clock.dateKey), [clock.dateKey]);
  const prepLine = (menuId: string) => {
    if (!engine) return null;
    const e = prepForMenu(engine, clock, menuId, liveBacklog[menuId.split("-")[0]] ?? 0);
    return e && Number.isFinite(e.p50) ? prepText(e.p50, e.p80) : null;
  };
  const brandPrep = (id: string) => {
    const v = world?.brands.find((b) => b.id === id);
    return v && Number.isFinite(v.p50) ? prepText(v.p50, v.p80) : null;
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
  const unknownPrice = cart.some((l) => getMenu(l.menuId)?.listedPriceKrw == null);
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const cartBrands = [...new Set(cart.map((l) => getMenu(l.menuId)?.brandId))].filter(Boolean) as string[];

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
  const brand = getBrand(brandId)!;

  return (
    <div className={`flex min-h-dvh items-stretch justify-center bg-[#1b2233] ${large ? "text-[118%]" : ""}`} onPointerDown={touch}>
      <div className="relative flex h-dvh w-full max-w-[820px] flex-col overflow-hidden bg-[#f4f4f1]">
        <AnimatePresence mode="wait">
          {step === "attract" && (
            <motion.div key="attract" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white">
              <div className="flex shrink-0 items-center justify-end gap-2 px-4 pt-4">
                <LargeToggle large={large} setLarge={setLarge} light />
              </div>
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-4 text-center">
                <p className="text-[13px] font-bold tracking-[0.32em] text-ink-3">1947 COMMONS</p>
                <h1 className="mt-2 text-[40px] leading-none font-[850] tracking-[-0.04em] text-[#1b2233] sm:text-[52px]">FOOD MARKET</h1>
                <div className="mt-8 flex items-end justify-center gap-1 sm:gap-3" aria-hidden>
                  {["kaohsiung-089", "babi-025", "gapjjigae-006", "tokyoya-085", "gyeongseong-014"].map((id, i) => {
                    const m = getMenu(id);
                    return m ? (
                      <span key={id} className={i === 2 ? "" : i % 2 ? "translate-y-3" : "translate-y-6"}>
                        <DishArt menu={m} size={i === 2 ? 116 : 84} />
                      </span>
                    ) : null;
                  })}
                </div>
                <p className="mt-8 max-w-sm text-[15px] leading-relaxed text-ink-2">10개 매장 메뉴를 한 번에 주문하고, 매장마다 번호표를 받아요.</p>
              </div>
              <div className="shrink-0 px-5 pb-5 sm:px-8">
                <button
                  onClick={() => {
                    setStep("menu");
                    touch();
                  }}
                  className="h-[84px] w-full rounded-[22px] text-[28px] font-[800] text-[#1b2233] shadow-[0_10px_30px_rgba(160,140,0,.25)] active:brightness-95"
                  style={{ background: YELLOW }}
                >
                  주문하기
                </button>
                <p className="mt-3 text-center text-[12.5px] leading-relaxed text-ink-3">
                  실제 학식 키오스크의 주문 흐름을 참고한 <b className="text-ink-2">모의 키오스크</b>예요. 파란색 표시는 FLOWEAT이 더한 기능이에요.
                </p>
              </div>
            </motion.div>
          )}

          {step === "menu" && (
            <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-0 flex-1 flex-col">
              <TopBar onHome={reset} large={large} setLarge={setLarge} />
              <div role="tablist" aria-label="매장" className="grid shrink-0 grid-cols-5 gap-1 bg-[#eceae2] p-1.5">
                {brands.map((b) => {
                  const n = cart.filter((l) => getMenu(l.menuId)?.brandId === b.id).reduce((s, l) => s + l.qty, 0);
                  const on = b.id === brandId;
                  return (
                    <button
                      key={b.id}
                      role="tab"
                      aria-selected={on}
                      aria-label={`${b.name}${n ? `, ${n}개 담음` : ""}`}
                      onClick={() => {
                        setBrandId(b.id);
                        touch();
                      }}
                      className={`relative flex min-h-[52px] items-center justify-center rounded-[10px] px-1 text-center text-[14px] leading-tight font-semibold sm:min-h-[58px] sm:text-[16px] ${on ? "bg-[#d9dcf3] text-[#1b2233]" : "bg-white text-ink-2"}`}
                    >
                      {b.name}
                      {n > 0 && <span className="num absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-[#d23a35] text-[11px] font-bold text-white">{n}</span>}
                    </button>
                  );
                })}
              </div>

              <section className="min-h-0 flex-1 overflow-y-auto px-2.5 pt-2.5 pb-4 sm:px-3" aria-label={`${brand.name} 메뉴`}>
                <div className="mb-2.5 flex items-center justify-between gap-3 rounded-xl bg-[#e8efff] px-3.5 py-2.5 text-[#14348f]">
                  <p className="min-w-0 text-[14px] font-semibold">
                    <span className="mr-1.5 rounded bg-[#2448db] px-1.5 py-0.5 text-[11px] font-bold text-white">FLOWEAT</span>
                    {brand.name} 주문 후 준비
                  </p>
                  <p className="num shrink-0 text-[17px] font-[800]">{brandPrep(brandId) ?? "–"}</p>
                </div>
                <ul className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 min-[700px]:grid-cols-4">
                  {menusOf(brandId).map((m) => (
                    <MenuTile key={m.id} m={m} qty={cart.find((l) => l.menuId === m.id)?.qty ?? 0} preparing={preparing.has(m.id)} prep={m.isSide ? null : prepLine(m.id)} onAdd={() => add(m.id)} />
                  ))}
                </ul>
                <p className="mt-4 px-1 text-[12px] leading-relaxed text-ink-3">
                  메뉴명·가격은 2026-11-25 현장 키오스크 화면 기준이고, 그때 보지 못한 메뉴는 참고 가격이에요. ‘준비중’ 표시는 이 시연에서 날짜마다 임의로 정한 예시라 실제 판매 상태와 관계없어요. 그림은 실제 음식 사진이 아니에요.
                </p>
              </section>

              {/* order cart */}
              <div className="shrink-0 border-t border-[#dcdad2] bg-white shadow-[0_-8px_24px_rgba(17,26,46,.06)]">
                <div className="flex items-center justify-between px-4 pt-2.5 sm:px-5">
                  <h2 className="text-[15px] font-bold">
                    주문카트 <span className="num text-ink-3">{count}</span>
                  </h2>
                  {cart.length > 0 && (
                    <button onClick={() => setCart([])} className="h-9 rounded-full px-3 text-[13.5px] font-semibold text-ink-3">
                      전체 삭제
                    </button>
                  )}
                </div>
                {cart.length > 0 ? (
                  <ul className="max-h-[22vh] space-y-1 overflow-y-auto px-4 pt-1 sm:px-5" aria-label="장바구니">
                    {cart.map((l) => {
                      const m = getMenu(l.menuId)!;
                      return (
                        <li key={l.menuId} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[15px]">
                            <span className="text-ink-3">{getBrand(m.brandId)?.name}</span> {m.name}
                          </span>
                          <span className="num hidden w-20 text-right text-[14px] text-ink-2 min-[420px]:block">{won(m.listedPriceKrw == null ? null : m.listedPriceKrw * l.qty)}</span>
                          <button onClick={() => dec(l.menuId)} className="grid size-10 place-items-center rounded-full bg-[#f1f0ea] text-[20px] font-bold" aria-label={`${m.name} 하나 빼기`}>
                            −
                          </button>
                          <span className="num w-5 text-center text-[16px] font-bold">{l.qty}</span>
                          <button onClick={() => add(l.menuId)} className="grid size-10 place-items-center rounded-full bg-[#f1f0ea] text-[20px] font-bold" aria-label={`${m.name} 하나 더`}>
                            +
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-4 pt-1 text-[14.5px] text-ink-3 sm:px-5">메뉴를 누르면 여기에 담겨요.</p>
                )}
                {cartBrands.length > 1 && (
                  <p className="mx-4 mt-2 rounded-xl bg-[#e8efff] px-3 py-2 text-[13.5px] font-semibold text-[#14348f] sm:mx-5">
                    매장이 {cartBrands.length}곳이라 번호표가 {cartBrands.length}장 나와요.
                  </p>
                )}
                <div className="flex items-center gap-2.5 px-4 pt-2.5 pb-4 sm:px-5">
                  <div className="shrink-0">
                    <p className="text-[12.5px] text-ink-3">합계</p>
                    <p className="num text-[22px] leading-tight font-[800]">{won(total)}{unknownPrice ? "+" : ""}</p>
                  </div>
                  <button
                    disabled={cart.length === 0}
                    onClick={() => setStep("pay")}
                    className="flex h-16 min-w-0 flex-1 items-center justify-center rounded-2xl text-[20px] font-[800] text-[#1b2233] disabled:bg-[#e4e2da] disabled:text-ink-3"
                    style={cart.length ? { background: YELLOW } : undefined}
                  >
                    <span className="num">{count}</span>개 결제하기
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === "pay" && (
            <motion.div key="pay" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex min-h-0 flex-1 flex-col">
              <TopBar onHome={reset} large={large} setLarge={setLarge} title="결제" />
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-8">
                <div className="mx-auto flex w-full max-w-md flex-col">
                  <p className="text-center text-[16px] font-semibold text-ink-2">결제 금액</p>
                  <p className="num mt-1 text-center text-[46px] leading-tight font-[800] tracking-[-0.03em]">{won(total)}</p>
                  {unknownPrice && <p className="text-center text-[12.5px] text-ink-3">가격 미표기 메뉴는 합계에서 빠졌어요.</p>}
                  <ul className="mt-4 space-y-2" aria-label="매장별 주문">
                    {cartBrands.map((bid) => {
                      const b = getBrand(bid)!;
                      const lines = cart.filter((l) => getMenu(l.menuId)?.brandId === bid);
                      return (
                        <li key={bid} className="flex items-start gap-3 rounded-2xl bg-white p-3.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-[15.5px] font-bold">{b.name}</p>
                            <p className="text-[13.5px] text-ink-2">{lines.map((l) => `${getMenu(l.menuId)?.name} ×${l.qty}`).join(", ")}</p>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#fff6b8] px-2.5 py-1 text-[12px] font-bold text-[#5c4a00]">번호표 1장</span>
                        </li>
                      );
                    })}
                  </ul>

                  <fieldset className="mt-5">
                    <legend className="text-[15px] font-bold">영수증</legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(
                        [
                          ["full", "주문영수증", "매장명·메뉴·번호"],
                          ["simple", "간이영수증", "매장명·번호만"],
                        ] as const
                      ).map(([k, label, sub]) => (
                        <label key={k} className={`flex cursor-pointer flex-col rounded-2xl border-2 bg-white px-3.5 py-3 ${receipt === k ? "border-[#1b2233]" : "border-transparent"}`}>
                          <input type="radio" name="receipt" value={k} checked={receipt === k} onChange={() => setReceipt(k)} className="sr-only" />
                          <span className="text-[15.5px] font-bold">{label}</span>
                          <span className="text-[12.5px] text-ink-3">{sub}</span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">현장 안내문: 간이영수증은 매장명만 나오고 메뉴명은 나오지 않아요. 음식을 받을 때 영수증을 가져가거나 제출해 주세요.</p>
                  </fieldset>

                  <p className="mt-4 rounded-xl bg-[#e9ecf3] px-4 py-3 text-[14px] leading-relaxed text-ink-2">
                    실제 키오스크의 카드·간편결제 단계 대신 <b className="text-ink">모의 결제</b>를 해요. 돈이 나가거나 카드 정보를 받지 않아요.
                  </p>
                  {error && (
                    <p role="alert" className="mt-3 rounded-xl bg-very-bg px-4 py-3 text-[15px] font-semibold text-very">
                      {error}
                    </p>
                  )}
                  <div className="flex flex-col gap-2.5 pt-6">
                    <button onClick={pay} disabled={busy || !backend} className="h-16 rounded-2xl text-[20px] font-[800] text-[#1b2233] disabled:opacity-60" style={{ background: YELLOW }}>
                      {busy ? "결제하는 중…" : "모의 결제 완료"}
                    </button>
                    <button onClick={() => setStep("menu")} className="h-14 rounded-2xl bg-white text-[17px] font-semibold">
                      메뉴로 돌아가기
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === "tickets" && result && (
            <motion.div key="tickets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-0 flex-1 flex-col">
              <TopBar onHome={reset} large={large} setLarge={setLarge} title="주문 완료" />
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4 pb-5 sm:px-5">
                <h1 className="text-[23px] font-bold sm:text-[25px]">영수증 {result.tickets.length}장이 나왔어요</h1>
                <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">
                  호출 모니터에 번호가 뜨면 매장 카운터에서 영수증을 보여 주고 받아 가세요.{" "}
                  {info?.kind === "device" ? "영수증 아래 ‘학생 앱에 연결’을 누르면 QR을 찍은 것처럼 이 브라우저의 학생 앱에 연결돼요." : "QR을 휴대폰 카메라로 찍으면 준비됐을 때 알려 드려요."}
                </p>
                {info?.kind === "device" && (
                  <p className="mt-2 rounded-xl bg-[#fff4dc] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-[#5c3d00]" role="note">
                    한 기기 체험 중이라 <b>다른 휴대폰 카메라로 QR을 찍으면 주문을 찾을 수 없어요.</b> 기기 간 연동은 공용 저장소를 연결한 뒤에 가능해요.
                  </p>
                )}
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
                      <li key={order.id} className="receipt relative overflow-hidden rounded-t-[6px] bg-white pb-3 font-mono shadow-[0_2px_10px_rgba(17,26,46,.08)]" data-testid="ticket">
                        <div className="px-4 pt-4 text-center">
                          <p className="font-sans text-[13px] text-ink-3">{receipt === "full" ? "주문영수증" : "간이영수증"} · 모의</p>
                          <p className="mt-1 font-sans text-[18px] font-bold">{b.name}</p>
                          <p className="font-sans text-[12.5px] text-ink-3">주문번호</p>
                          <p className="num font-sans text-[60px] leading-none font-[850] tracking-[-0.04em] text-[#1b2233]" data-testid="ticket-number">
                            {order.displayNumber}
                          </p>
                        </div>
                        {receipt === "full" ? (
                          <ul className="mx-4 mt-3 space-y-0.5 border-y border-dashed border-line-2 py-2 text-[13.5px] text-ink-2">
                            {order.items.map((i) => (
                              <li key={i.menuId} className="flex justify-between gap-2">
                                <span className="truncate">{i.name}</span>
                                <span className="num shrink-0">×{i.qty}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mx-4 mt-3 border-y border-dashed border-line-2 py-2 text-center text-[12.5px] text-ink-3">간이영수증은 메뉴명이 나오지 않아요</p>
                        )}
                        <div className="mx-3 mt-3 rounded-xl bg-[#eef3ff] p-3 font-sans">
                          <div className="flex items-center gap-3">
                            <Qr value={url} size={104} label={`${b.name} ${order.displayNumber}번 주문 추적 QR`} />
                            <div className="min-w-0 text-[#14348f]">
                              <p className="text-[11px] font-bold tracking-wide">FLOWEAT 제안</p>
                              <p className="text-[14px] leading-snug font-bold">주문 추적 QR</p>
                              {order.prepEstimate && <p className="num mt-1 text-[13px] font-semibold">준비 예상 {prepText(order.prepEstimate.p50, order.prepEstimate.p80)}</p>}
                              <p className="mt-1 text-[11.5px] leading-snug text-[#3b4f8f]">준비되면 휴대폰으로 알려 드려요</p>
                            </div>
                          </div>
                          <a
                            href={url}
                            target={inFrame ? "student" : "_blank"}
                            rel="noreferrer"
                            data-testid="ticket-link"
                            title={url}
                            className={`mt-2.5 flex min-h-11 items-center justify-center rounded-xl px-3 text-center text-[14px] font-bold ${info?.kind === "device" ? "bg-[#2448db] text-white" : "bg-white text-[12.5px] font-medium text-ink-3"}`}
                          >
                            {info?.kind === "device" ? "학생 앱에 연결 (이 기기에서 열기)" : <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>}
                          </a>
                        </div>
                        <p className="mx-4 mt-2.5 font-sans text-[12px] leading-relaxed text-ink-3">음식을 받을 때 이 영수증을 가져가거나 제출해 주세요. 영수증이 안 나왔다면 매장 벨을 눌러 주세요.</p>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-auto flex gap-2.5 pt-5">
                  <button onClick={() => window.print()} className="h-14 flex-1 rounded-2xl bg-white text-[17px] font-semibold">
                    영수증 인쇄
                  </button>
                  <button onClick={reset} className="h-14 flex-[2] rounded-2xl bg-[#1b2233] text-[18px] font-bold text-white">
                    처음 화면으로
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-t border-[#dcdad2] bg-white px-4 py-2 text-[12px] text-ink-3 sm:px-5">
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

function LargeToggle({ large, setLarge, light }: { large: boolean; setLarge: (f: (v: boolean) => boolean) => void; light?: boolean }) {
  return (
    <button
      onClick={() => setLarge((v) => !v)}
      aria-pressed={large}
      className={`shrink-0 rounded-full border px-3.5 py-2 text-[14px] font-semibold ${large ? "border-[#1b2233] bg-[#1b2233] text-white" : light ? "border-line-2 text-ink-2" : "border-[#1b2233]/25 bg-white/60 text-[#1b2233]"}`}
    >
      글자 크게
    </button>
  );
}

/** Yellow top bar with a round home button, as on the real kiosk. */
function TopBar({ onHome, large, setLarge, title = "푸드마켓" }: { onHome: () => void; large: boolean; setLarge: (f: (v: boolean) => boolean) => void; title?: string }) {
  return (
    <header className="flex shrink-0 items-center gap-3 px-3 py-2.5 sm:px-4" style={{ background: YELLOW }}>
      <button onClick={onHome} aria-label="처음으로" className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-[#1b2233] shadow-[0_1px_4px_rgba(0,0,0,.12)]">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
          <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />
        </svg>
      </button>
      <p className="min-w-0 flex-1 truncate text-center text-[22px] font-bold text-[#1b2233] sm:text-[24px]">{title}</p>
      <LargeToggle large={large} setLarge={setLarge} />
    </header>
  );
}

function MenuTile({ m, qty, preparing, prep, onAdd }: { m: Menu; qty: number; preparing: boolean; prep: string | null; onAdd: () => void }) {
  const badge = m.field?.badge;
  const unknown = m.listedPriceKrw == null;
  return (
    <li>
      <button
        onClick={preparing ? undefined : onAdd}
        aria-disabled={preparing || undefined}
        aria-label={`${m.name}, ${unknown ? "가격 미표기" : won(m.listedPriceKrw)}${preparing ? ", 준비중" : ""}${prep ? `, 준비 예상 ${prep}` : ""}${badge ? `, ${badge}` : ""}${qty ? `, ${qty}개 담음` : ""}`}
        className={`relative flex h-full w-full flex-col items-center rounded-[12px] border-2 bg-white px-2 pt-2.5 pb-2.5 text-center transition-colors ${qty ? "border-[#1b2233]" : "border-transparent"} ${preparing ? "cursor-not-allowed" : "active:scale-[.98]"}`}
      >
        <span className="relative">
          <DishArt menu={m} size={86} dim={preparing} />
          {preparing && <span className="absolute inset-0 grid place-items-center text-[19px] font-[850] tracking-[0.2em] text-[#d23a35]">준비중</span>}
        </span>
        {badge && (
          <span
            className={`absolute top-1.5 left-1.5 rounded-[5px] px-1.5 py-0.5 text-[11px] font-[850] tracking-wide text-white ${badge === "BEST" ? "bg-[#c8312c]" : "bg-[#8f6700]"}`}
            title="2026-11-25 현장 화면 표시"
          >
            {badge}
          </span>
        )}
        {m.field?.spicyIcon && (
          <svg viewBox="0 0 24 24" className="absolute top-2 right-2 size-5" aria-hidden>
            <path d="M15 4c1 1 1 2 0 3 3 0 5 3 4 6-2 5-8 8-14 7 5-2 8-6 8-11 0-2 1-4 2-5z" fill="#d23a35" />
            <path d="M15 7c0-2 1-3 3-4" stroke="#3d7a3a" strokeWidth="1.8" fill="none" strokeLinecap="round" />
          </svg>
        )}
        <span className="mt-1.5 line-clamp-2 min-h-[2.5em] text-[14.5px] leading-tight font-semibold text-[#1b2233]">{m.name}</span>
        <span className="num mt-0.5 text-[14.5px] text-ink-2">{unknown ? "가격 미표기" : (m.listedPriceKrw ?? 0).toLocaleString("ko-KR")}</span>
        {prep && !preparing && <span className="num mt-1 rounded-full bg-[#e8efff] px-2 py-0.5 text-[11.5px] font-bold text-[#14348f]">준비 {prep}</span>}
        {qty > 0 && <span className="num absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-[#1b2233] text-[14px] font-bold text-white">{qty}</span>}
      </button>
    </li>
  );
}
