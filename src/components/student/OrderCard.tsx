"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { getBrand } from "@/core/catalog";
import { pickupShort } from "@/core/layout";
import type { TrackResult } from "@/core/orders/service";
import { prepText, since } from "@/lib/format";
import { useNow } from "@/client/hooks";

/** One tracked order, as a pass. Status only changes on real events — never from the estimate. */
export function OrderCard({ r, onClose, onForget, large }: { r: TrackResult; onClose?: () => void; onForget?: () => void; large?: boolean }) {
  const o = r.order!;
  const brand = getBrand(o.brandId);
  const now = useNow(1000);
  const reduce = useReducedMotion();
  const isReady = o.status === "ready";
  const finished = o.status === "closed" || o.status === "expired" || r.state !== "ok";
  const loc = pickupShort(o.brandId);
  const late = o.status === "accepted" && o.prepEstimate && now - o.acceptedAt > o.prepEstimate.p80 * 1000;

  return (
    <motion.article
      layout={!reduce}
      className={`overflow-hidden rounded-[18px] ${isReady ? "bg-free text-white" : finished ? "bg-floor text-ink-3" : "bg-white text-ink ring-1 ring-line"}`}
      style={isReady && !reduce ? { animation: "ready-pop 520ms var(--ease-out-soft)" } : undefined}
      aria-label={`${brand?.name} ${o.displayNumber}번 주문, ${isReady ? "준비 완료" : finished ? "추적 종료" : "조리 중"}`}
      data-testid="order-card"
      data-status={o.status}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <p className="t-row truncate font-semibold">{brand?.name}</p>
          <p className={`t-sub ${isReady ? "text-white/80" : "text-ink-3"}`}>
            {isReady ? (o.readyAt ? `${since(o.readyAt, now)} 준비 완료` : "준비 완료") : finished ? (o.status === "closed" ? "받은 주문" : "추적 종료") : `${since(o.acceptedAt, now)} 주문`}
          </p>
        </div>
        <p className={`num shrink-0 leading-none font-bold tracking-[-0.03em] ${large ? "text-[48px]" : "text-[40px]"}`}>{o.displayNumber}</p>
      </div>

      {!finished && (
        <div className="px-5 pt-4 pb-4">
          <p className={`text-[17px] leading-6 font-semibold tracking-[-0.015em]`}>
            {isReady ? "카운터에서 받아 가세요" : o.prepEstimate ? `조리 중 · 보통 ${prepText(o.prepEstimate.p50, o.prepEstimate.p80)}` : "조리 중"}
          </p>
          {/* two real states only: accepted → ready */}
          <ol className="mt-2.5 grid grid-cols-2 gap-1" aria-label="진행 상태">
            <li className={`h-1 rounded-full ${isReady ? "bg-white" : "bg-blue"}`} aria-label="접수됨" />
            <li className={`h-1 rounded-full ${isReady ? "bg-white" : "bg-line"}`} aria-label={isReady ? "준비 완료" : "준비 완료 전"} />
          </ol>
          {late && <p className="t-sub mt-2 text-ink-3">평소보다 늦어지고 있어요</p>}
          <p className={`t-sub mt-3 flex flex-wrap gap-x-3 gap-y-1 ${isReady ? "text-white/90" : "text-ink-2"}`}>
            <span className="flex items-center gap-1">
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                <path d="M5 3h10v14l-2-1.3L11 17l-2-1.3L7 17l-2-1.3z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
              영수증 지참
            </span>
            <Link href="/app?layer=pickup" className="flex items-center gap-1 underline-offset-2 hover:underline">
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                <path d="M10 17s5-4.6 5-8.5A5 5 0 0 0 5 8.5C5 12.4 10 17 10 17z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="10" cy="8.5" r="1.8" fill="currentColor" />
              </svg>
              {loc ? `${loc.text}${loc.sure ? "" : " (추정)"}` : "위치 미확인"}
            </Link>
          </p>
        </div>
      )}
      {finished && <div className="h-4" />}

      {(onClose || onForget) && (
        <div className={`flex border-t ${isReady ? "border-white/20" : "border-line"}`}>
          {isReady && onClose && (
            <button onClick={onClose} className="h-12 flex-1 text-[15px] font-semibold">
              받았어요
            </button>
          )}
          {onForget && (
            <button onClick={onForget} className={`h-12 flex-1 text-[14px] font-medium ${isReady ? "border-l border-white/20 text-white/85" : "text-ink-3"}`}>
              {finished ? "목록에서 지우기" : "알림 그만 받기"}
            </button>
          )}
        </div>
      )}
    </motion.article>
  );
}
