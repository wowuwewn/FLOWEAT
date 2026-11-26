"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { getBrand } from "@/core/catalog";
import { minuteRange, prepText } from "@/lib/format";
import { IconBowl, IconNow, IconTicket } from "../icons";
import { useStudent } from "./StudentProvider";

const TABS = [
  { href: "/app", label: "지금", Icon: IconNow, match: (p: string) => p === "/app" },
  { href: "/app/menu", label: "메뉴", Icon: IconBowl, match: (p: string) => p.startsWith("/app/menu") },
  { href: "/app/orders", label: "내 주문", Icon: IconTicket, match: (p: string) => p.startsWith("/app/orders") || p.startsWith("/o/") || p.startsWith("/app/scan") },
];

export function TabBar() {
  const path = usePathname();
  const { active } = useStudent();
  const readyCount = active.filter((r) => r.order?.status === "ready").length;
  return (
    <nav aria-label="주요 화면" className="fixed inset-x-0 bottom-0 z-40 flex justify-center lg:left-auto lg:w-[460px]">
      <div className="safe-bottom w-full max-w-[480px] border-t border-line bg-white/95 pt-1 backdrop-blur">
        <ul className="grid grid-cols-3">
          {TABS.map(({ href, label, Icon, match }) => {
            const on = match(path);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={`relative mx-auto flex min-h-12 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? "text-ink" : "text-ink-3"}`}
                >
                  <Icon className="size-[22px]" />
                  {label}
                  {href === "/app/orders" && active.length > 0 && (
                    <span
                      className={`num absolute top-0 left-[calc(50%+6px)] min-w-[17px] rounded-full px-1 text-center text-[10.5px] leading-[17px] font-bold text-white ${readyCount ? "bg-free" : "bg-blue"}`}
                      aria-label={`진행 중인 주문 ${active.length}건`}
                    >
                      {active.length}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

/** Live-Activity-inspired strip pinned to the top while an order is being tracked. */
export function OrderIsland() {
  const { active, alert, alertCount, dismissAlert, retracted } = useStudent();
  const reduce = useReducedMotion();
  const path = usePathname();
  const hidden = path.startsWith("/app/orders") || path.startsWith("/o/") || path === "/app";
  const ready = active.filter((r) => r.order?.status === "ready");
  const waiting = active.filter((r) => r.order?.status === "accepted");
  const first = ready[0] ?? waiting[0];

  return (
    <div className="pointer-events-none sticky top-0 z-30 px-3 pt-[max(env(safe-area-inset-top),8px)]">
      <AnimatePresence>
        {alert && (
          <motion.div
            key="alert"
            role="alert"
            initial={reduce ? { opacity: 0 } : { y: -24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            className="pointer-events-auto mb-2 flex items-center overflow-hidden rounded-[18px] bg-free text-white shadow-[0_8px_24px_rgba(11,132,87,.30)]"
          >
            <Link href="/app/orders" onClick={dismissAlert} className="min-w-0 flex-1 px-4 py-3">
              <p className="text-[12.5px] font-medium text-white/85">준비 완료{alertCount > 1 ? ` · 외 ${alertCount - 1}건` : ""}</p>
              <p className="mt-0.5 text-[18px] leading-6 font-bold tracking-[-0.015em]">
                {alert.brandName} <span className="num">{alert.displayNumber}</span>번
              </p>
              <p className="mt-0.5 text-[13px] text-white/90">영수증 들고 {alert.brandName} 카운터로</p>
            </Link>
            <button onClick={dismissAlert} className="mr-3 shrink-0 rounded-full bg-white/20 px-3.5 py-2 text-[13.5px] font-semibold">
              확인
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {retracted && !alert && (
          <motion.div
            key="retracted"
            role="status"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto mb-2 rounded-[16px] bg-ink px-4 py-3 text-[14px] text-white shadow-[0_6px_20px_rgba(16,24,40,.20)]"
          >
            <b className="num">
              {retracted.brandName} {retracted.displayNumber}번
            </b>{" "}
            호출이 취소됐어요. 아직 조리 중이에요.
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!hidden && first?.order && !alert && (
          <motion.div
            key="island"
            initial={reduce ? { opacity: 0 } : { y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto"
          >
            <Link
              href="/app/orders"
              className={`flex items-center gap-3 rounded-full py-1.5 pr-4 pl-1.5 text-white shadow-[0_6px_18px_rgba(16,24,40,.22)] ${ready.length ? "bg-free" : "bg-ink"}`}
            >
              <span className="num grid h-8 min-w-8 place-items-center rounded-full bg-white/15 px-2 text-[14px] font-bold">
                {first.order.displayNumber}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                {getBrand(first.order.brandId)?.name}
                <span className="font-normal opacity-85">
                  {" "}
                  {first.order.status === "ready"
                    ? "준비 완료"
                    : first.order.prepEstimate
                      ? `조리 중 · ${prepText(first.order.prepEstimate.p50, first.order.prepEstimate.p80)}`
                      : "조리 중"}
                </span>
              </span>
              {active.length > 1 && <span className="text-[13px] opacity-85">외 {active.length - 1}건</span>}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PageHeader({ title, back, right }: { title: string; back?: string; right?: React.ReactNode }) {
  return (
    <header className="flex min-h-14 items-center gap-2 px-5 pt-2 pb-1">
      {back && (
        <Link href={back} className="-ml-2 grid size-10 place-items-center rounded-full text-ink-2" aria-label="뒤로">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="m15 6-6 6 6 6" />
          </svg>
        </Link>
      )}
      <h1 className="t-title flex-1">{title}</h1>
      {right}
    </header>
  );
}
