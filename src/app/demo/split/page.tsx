"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { currentScenario, currentSession } from "@/client/session";

/** All four surfaces in one browser — they share storage, so one-device mode works end to end. */
export default function SplitDemo() {
  const [q, setQ] = useState<string | null>(null);
  useEffect(() => setQ(`s=${currentSession()}&sc=${currentScenario()}`), []);
  if (!q) return <div className="min-h-dvh bg-[#0b1630]" />;
  const pane = "overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgba(255,255,255,.08)]";
  return (
    <div className="flex h-dvh flex-col bg-[#0b1630] p-3 text-white">
      <div className="mb-2 flex items-center justify-between px-1 text-[13px]">
        <p>
          <b>분할 화면 체험</b> <span className="opacity-75">키오스크에서 주문 → 번호표의 ‘이 기기에서 열기’ 또는 휴대폰 화면의 QR 스캔 → 직원 화면에서 완료</span>
        </p>
        <Link href={`/?${q}`} className="rounded-full border border-white/25 px-3 py-1">
          시연 안내로
        </Link>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(320px,390px)_1fr_1fr] grid-rows-2 gap-3">
        <div className={`${pane} row-span-2 flex flex-col`}>
          <p className="bg-navy px-3 py-1.5 text-[12px] font-semibold">학생 휴대폰</p>
          <iframe title="학생 화면" src={`/app/orders?${q}`} name="student" className="min-h-0 w-full flex-1" />
        </div>
        <div className={`${pane} row-span-2 flex flex-col`}>
          <p className="bg-navy px-3 py-1.5 text-[12px] font-semibold">모의 키오스크</p>
          <iframe title="모의 키오스크" src={`/kiosk?${q}&k=L2`} className="min-h-0 w-full flex-1" />
        </div>
        <div className={`${pane} flex flex-col`}>
          <p className="bg-navy px-3 py-1.5 text-[12px] font-semibold">직원 화면</p>
          <iframe title="직원 화면" src={`/staff?${q}`} className="min-h-0 w-full flex-1" />
        </div>
        <div className={`${pane} flex flex-col`}>
          <p className="bg-navy px-3 py-1.5 text-[12px] font-semibold">호출 모니터</p>
          <iframe title="호출 모니터" src={`/monitor?${q}`} className="min-h-0 w-full flex-1" />
        </div>
      </div>
    </div>
  );
}
