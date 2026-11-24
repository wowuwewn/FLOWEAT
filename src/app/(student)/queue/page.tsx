"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EntranceView } from "@/components/EntranceView";
import { Sheet } from "@/components/Sheet";
import { PageHeader } from "@/components/student/Chrome";
import { useStudent } from "@/components/student/StudentProvider";
import { queueInsight } from "@/core/insight";
import { DATA_MODE_LABEL, formatClock, type KioskView } from "@/core/world";
import { minuteRange, WAIT_LEVEL } from "@/lib/format";

export default function QueuePage() {
  return (
    <Suspense>
      <Queue />
    </Suspense>
  );
}

function Queue() {
  const { world } = useStudent();
  const params = useSearchParams();
  const router = useRouter();
  const selected = params.get("k");
  const select = (id: string | null) => router.replace(id ? `/queue?k=${id}` : "/queue", { scroll: false });
  const sel = world?.kiosks.find((k) => k.id === selected) ?? null;

  return (
    <div className="pb-6">
      <PageHeader title="키오스크 6대" back="/" />
      {!world ? (
        <p className="px-5 py-10 text-ink-3">불러오는 중…</p>
      ) : (
        <>
          <p className="px-5 text-[15px] leading-relaxed text-ink-2">{queueInsight(world)}</p>
          <div className="mx-3 mt-3 rounded-[var(--radius-sheet)] bg-surface px-2 pt-3 pb-2">
            <EntranceView kiosks={world.kiosks} selected={selected} onSelect={select} />
          </div>

          {(["left", "right"] as const).map((side) => (
            <section key={side} className="mx-3 mt-3 rounded-[var(--radius-card)] bg-surface" aria-labelledby={`side-${side}`}>
              <h2 id={`side-${side}`} className="px-5 pt-4 pb-1 text-[15px] font-bold text-ink-2">
                정문에서 {side === "left" ? "왼쪽" : "오른쪽"}
              </h2>
              <ul>
                {world.kiosks
                  .filter((k) => k.side === side)
                  .sort((a, b) => a.depth - b.depth)
                  .map((k) => (
                    <li key={k.id}>
                      <button onClick={() => select(k.id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-floor">
                        <span className={`size-2.5 shrink-0 rounded-full ${WAIT_LEVEL[k.level].dot}`} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[16px] font-semibold">{k.label.replace(/^(왼|오른)쪽 /, "")}</span>
                          <span className="num block text-[13px] text-ink-3">
                            줄 {k.people}명{k.inService ? ", 주문 중 1팀" : ""}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className={`num block text-[18px] font-bold ${k.similar && !world.kiosks.every((x) => x.similar) ? "text-blue-ink" : ""}`}>
                            {minuteRange(k.p20, k.p80)}
                          </span>
                          <span className={`block text-[12.5px] font-semibold ${WAIT_LEVEL[k.level].text}`}>{WAIT_LEVEL[k.level].label}</span>
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          ))}

          <p className="mx-5 mt-4 text-[12.5px] leading-relaxed text-ink-3">
            시간은 줄에 선 뒤 내 차례가 와서 화면을 누를 때까지예요. 줄 인원뿐 아니라 기기마다 최근 주문이 얼마나 빨리 끝나는지를 함께 계산해요. 차이가 작으면 비슷하다고 보여 드리고, 특정 줄로 안내하지 않아요. 기기에는 실제 번호가 없어서 정문 기준 위치로만 불러요.
          </p>

          <Sheet open={!!sel} onClose={() => select(null)} title={sel ? `${sel.label} 키오스크` : ""}>
            {sel && <KioskDetail k={sel} clock={formatClock(world.clock.tSec)} />}
          </Sheet>
        </>
      )}
    </div>
  );
}

function KioskDetail({ k, clock }: { k: KioskView; clock: string }) {
  const rows: [string, React.ReactNode][] = [
    ["줄 선 사람", <span key="p" className="num">{k.people}명{k.inService ? " + 지금 주문 중인 1팀" : ""}</span>],
    ["최근 한 건 주문 시간", <span key="m" className="num">평균 {Math.round(k.meanServiceSec)}초 {k.samples > 0 ? `(최근 30분 ${k.samples}건)` : "(최근 기록 없음, 전체 평균 사용)"}</span>],
    ["사람 수만 보고 계산하면", <span key="b" className="num">{minuteRange(k.baselineSec, k.baselineSec)}</span>],
  ];
  return (
    <div>
      <p className="text-[14px] text-ink-2">주문 시작까지</p>
      <p className="num text-[40px] leading-tight font-[780] tracking-[-0.03em]">{minuteRange(k.p20, k.p80)}</p>
      <p className={`text-[15px] font-semibold ${WAIT_LEVEL[k.level].text}`}>
        {WAIT_LEVEL[k.level].label}
        {k.similar ? ", 가장 빠른 줄과 비슷해요" : ""}
      </p>
      <dl className="mt-4 divide-y divide-line">
        {rows.map(([dt, dd]) => (
          <div key={dt} className="flex justify-between gap-4 py-3 text-[15px]">
            <dt className="text-ink-2">{dt}</dt>
            <dd className="text-right font-semibold">{dd}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
        일행은 보통 한 번에 결제해서, 사람 수보다 주문 건수가 적어요. 범위는 예측이 맞을 가능성이 높은 구간이에요. {DATA_MODE_LABEL[k.source]}, 시연 시각 {clock} 기준.
      </p>
    </div>
  );
}
