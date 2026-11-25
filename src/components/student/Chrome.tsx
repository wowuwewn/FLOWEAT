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
      <div className="safe-bottom w-full max-w-[480px] border-t border-line bg-surface/95 pt-1.5 backdrop-blur">
        <ul className="grid grid-cols-3">
          {TABS.map(({ href, label, Icon, match }) => {
            const on = match(path);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={`relative mx-auto flex min-h-12 w-full flex-col items-center justify-center gap-0.5 text-[11.5px] font-semibold ${on ? "text-navy" : "text-ink-3"}`}
                >
                  <Icon className="size-[23px]" />
                  {label}
                  {href === "/app/orders" && active.length > 0 && (
                    <span
                      className={`num absolute top-0.5 left-[calc(50%+8px)] min-w-[18px] rounded-full px-1 text-center text-[11px] leading-[18px] font-bold text-white ${readyCount ? "bg-free" : "bg-blue"}`}
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
            className="pointer-events-auto mb-2 overflow-hidden rounded-[22px] bg-free text-white shadow-[0_10px_30px_rgba(18,128,90,.35)]"
          >
            <Link href="/app/orders" onClick={dismissAlert} className="block px-5 pt-4 pb-4">
              <p className="text-[13px] font-semibold opacity-90">준비 완료{alertCount > 1 ? ` · 외 ${alertCount - 1}건` : ""}</p>
              <p className="mt-0.5 text-[22px] leading-tight font-bold">
                {alert.brandName} <span className="num">{alert.displayNumber}</span>번
              </p>
              <p className="mt-1 text-[14px] opacity-95">{alert.brandName} 카운터에서 영수증을 보여 주고 받아 가세요.</p>
            </Link>
            <button onClick={dismissAlert} className="w-full border-t border-white/25 py-2.5 text-[14px] font-semibold">
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
            className="pointer-events-auto mb-2 rounded-[18px] bg-[#fff4dc] px-4 py-3 text-[14px] text-[#5c3d00] shadow-[0_6px_20px_rgba(15,26,51,.12)]"
          >
            <b>
              {retracted.brandName} {retracted.displayNumber}번
            </b>
            은 매장이 완료를 취소했어요. 아직 준비 중이니 번호가 다시 뜰 때까지 기다려 주세요.
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
              className={`flex items-center gap-3 rounded-full py-2 pr-4 pl-2 text-white shadow-[0_6px_20px_rgba(14,43,99,.28)] ${ready.length ? "bg-free" : "bg-navy"}`}
            >
              <span className="num grid h-9 min-w-9 place-items-center rounded-full bg-white/15 px-2 text-[15px] font-bold">
                {first.order.displayNumber}
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
                {getBrand(first.order.brandId)?.name}
                <span className="font-normal opacity-85">
                  {" "}
                  {first.order.status === "ready"
                    ? "준비 완료"
                    : first.order.prepEstimate
                      ? `준비 중, 보통 ${prepText(first.order.prepEstimate.p50, first.order.prepEstimate.p80)}`
                      : "준비 중"}
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
    <header className="flex items-center gap-2 px-5 pt-3 pb-2">
      {back && (
        <Link href={back} className="-ml-2 grid size-10 place-items-center rounded-full text-ink-2" aria-label="뒤로">
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <path d="m15 6-6 6 6 6" />
          </svg>
        </Link>
      )}
      <h1 className="flex-1 text-[22px] leading-tight font-bold tracking-[-0.02em]">{title}</h1>
      {right}
    </header>
  );
}
