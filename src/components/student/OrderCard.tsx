"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { getBrand } from "@/core/catalog";
import { pickupHint } from "@/core/layout";
import type { TrackResult } from "@/core/orders/service";
import { elapsed, minuteRange, percent, TABLE_LEVEL, since, prepText } from "@/lib/format";
import { useNow } from "@/client/hooks";
import { useStudent } from "./StudentProvider";

/** One tracked order. Status only changes on real events — never from the estimate. */
export function OrderCard({ r, onClose, onForget, large }: { r: TrackResult; onClose?: () => void; onForget?: () => void; large?: boolean }) {
  const o = r.order!;
  const brand = getBrand(o.brandId);
  const now = useNow(1000);
  const { world } = useStudent();
  const reduce = useReducedMotion();
  const isReady = o.status === "ready";
  const finished = o.status === "closed" || o.status === "expired" || r.state !== "ok";

  return (
    <motion.article
      layout={!reduce}
      className={`overflow-hidden rounded-[var(--radius-card)] ${isReady ? "bg-free text-white" : "bg-surface"} ${finished ? "opacity-70" : ""}`}
      style={isReady && !reduce ? { animation: "ready-pop 520ms var(--ease-out-soft)" } : undefined}
      aria-label={`${brand?.name} ${o.displayNumber}번 주문, ${isReady ? "준비 완료" : finished ? "추적 종료" : "준비 중"}`}
      data-testid="order-card"
      data-status={o.status}
    >
      {/* pass header: merchant first, then the number people listen for */}
      <div className={`flex items-center gap-3 px-5 pt-4 pb-3 ${isReady ? "" : "bg-navy text-white"}`}>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl text-[17px] font-[800] ${isReady ? "bg-white/20" : "bg-white/12"}`}>{brand?.name.slice(0, 1)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold">{brand?.name}</p>
          <p className="text-[12px] opacity-75">키오스크 체험 주문 · 번호표</p>
        </div>
        <p className={`num shrink-0 leading-none font-[800] tracking-[-0.04em] ${large ? "text-[52px]" : "text-[40px]"}`}>{o.displayNumber}</p>
      </div>
      <div className="relative h-0" aria-hidden>
        <span className="absolute top-[-8px] -left-2 size-4 rounded-full bg-floor" />
        <span className="absolute top-[-8px] -right-2 size-4 rounded-full bg-floor" />
      </div>
      <div className="px-5 pt-3 pb-4">
        <p className={`text-[13px] ${isReady ? "opacity-85" : "text-ink-3"}`}>
          {o.items.map((i) => `${i.name}${i.qty > 1 ? ` ${i.qty}개` : ""}`).join(", ")}
        </p>

        {/* two real states only: accepted → ready */}
        <ol className="mt-3 grid grid-cols-2 gap-1.5" aria-label="진행 상태">
          <li className={`h-1.5 rounded-full ${isReady ? "bg-white" : "bg-blue"}`} aria-label="접수됨" />
          <li className={`h-1.5 rounded-full ${isReady ? "bg-white" : "bg-line"}`} aria-label={isReady ? "준비 완료" : "준비 완료 전"} />
        </ol>

        {o.status === "accepted" && r.state === "ok" && (
          <div className="mt-3">
            <p className="text-[19px] font-bold">준비하고 있어요</p>
            <p className="mt-0.5 text-[14px] text-ink-2">
              주문한 지 <span className="num">{elapsed(o.acceptedAt, now)}</span>
              {o.prepEstimate && (
                <>
                  , 보통 <span className="num font-semibold text-ink">{prepText(o.prepEstimate.p50, o.prepEstimate.p80)}</span> 걸려요
                </>
              )}
            </p>
            {o.prepEstimate && now - o.acceptedAt > o.prepEstimate.p80 * 1000 && (
              <p className="mt-1 text-[12.5px] text-ink-3">예상보다 늦어지고 있어요. 매장에서 번호를 호출하면 바로 알려 드려요.</p>
            )}
            <p className="mt-2.5 rounded-xl bg-floor px-3 py-2 text-[12.5px] leading-relaxed text-ink-2">
              받을 때 <b className="text-ink">키오스크 영수증</b>을 챙겨 가세요. 현장은 영수증을 보여 주거나 제출하는 방식이라, 이 앱 화면만으로 받을 수 있다고 보장하지 않아요.
            </p>
          </div>
        )}
        {isReady && (
          <div className="mt-3">
            <p className="text-[21px] font-bold">준비됐어요</p>
            <p className="mt-0.5 text-[15px]">
              <strong>{brand?.name} 카운터</strong>에서 받아 가세요. <span className="num opacity-85">{o.readyAt ? `${since(o.readyAt, now)} 완료` : ""}</span>
            </p>
          </div>
        )}
        {finished && !isReady && (
          <p className="mt-3 text-[15px] font-semibold text-ink-2">
            {o.status === "closed" ? "받은 주문이에요. 추적을 마쳤어요." : "추적 시간이 지나 종료됐어요."}
          </p>
        )}
      </div>

      {isReady && (
        <div className="border-t border-white/25 px-5 py-3 text-[13.5px] leading-relaxed">
          <p>
            <b>어디서?</b> {pickupHint(o.brandId).where}.{" "}
            <Link href="/app?layer=pickup" className="font-semibold underline underline-offset-2">
              지도
            </Link>
          </p>
          <p className="mt-1 opacity-90">카운터에서 영수증을 보여 주거나 제출해 주세요.</p>
          {world && (
            <p className="mt-1">
              지금 자리는{" "}
              <Link href="/app?layer=seats" className="font-semibold underline underline-offset-2">
                {TABLE_LEVEL[world.overall.tableLevel].label} ({percent(world.overall.tableRateLow)}–{percent(world.overall.tableRateHigh)})
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {(onClose || onForget) && (
        <div className={`flex border-t ${isReady ? "border-white/25" : "border-line"}`}>
          {isReady && onClose && (
            <button onClick={onClose} className="h-12 flex-1 text-[15px] font-bold">
              받았어요
            </button>
          )}
          {onForget && (
            <button onClick={onForget} className={`h-12 flex-1 text-[14px] font-semibold ${isReady ? "border-l border-white/25" : "text-ink-2"}`}>
              {finished ? "목록에서 지우기" : "알림 그만 받기"}
            </button>
          )}
        </div>
      )}
    </motion.article>
  );
}
