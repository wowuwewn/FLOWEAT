"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { IconSearch } from "@/components/icons";
import { PageHeader } from "@/components/student/Chrome";
import { useStudent } from "@/components/student/StudentProvider";
import { catalog, getBrand, searchMenus } from "@/core/catalog";
import { prepForMenu } from "@/core/world";
import { minuteRange, won, prepText } from "@/lib/format";

export default function MenuPage() {
  const { world, engine } = useStudent();
  const [q, setQ] = useState("");
  const results = useMemo(() => searchMenus(q).slice(0, 40), [q]);
  return (
    <div className="pb-6">
      <PageHeader title="메뉴" />
      <div className="sticky top-0 z-10 bg-floor px-3 pt-1 pb-2">
        <label className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 focus-within:border-blue">
          <IconSearch className="size-5 text-ink-3" />
          <span className="sr-only">메뉴 검색</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="메뉴나 브랜드, 예: 찌개, 쌀국수"
            className="h-12 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
          />
        </label>
      </div>

      {q ? (
        <section className="mx-3 rounded-[var(--radius-card)] bg-surface py-1" aria-live="polite">
          {results.length === 0 ? (
            <p className="px-5 py-8 text-center text-ink-2">‘{q}’에 맞는 메뉴가 없어요.</p>
          ) : (
            <ul>
              {results.map((m) => {
                const e = engine && world ? prepForMenu(engine, world.clock, m.id) : null;
                return (
                  <li key={m.id}>
                    <Link href={`/app/menu/${m.brandId}#${m.id}`} className="flex items-center gap-3 px-5 py-3 active:bg-floor">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15.5px] font-semibold">{m.name}</span>
                        <span className="block text-[13px] text-ink-3">
                          {getBrand(m.brandId)?.name}, {won(m.listedPriceKrw)}
                        </span>
                      </span>
                      {e && !m.isSide && <span className="num text-[15px] font-bold">{prepText(e.p50, e.p80)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <section className="mx-3 rounded-[var(--radius-card)] bg-surface py-1">
          <ul>
            {(world?.brands ?? catalog.brands.map((b) => ({ ...b, p20: NaN, p50: NaN, p80: NaN, backlog: 0 }))).map((b) => (
              <li key={b.id}>
                <Link href={`/app/menu/${b.id}`} className="flex items-center gap-3 px-5 py-3.5 active:bg-floor">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold">{b.name}</span>
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
      )}
      <p className="mx-5 mt-4 text-[12.5px] leading-relaxed text-ink-3">
        메뉴와 가격은 공개 목록의 참고값이라 지금 판매 여부와 다를 수 있어요. 오늘 메뉴는 단국대 앱의 금주의 식단(죽전)에서 확인할 수 있어요. 주문은 현장 키오스크에서 해요.
      </p>
    </div>
  );
}
