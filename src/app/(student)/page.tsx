"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EntranceView } from "@/components/EntranceView";
import { IconChevron } from "@/components/icons";
import { ClockChip } from "@/components/student/DataNote";
import { useStudent } from "@/components/student/StudentProvider";
import { TrendChart } from "@/components/TrendChart";
import { queueInsight, seatInsight, trendWord } from "@/core/insight";
import { minuteRange, minuteRangeParts, percent, TABLE_LEVEL } from "@/lib/format";

export default function HomePage() {
  const { world } = useStudent();
  const router = useRouter();

  return (
    <div className="pb-6">
      <header className="flex items-start justify-between px-5 pt-4 pb-3">
        <div>
          <p className="text-[22px] leading-none font-extrabold tracking-[-0.04em] text-navy">FLOWEAT</p>
          <p className="mt-1.5 text-[13px] font-medium text-ink-2">1947 COMMONS, 혜당관 1층</p>
        </div>
        <ClockChip />
      </header>

      {!world ? (
        <HomeSkeleton />
      ) : (
        <>
          <section aria-labelledby="queue-h" className="mx-3 rounded-[var(--radius-sheet)] bg-surface px-4 pt-5 pb-4">
            <h1 id="queue-h" className="px-1 text-[15px] font-semibold text-ink-2">
              지금 줄을 서면 주문까지
            </h1>
            {world.overall.fastestP80 < 75 ? (
              <p className="mt-1 px-1 text-[34px] leading-tight font-[780] tracking-[-0.03em]">거의 바로 주문해요</p>
            ) : (
              <p className="mt-0.5 px-1">
                <span className="num text-[46px] leading-none font-[780] tracking-[-0.04em]">
                  {minuteRangeParts(world.overall.fastestP20, world.overall.fastestP80).value}
                </span>
                <span className="ml-1 text-[22px] font-bold">{minuteRangeParts(world.overall.fastestP20, world.overall.fastestP80).unit}</span>
                <span className="ml-2 text-[14px] font-medium text-ink-3">가장 빠른 줄 기준</span>
              </p>
            )}

            <div className="mt-3 -mx-1">
              <EntranceView kiosks={world.kiosks} compact onSelect={(id) => router.push(`/queue?k=${id}`)} />
            </div>

            <p className="mt-1 px-1 text-[14.5px] leading-relaxed text-ink-2">{queueInsight(world)}</p>

            <Link href="/queue" className="mt-3 flex items-center justify-between rounded-2xl bg-floor px-4 py-3.5 text-[15px] font-semibold">
              키오스크 6대 비교하기
              <IconChevron className="size-5 text-ink-3" />
            </Link>
          </section>

          <section aria-labelledby="next-h" className="mx-3 mt-3 rounded-[var(--radius-card)] bg-surface px-5 pt-4 pb-3">
            <div className="flex items-baseline justify-between">
              <h2 id="next-h" className="text-[17px] font-bold">
                앞으로 15분
              </h2>
              <span className="text-[12px] text-ink-3">점선은 예측</span>
            </div>
            {world.forecast.lines ? (
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[13px] text-ink-2">주문 줄 전체</p>
                  <p className="text-[17px] font-bold">
                    {trendWord(world.overall.linePeople, world.forecast.lines[2].value, 6)}
                  </p>
                  <TrendChart
                    t={world.trend.t}
                    values={world.trend.lines}
                    forecast={world.forecast.lines}
                    yMax={Math.max(30, ...world.trend.lines, ...world.forecast.lines.map((p) => p.hi))}
                    label={`주문 줄 전체 인원 추이와 15분 예측. 지금 ${world.overall.linePeople}명, 15분 뒤 약 ${Math.round(world.forecast.lines[2].value)}명`}
                    height={64}
                    width={160}
                  />
                </div>
                <div>
                  <p className="text-[13px] text-ink-2">관측 구역 자리</p>
                  <p className="text-[17px] font-bold">
                    {world.forecast.tables ? trendWord(world.trend.tables.at(-1)!, world.forecast.tables[2].value, 0.05) : "정보 부족"}
                  </p>
                  <TrendChart
                    t={world.trend.t}
                    values={world.trend.tables}
                    forecast={world.forecast.tables}
                    yMax={1}
                    color="var(--color-brick)"
                    label={`관측 구역 자리 사용률 추이와 15분 예측. 지금 ${percent(world.trend.tables.at(-1)!)}`}
                    height={64}
                    width={160}
                  />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[14px] text-ink-2">예측할 기록이 아직 부족해요. 지금 상태만 보여드려요.</p>
            )}
          </section>

          <section aria-labelledby="seat-h" className="mx-3 mt-3 rounded-[var(--radius-card)] bg-surface px-5 pt-4 pb-4">
            <Link href="/dining" className="flex items-baseline justify-between">
              <h2 id="seat-h" className="text-[17px] font-bold">
                자리
              </h2>
              <span className={`text-[15px] font-bold ${TABLE_LEVEL[world.overall.tableLevel].text}`}>
                {TABLE_LEVEL[world.overall.tableLevel].label}
              </span>
            </Link>
            <p className="mt-1 text-[14px] text-ink-2">{seatInsight(world)}</p>
            <ul className="mt-3 space-y-2.5">
              {world.zones
                .filter((z) => z.observed)
                .map((z) => (
                  <li key={z.id} className="grid grid-cols-[92px_1fr_64px] items-center gap-3 text-[13.5px]">
                    <span className="font-medium">{z.name}</span>
                    <span className="relative h-2.5 overflow-hidden rounded-full bg-floor" aria-hidden>
                      <span className="absolute inset-y-0 left-0 rounded-full bg-brick" style={{ width: percent(z.rateLow) }} />
                      <span className="hatch absolute inset-y-0" style={{ left: percent(z.rateLow), width: percent(z.rateHigh - z.rateLow) }} />
                    </span>
                    <span className="num text-right text-ink-2">
                      {Math.round(z.rateLow * 100)}–{Math.round(z.rateHigh * 100)}%
                    </span>
                  </li>
                ))}
            </ul>
            <p className="mt-3 text-[12.5px] text-ink-3">
              빗금은 가방만 있거나 가려서 판단이 어려운 테이블이에요. 빈자리를 맡아 드리지는 않아요.
            </p>
          </section>

          <section aria-labelledby="brand-h" className="mx-3 mt-3 rounded-[var(--radius-card)] bg-surface pt-4 pb-1">
            <div className="flex items-baseline justify-between px-5">
              <h2 id="brand-h" className="text-[17px] font-bold">
                주문 후 준비까지
              </h2>
              <Link href="/menu" className="text-[13.5px] font-semibold text-blue-ink">
                메뉴 보기
              </Link>
            </div>
            <ul className="mt-1">
              {world.brands.map((b) => (
                <li key={b.id}>
                  <Link href={`/menu/${b.id}`} className="flex items-center gap-3 px-5 py-3 active:bg-floor">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-semibold">{b.name}</span>
                      <span className="block text-[13px] text-ink-3">{b.cuisine}</span>
                    </span>
                    <span className="num text-[17px] font-bold">{minuteRange(b.p20, b.p80)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <footer className="px-6 pt-5 text-[12.5px] leading-relaxed text-ink-3">
            시연용 시뮬레이션과 실제로 계산하는 예측 모델로 만든 화면이에요. 학교·운영사 시스템과 연결되지 않았고, 메뉴와 가격은 공개 자료 참고값이에요. 단국대 재학생 팀의 공모전 시제품이에요.{" "}
            <Link href="/about" className="font-semibold text-ink-2 underline underline-offset-2">
              출처 보기
            </Link>
          </footer>
        </>
      )}
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-3 animate-pulse rounded-[var(--radius-sheet)] bg-surface p-5" aria-busy="true" aria-label="불러오는 중">
      <div className="h-4 w-40 rounded bg-floor" />
      <div className="mt-3 h-11 w-32 rounded bg-floor" />
      <div className="mt-5 h-64 rounded-2xl bg-floor" />
    </div>
  );
}
