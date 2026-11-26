"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { brands as allBrands, getBrand } from "@/core/catalog";
import { kioskById, pickupShort, ZONES } from "@/core/layout";
import { popularTimes, type KioskView, type ZoneView } from "@/core/world";
import { CommonsMap, recommendedKiosk, type MapLayer } from "@/components/map/CommonsMap";
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
      {/* seat positions are not verified, so the seats tab has no map: just the chips row */}
      <div className={`lg:hidden ${layer === "seats" ? "relative h-[60px] bg-white" : `sticky top-0 z-0 overflow-hidden bg-canvas ${layer === "queue" ? "h-[36vh] max-h-[380px] min-h-[250px]" : "h-[46vh] min-h-[320px]"}`}`}>
        <div className="absolute top-0 right-0 left-0 z-10 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)]">
          <span className="rounded-full bg-white px-3 py-1.5 shadow-[0_1px_4px_rgba(16,24,40,.12)]">
            <Wordmark size={15} />
          </span>
          <ClockChip />
        </div>
        {layer !== "seats" && <MobileMap />}
      </div>

      <div className={`relative z-10 min-h-[60vh] bg-white lg:mt-0 lg:min-h-dvh lg:rounded-none lg:shadow-none ${layer === "seats" ? "" : "-mt-5 rounded-t-[var(--radius-sheet)] shadow-[0_-6px_24px_rgba(16,24,40,.07)]"}`}>
        {layer !== "seats" && <div className="mx-auto h-1 w-9 translate-y-2 rounded-full bg-line-2 lg:hidden" aria-hidden />}
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
  const { world, selected, setSelected, layer, active, brandFocus } = useStudent();
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
          focusBrand={brandFocus}
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
  const fast = world.kiosks.filter((k) => k.similar);
  // five or six within the same band: say so instead of singling one out
  const clear = fast.length <= 4;
  const rec = recommendedKiosk(world.kiosks);
  const sel = selected ? byId[selected] : null;

  return (
    <section className="px-5 pt-5" aria-label="키오스크 대기열">
      <div className="flex items-end justify-between">
        <div>
          <p className="t-sub text-ink-3">가장 빠른 줄</p>
          <p className="t-display num">{fastest}</p>
        </div>
        <p className="t-sub pb-1.5 text-right text-ink-3">
          {!clear ? (
            "어느 줄이든 비슷해요"
          ) : fast.length === 1 && rec ? (
            <>
              <span className="font-semibold text-blue-ink">{kioskById(rec.id)?.label}</span>
            </>
          ) : (
            <>
              파란 줄 <span className="num font-semibold text-blue-ink">{fast.length}</span>곳이 비슷해요
            </>
          )}
        </p>
      </div>

      {/* the six kiosks as they stand at the door: left bank | aisle | right bank */}
      <div className="mt-4 grid grid-cols-[1fr_20px_1fr] gap-x-1.5 gap-y-1.5" role="list" aria-label="키오스크 6대, 정문 기준 배치">
        {([3, 2, 1] as const).map((d) =>
          (["L", "R"] as const).map((s, i) => {
            const k = byId[`${s}${d}`];
            return (
              <div key={`${s}${d}`} role="listitem" style={{ gridColumn: i === 0 ? 1 : 3 }}>
                <KioskCell k={k} strong={k.similar && clear} on={selected === k.id} onClick={() => setSelected(selected === k.id ? null : k.id)} />
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
type Cell = "free" | "busy" | "unsure";

function SeatLayer() {
  const { world, engine } = useStudent();
  const pt = useMemo(() => (engine && world ? popularTimes(engine, world, "tables") : null), [engine, world]);
  if (!world) return null;
  const observed = world.zones.filter((z) => z.observed);
  const isSingle = (z: ZoneView) => ZONES.find((x) => x.id === z.id)!.seatsPerTable === 1;
  const quad = observed.filter((z) => !isSingle(z));
  const single = observed.filter(isSingle);
  const freeQuad = quad.reduce((s, z) => s + z.apparentlyEmpty, 0);
  const freeSingle = single.reduce((s, z) => s + z.apparentlyEmpty, 0);
  const lvl = TABLE_LEVEL[world.overall.tableLevel];
  const live = observed.some((z) => z.source !== "simulated");

  return (
    <section className="px-5 pt-5" aria-label="좌석">
      <div className="flex items-baseline justify-between">
        <p className="t-sub text-ink-3">{live ? "영상 AI 추정" : "추정치"} · 자리 위치는 표시하지 않아요</p>
        <p className={`t-sub font-semibold ${lvl.text}`}>전체 {lvl.label}</p>
      </div>

      {/* the two questions people actually have: alone, or with friends */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <SeatSummary unit="table" label="여럿이라면" caption="4인 테이블이 비어 보여요" n={freeQuad} suffix="개" />
        <SeatSummary unit="seat" label="혼자라면" caption="1인석이 비어 보여요" n={freeSingle} suffix="석" />
      </div>

      <SeatLegend />

      <ul className="mt-5 space-y-6">
        {[...quad, ...single].map((z) => (
          <ZoneGrid key={z.id} z={z} single={isSingle(z)} />
        ))}
      </ul>
      <p className="t-micro mt-4 text-ink-3">칸 순서는 실제 자리 순서가 아니에요. 비어 보이는 자리부터 모아 보여 줘요.</p>

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

function SeatSummary({ unit, label, caption, n, suffix }: { unit: "seat" | "table"; label: string; caption: string; n: number; suffix: string }) {
  return (
    <div className="rounded-[var(--radius-tile)] bg-floor px-3.5 py-3">
      <p className="t-sub flex items-center gap-1.5 font-medium text-ink-2">
        <UnitMark unit={unit} state="free" small />
        {label}
      </p>
      <p className="num mt-1.5">
        <span className={`text-[30px] leading-9 font-bold tracking-[-0.02em] ${n ? "text-free" : "text-ink-3"}`}>{n}</span>
        <span className="ml-0.5 text-[16px] font-semibold">{suffix}</span>
      </p>
      <p className="t-micro text-ink-3">{caption}</p>
    </div>
  );
}

/**
 * One mark per seating unit, shaped like what it is:
 * a single seat (cinema style: back + cushion) or a 4-seat table (table with four chairs).
 */
function UnitMark({ unit, state, small }: { unit: "seat" | "table"; state: Cell; small?: boolean }) {
  const fill = state === "free" ? "bg-free" : state === "busy" ? "bg-[#cfd4db]" : "hatch bg-floor ring-1 ring-inset ring-[#c2c8d0]";
  const chair = state === "free" ? "bg-free/45" : state === "busy" ? "bg-[#dfe3e8]" : "bg-[#d5dae1]";
  if (unit === "seat") {
    const sz = small ? "size-3.5" : "size-[22px]";
    return (
      <span className={`relative inline-block shrink-0 ${sz}`} aria-hidden>
        <span className={`absolute inset-x-[12%] top-0 h-[22%] rounded-full ${chair}`} />
        <span className={`absolute inset-x-0 top-[32%] bottom-0 rounded-[30%] ${fill}`} />
      </span>
    );
  }
  const sz = small ? "size-3.5" : "size-[30px]";
  return (
    <span className={`relative inline-block shrink-0 ${sz}`} aria-hidden>
      <span className={`absolute inset-x-[30%] top-0 h-[12%] rounded-full ${chair}`} />
      <span className={`absolute inset-x-[30%] bottom-0 h-[12%] rounded-full ${chair}`} />
      <span className={`absolute inset-y-[30%] left-0 w-[12%] rounded-full ${chair}`} />
      <span className={`absolute inset-y-[30%] right-0 w-[12%] rounded-full ${chair}`} />
      <span className={`absolute inset-[18%] rounded-[22%] ${fill}`} />
    </span>
  );
}

function ZoneGrid({ z, single }: { z: ZoneView; single: boolean }) {
  const cells: Cell[] = [
    ...Array<Cell>(z.apparentlyEmpty).fill("free"),
    ...Array<Cell>(z.uncertain).fill("unsure"),
    ...Array<Cell>(z.occupied).fill("busy"),
  ];
  return (
    <li>
      <div className="flex items-baseline justify-between">
        <span className="t-row">
          {z.name}
          <span className="t-sub ml-1.5 text-ink-3">{single ? "1인" : "4인 테이블"}</span>
        </span>
        <span className="t-sub num text-ink-3">
          <b className={`font-semibold ${z.apparentlyEmpty ? "text-free" : "text-ink-3"}`}>{z.apparentlyEmpty}</b> / {z.tables}
          {single ? "석" : "개"}
          {z.source !== "simulated" && <span className="ml-1 font-semibold text-blue-ink">· 영상 AI</span>}
        </span>
      </div>
      <div
        className={`mt-2.5 grid ${single ? "grid-cols-[repeat(auto-fill,22px)] gap-x-[7px] gap-y-2" : "grid-cols-[repeat(auto-fill,30px)] gap-1.5"}`}
        role="img"
        aria-label={`${z.name}: 비어 보임 ${z.apparentlyEmpty}, 사용 중 ${z.occupied}, 확인 어려움 ${z.uncertain}`}
      >
        {cells.map((c, i) => (
          <UnitMark key={i} unit={single ? "seat" : "table"} state={c} />
        ))}
      </div>
    </li>
  );
}

function SeatLegend() {
  return (
    <p className="t-micro mt-4 flex flex-wrap gap-x-4 gap-y-1 text-ink-2">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[3px] bg-free" />
        비어 보임
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[3px] bg-[#cfd4db]" />
        사용 중
      </span>
      <span className="flex items-center gap-1.5">
        <span className="hatch size-3 rounded-[3px] bg-floor ring-1 ring-inset ring-[#c2c8d0]" />
        짐만 있거나 가려져 확인 어려움
      </span>
    </p>
  );
}

// ------------------------------------------------------------------ pickup
function PickupLayer() {
  const { world, active, brandFocus, setBrandFocus } = useStudent();
  if (!world) return null;
  const mine = new Map(active.map((r) => [r.order!.brandId, r.order!]));
  const list = [...world.brands].sort((a, b) => Number(mine.has(b.id)) - Number(mine.has(a.id)));
  const show = (id: string) => {
    setBrandFocus(brandFocus === id ? null : id);
    // phones: the map sits behind the sheet — bring it back into view
    if (window.matchMedia("(max-width: 1023px)").matches) window.scrollTo({ top: 0, behavior: "smooth" });
  };
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
          const on = brandFocus === b.id;
          return (
            <li key={b.id} className={`flex items-stretch ${on ? "bg-ice" : o ? "bg-ice/50" : ""}`}>
              <button onClick={() => show(b.id)} aria-pressed={on} aria-label={`${b.name} 위치를 지도에 표시`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-2 pl-5 text-left active:bg-floor">
                <PinGlyph on={on} />
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
                      "위치 미확인"
                    )}
                    {mon && <> · 모니터 {mon.screen === "A" ? 1 : 2}</>}
                  </span>
                </span>
                <span className="text-right">
                  <span className="num block text-[15px] font-semibold">{prepText(b.p50, b.p80)}</span>
                  <span className="t-micro block text-ink-3">조리</span>
                </span>
              </button>
              <Link href={`/app/menu/${b.id}`} aria-label={`${b.name} 메뉴`} className="flex w-14 shrink-0 flex-col items-center justify-center border-l border-line text-ink-3 active:bg-floor">
                <span className="t-micro font-semibold">메뉴</span>
                <svg viewBox="0 0 12 12" className="mt-0.5 size-3" aria-hidden>
                  <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PinGlyph({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`size-5 shrink-0 ${on ? "text-blue" : "text-ink-4"}`} aria-hidden>
      <path d="M10 18s5.5-5.2 5.5-9.3A5.5 5.5 0 0 0 4.5 8.7C4.5 12.8 10 18 10 18Z" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="8.6" r="2" fill={on ? "#fff" : "currentColor"} />
    </svg>
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
