"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { IconSearch } from "@/components/icons";
import { PageHeader } from "@/components/student/Chrome";
import { useStudent } from "@/components/student/StudentProvider";
import { catalog, getBrand, menusOf, searchMenus } from "@/core/catalog";
import { prepForMenu } from "@/core/world";
import { won, prepText } from "@/lib/format";

type Sort = "fast" | "default";

/** Starting price and two representative mains, straight from the reference list. */
function summary(brandId: string) {
  const mains = menusOf(brandId).filter((m) => !m.isSide);
  const prices = mains.map((m) => m.listedPriceKrw).filter((p): p is number => p != null);
  return { from: prices.length ? Math.min(...prices) : null, picks: mains.slice(0, 2).map((m) => m.name.replace(/\(.*?\)/g, "")), count: mains.length };
}

export default function MenuPage() {
  const { world, engine } = useStudent();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("fast");
  const results = useMemo(() => searchMenus(q).slice(0, 40), [q]);
  const list = useMemo(() => {
    const base = world?.brands ?? catalog.brands.map((b) => ({ ...b, p20: NaN, p50: NaN, p80: NaN, backlog: 0, liveOrders: 0 }));
    const rows = base.map((b) => ({ ...b, ...summary(b.id) }));
    return sort === "fast" && world ? [...rows].sort((a, b) => a.p50 - b.p50) : rows;
  }, [world, sort]);
  const maxP80 = Math.max(1, ...list.map((b) => (Number.isFinite(b.p80) ? b.p80 : 0)));
  const fastest = list.length && Number.isFinite(list[0].p50) ? Math.min(...list.map((b) => b.p50)) : NaN;

  return (
    <div className="pb-6">
      <PageHeader title="메뉴" />
      <p className="-mt-1 px-5 pb-2 text-[13.5px] text-ink-2">매장별로 주문 후 음식이 나오기까지의 예상 시간이에요. 주문은 현장 키오스크에서 해요.</p>
      <div className="sticky top-0 z-10 bg-floor/95 px-3 pt-1 pb-2 backdrop-blur">
        <label className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 focus-within:border-blue">
          <IconSearch className="size-5 text-ink-3" />
          <span className="sr-only">메뉴 검색</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="메뉴나 매장, 예: 찌개, 쌀국수"
            className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
          />
        </label>
        {!q && (
          <div className="mt-2 flex items-center justify-between px-1">
            <p className="text-[13px] font-semibold text-ink-2">
              매장 <span className="num">{list.length}</span>곳
            </p>
            <div className="flex gap-1 rounded-full bg-[#e3e7ee] p-0.5" role="radiogroup" aria-label="정렬">
              {(
                [
                  ["fast", "빨리 나오는 순"],
                  ["default", "기본 순"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} role="radio" aria-checked={sort === id} onClick={() => setSort(id)} className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${sort === id ? "bg-surface text-ink shadow-sm" : "text-ink-2"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {q ? (
        <section className="mx-3 rounded-[var(--radius-card)] bg-surface py-1" aria-live="polite">
          {results.length === 0 ? (
            <p className="px-5 py-8 text-center text-ink-2">‘{q}’에 맞는 메뉴가 없어요.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {results.map((m) => {
                const e = engine && world ? prepForMenu(engine, world.clock, m.id) : null;
                const b = getBrand(m.brandId)!;
                return (
                  <li key={m.id}>
                    <Link href={`/app/menu/${m.brandId}#${m.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-floor">
                      <BrandMark brandId={b.id} name={b.name} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15.5px] font-semibold">{m.name}</span>
                        <span className="block text-[13px] text-ink-3">
                          {b.name} · {won(m.listedPriceKrw)}
                        </span>
                      </span>
                      {e && !m.isSide && <span className="num shrink-0 text-[15px] font-bold">{prepText(e.p50, e.p80)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <ul className="mx-3 space-y-2" aria-label="매장">
          {list.map((b) => {
            const ok = Number.isFinite(b.p50);
            const quick = ok && b.p50 - fastest <= Math.max(60, fastest * 0.25);
            return (
              <li key={b.id}>
                <Link href={`/app/menu/${b.id}`} className="flex items-center gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-3.5 active:bg-[#f6f7f9]">
                  <BrandMark brandId={b.id} name={b.name} size={46} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[16.5px] font-bold">{b.name}</span>
                      {quick && <span className="shrink-0 rounded-full bg-free-bg px-1.5 py-0.5 text-[11px] font-bold text-[#0b6646]">빨리 나와요</span>}
                    </span>
                    <span className="block truncate text-[13px] text-ink-3">
                      {b.cuisine}
                      {b.from != null && <> · <span className="num">{won(b.from)}</span>부터</>}
                    </span>
                    <span className="mt-1.5 block truncate text-[12.5px] text-ink-2">{b.picks.join(", ")}{b.count > 2 ? ` 외 ${b.count - 2}개` : ""}</span>
                  </span>
                  <span className="w-[92px] shrink-0 text-right">
                    <span className="num block text-[17px] leading-tight font-[780] tracking-[-0.02em]">{ok ? prepText(b.p50, b.p80) : "–"}</span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-floor" aria-hidden>
                      {ok && <span className="block h-full rounded-full bg-blue/70" style={{ width: `${Math.max(8, (b.p80 / maxP80) * 100)}%` }} />}
                    </span>
                    <span className="mt-1 block text-[11.5px] text-ink-3">{b.backlog ? `밀린 주문 ${b.backlog}건` : "주문 후 준비"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mx-5 mt-4 space-y-1 text-[12.5px] leading-relaxed text-ink-3">
        <p>준비시간은 시뮬레이션 기록으로 학습한 예측이고, 이 체험에서 넣은 주문도 반영해요.</p>
        <p>메뉴와 가격은 공개 목록의 참고값이라 지금 판매 여부와 다를 수 있어요. 오늘 메뉴는 단국대 앱의 금주의 식단(죽전)에서 확인할 수 있어요.</p>
      </div>
    </div>
  );
}
