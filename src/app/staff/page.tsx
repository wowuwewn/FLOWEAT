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
  called: (b, n) => `${b} ${n}번을 호출했어요. 호출 모니터와 학생 앱에 표시돼요.`,
  already_ready: (b, n) => `${b} ${n}번은 이미 호출된 번호예요.`,
  already_closed: (b, n) => `${b} ${n}번은 이미 받아 간 주문이에요.`,
  not_found: (b, n) => `${b}에 ${n}번 주문이 없어요. 영수증 번호와 매장을 확인해 주세요.`,
  invalid: () => "번호를 확인해 주세요.",
  error: () => "처리하지 못했어요. 네트워크를 확인하고 다시 눌러 주세요.",
  undone: (b, n) => `${b} ${n}번 호출을 취소했어요. 모니터와 학생 앱에서도 내려가요.`,
};
const TONE: Record<Result["outcome"], string> = {
  called: "bg-[#0f7a52] text-white",
  already_ready: "bg-[#f2b630] text-[#2a1d00]",
  already_closed: "bg-[#f2b630] text-[#2a1d00]",
  not_found: "bg-[#d8343a] text-white",
  invalid: "bg-[#d8343a] text-white",
  error: "bg-[#d8343a] text-white",
  undone: "bg-white text-[#161a22]",
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

  if (!ready || auth === "unknown") return <div className="min-h-dvh bg-[#161a22]" />;
  if (auth === "needed" && demo) return <StaffAuthForm session={demo.session} backend={backend} msg={authMsg} setMsg={setAuthMsg} onOk={() => setAuth("ok")} />;

  if (!mode) {
    return (
      <div className="min-h-dvh bg-[#161a22] px-5 py-8 text-white">
        <div className="mx-auto max-w-2xl">
          <p className="text-[13px] font-semibold opacity-70">매장 직원 기기 · 모의</p>
          <h1 className="mt-2 text-[26px] font-bold">어느 매장의 기기인가요?</h1>
          <p className="mt-1 text-[15px] leading-relaxed opacity-75">음식이 준비되면 영수증의 주문번호를 눌러 호출해요. 한 번 고르면 이 기기에 저장돼요.</p>
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
            <b>시연용: 매장을 바꿔 가며 한 기기로</b>
            <span className="block text-[13px] opacity-70">혼자서 10개 매장의 호출을 모두 해 볼 때</span>
          </button>
        </div>
      </div>
    );
  }

  const shown = last && now - last.at < 8000 ? last : null;
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#161a22] text-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] opacity-65">매장 직원 호출기 · 모의</p>
          <p className="truncate text-[18px] leading-tight font-bold">{brand?.name ?? "매장"}</p>
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
                className={`relative h-10 truncate rounded-lg px-1 text-[12.5px] font-semibold ${on ? "bg-white text-[#161a22]" : "bg-white/8 text-white/85"}`}
              >
                {b.name}
                {n > 0 && <span className="num absolute -top-1 -right-0.5 grid size-4.5 place-items-center rounded-full bg-[#f2b630] text-[10px] font-bold text-[#2a1d00]">{n}</span>}
              </button>
            );
          })}
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 pt-3 pb-3">
        <div className="flex w-full max-w-[420px] flex-1 flex-col">
          {/* display */}
          <div className="rounded-2xl bg-[#0b0e14] px-4 py-3 ring-1 ring-white/10">
            <p className="text-[12px] opacity-60">주문번호</p>
            <p className="num h-[60px] text-right text-[54px] leading-[60px] font-[800] tracking-[-0.02em]" data-testid="pad-display" aria-live="polite">
              {digits || <span className="text-[22px] font-semibold opacity-35">번호를 누르세요</span>}
            </p>
          </div>

          <div className="mt-2 min-h-[52px]" aria-live="polite">
            {shown && (
              <p role="status" className={`rounded-xl px-3.5 py-2.5 text-[14.5px] leading-snug font-semibold ${TONE[shown.outcome]}`}>
                {MESSAGE[shown.outcome](getBrand(shown.brandId)?.name ?? "", shown.number)}
              </p>
            )}
          </div>

          {/* keypad */}
          <div className="mt-1 grid grid-cols-3 gap-2" aria-label="숫자 키패드">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"].map((k) => (
              <button
                key={k}
                onClick={() => press(k)}
                aria-label={k === "back" ? "한 글자 지우기" : k === "clear" ? "모두 지우기" : `숫자 ${k}`}
                className="num h-[60px] rounded-2xl bg-white/10 text-[26px] font-bold active:bg-white/25 sm:h-[66px]"
              >
                {k === "back" ? "⌫" : k === "clear" ? <span className="text-[16px]">지움</span> : k}
              </button>
            ))}
          </div>
          <button
            onClick={submit}
            disabled={!digits || busy}
            className="mt-2 h-[66px] w-full shrink-0 rounded-2xl bg-[#2d6bff] text-[23px] font-[800] disabled:opacity-40"
          >
            {busy ? "호출하는 중…" : "호출"}
          </button>

          {/* demo helper */}
          <div className="mt-3 rounded-xl bg-white/5 px-3 py-2.5">
            <p className="text-[12px] opacity-65">시연 도움 · {brand?.name} 접수된 번호 (누르면 입력돼요)</p>
            {pendingHere.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {pendingHere.slice(0, 12).map((o) => (
                  <button key={o.id} onClick={() => setDigits(String(o.displayNumber))} className="num h-9 rounded-full bg-white/12 px-3 text-[15px] font-bold" aria-label={`${o.displayNumber}번 입력`}>
                    {o.displayNumber}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-[13px] opacity-50">아직 없어요. 키오스크에서 주문해 보세요.</p>
            )}
          </div>

          {history.length > 0 && (
            <div className="mt-3">
              <p className="text-[12px] opacity-65">최근 호출</p>
              <ul className="mt-1 divide-y divide-white/10">
                {history.slice(0, 4).map((r) => {
                  const left = UNDO_MS - (now - r.at);
                  const wasUndone = r.order && undone.has(r.order.id);
                  return (
                    <li key={`${r.order?.id}${r.at}`} className="flex items-center gap-3 py-2">
                      <span className="num w-14 text-[20px] font-bold">{r.number}</span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] opacity-75">
                        {getBrand(r.brandId)?.name} · {wasUndone ? "호출 취소됨" : "호출함"}
                      </span>
                      {!wasUndone && left > 0 && (
                        <button onClick={() => undo(r)} className="num h-9 shrink-0 rounded-full bg-white/12 px-3 text-[13px] font-semibold">
                          호출 취소 {Math.ceil(left / 1000)}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </main>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-t border-white/10 px-4 py-2 text-[11.5px] text-white/60">
        <span>실제 매장 기기의 모양·버튼·통신 방식은 확인 전이라 같은 역할만 재현해요</span>
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
