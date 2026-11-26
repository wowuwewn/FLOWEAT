"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { brands as allBrands, getBrand } from "@/core/catalog";
import { kioskById, pickupShort, ZONES } from "@/core/layout";
import { popularTimes, type KioskView, type ZoneView } from "@/core/world";
import { CommonsMap, type MapLayer } from "@/components/map/CommonsMap";
import { Wordmark } from "@/components/brand/Logo";
import { PopularLegend, PopularTimes } from "@/components/PopularTimes";
import { ClockChip } from "@/components/student/DataNote";
import { useStudent } from "@/components/student/StudentProvider";
import { minuteRange, prepText, TABLE_LEVEL } from "@/lib/format";

const LAYERS: { id: MapLayer; label: string }[] = [
  { id: "queue", label: "대기열" },
  { id: "seats", label: "좌석" },
  { id: "pickup", label: "수령" },
];

export default function HomePage() {
  const { world, engine, layer, setLayer, active } = useStudent();

  return (
    <div>
      {/* phones: the map sits behind, the sheet scrolls over it */}
      <div className="sticky top-0 z-0 h-[50vh] min-h-[330px] overflow-hidden bg-canvas lg:hidden">
        <div className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)]">
          <span className="rounded-full bg-white px-3 py-1.5 shadow-[0_1px_4px_rgba(16,24,40,.12)]">
            <Wordmark size={15} />
          </span>
          <ClockChip />
        </div>
        <MobileMap />
      </div>

      <div className="relative z-10 -mt-5 min-h-[60vh] rounded-t-[var(--radius-sheet)] bg-white shadow-[0_-6px_24px_rgba(16,24,40,.07)] lg:mt-0 lg:min-h-dvh lg:rounded-none lg:shadow-none">
        <div className="mx-auto h-1 w-9 translate-y-2 rounded-full bg-line-2 lg:hidden" aria-hidden />
        {!world || !engine ? (
          <div className="space-y-3 p-5 pt-8" aria-busy="true" aria-label="불러오는 중">
            <div className="h-4 w-24 animate-pulse rounded bg-floor" />
            <div className="h-8 w-32 animate-pulse rounded bg-floor" />
            <div className="h-48 animate-pulse rounded-2xl bg-floor" />
          </div>
        ) : (
          <div className="pb-10">
            <div className="hidden items-center justify-between px-5 pt-5 lg:flex">
              <p className="t-sub font-medium text-ink-3">1947 COMMONS</p>
              <ClockChip />
            </div>

            {active.length > 0 && <ActivePasses />}

            <div role="tablist" aria-label="지도 정보" className="mt-3 flex gap-5 border-b border-line px-5 lg:mt-2">
              {LAYERS.map((l) => (
                <button
                  key={l.id}
                  role="tab"
                  aria-selected={layer === l.id}
                  onClick={() => setLayer(l.id)}
                  className={`relative -mb-px h-11 text-[16px] font-semibold tracking-[-0.01em] transition-colors ${layer === l.id ? "text-ink" : "text-ink-3"}`}
                >
                  {l.label}
                  {layer === l.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-ink" />}
                </button>
              ))}
            </div>

            {layer === "queue" && <QueueLayer />}
            {layer === "seats" && <SeatLayer />}
            {layer === "pickup" && <PickupLayer />}
          </div>
        )}
      </div>
    </div>
  );
}

/** Map sized to the space between the top chips and the sheet edge, so its controls are never under the sheet. */
function MobileMap() {
  const { world, selected, setSelected, layer, active } = useStudent();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const labels = Object.fromEntries(active.map((r) => [r.order!.brandId, String(r.order!.displayNumber)]));
  return (
    <div ref={box} className="absolute inset-x-0 top-0 bottom-5">
      {world && size && size.h > 120 && (
        <CommonsMap
          kiosks={world.kiosks}
          selected={selected}
          onSelect={setSelected}
          layer={layer}
          width={size.w}
          height={size.h}
          fitHalf={10.4}
          noticeTop={56}
          padBottom={14}
          highlightBrands={active.map((r) => r.order!.brandId)}
          highlightLabels={labels}
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------------ queue
function QueueLayer() {
  const { world, engine, selected, setSelected } = useStudent();
  const pt = useMemo(() => (engine && world ? popularTimes(engine, world, "lines") : null), [engine, world]);
  if (!world) return null;
  const byId = Object.fromEntries(world.kiosks.map((k) => [k.id, k]));
  const fastest = minuteRange(world.overall.fastestP20, world.overall.fastestP80);
  const allSimilar = world.kiosks.every((k) => k.similar);
  const fastSides = new Set(world.kiosks.filter((k) => k.similar).map((k) => k.side));
  const sel = selected ? byId[selected] : null;

  return (
    <section className="px-5 pt-5" aria-label="키오스크 대기열">
      <div className="flex items-end justify-between">
        <div>
          <p className="t-sub text-ink-3">가장 빠른 줄</p>
          <p className="t-display num">{fastest}</p>
        </div>
        <p className="t-sub pb-1.5 text-ink-3">{allSimilar ? "6대 모두 비슷해요" : fastSides.size === 2 ? "양쪽 모두" : fastSides.has("left") ? "왼쪽이 빨라요" : "오른쪽이 빨라요"}</p>
      </div>

      {/* the six kiosks as they stand at the door: left bank | aisle | right bank */}
      <div className="mt-4 grid grid-cols-[1fr_20px_1fr] gap-x-1.5 gap-y-1.5" role="list" aria-label="키오스크 6대, 정문 기준 배치">
        {([3, 2, 1] as const).map((d) =>
          (["L", "R"] as const).map((s, i) => {
            const k = byId[`${s}${d}`];
            return (
              <div key={`${s}${d}`} role="listitem" style={{ gridColumn: i === 0 ? 1 : 3 }}>
                <KioskCell k={k} strong={k.similar && !allSimilar} on={selected === k.id} onClick={() => setSelected(selected === k.id ? null : k.id)} />
              </div>
            );
          }),
        )}
        <p className="col-span-3 mt-1 flex items-center gap-2 text-[12px] font-semibold text-ink-3" aria-hidden>
          <span className="h-px flex-1 bg-line-2" />
          정문
          <span className="h-px flex-1 bg-line-2" />
        </p>
      </div>

      <p className="t-sub mt-3 min-h-[18px] text-ink-3" aria-live="polite">
        {sel ? (
          <>
            <span className="font-semibold text-ink-2">{kioskById(sel.id)?.label}</span> · 한 건에 평균 <span className="num">{Math.round(sel.meanServiceSec)}</span>초
            {sel.source !== "simulated" && <span className="ml-1 font-semibold text-blue-ink">· 영상 AI</span>}
          </>
        ) : null}
      </p>

      {pt && (
        <div className="mt-7">
          <div className="flex items-baseline justify-between">
            <h2 className="t-head">시간대별 대기 인원</h2>
            <span className="t-sub text-ink-3">{{ busier: "평소보다 붐빔", quieter: "평소보다 한산", usual: "평소와 비슷", unknown: "" }[pt.vsUsual]}</span>
          </div>
          <div className="mt-3">
            <PopularTimes slots={pt.slots} max={Math.max(20, ...pt.slots.map((s) => Math.max(s.usual, s.today ?? 0, s.forecast ?? 0)))} label="시간대별 전체 대기 인원" unit={(v) => `${Math.round(v)}명`} />
          </div>
          <PopularLegend />
        </div>
      )}
    </section>
  );
}

function KioskCell({ k, strong, on, onClick }: { k: KioskView; strong: boolean; on: boolean; onClick: () => void }) {
  const spec = kioskById(k.id)!;
  const text = minuteRange(k.p20, k.p80);
  const tone = on ? "bg-ink text-white" : strong ? "bg-ice text-blue-ink" : "bg-floor text-ink";
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      aria-label={`${spec.label}, ${text}, 대기 ${k.people}명${strong ? ", 빠른 편" : ""}`}
      data-kiosk={k.id}
      className={`flex w-full items-center justify-between rounded-[var(--radius-tile)] px-3.5 py-3 text-left transition-colors ${tone}`}
    >
      <span>
        <span className="num block text-[18px] leading-6 font-bold tracking-[-0.02em]">{text}</span>
        <span className={`t-micro num block ${on ? "text-white/70" : strong ? "text-blue-ink" : "text-ink-3"}`}>
          {spec.shortLabel} · {k.people}명
        </span>
      </span>
      <QueueBars n={k.people} on={on} strong={strong} />
    </button>
  );
}

/** The line itself: one dot per person waiting (max 8), so a long line looks long. */
function QueueBars({ n, on, strong }: { n: number; on: boolean; strong: boolean }) {
  const c = on ? "bg-white" : strong ? "bg-blue" : "bg-ink-3";
  return (
    <span className="grid grid-cols-4 gap-[3px]" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <span key={i} className={`size-[5px] rounded-full ${i < n ? c : on ? "bg-white/20" : "bg-ink-4/35"}`} />
      ))}
    </span>
  );
}

// ------------------------------------------------------------------ seats
function SeatLayer() {
  const { world, engine } = useStudent();
  const pt = useMemo(() => (engine && world ? popularTimes(engine, world, "tables") : null), [engine, world]);
  if (!world) return null;
  const observed = world.zones.filter((z) => z.observed);
  const quad = observed.filter((z) => ZONES.find((x) => x.id === z.id)!.seatsPerTable > 1);
  const single = observed.filter((z) => ZONES.find((x) => x.id === z.id)!.seatsPerTable === 1);
  const freeQuad = quad.reduce((s, z) => s + z.apparentlyEmpty, 0);
  const freeSingle = single.reduce((s, z) => s + z.apparentlyEmpty, 0);
  const lvl = TABLE_LEVEL[world.overall.tableLevel];

  return (
    <section className="px-5 pt-5" aria-label="좌석">
      <div className="flex items-end justify-between">
        <div>
          <p className="t-sub text-ink-3">빈 4인 테이블</p>
          <p className="t-display num">
            {freeQuad}
            <span className="ml-0.5 text-[20px] font-semibold">개</span>
          </p>
        </div>
        <div className="pb-1.5 text-right">
          <p className={`t-sub font-semibold ${lvl.text}`}>{lvl.label}</p>
          <p className="t-sub num text-ink-3">1인석 {freeSingle}석 빔</p>
        </div>
      </div>

      <ul className="mt-5 space-y-5">
        {observed.map((z) => (
          <ZoneWaffle key={z.id} z={z} />
        ))}
      </ul>
      <SeatLegend />

      {pt && (
        <div className="mt-8">
          <div className="flex items-baseline justify-between">
            <h2 className="t-head">시간대별 좌석</h2>
            <span className="t-sub text-ink-3">{{ busier: "평소보다 붐빔", quieter: "평소보다 한산", usual: "평소와 비슷", unknown: "" }[pt.vsUsual]}</span>
          </div>
          <div className="mt-3">
            <PopularTimes slots={pt.slots} max={1} label="시간대별 좌석 사용률" unit={(v) => `${Math.round(v * 100)}%`} color="#0b8457" />
          </div>
          <PopularLegend />
        </div>
      )}
    </section>
  );
}

/** One square per table: green = looks free, grey = taken, hatched = can't tell. Free first so they read at a glance. */
function ZoneWaffle({ z }: { z: ZoneView }) {
  const cells: ("free" | "busy" | "unsure")[] = [
    ...Array<"free">(z.apparentlyEmpty).fill("free"),
    ...Array<"unsure">(z.uncertain).fill("unsure"),
    ...Array<"busy">(z.occupied).fill("busy"),
  ];
  const single = ZONES.find((x) => x.id === z.id)!.seatsPerTable === 1;
  return (
    <li>
      <div className="flex items-baseline justify-between">
        <span className="t-row">{z.name}</span>
        <span className="t-sub num text-ink-3">
          <b className={`font-semibold ${z.apparentlyEmpty ? "text-free" : "text-ink-3"}`}>{z.apparentlyEmpty}</b> / {z.tables}
          {single ? "석" : "개"} 빔{z.source !== "simulated" && <span className="ml-1 font-semibold text-blue-ink">· 영상 AI</span>}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-[3px]" role="img" aria-label={`${z.name}: 빈 자리 ${z.apparentlyEmpty}, 사용 중 ${z.occupied}, 확인 중 ${z.uncertain}`}>
        {cells.map((c, i) => (
          <span
            key={i}
            className={`${single ? "size-[9px] rounded-[2px]" : "size-[13px] rounded-[3px]"} ${c === "free" ? "bg-free" : c === "busy" ? "bg-line-2" : "hatch bg-floor"}`}
          />
        ))}
      </div>
    </li>
  );
}

function SeatLegend() {
  return (
    <p className="t-micro mt-4 flex flex-wrap gap-x-4 gap-y-1 text-ink-3">
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-free" />빈 자리
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-line-2" />
        사용 중
      </span>
      <span className="flex items-center gap-1.5">
        <span className="hatch size-2.5 rounded-[2px] bg-floor" />
        짐만 있음·가려짐
      </span>
    </p>
  );
}

// ------------------------------------------------------------------ pickup
function PickupLayer() {
  const { world, active } = useStudent();
  if (!world) return null;
  const mine = new Map(active.map((r) => [r.order!.brandId, r.order!]));
  const list = [...world.brands].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)));
  return (
    <section className="pt-2" aria-label="수령">
      <p className="t-sub mx-5 mt-3 flex items-center gap-1.5 text-ink-2">
        <svg viewBox="0 0 20 20" className="size-4 text-ink-3" aria-hidden>
          <path d="M5 3h10v14l-2-1.3L11 17l-2-1.3L7 17l-2-1.3z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
        모니터에 번호가 뜨면 영수증을 들고 카운터로
      </p>
      <ul className="mt-2">
        {list.map((b) => {
          const loc = pickupShort(b.id);
          const mon = allBrands.find((x) => x.id === b.id)?.monitor;
          const o = mine.get(b.id);
          return (
            <li key={b.id}>
              <Link href={`/app/menu/${b.id}`} className={`flex items-center gap-3 px-5 py-3 active:bg-floor ${o ? "bg-ice/60" : ""}`}>
                <span className="min-w-0 flex-1">
                  <span className="t-row flex items-center gap-2">
                    {b.name}
                    {o && (
                      <span className={`num rounded-md px-1.5 text-[12px] leading-5 font-bold text-white ${o.status === "ready" ? "bg-free" : "bg-blue"}`}>
                        {o.displayNumber}
                      </span>
                    )}
                  </span>
                  <span className="t-sub block text-ink-3">
                    {loc ? (
                      <>
                        {loc.text}
                        {!loc.sure && " (추정)"}
                      </>
                    ) : (
                      <span className="text-ink-3">위치 미확인</span>
                    )}
                    {mon && <> · 모니터 {mon.screen === "A" ? 1 : 2}</>}
                  </span>
                </span>
                <span className="text-right">
                  <span className="num block text-[15px] font-semibold">{prepText(b.p50, b.p80)}</span>
                  <span className="t-micro block text-ink-3">조리</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ActivePasses() {
  const { active } = useStudent();
  return (
    <div className="no-scrollbar mt-4 flex snap-x scroll-px-5 gap-2 overflow-x-auto px-5" aria-label="진행 중인 주문">
      {active.map((r) => {
        const o = r.order!;
        const ready = o.status === "ready";
        return (
          <Link key={r.token} href="/app/orders" className={`flex min-w-[220px] snap-start items-center gap-3 rounded-[var(--radius-tile)] px-4 py-2.5 ${ready ? "bg-free text-white" : "bg-floor"}`}>
            <span className="num text-[22px] leading-none font-bold tracking-[-0.02em]">{o.displayNumber}</span>
            <span className="min-w-0">
              <span className="t-sub block truncate font-semibold">{getBrand(o.brandId)?.name}</span>
              <span className={`t-micro block ${ready ? "text-white/85" : "text-ink-3"}`}>{ready ? "준비 완료 · 영수증 지참" : o.prepEstimate ? `조리 중 · ${prepText(o.prepEstimate.p50, o.prepEstimate.p80)}` : "조리 중"}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
