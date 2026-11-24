"use client";
import { PageHeader } from "@/components/student/Chrome";
import { useStudent } from "@/components/student/StudentProvider";
import { TrendChart } from "@/components/TrendChart";
import { seatInsight } from "@/core/insight";
import { METHOD_LABEL } from "@/core/predict/forecast";
import { DATA_MODE_LABEL, formatClock } from "@/core/world";
import { percent, TABLE_LEVEL } from "@/lib/format";

export default function DiningPage() {
  const { world } = useStudent();
  if (!world) return <PageHeader title="자리" back="/" />;
  const o = world.overall;
  const fc = world.forecast.tables;
  const unobservedSeats = world.zones.filter((z) => !z.observed).reduce((s, z) => s + z.tables * 4, 0);
  return (
    <div className="pb-6">
      <PageHeader title="자리" back="/" />
      <section className="mx-3 rounded-[var(--radius-sheet)] bg-surface px-5 pt-5 pb-4">
        <p className={`text-[30px] leading-tight font-[780] tracking-[-0.03em] ${TABLE_LEVEL[o.tableLevel].text}`}>{TABLE_LEVEL[o.tableLevel].label}</p>
        <p className="num mt-1 text-[15px] text-ink-2">
          관측 중인 테이블 {o.observedTables}개 중 {percent(o.tableRateLow)}–{percent(o.tableRateHigh)} 사용 중
        </p>
        <p className="mt-2 text-[14.5px] text-ink-2">{seatInsight(world)}</p>
        <div className="mt-4">
          <TrendChart
            t={world.trend.t}
            values={world.trend.tables}
            forecast={fc}
            yMax={1}
            color="var(--color-brick)"
            label={`관측 구역 자리 사용률 추이. 지금 ${percent(world.trend.tables.at(-1)!)}${fc ? `, 15분 뒤 약 ${percent(fc[2].value)}` : ""}`}
            height={96}
          />
        </div>
        {fc ? (
          <p className="num mt-2 text-[13px] text-ink-3">
            15분 뒤 {percent(fc[2].lo)}–{percent(fc[2].hi)} 예상. 방식: {METHOD_LABEL[fc[2].method]} (기록 6일로 비교해 가장 오차가 작은 방식)
          </p>
        ) : (
          <p className="mt-2 text-[13px] text-ink-3">예측할 기록이 부족해서 지금까지의 추이만 보여요.</p>
        )}
      </section>

      <section className="mx-3 mt-3 rounded-[var(--radius-card)] bg-surface px-5 pt-4 pb-2" aria-labelledby="zones-h">
        <h2 id="zones-h" className="text-[17px] font-bold">
          구역별
        </h2>
        <ul className="mt-2 divide-y divide-line">
          {world.zones
            .filter((z) => z.observed)
            .map((z) => (
              <li key={z.id} className="py-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[16px] font-semibold">{z.name}</span>
                  <span className={`text-[14px] font-bold ${TABLE_LEVEL[z.level].text}`}>{TABLE_LEVEL[z.level].label}</span>
                </div>
                <p className="text-[13px] text-ink-3">{z.description}</p>
                <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-floor" aria-hidden>
                  <span className="bg-brick" style={{ width: percent(z.occupied / z.tables) }} />
                  <span className="hatch" style={{ width: percent(z.uncertain / z.tables) }} />
                </div>
                <p className="num mt-1.5 text-[13px] text-ink-2">
                  사용 {z.occupied}, 판단 어려움 {z.uncertain}, 비어 보임 {z.apparentlyEmpty} <span className="text-ink-3">/ {z.tables}개</span>
                </p>
              </li>
            ))}
        </ul>
      </section>

      <div className="mx-5 mt-4 space-y-2 text-[12.5px] leading-relaxed text-ink-3">
        <p>판단 어려움은 가방만 있거나 기둥·사람에 가려 확실하지 않은 테이블이에요. 비어 있다고 세지 않아요.</p>
        <p>그 밖의 좌석 약 {unobservedSeats}석은 카메라 관측 범위 밖으로 가정해 숫자에 넣지 않았어요. 구역 이름은 사진에서 확인한 좌석 형태이고, 위치와 테이블 수는 시연용 가정이에요.</p>
        <p>빈자리를 맡아 주거나 특정 자리를 보장하지 않아요. 점심 피크에는 빈 테이블도 금방 채워져요.</p>
        <p>
          {DATA_MODE_LABEL.simulated}, 시연 시각 {formatClock(world.clock.tSec)} 기준.
        </p>
      </div>
    </div>
  );
}
