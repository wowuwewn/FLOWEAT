"use client";
import Link from "next/link";
import { useState } from "react";
import { DATA_MODE_LABEL, formatClock } from "@/core/world";
import { Sheet } from "../Sheet";
import { useStudent } from "./StudentProvider";
import { useVisionLinked } from "@/client/vision";

/** Compact, single place for "this is a demo / where data comes from". */
export function ClockChip() {
  const { world } = useStudent();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink-2"
        aria-haspopup="dialog"
        aria-label={`시뮬레이션 시각 ${world ? formatClock(world.clock.tSec) : ""}, 데이터 출처 보기`}
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue opacity-40 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-blue" />
        </span>
        <span>
          시뮬레이션 <span className="num">{world ? formatClock(world.clock.tSec) : "–:–"}</span>
        </span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="지금 보는 정보는 시연용이에요">
        <DataSources />
        <Link href="/app/about" className="mt-4 block rounded-2xl bg-floor py-3.5 text-center text-[15px] font-semibold text-navy" onClick={() => setOpen(false)}>
          데이터와 출처 자세히
        </Link>
      </Sheet>
    </>
  );
}

export function DataSources() {
  const { world, info } = useStudent();
  const linked = useVisionLinked();
  const rows: [string, string][] = [
    [
      "키오스크 대기와 좌석",
      linked
        ? `왼쪽 키오스크 3대·중앙 칸막이석 4개: ${DATA_MODE_LABEL.recorded_inference}(테스트 영상, 학교 영상 아님) / 나머지: ${DATA_MODE_LABEL.simulated}`
        : `${DATA_MODE_LABEL.simulated} — 실제 CCTV와 연결되지 않았어요. 체험 홈에서 테스트 영상 AI 결과를 연결할 수 있어요`,
    ],
    ["대기·준비시간 예측", "실제로 계산하는 예측 모델 (시뮬레이션 기록으로 학습)"],
    ["브랜드와 메뉴", "공개 자료 참고. 현재 판매 여부와 가격은 확인 전이에요"],
    ["주문과 번호표", info?.kind === "server" ? "모의 키오스크 주문 — 이 시연 서버 안에서만 연결돼요" : "모의 키오스크 주문 — 이 브라우저 안에서만 연결돼요 (한 기기 체험)"],
  ];
  return (
    <div>
      <p className="text-[14.5px] text-ink-2">
        {world?.clock.realTime ? "지금 실제 점심시간 시각에 맞춰" : "점심 피크(12:00–12:45)를 반복해서"} 시뮬레이션하고 있어요. 학교·운영사 시스템과 연결된 실제 현장 데이터가 아니에요.
      </p>
      <dl className="mt-4 divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="py-3">
            <dt className="text-[13px] font-semibold text-ink-3">{k}</dt>
            <dd className="mt-0.5 text-[15px]">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[12.5px] text-ink-3">FLOWEAT은 단국대 재학생 팀의 공모전 시제품이며, 학교 공식 서비스가 아니에요.</p>
    </div>
  );
}
