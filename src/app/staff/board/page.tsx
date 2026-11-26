"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { brands, getBrand } from "@/core/catalog";
import type { StaffOrder } from "@/core/orders/types";
import { useBackend, useDemoContext, useNow, useSessionOrders } from "@/client/hooks";
import { saveStaffBrand, savedStaffBrand } from "@/client/session";
import { StaffAuthForm, useStaffAuth } from "@/components/staff/StaffAuth";
import { Logo } from "@/components/brand/Logo";
import { elapsed, prepText } from "@/lib/format";

type Age = "fresh" | "due" | "late";
/** Demo-only view: every brand's tickets on one screen, so one person can run the whole loop. */
const ALL = "all";
const AGE_STYLE: Record<Age, { head: string; label: string }> = {
  fresh: { head: "bg-[#2a3550] text-white", label: "" },
  due: { head: "bg-[#f2b630] text-[#2a1d00]", label: "평소 시간 지남" },
  late: { head: "bg-[#d8343a] text-white", label: "늦어지는 중" },
};

/**
 * Auxiliary order board (mock KDS) for judges/demo: every open ticket, one tap to complete.
 * The primary staff surface is the number-entry device at /staff (matches how the real stores work).
 */
export default function StaffBoardPage() {
  const { backend, info } = useBackend();
  const demo = useDemoContext();
  const [brandId, setBrandId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [inFrame, setInFrame] = useState(false);
  useEffect(() => setInFrame(window.top !== window.self), []);
  const [search, setSearch] = useState("");
  useEffect(() => setSearch(window.location.search), []);
  useEffect(() => {
    const b = savedStaffBrand();
    if (b && (b === ALL || getBrand(b))) setBrandId(b);
    setReady(true);
  }, []);
  // laptop server mode: staff actions need this session's staff key (or the operator key)
  const { auth, setAuth, authMsg, setAuthMsg } = useStaffAuth(backend, info, demo);
  const { orders, loaded } = useSessionOrders(auth === "ok" ? backend : null, demo?.session);
  const now = useNow(1000);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const mine = useMemo(() => (brandId === ALL ? orders : orders.filter((o) => o.brandId === brandId)), [orders, brandId]);
  useEffect(() => {
    // switching stores must not keep the picker's scroll position (header would start hidden)
    window.scrollTo(0, 0);
  }, [brandId]);
  const open = mine.filter((o) => o.status === "accepted").sort((a, b) => a.acceptedAt - b.acceptedAt);
  const done = mine.filter((o) => o.status === "ready" || o.status === "closed").sort((a, b) => (b.readyAt ?? 0) - (a.readyAt ?? 0)).slice(0, 10);
  const allDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of open) for (const i of o.items) m.set(i.name, (m.get(i.name) ?? 0) + i.qty);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [open]);

  const act = async (o: StaffOrder, undo = false) => {
    if (!backend || !demo) return;
    setPending((p) => new Set(p).add(o.id));
    setError(null);
    try {
      await backend.setReady(demo.session, o.id, `${undo ? "undo" : "ready"}:${o.id}:v${o.version}`, undo);
    } catch (e) {
      if ((e as { status?: number }).status === 403) {
        setAuth("needed");
        setAuthMsg("직원 키가 맞지 않아요. 운영자에게 다시 받아 주세요.");
      } else setError("처리하지 못했어요. 네트워크를 확인하고 다시 눌러 주세요.");
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(o.id);
        return n;
      });
    }
  };

  const ageOf = (o: StaffOrder): Age => {
    if (!o.prepEstimate) return "fresh";
    const w = (now - o.acceptedAt) / 1000;
    return w > o.prepEstimate.p80 ? "late" : w > o.prepEstimate.p50 ? "due" : "fresh";
  };

  if (!ready || auth === "unknown") return <div className="min-h-dvh bg-[#11192b]" />;

  if (auth === "needed" && demo) return <StaffAuthForm session={demo.session} backend={backend} msg={authMsg} setMsg={setAuthMsg} onOk={() => setAuth("ok")} />;

  if (!brandId) {
    return (
      <div className="min-h-dvh bg-[#11192b] px-5 py-8 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2">
            <Logo size={24} tone="white" />
            <p className="text-[14px] font-semibold opacity-80">주문 목록 · 보조 화면(모의)</p>
          </div>
          <h1 className="mt-3 text-[28px] font-bold">어느 매장 화면인가요?</h1>
          <p className="mt-1 text-[15px] opacity-75">한 번 고르면 이 기기에 저장돼요.</p>
          <button
            onClick={() => {
              saveStaffBrand(ALL);
              setBrandId(ALL);
            }}
            className="mt-6 flex w-full items-center justify-between gap-4 rounded-2xl bg-blue px-5 py-4 text-left hover:brightness-110"
          >
            <span>
              <span className="block text-[19px] font-bold">모든 매장 한 화면에서</span>
              <span className="block text-[13.5px] opacity-85">시연용 · 매장 10곳의 주문을 한 화면에서 완료해 볼 수 있어요</span>
            </span>
            <span aria-hidden className="text-[22px]">→</span>
          </button>
          <p className="mt-6 text-[13px] font-semibold opacity-60">또는 한 매장만</p>
          <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {brands.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => {
                    saveStaffBrand(b.id);
                    setBrandId(b.id);
                  }}
                  className="flex h-24 w-full flex-col justify-center rounded-2xl bg-white/8 px-5 text-left ring-1 ring-white/10 hover:bg-white/12"
                >
                  <span className="text-[19px] font-bold">{b.name}</span>
                  <span className="text-[13.5px] opacity-70">{b.cuisine}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const isAll = brandId === ALL;
  const brand = isAll ? null : getBrand(brandId)!;
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#11192b] text-white">
      <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-white/10 px-5 py-3">
        <div className="flex flex-1 items-center gap-3">
          <Logo size={26} tone="white" />
          <div>
            <p className="text-[12px] whitespace-nowrap opacity-70">주문 목록 · 보조 화면(모의)</p>
            <h1 className="text-[22px] leading-tight font-bold">{brand ? brand.name : "모든 매장 (시연)"}</h1>
          </div>
        </div>
        <dl className="flex gap-6 text-center">
          <div>
            <dt className="text-[12px] opacity-70">조리할 주문</dt>
            <dd className="num text-[26px] leading-tight font-bold" data-testid="open-count">
              {open.length}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] opacity-70">늦어지는 중</dt>
            <dd className="num text-[26px] leading-tight font-bold text-[#ff8a8e]">{open.filter((o) => ageOf(o) === "late").length}</dd>
          </div>
        </dl>
        <button onClick={() => setBrandId(null)} className="rounded-full px-4 py-2 text-[14px] font-semibold ring-1 ring-white/25">
          매장 바꾸기
        </button>
        <Link href={`/staff${search}`} className="rounded-full bg-white px-4 py-2 text-[14px] font-semibold text-[#11192b]">
          번호 호출기로
        </Link>
      </header>
      <p className="shrink-0 bg-white/5 px-5 py-1.5 text-[12.5px] text-white/70">
        실제 매장은 음식이 준비되면 전용 기기에 번호만 눌러요. 이 목록은 심사·시연용 보조 화면이에요.
      </p>

      {error && (
        <p role="alert" className="mx-5 mt-3 rounded-xl bg-very px-4 py-3 font-semibold">
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <main className="min-w-0 flex-1 overflow-x-auto p-4 lg:overflow-y-auto">
          {!loaded ? (
            <p className="py-16 text-center opacity-70">주문을 불러오는 중…</p>
          ) : open.length === 0 ? (
            <div className="grid h-full min-h-[150px] place-items-center rounded-2xl px-4 py-6 text-center ring-1 ring-white/10">
              <div className="text-center">
                <p className="text-[22px] font-bold">조리할 주문이 없어요</p>
                <p className="mt-1 text-[15px] opacity-70">키오스크에서 {brand ? `${brand.name} 메뉴를` : "아무 매장이나"} 주문하면 여기에 바로 나타나요.</p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-3 sm:flex-row sm:items-start" aria-label="조리할 주문 (들어온 순서)">
              <AnimatePresence initial={false}>
                {open.map((o, idx) => {
                  const age = ageOf(o);
                  const st = AGE_STYLE[age];
                  return (
                    <motion.li
                      key={o.id}
                      layout
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.22 }}
                      className="flex w-full shrink-0 flex-col overflow-hidden rounded-2xl bg-white text-ink sm:w-[250px]"
                      data-testid="staff-order"
                    >
                      <div className={`flex items-baseline justify-between px-4 py-2.5 ${st.head}`}>
                        <span>
                          {isAll && <span className="block text-[12.5px] font-bold opacity-90">{getBrand(o.brandId)?.name}</span>}
                          <span className="num text-[34px] leading-none font-[800] tracking-[-0.04em]">{o.displayNumber}</span>
                        </span>
                        <span className="text-right">
                          <span className="num block text-[15px] font-bold">{elapsed(o.acceptedAt, now)}</span>
                          <span className="block text-[11.5px] font-semibold opacity-85">{st.label || `${idx + 1}번째`}</span>
                        </span>
                      </div>
                      <ul className="flex-1 space-y-1.5 px-4 py-3 text-[17px]">
                        {o.items.map((i) => (
                          <li key={i.menuId} className="flex gap-2">
                            <span className="num w-7 shrink-0 font-[800] text-blue-ink">{i.qty}</span>
                            <span className="font-semibold">{i.name}</span>
                          </li>
                        ))}
                      </ul>
                      {o.prepEstimate && <p className="px-4 pb-2 text-[12.5px] text-ink-3">예측 {prepText(o.prepEstimate.p50, o.prepEstimate.p80)} · 실제 완료는 아래 버튼으로만</p>}
                      <button
                        onClick={() => act(o)}
                        disabled={pending.has(o.id)}
                        className="h-14 bg-free text-[19px] font-bold text-white active:brightness-95 disabled:opacity-60"
                        aria-label={`${isAll ? `${getBrand(o.brandId)?.name} ` : ""}${o.displayNumber}번 완료`}
                      >
                        완료
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </main>

        <aside className="shrink-0 border-t border-white/10 p-4 lg:w-[260px] lg:overflow-y-auto lg:border-t-0 lg:border-l" aria-labelledby="allday-h">
          <h2 id="allday-h" className="text-[14px] font-bold opacity-80">
            지금 만들 품목 합계
          </h2>
          {allDay.length === 0 ? (
            <p className="mt-2 text-[14px] opacity-60">없음</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {allDay.map(([name, n]) => (
                <li key={name} className="flex justify-between gap-2 text-[16px]">
                  <span className="truncate">{name}</span>
                  <span className="num font-[800]">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <footer className="shrink-0 border-t border-white/10 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2" aria-label="최근 완료">
          <span className="mr-1 text-[13px] font-semibold opacity-70">최근 완료 (모니터·학생 휴대폰에 표시됨)</span>
          {done.map((o) => {
            const canUndo = o.status === "ready" && o.readyAt && now - o.readyAt < 10_000;
            return (
              <span key={o.id} className="flex items-center gap-2 rounded-full bg-white/10 py-1 pr-1 pl-3">
                {isAll && <span className="text-[12px] font-semibold opacity-80">{getBrand(o.brandId)?.name}</span>}
                <span className="num text-[16px] font-bold">{o.displayNumber}</span>
                <span className="text-[12px] opacity-70">{o.status === "closed" ? "수령 확인" : "완료"}</span>
                {canUndo ? (
                  <button onClick={() => act(o, true)} className="rounded-full bg-white px-3 py-1 text-[12.5px] font-bold text-ink">
                    되돌리기 {Math.ceil((10_000 - (now - o.readyAt!)) / 1000)}
                  </button>
                ) : (
                  <span className="w-1" />
                )}
              </span>
            );
          })}
          <span className="ml-auto text-[12px] opacity-60">
            세션 {demo?.session} {info?.kind === "device" ? "· 한 기기 체험" : ""}
            {!inFrame && (
              <>
                {" · "}
                <Link href="/" className="underline">
                  체험 홈
                </Link>
              </>
            )}
          </span>
        </div>
      </footer>
    </div>
  );
}
