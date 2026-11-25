"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { getBrand } from "@/core/catalog";
import { queueInsight, seatInsight } from "@/core/insight";
import { kioskById, ZONES } from "@/core/layout";
import { DATA_MODE_LABEL, popularTimes, type KioskView } from "@/core/world";
import { CommonsMap, type MapLayer } from "@/components/map/CommonsMap";
import { Wordmark } from "@/components/brand/Logo";
import { PopularLegend, PopularTimes } from "@/components/PopularTimes";
import { ClockChip } from "@/components/student/DataNote";
import { useStudent } from "@/components/student/StudentProvider";
import { minuteRange, minuteRangeParts, percent, prepText, TABLE_LEVEL, WAIT_LEVEL } from "@/lib/format";

const LAYERS: { id: MapLayer; label: string }[] = [
  { id: "queue", label: "주문 줄" },
  { id: "seats", label: "자리" },
  { id: "pickup", label: "수령" },
];

export default function HomePage() {
  const { world, engine, selected, setSelected, layer, setLayer, active } = useStudent();

  return (
    <div>
      {/* mobile: map sticks behind, the sheet scrolls over it */}
      <div className="sticky top-0 z-0 h-[52vh] min-h-[340px] overflow-hidden bg-floor lg:hidden">
        <div className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)]">
          <span className="rounded-full bg-white/90 px-2.5 py-1.5 shadow-sm">
            <Wordmark size={16} />
          </span>
          <ClockChip />
        </div>
        {world && (
          <div className="absolute inset-x-0 bottom-6 top-10">
            <CommonsMap kiosks={world.kiosks} selected={selected} onSelect={setSelected} layer={layer} height={430} />
          </div>
        )}
      </div>

      <div className="relative z-10 -mt-6 min-h-[60vh] rounded-t-[28px] bg-white shadow-[0_-10px_30px_rgba(15,26,51,.08)] lg:mt-0 lg:min-h-dvh lg:rounded-none lg:shadow-none">
        <div className="mx-auto h-1.5 w-10 translate-y-2 rounded-full bg-line-2 lg:hidden" aria-hidden />
        {!world || !engine ? (
          <div className="space-y-3 p-6" aria-busy="true" aria-label="불러오는 중">
            <div className="h-4 w-32 animate-pulse rounded bg-floor" />
            <div className="h-10 w-40 animate-pulse rounded bg-floor" />
            <div className="h-40 animate-pulse rounded-2xl bg-floor" />
          </div>
        ) : (
          <div className="px-5 pt-6 pb-8">
            <div className="hidden items-center justify-between lg:flex">
              <p className="text-[13px] font-semibold text-ink-3">지금 1947 COMMONS</p>
              <ClockChip />
            </div>

            {active.length > 0 && <ActivePasses />}

            <header className="mt-1">
              <h1 className="text-[15px] font-semibold text-ink-2">지금 줄을 서면 주문까지</h1>
              {world.overall.fastestP80 < 75 ? (
                <p className="text-[34px] leading-tight font-[800] tracking-[-0.03em]">거의 바로 주문해요</p>
              ) : (
                <p className="leading-none">
                  <span className="num text-[48px] font-[800] tracking-[-0.045em]">{minuteRangeParts(world.overall.fastestP20, world.overall.fastestP80).value}</span>
                  <span className="ml-1 text-[22px] font-bold">{minuteRangeParts(world.overall.fastestP20, world.overall.fastestP80).unit}</span>
                </p>
              )}
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{layer === "seats" ? seatInsight(world) : queueInsight(world)}</p>
            </header>

            <div role="tablist" aria-label="지도 정보" className="mt-4 grid grid-cols-3 rounded-[14px] bg-floor p-1">
              {LAYERS.map((l) => (
                <button
                  key={l.id}
                  role="tab"
                  aria-selected={layer === l.id}
                  onClick={() => setLayer(l.id)}
                  className={`h-10 rounded-[11px] text-[14.5px] font-semibold transition-colors ${layer === l.id ? "bg-white text-ink shadow-[0_1px_3px_rgba(15,26,51,.12)]" : "text-ink-3"}`}
                >
                  {l.label}
                </button>
              ))}
            </div>

            {layer === "queue" && <QueueLayer />}
            {layer === "seats" && <SeatLayer />}
            {layer === "pickup" && <PickupLayer />}

            <footer className="mt-8 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-3">
              시뮬레이션과 실제로 계산하는 예측 모델로 만든 시연 화면이에요. 학교·운영사 시스템과 연결되지 않았어요.{" "}
              <Link href="/app/about" className="font-semibold text-ink-2 underline underline-offset-2">
                데이터 출처
              </Link>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}

function KioskGlyph({ id, active }: { id: string; active: boolean }) {
  const k = kioskById(id)!;
  return (
    <svg viewBox="0 0 36 36" className="size-9 shrink-0" aria-hidden>
      <rect width="36" height="36" rx="10" fill={active ? "#eaefff" : "#f1f3f6"} />
      {[1, 2, 3].map((d) =>
        (["left", "right"] as const).map((side) => (
          <rect key={side + d} x={side === "left" ? 9 : 23} y={26 - d * 6.5} width="4" height="4.5" rx="1.2" fill={k.depth === d && k.side === side ? "#2448db" : "#c5ccd8"} />
        )),
      )}
      <rect x="14" y="30" width="8" height="2.4" rx="1.2" fill="#0b1f4d" />
    </svg>
  );
}

function QueueLayer() {
  const { world, engine, selected, setSelected } = useStudent();
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!selected) return;
    listRef.current?.querySelector<HTMLElement>(`[data-kiosk="${selected}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);
  const pt = useMemo(() => (engine && world ? popularTimes(engine, world, "lines") : null), [engine, world]);
  if (!world) return null;
  const order = ["L1", "L2", "L3", "R1", "R2", "R3"];
  const ks = order.map((id) => world.kiosks.find((k) => k.id === id)!);
  const allSimilar = ks.every((k) => k.similar);
  return (
    <section className="mt-3" aria-label="키오스크 6대">
      <ul ref={listRef} className="-mx-2">
        {ks.map((k) => (
          <KioskRow key={k.id} k={k} open={selected === k.id} strong={k.similar && !allSimilar} onToggle={() => setSelected(selected === k.id ? null : k.id)} />
        ))}
      </ul>
      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">
        줄에 선 뒤 화면을 누르기까지의 예측이에요. 차이가 작으면 비슷하다고 보여 드리고 특정 줄로 안내하지 않아요. 기기에는 번호가 없어서 정문 기준 위치로 불러요.
      </p>

      {pt && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-bold">시간대별 주문 줄</h2>
            <span className="text-[13.5px] font-semibold text-ink-2">{{ busier: "평소보다 붐벼요", quieter: "평소보다 한산해요", usual: "평소와 비슷해요", unknown: "" }[pt.vsUsual]}</span>
          </div>
          <div className="mt-2">
            <PopularTimes slots={pt.slots} max={Math.max(20, ...pt.slots.map((s) => Math.max(s.usual, s.today ?? 0, s.forecast ?? 0)))} label="시간대별 전체 주문 줄 인원" unit={(v) => `${Math.round(v)}명`} />
          </div>
          <PopularLegend />
        </div>
      )}
    </section>
  );
}

function KioskRow({ k, open, strong, onToggle }: { k: KioskView; open: boolean; strong: boolean; onToggle: () => void }) {
  const lvl = WAIT_LEVEL[k.level];
  return (
    <li data-kiosk={k.id} className={`rounded-2xl transition-colors ${open ? "bg-ice" : ""}`}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left active:bg-floor">
        <KioskGlyph id={k.id} active={open || strong} />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold">{k.label}</span>
          <span className="num block text-[13px] text-ink-3">
            줄 {k.people}명{k.inService ? ", 주문 중 1명" : ""}
            {k.source !== "simulated" && <span className="ml-1 font-semibold text-blue-ink">영상 AI</span>}
          </span>
        </span>
        <span className="text-right">
          <span className={`num block text-[18px] font-[760] ${strong ? "text-blue-ink" : ""}`}>{minuteRange(k.p20, k.p80)}</span>
          <span className={`block text-[12.5px] font-semibold ${strong ? "text-blue-ink" : lvl.text}`}>{strong ? "빠른 편" : lvl.label}</span>
        </span>
      </button>
      {open && (
        <dl className="num mx-2 mb-2 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[#d9e1f7] px-2 pt-3 pb-1 text-[13.5px]">
          <div>
            <dt className="text-ink-3">한 건 주문 시간</dt>
            <dd className="font-semibold">평균 {Math.round(k.meanServiceSec)}초</dd>
          </div>
          <div>
            <dt className="text-ink-3">사람 수만 보면</dt>
            <dd className="font-semibold">{minuteRange(k.baselineSec, k.baselineSec)}</dd>
          </div>
          <div className="col-span-2 text-[12.5px] text-ink-3">
            일행은 보통 한 번에 결제해서 사람 수보다 주문 건수가 적어요. 최근 30분 {k.samples}건 기록 반영. {DATA_MODE_LABEL[k.source]}.
          </div>
        </dl>
      )}
    </li>
  );
}

function SeatLayer() {
  const { world, engine } = useStudent();
  const pt = useMemo(() => (engine && world ? popularTimes(engine, world, "tables") : null), [engine, world]);
  if (!world) return null;
  const o = world.overall;
  const observed = world.zones.filter((z) => z.observed);
  const unit = (kind: "quad" | "single") => {
    const zs = observed.filter((z) => (ZONES.find((x) => x.id === z.id)!.seatsPerTable === 1) === (kind === "single"));
    return { tables: zs.reduce((s, z) => s + z.tables, 0), free: zs.reduce((s, z) => s + z.apparentlyEmpty, 0) };
  };
  const quad = unit("quad");
  const single = unit("single");
  return (
    <section className="mt-4" aria-label="자리">
      <div className="flex items-baseline gap-3">
        <p className={`text-[26px] font-[800] ${TABLE_LEVEL[o.tableLevel].text}`}>{TABLE_LEVEL[o.tableLevel].label}</p>
        <p className="num text-[14px] text-ink-2">
          관측 구역 {percent(o.tableRateLow)}–{percent(o.tableRateHigh)} 사용 중
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-floor px-4 py-3">
          <p className="text-[13px] text-ink-3">4인 테이블</p>
          <p className="num text-[20px] font-[760]">
            {quad.free}
            <span className="text-[14px] font-medium text-ink-3"> / {quad.tables}개 비어 보임</span>
          </p>
        </div>
        <div className="rounded-2xl bg-floor px-4 py-3">
          <p className="text-[13px] text-ink-3">1인석</p>
          <p className="num text-[20px] font-[760]">
            {single.free}
            <span className="text-[14px] font-medium text-ink-3"> / {single.tables}석 비어 보임</span>
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-3">
        {observed.map((z) => (
          <li key={z.id}>
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold">{z.name}</span>
              <span className={`text-[13.5px] font-bold ${TABLE_LEVEL[z.level].text}`}>{TABLE_LEVEL[z.level].label}</span>
            </div>
            <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-floor" aria-hidden>
              <span className="bg-brick" style={{ width: percent(z.occupied / z.tables) }} />
              <span className="hatch" style={{ width: percent(z.uncertain / z.tables) }} />
            </div>
            <p className="num mt-1 text-[12.5px] text-ink-3">
              사용 {z.occupied}, 판단 어려움 {z.uncertain}, 비어 보임 {z.apparentlyEmpty}
              {z.source !== "simulated" && <span className="ml-1 font-semibold text-blue-ink">일부 영상 AI</span>}
            </p>
          </li>
        ))}
      </ul>
      {pt && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-bold">시간대별 자리</h2>
            <span className="text-[13.5px] font-semibold text-ink-2">{{ busier: "평소보다 붐벼요", quieter: "평소보다 한산해요", usual: "평소와 비슷해요", unknown: "" }[pt.vsUsual]}</span>
          </div>
          <div className="mt-2">
            <PopularTimes slots={pt.slots} max={1} label="시간대별 관측 구역 자리 사용률" unit={(v) => percent(v)} color="#a0533b" />
          </div>
          <PopularLegend />
        </div>
      )}
      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-3">
        가방만 놓인 자리는 맡은 자리로, 그릇만 남았거나 가려진 자리는 판단 어려움으로 세요. 좌석 위치와 테이블 수는 시연용 가정이고, 빈자리를 맡아 드리지 않아요.
      </p>
    </section>
  );
}

function PickupLayer() {
  const { world, active } = useStudent();
  if (!world) return null;
  const mine = new Set(active.map((r) => r.order!.brandId));
  return (
    <section className="mt-3" aria-label="수령">
      <p className="text-[14px] leading-relaxed text-ink-2">번호가 뜨면 각 매장 카운터에서 받아요. 카운터 위치는 아직 확인 전이라 지도에 표시하지 않아요.</p>
      <ul className="-mx-2 mt-2">
        {world.brands.map((b) => (
          <li key={b.id}>
            <Link href={`/app/menu/${b.id}`} className={`flex items-center gap-3 rounded-2xl px-2 py-2.5 active:bg-floor ${mine.has(b.id) ? "bg-ice" : ""}`}>
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-floor text-[14px] font-bold text-navy">{b.name.slice(0, 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-semibold">
                  {b.name}
                  {mine.has(b.id) && <span className="ml-1.5 text-[12.5px] font-bold text-blue-ink">내 주문</span>}
                </span>
                <span className="block text-[13px] text-ink-3">{b.cuisine}</span>
              </span>
              <span className="text-right">
                <span className="num block text-[16px] font-bold">{prepText(b.p50, b.p80)}</span>
                <span className="block text-[12px] text-ink-3">주문 후 준비</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivePasses() {
  const { active } = useStudent();
  return (
    <div className="no-scrollbar -mx-5 mb-4 flex snap-x scroll-px-5 gap-2 overflow-x-auto px-5" aria-label="진행 중인 주문">
      {active.map((r) => {
        const o = r.order!;
        const ready = o.status === "ready";
        return (
          <Link
            key={r.token}
            href="/app/orders"
            className={`flex min-w-[240px] snap-start items-center gap-3 rounded-2xl px-4 py-3 ${ready ? "bg-free text-white" : "bg-navy text-white"}`}
          >
            <span className="num text-[30px] leading-none font-[800] tracking-[-0.04em]">{o.displayNumber}</span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-bold">{getBrand(o.brandId)?.name}</span>
              <span className="block text-[13px] opacity-85">
                {ready ? "준비됐어요, 카운터에서 받아 가세요" : o.prepEstimate ? `준비 중, 보통 ${prepText(o.prepEstimate.p50, o.prepEstimate.p80)}` : "준비 중"}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}


