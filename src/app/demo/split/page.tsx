"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBrand } from "@/core/catalog";
import type { StaffOrder } from "@/core/orders/types";
import type { OrderBackend } from "@/client/backend";
import { useBackend } from "@/client/hooks";
import { clearMyOrders, useMyOrders } from "@/client/my-orders";
import { currentScenario, currentSession } from "@/client/session";
import { Logo } from "@/components/brand/Logo";

/**
 * Whole-loop demo in one browser. All four surfaces are real pages in iframes and share this
 * browser's storage, so one-device mode works end to end. The arrangement adapts to the screen:
 *   phone   → one surface at a time (top switcher, guided steps, auto-switching)
 *   tablet  → student phone fixed on the left, kiosk / staff / monitor switch on the right
 *   desktop → student | kiosk | staff + monitor (staff / monitor switch when the window is short)
 * Iframes are never remounted when the arrangement changes, so no order state is lost.
 */
type Surface = "student" | "kiosk" | "staff" | "monitor";
type Mode = "tabs" | "duo" | "trio-short" | "trio";

const SURFACES: Record<Surface, { label: string; short: string; title: string }> = {
  student: { label: "학생 휴대폰", short: "학생 앱", title: "학생 화면" },
  kiosk: { label: "모의 키오스크", short: "키오스크", title: "모의 키오스크" },
  staff: { label: "직원 화면", short: "직원", title: "직원 화면" },
  monitor: { label: "호출 모니터", short: "모니터", title: "호출 모니터" },
};
const ORDER: Surface[] = ["student", "kiosk", "staff", "monitor"];

const LAYOUT: Record<Mode, { areas: string; cols: string; rows: string; area: Record<Surface, string> }> = {
  tabs: { areas: `"a"`, cols: "1fr", rows: "1fr", area: { student: "a", kiosk: "a", staff: "a", monitor: "a" } },
  duo: { areas: `"s r"`, cols: "minmax(330px, 380px) 1fr", rows: "1fr", area: { student: "s", kiosk: "r", staff: "r", monitor: "r" } },
  "trio-short": { areas: `"s k r"`, cols: "minmax(330px, 380px) 1fr 1.08fr", rows: "1fr", area: { student: "s", kiosk: "k", staff: "r", monitor: "r" } },
  trio: { areas: `"s k t" "s k m"`, cols: "minmax(340px, 390px) 1fr 1.08fr", rows: "1.1fr 1fr", area: { student: "s", kiosk: "k", staff: "t", monitor: "m" } },
};

function modeFor(w: number, h: number): Mode {
  if (w < 760 || h < 480) return "tabs";
  if (w < 1180) return "duo";
  return h < 820 ? "trio-short" : "trio";
}

type Step = 0 | 1 | 2 | 3;
const STEPS: { title: string; hint: string; go: Surface }[] = [
  { title: "키오스크에서 주문", hint: "두 매장의 메뉴를 담으면 번호표가 매장마다 1장씩 나와요.", go: "kiosk" },
  { title: "번호표를 학생 앱에 연결", hint: "번호표의 ‘이 기기에서 열기’를 누르면 QR을 찍은 것처럼 학생 앱에 연결돼요.", go: "kiosk" },
  { title: "직원 화면에서 한 매장만 완료", hint: "‘완료’를 누른 주문만 바뀌고, 다른 매장 주문은 그대로예요.", go: "staff" },
  { title: "학생 앱과 모니터 확인", hint: "완료한 번호만 학생 앱 알림과 호출 모니터에 떠요.", go: "student" },
];

export default function SplitDemo() {
  const [q, setQ] = useState<string | null>(null);
  const [session, setSession] = useState<string>();
  const [mode, setMode] = useState<Mode>("trio");
  const [active, setActive] = useState<Record<string, Surface>>({ a: "kiosk", r: "kiosk", s: "student", k: "kiosk", t: "staff", m: "monitor" });
  const [badge, setBadge] = useState<Partial<Record<Surface, boolean>>>({});
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);
  const [epoch, setEpoch] = useState(0);
  const frames = useRef<Partial<Record<Surface, HTMLIFrameElement | null>>>({});

  useEffect(() => {
    const s = currentSession();
    setSession(s);
    setQ(`s=${s}&sc=${currentScenario()}`);
    const update = () => setMode(modeFor(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const { backend, info } = useBackend();
  const { orders, loaded } = useGuideOrders(backend, session);
  const mine = useMyOrders();
  const layout = LAYOUT[mode];

  const isVisible = useCallback(
    (s: Surface) => {
      const group = ORDER.filter((x) => layout.area[x] === layout.area[s]);
      const cur = active[layout.area[s]];
      return group.length === 1 || (group.includes(cur) ? cur === s : group[0] === s);
    },
    [active, layout],
  );
  const focus = useCallback(
    (s: Surface) => {
      setActive((a) => ({ ...a, [layout.area[s]]: s }));
      setBadge((b) => ({ ...b, [s]: false }));
    },
    [layout],
  );
  // a surface that becomes visible has been "seen"
  useEffect(() => {
    setBadge((b) => {
      const n = { ...b };
      for (const s of ORDER) if (isVisible(s)) n[s] = false;
      return n;
    });
  }, [isVisible]);

  // ---- follow the real orders of this session to guide the next step
  const open = orders.filter((o) => o.status === "accepted");
  const readyNow = orders.filter((o) => o.status === "ready");
  const step: Step = orders.length === 0 ? 0 : mine.length === 0 ? 1 : readyNow.length === 0 && orders.every((o) => o.status === "accepted") ? 2 : 3;
  // remember what was already known, so a fast click (order placed and completed between two polls) still counts
  const known = useRef<{ ids: Set<string>; ready: Set<string> } | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (!known.current) {
      known.current = { ids: new Set(orders.map((o) => o.id)), ready: new Set(orders.filter((o) => o.status !== "accepted").map((o) => o.id)) };
      return;
    }
    const k = known.current;
    const added = orders.filter((o) => !k.ids.has(o.id));
    const turned = orders.filter((o) => o.status === "ready" && !k.ready.has(o.id));
    const undone = orders.filter((o) => o.status === "accepted" && k.ready.has(o.id));
    added.forEach((o) => k.ids.add(o.id));
    turned.forEach((o) => k.ready.add(o.id));
    undone.forEach((o) => k.ready.delete(o.id));
    if (undone.length) {
      const o = undone[0];
      setToast({ id: `${o.id}-undo`, text: `${getBrand(o.brandId)?.name ?? ""} ${o.displayNumber}번 완료를 되돌렸어요. 학생 앱 알림과 모니터 번호도 함께 내려갔어요.` });
    }
    if (added.length) setBadge((b) => ({ ...b, staff: !isVisible("staff") || b.staff }));
    if (turned.length) {
      const o = turned[0];
      setBadge((b) => ({ ...b, student: !isVisible("student"), monitor: !isVisible("monitor") }));
      setToast({ id: o.id, text: `${getBrand(o.brandId)?.name ?? ""} ${o.displayNumber}번을 완료했어요. 학생 앱 알림과 호출 모니터에 떴어요.` });
      // on tablet / short desktop the monitor shares space with staff: show it once the number is up
      if (mode !== "tabs" && layout.area.monitor === layout.area.staff) setTimeout(() => focus("monitor"), 1400);
    }
  }, [orders, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(t);
  }, [toast]);

  // ticket links target the student frame: bring it forward when it navigates to an order
  const onStudentLoad = () => {
    try {
      const path = frames.current.student?.contentWindow?.location.pathname ?? "";
      if (path.startsWith("/o/")) focus("student");
    } catch {
      /* cross-origin never happens here */
    }
  };

  const restart = async () => {
    if (session) await backend?.reset(session).catch(() => {});
    clearMyOrders();
    known.current = null;
    setToast(null);
    setBadge({});
    setEpoch((e) => e + 1);
    setActive((a) => ({ ...a, a: "kiosk", r: "kiosk" }));
  };

  const srcOf = useMemo(
    () =>
      q
        ? {
            student: `/app/orders?${q}`,
            kiosk: `/kiosk?${q}&k=L2&embed=1`,
            staff: `/staff?${q}&b=all&embed=1`,
            monitor: `/monitor?${q}&embed=1`,
          }
        : null,
    [q],
  );

  if (!srcOf) return <div className="min-h-dvh bg-[#0b1630]" />;

  const groupOf = (s: Surface) => ORDER.filter((x) => layout.area[x] === layout.area[s]);
  const cur = STEPS[step];

  return (
    <div className="flex h-dvh flex-col bg-[#0b1630] text-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* guide */}
      <header className="flex shrink-0 items-center gap-3 px-3 pt-2.5 pb-2 sm:px-4">
        <Link href={`/?${q}`} className="flex shrink-0 items-center gap-2" aria-label="체험 홈으로">
          <Logo size={26} tone="white" />
        </Link>
        <div className="min-w-0 flex-1">
          <ol className="hidden items-center gap-1.5 lg:flex" aria-label="체험 순서">
            {STEPS.map((s, i) => (
              <li key={s.title} className={`flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-[12.5px] ${i === step ? "bg-white text-navy" : i < step ? "text-white/85" : "text-white/65"}`}>
                <span className={`grid size-5 place-items-center rounded-full text-[11px] font-bold ${i === step ? "bg-blue text-white" : i < step ? "bg-white/20" : "bg-white/10"}`}>{i < step ? "✓" : i + 1}</span>
                <span className="font-semibold">{s.title}</span>
              </li>
            ))}
          </ol>
          <p className="truncate text-[13.5px] font-semibold lg:hidden" aria-live="polite">
            <span className="mr-1.5 inline-grid size-5 place-items-center rounded-full bg-blue align-[-3px] text-[11px]">{step + 1}</span>
            {cur.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-white/70 lg:mt-1">{cur.hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {mode === "tabs" && !isVisible(cur.go) && (
            <button onClick={() => focus(cur.go)} className="h-9 rounded-full bg-blue px-3.5 text-[13px] font-bold">
              {SURFACES[cur.go].short} 열기
            </button>
          )}
          <button onClick={restart} className="h-9 rounded-full px-3 text-[12.5px] font-semibold ring-1 ring-white/25" aria-label="주문을 모두 지우고 처음부터">
            처음부터
          </button>
        </div>
      </header>

      {/* phone: one surface at a time */}
      {mode === "tabs" && (
        <nav className="mx-3 mb-2 grid shrink-0 grid-cols-4 gap-1 rounded-2xl bg-white/8 p-1" aria-label="화면 전환" role="tablist">
          {ORDER.map((s) => (
            <TabButton key={s} s={s} selected={isVisible(s)} dot={!!badge[s]} onClick={() => focus(s)} />
          ))}
        </nav>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={
              mode === "tabs"
                ? "mx-3 mb-2 shrink-0 rounded-2xl bg-free p-3 text-white shadow-[0_8px_24px_rgba(0,0,0,.3)]"
                : "fixed top-2 right-3 z-50 w-[min(560px,calc(100vw-24px))] rounded-2xl bg-free px-3.5 py-2.5 text-white shadow-[0_12px_40px_rgba(0,0,0,.35)]"
            }
            role="status"
          >
            <div className="flex items-start gap-3">
              <p className={`min-w-0 flex-1 leading-snug font-semibold ${mode === "tabs" ? "text-[14px]" : "text-[13px]"}`}>{toast.text}</p>
              <button onClick={() => setToast(null)} className="-mt-0.5 -mr-1 shrink-0 rounded-full px-2 py-0.5 text-[13px] font-semibold opacity-85 ring-1 ring-white/40" aria-label="알림 닫기">
                닫기
              </button>
            </div>
            {mode === "tabs" && (["student", "monitor"] as const).some((s) => !isVisible(s)) && (
              <div className="mt-2 flex gap-2">
                {(["student", "monitor"] as const)
                  .filter((s) => !isVisible(s))
                  .map((s) => (
                    <button key={s} onClick={() => focus(s)} className="h-9 flex-1 rounded-xl bg-white text-[13.5px] font-bold text-free">
                      {SURFACES[s].short}에서 보기
                    </button>
                  ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <div
        className="grid min-h-0 flex-1 gap-2.5 px-2.5 pb-2.5 sm:gap-3 sm:px-3 sm:pb-3"
        style={{ gridTemplateAreas: layout.areas, gridTemplateColumns: layout.cols, gridTemplateRows: layout.rows, paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
      >
        {ORDER.map((s) => {
          const vis = isVisible(s);
          const group = groupOf(s);
          return (
            <section
              key={s}
              style={{ gridArea: layout.area[s] }}
              className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgba(255,255,255,.08)] ${vis ? "" : "pointer-events-none invisible"}`}
              aria-hidden={!vis}
              aria-label={SURFACES[s].label}
            >
              {mode !== "tabs" && (
                <div className="flex h-9 shrink-0 items-center gap-1 bg-navy px-2 text-[12.5px]">
                  {group.length > 1 ? (
                    <div className="flex gap-1" role="tablist" aria-label="화면 전환">
                      {group.map((g) => (
                        <TabButton key={g} s={g} selected={g === s} dot={!!badge[g]} onClick={() => focus(g)} compact />
                      ))}
                    </div>
                  ) : (
                    <p className="px-1.5 font-semibold">{SURFACES[s].label}</p>
                  )}
                  <a href={srcOf[s].replace("&embed=1", "")} target="_blank" rel="noreferrer" className="ml-auto rounded-full px-2.5 py-1 text-[12px] text-white/75 hover:bg-white/10" aria-label={`${SURFACES[s].label} 새 탭에서 크게 보기`}>
                    크게 ↗
                  </a>
                </div>
              )}
              <iframe
                key={`${s}-${epoch}`}
                ref={(el) => {
                  frames.current[s] = el;
                }}
                title={SURFACES[s].title}
                name={s === "student" ? "student" : undefined}
                src={srcOf[s]}
                onLoad={s === "student" ? onStudentLoad : undefined}
                tabIndex={vis ? 0 : -1}
                className="min-h-0 w-full flex-1"
              />
            </section>
          );
        })}
      </div>


      <p className="sr-only" aria-live="polite">
        {info?.kind === "device" ? "한 기기 체험 모드: 이 브라우저 안의 화면끼리 주문이 연결돼요." : ""} 조리 중 {open.length}건, 완료 {readyNow.length}건
      </p>
    </div>
  );
}

/**
 * The guide follows the same feed as the surfaces. In server mode the backend shares one long-poll
 * per browser (Web Locks + BroadcastChannel), so this adds no connection of its own.
 */
function useGuideOrders(backend: OrderBackend | null, session: string | undefined): { orders: StaffOrder[]; loaded: boolean } {
  const [state, setState] = useState<{ orders: StaffOrder[]; loaded: boolean }>({ orders: [], loaded: false });
  useEffect(() => {
    if (!backend || !session) return;
    return backend.watchSession(session, (s) => setState({ orders: s.orders, loaded: true }));
  }, [backend, session]);
  return state;
}

function TabButton({ s, selected, dot, onClick, compact }: { s: Surface; selected: boolean; dot: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`relative rounded-xl font-semibold transition-colors ${compact ? "h-7 px-2.5 text-[12.5px]" : "h-10 text-[13.5px]"} ${selected ? "bg-white text-navy" : "text-white/75 hover:bg-white/10"}`}
    >
      {compact ? SURFACES[s].label : SURFACES[s].short}
      {dot && <span className="absolute top-1 right-1 size-2 rounded-full bg-[#ffd34d]" aria-label="새 소식" />}
    </button>
  );
}
