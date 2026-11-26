"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { IconSearch } from "@/components/icons";
import { PageHeader } from "@/components/student/Chrome";
import { useStudent } from "@/components/student/StudentProvider";
import { catalog, getBrand, menusOf, searchMenus } from "@/core/catalog";
import { prepForMenu } from "@/core/world";
import { prepText } from "@/lib/format";

type Sort = "fast" | "default";

function summary(brandId: string) {
  const mains = menusOf(brandId).filter((m) => !m.isSide);
  const prices = mains.map((m) => m.listedPriceKrw).filter((p): p is number => p != null);
  return { from: prices.length ? Math.min(...prices) : null, picks: [...new Set(mains.map((m) => m.name.replace(/\(.*?\)/g, "").trim()))].slice(0, 3) };
}

const krw = (n: number | null) => (n == null ? "가격 미정" : `${n.toLocaleString("ko-KR")}원`);

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

  return (
    <div className="pb-8">
      <PageHeader title="메뉴" />
      <div className="sticky top-0 z-10 bg-white px-5 pt-1 pb-3">
        <label className="flex h-11 items-center gap-2 rounded-[var(--radius-tile)] bg-floor px-3.5">
          <IconSearch className="size-[18px] text-ink-3" />
          <span className="sr-only">메뉴 검색</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="찌개, 쌀국수, 돈카츠" className="t-body min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-4" />
        </label>
        {!q && (
          <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label="정렬">
            {(
              [
                ["fast", "빨리 나오는 순"],
                ["default", "키오스크 순"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="radio"
                aria-checked={sort === id}
                onClick={() => setSort(id)}
                className={`h-8 rounded-full px-3 text-[13px] font-semibold ${sort === id ? "bg-ink text-white" : "bg-floor text-ink-2"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {q ? (
        <section aria-live="polite">
          {results.length === 0 ? (
            <p className="t-body px-5 py-12 text-center text-ink-3">‘{q}’ 메뉴가 없어요</p>
          ) : (
            <ul>
              {results.map((m) => {
                const e = engine && world ? prepForMenu(engine, world.clock, m.id) : null;
                const b = getBrand(m.brandId)!;
                return (
                  <li key={m.id}>
                    <Link href={`/app/menu/${m.brandId}#${m.id}`} className="flex items-center gap-3 px-5 py-3 active:bg-floor">
                      <span className="min-w-0 flex-1">
                        <span className="t-row block truncate">{m.name}</span>
                        <span className="t-sub num block text-ink-3">
                          {b.name} · {krw(m.listedPriceKrw)}
                        </span>
                      </span>
                      {e && !m.isSide && <span className="num shrink-0 text-[15px] font-semibold">{prepText(e.p50, e.p80)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <ul aria-label="매장">
          {list.map((b) => {
            const ok = Number.isFinite(b.p50);
            return (
              <li key={b.id}>
                <Link href={`/app/menu/${b.id}`} className="flex items-center gap-4 px-5 py-3.5 active:bg-floor">
                  <span className="min-w-0 flex-1">
                    <span className="t-row block">{b.name}</span>
                    <span className="t-sub block truncate text-ink-3">{b.picks.join(" · ")}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="num block text-[16px] font-semibold tracking-[-0.01em]">{ok ? prepText(b.p50, b.p80) : "–"}</span>
                    <span className="t-micro num block text-ink-3">{b.from != null ? `${b.from.toLocaleString("ko-KR")}원~` : ""}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <p className="t-micro mx-5 mt-5 text-ink-3">시간은 주문 후 조리 예상(시뮬레이션) · 가격은 11월 현장 키오스크 기준</p>
    </div>
  );
}
