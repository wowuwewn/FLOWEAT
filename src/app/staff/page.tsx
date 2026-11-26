"use client";
/**
 * Store staff device (mock): when food is ready, staff type the ticket number and press 호출.
 * Matches the real workflow seen on site (2026-11-25): number in → number on the shared call
 * monitor. FLOWEAT adds only the student-app notification on top; staff do nothing extra.
 * The real device's look, buttons and protocol are NOT known — this is a stand-in, not a replica.
 * The full order board (mock KDS) stays at /staff/board as an auxiliary screen for judges.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { brands, getBrand } from "@/core/catalog";
import type { CallOutcome } from "@/core/orders/service";
import type { StaffOrder } from "@/core/orders/types";
import { useBackend, useDemoContext, useNow, useSessionOrders } from "@/client/hooks";
import { saveStaffBrand, savedStaffBrand } from "@/client/session";
import { StaffAuthForm, useStaffAuth } from "@/components/staff/StaffAuth";

const ALL = "all";
const UNDO_MS = 10_000;

interface Result {
  outcome: CallOutcome | "error" | "undone";
  brandId: string;
  number: number;
  order: StaffOrder | null;
  at: number;
}

const MESSAGE: Record<Result["outcome"], (b: string, n: number) => string> = {
  called: (b, n) => `${b} ${n}번을 호출했어요`,
  already_ready: (b, n) => `${b} ${n}번은 이미 호출된 번호예요`,
  already_closed: (b, n) => `${b} ${n}번은 이미 받아 간 주문이에요`,
  not_found: (b, n) => `${b}에 ${n}번 주문이 없어요`,
  invalid: () => "번호를 확인해 주세요",
  error: () => "처리하지 못했어요. 다시 눌러 주세요",
  undone: (b, n) => `${b} ${n}번 호출을 취소했어요`,
};
const TONE: Record<Result["outcome"], string> = {
  called: "bg-[#0b8457] text-white",
  already_ready: "bg-[#3a3f48] text-[#ffd479]",
  already_closed: "bg-[#3a3f48] text-[#ffd479]",
  not_found: "bg-[#c4263a] text-white",
  invalid: "bg-[#c4263a] text-white",
  error: "bg-[#c4263a] text-white",
  undone: "bg-white text-[#191b1f]",
};

export default function StaffCallerPage() {
  const { backend, info } = useBackend();
  const demo = useDemoContext();
  const [mode, setMode] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [inFrame, setInFrame] = useState(false);
  useEffect(() => setInFrame(window.top !== window.self), []);
  useEffect(() => {
    const b = savedStaffBrand();
    if (b && (b === ALL || getBrand(b))) setMode(b);
    setReady(true);
  }, []);
  const { auth, setAuth, authMsg, setAuthMsg } = useStaffAuth(backend, info, demo);
  const { orders } = useSessionOrders(auth === "ok" ? backend : null, demo?.session);
  const now = useNow(1000);

  const isAll = mode === ALL;
  const [picked, setPicked] = useState<string | null>(null);
  const pending = useMemo(() => orders.filter((o) => o.status === "accepted").sort((a, b) => a.acceptedAt - b.acceptedAt), [orders]);
  // in the all-stores demo, follow the oldest waiting order's store until someone picks one
  const brandId = isAll ? (picked ?? pending[0]?.brandId ?? brands[0].id) : mode;
  const brand = brandId ? getBrand(brandId) : null;
  const pendingHere = pending.filter((o) => o.brandId === brandId);

  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Result | null>(null);
  const [history, setHistory] = useState<Result[]>([]);

  const press = useCallback((k: string) => {
    setDigits((d) => (k === "back" ? d.slice(0, -1) : k === "clear" ? "" : d.length >= 4 ? d : (d + k).replace(/^0+/, "")));
  }, []);

  const submit = useCallback(async () => {
    if (!backend || !demo || !brandId || !digits || busy) return;
    const number = Number(digits);
    if (isAll) setPicked(brandId); // stay on this store after its last order is called
    setBusy(true);
    let r: Result;
    try {
      const res = await backend.callNumber(demo.session, brandId, number, `call:${brandId}:${number}:${Date.now().toString(36)}`);
      r = { outcome: res.outcome, brandId, number, order: res.order, at: Date.now() };
    } catch (e) {
      if ((e as { status?: number }).status === 403) {
        setAuth("needed");
        setAuthMsg("직원 키가 맞지 않아요. 운영자에게 다시 받아 주세요.");
      }
      r = { outcome: "error", brandId, number, order: null, at: Date.now() };
    } finally {
      setBusy(false);
    }
    setLast(r);
    if (r.outcome === "called") setHistory((h) => [r, ...h].slice(0, 8));
    if (r.outcome !== "not_found" && r.outcome !== "error") setDigits("");
  }, [backend, demo, brandId, digits, busy, isAll, setAuth, setAuthMsg]);

  const [undone, setUndone] = useState<Set<string>>(new Set());
  const undo = async (r: Result) => {
    if (!backend || !demo || !r.order) return;
    try {
      const res = await backend.setReady(demo.session, r.order.id, `undo:${r.order.id}:v${r.order.version}`, true);
      if (!res.changed) throw new Error("not undone");
      setUndone((u) => new Set(u).add(r.order!.id));
      setLast({ ...r, outcome: "undone", at: Date.now() });
    } catch {
      setLast({ ...r, outcome: "error", at: Date.now() });
    }
  };
  const [search, setSearch] = useState("");
  useEffect(() => setSearch(window.location.search), []);

  // physical keyboard (a real caller is a keypad; this keeps the demo usable on a laptop)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("back");
      else if (e.key === "Escape") press("clear");
      else if (e.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, submit]);

  if (!ready || auth === "unknown") return <div className="min-h-dvh bg-[#15171b]" />;
  if (auth === "needed" && demo) return <StaffAuthForm session={demo.session} backend={backend} msg={authMsg} setMsg={setAuthMsg} onOk={() => setAuth("ok")} />;

  if (!mode) {
    return (
      <div className="min-h-dvh bg-[#15171b] px-5 py-8 text-white">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">매장 선택</h1>
          <p className="mt-1 text-[15px] text-white/60">음식이 나오면 영수증 번호를 눌러 호출해요</p>
          <ul className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {brands.map((b) => (
              <li key={b.id}>
                <button
                  onClick={() => {
                    saveStaffBrand(b.id);
                    setMode(b.id);
                  }}
                  className="h-16 w-full rounded-2xl bg-white/8 px-3 text-[17px] font-bold ring-1 ring-white/10 hover:bg-white/12"
                >
                  {b.name}
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              saveStaffBrand(ALL);
              setMode(ALL);
            }}
            className="mt-4 w-full rounded-2xl bg-white/5 px-5 py-3.5 text-left text-[15px] ring-1 ring-white/10 hover:bg-white/10"
          >
            <b>모든 매장 (시연)</b>
            <span className="block text-[13px] text-white/55">한 기기에서 매장을 바꿔 가며 호출</span>
          </button>
        </div>
      </div>
    );
  }

  // a call stays on screen for the whole undo window, so 호출 취소 is always next to what it undoes
  const shown = last && now - last.at < (last.outcome === "called" ? UNDO_MS : 6000) ? last : null;
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#15171b] text-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2.5 short:py-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[18px] leading-6 font-bold tracking-[-0.015em]">{brand?.name ?? "매장"}</p>
          <p className="text-[12px] text-white/50 short:hidden">호출기 · 모의</p>
        </div>
        {!isAll && (
          <button
            onClick={() => {
              saveStaffBrand("");
              setMode(null);
            }}
            className="h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold ring-1 ring-white/20"
          >
            매장 변경
          </button>
        )}
      </header>

      {isAll && (
        <div role="tablist" aria-label="매장 선택" className="grid shrink-0 grid-cols-5 gap-1 border-b border-white/10 p-1.5">
          {brands.map((b) => {
            const n = pending.filter((o) => o.brandId === b.id).length;
            const on = b.id === brandId;
            return (
              <button
                key={b.id}
                role="tab"
                aria-selected={on}
                aria-label={`${b.name}${n ? `, 대기 ${n}건` : ""}`}
                onClick={() => {
                  setPicked(b.id);
                  setDigits("");
                }}
                className={`relative h-10 truncate rounded-lg px-1 text-[12.5px] font-semibold short:h-8 short:text-[12px] ${on ? "bg-white text-[#161a22]" : "bg-white/8 text-white/85"}`}
              >
                {b.name}
                {n > 0 && <span className="num absolute -top-1 -right-0.5 grid size-4.5 place-items-center rounded-full bg-[#f2b630] text-[10px] font-bold text-[#2a1d00]">{n}</span>}
              </button>
            );
          })}
        </div>
      )}

      <main className="flex min-h-0 flex-1 justify-center overflow-y-auto px-4 pt-3 pb-3 short:pt-2 short:pb-2">
        <div className="grid min-h-0 w-full max-w-[420px] content-start gap-2 short:grid-rows-[auto_auto_1fr] short:content-stretch short-wide:max-w-[760px] short-wide:grid-cols-[1fr_1.15fr] short-wide:grid-rows-1 short-wide:gap-4">
          {/* left (or top): what was typed, what happened, numbers waiting */}
          <div className="flex min-h-0 flex-col gap-2">
            <div className="rounded-2xl bg-[#0b0e14] px-4 py-2.5 ring-1 ring-white/10 short:py-1.5">
              <p className="text-[12px] text-white/50">영수증 번호</p>
              <p className="num h-[56px] text-right text-[48px] leading-[56px] font-bold tracking-[-0.02em] short:h-9 short:text-[30px] short:leading-9" data-testid="pad-display" aria-live="polite">
                {digits || <span className="text-[19px] font-medium text-white/60">번호 입력</span>}
              </p>
            </div>
            <div className="min-h-[48px] short:min-h-[40px]" aria-live="polite">
              {shown ? (
                <div role="status" className={`flex items-center gap-2 rounded-xl py-2 pr-2 pl-3.5 text-[15px] leading-snug font-semibold short:text-[14px] ${TONE[shown.outcome]}`}>
                  <span className="min-w-0 flex-1">{MESSAGE[shown.outcome](getBrand(shown.brandId)?.name ?? "", shown.number)}</span>
                  {shown.outcome === "called" && shown.order && !undone.has(shown.order.id) && UNDO_MS - (now - shown.at) > 0 && (
                    <button onClick={() => undo(shown)} className="num h-9 shrink-0 rounded-lg bg-white/20 px-3 text-[13px] font-semibold">
                      호출 취소 {Math.ceil((UNDO_MS - (now - shown.at)) / 1000)}
                    </button>
                  )}
                </div>
              ) : (
                pendingHere.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-0.5 text-[12px] text-white/50">접수된 번호</span>
                    {pendingHere.slice(0, 8).map((o) => (
                      <button key={o.id} onClick={() => setDigits(String(o.displayNumber))} className="num h-8 rounded-full bg-white/12 px-3 text-[14px] font-bold" aria-label={`${o.displayNumber}번 입력`}>
                        {o.displayNumber}
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
            {history.length > 0 && (
              <ul className="hidden min-h-0 divide-y divide-white/10 overflow-y-auto short-wide:block">
                {history.slice(0, 3).map((r) => {
                  const wasUndone = r.order && undone.has(r.order.id);
                  return (
                    <li key={`${r.order?.id}${r.at}`} className="flex items-center gap-3 py-1.5 text-[13px]">
                      <span className="num w-12 text-[16px] font-bold">{r.number}</span>
                      <span className="min-w-0 flex-1 truncate text-white/60">
                        {getBrand(r.brandId)?.name} · {wasUndone ? "취소됨" : "호출함"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* right (or bottom): keypad fills the space left, so 호출 never leaves the screen */}
          <div className="flex min-h-0 flex-col gap-2 short-wide:row-span-1">
            <div className="grid flex-1 grid-cols-3 grid-rows-4 gap-2 short:min-h-[150px] short:gap-1.5" aria-label="숫자 키패드">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((k) => (
                <button
                  key={k}
                  onClick={() => press(k)}
                  aria-label={k === "back" ? "한 글자 지우기" : k === "clear" ? "모두 지우기" : `숫자 ${k}`}
                  className="num h-[62px] rounded-xl bg-white/[.08] text-[24px] font-semibold active:bg-white/25 short:h-auto short:max-h-[64px] short:min-h-9 short:text-[19px]"
                >
                  {k === "back" ? "⌫" : k === "clear" ? <span className="text-[15px]">지움</span> : k}
                </button>
              ))}
            </div>
            <button
              onClick={submit}
              disabled={!digits || busy}
              className="h-[58px] w-full shrink-0 rounded-xl bg-[#1e62e6] text-[20px] font-bold disabled:opacity-35 short:h-11 short:text-[17px]"
            >
              {busy ? "호출하는 중…" : "호출"}
            </button>
          </div>
        </div>
      </main>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-t border-white/10 px-4 py-2 text-[11.5px] text-white/60">
        <span>모의 호출기</span>
        <span className="whitespace-nowrap">
          {demo && <>세션 {demo.session} · </>}
          <Link href={`/staff/board${search}`} className="underline">
            주문 목록(보조)
          </Link>
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
  );
}
