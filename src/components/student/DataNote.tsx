"use client";
import Link from "next/link";
import { useState } from "react";
import { formatClock } from "@/core/world";
import { Sheet } from "../Sheet";
import { useStudent } from "./StudentProvider";
import { useVisionLinked } from "@/client/vision";

/** The one place that says "simulation" — a small chip that opens what is real and what is not. */
export function ClockChip() {
  const { world } = useStudent();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 shadow-[0_1px_4px_rgba(16,24,40,.12)]"
        aria-haspopup="dialog"
        aria-label={`시뮬레이션 데이터, ${world ? formatClock(world.clock.tSec) : ""}. 데이터 안내 보기`}
      >
        <span className="size-1.5 rounded-full bg-normal-dot" aria-hidden />
        시뮬레이션 <span className="num font-medium text-ink-3">{world ? formatClock(world.clock.tSec) : "–:–"}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="시뮬레이션 데이터예요">
        <DataSources />
        <Link href="/app/about" className="mt-5 block rounded-[var(--radius-tile)] bg-floor py-3.5 text-center text-[15px] font-semibold text-ink" onClick={() => setOpen(false)}>
          데이터 안내
        </Link>
      </Sheet>
    </>
  );
}

export function DataSources() {
  const { info } = useStudent();
  const linked = useVisionLinked();
  const rows: [string, string][] = [
    ["대기열·좌석", linked ? "왼쪽 키오스크 3대와 중앙 칸막이석 24개 중 4개는 테스트 영상의 사전 분석값, 나머지와 시간대별 추이는 시뮬레이션" : "시뮬레이션"],
    ["예상 시간", "예측 모델 (시뮬레이션 기록으로 학습)"],
    ["메뉴·가격", "2026년 11월 현장 키오스크 기준, 판매 여부는 실시간 아님"],
    ["주문·번호", info?.kind === "server" ? "모의 키오스크 주문 (시연 서버)" : "모의 키오스크 주문 (이 기기 안에서만)"],
  ];
  return (
    <dl className="divide-y divide-line">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-4 py-3">
          <dt className="t-sub w-20 shrink-0 text-ink-3">{k}</dt>
          <dd className="t-body">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
