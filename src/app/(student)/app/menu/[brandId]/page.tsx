"use client";
import { notFound } from "next/navigation";
import { use } from "react";
import { PageHeader } from "@/components/student/Chrome";
import { useStudent } from "@/components/student/StudentProvider";
import { COOK_TYPE_LABEL, getBrand, menusOf } from "@/core/catalog";
import { prepForMenu } from "@/core/world";
import { minuteRange, won, prepText } from "@/lib/format";

export default function BrandPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = use(params);
  const brand = getBrand(brandId);
  const { world, engine } = useStudent();
  if (!brand) notFound();
  const view = world?.brands.find((b) => b.id === brandId);
  const items = menusOf(brandId);
  const mains = items.filter((m) => !m.isSide);
  const sides = items.filter((m) => m.isSide);

  return (
    <div className="pb-6">
      <PageHeader title={brand.name} back="/app/menu" />
      <section className="mx-3 rounded-[var(--radius-sheet)] bg-surface px-5 pt-4 pb-4">
        <p className="text-[14px] text-ink-2">{brand.cuisine}</p>
        <p className="mt-2 text-[14px] text-ink-2">주문 후 준비까지 보통</p>
        <p className="num text-[38px] leading-tight font-[780] tracking-[-0.03em]">{view ? prepText(view.p50, view.p80) : "–"}</p>
        {view && (
          <p className="num text-[13.5px] text-ink-3">
            지금 이 매장에 밀린 주문 {view.backlog}건을 반영했어요{view.liveOrders ? ` (시연 주문 ${view.liveOrders}건 포함)` : ""}.
          </p>
        )}
        <p className="mt-3 border-t border-line pt-3 text-[13.5px] text-ink-2">{brand.verificationNote}</p>
      </section>

      <section className="mx-3 mt-3 rounded-[var(--radius-card)] bg-surface py-1" aria-label="메뉴">
        <ul>
          {mains.map((m) => {
            const e = engine && world ? prepForMenu(engine, world.clock, m.id, view?.liveOrders ?? 0) : null;
            return (
              <li key={m.id} id={m.id} className="flex items-center gap-3 px-5 py-3 target:bg-ice">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] font-semibold">{m.name}</span>
                  <span className="block text-[13px] text-ink-3">
                    {won(m.listedPriceKrw)}, {COOK_TYPE_LABEL[m.cookType]}
                  </span>
                </span>
                <span className="num text-[16px] font-bold">{e && Number.isFinite(e.p50) ? prepText(e.p50, e.p80) : "정보 부족"}</span>
              </li>
            );
          })}
        </ul>
        {sides.length > 0 && (
          <>
            <h2 className="px-5 pt-3 pb-1 text-[13px] font-bold text-ink-3">사이드</h2>
            <ul>
              {sides.map((m) => (
                <li key={m.id} id={m.id} className="flex items-center justify-between px-5 py-2.5 text-[15px]">
                  <span>{m.name}</span>
                  <span className="num text-ink-2">{won(m.listedPriceKrw)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <div className="mx-5 mt-4 space-y-1.5 text-[12.5px] leading-relaxed text-ink-3">
        <p>가격은 공개 목록의 참고 가격이에요. 게시일과 지금 판매 여부는 확인 전이에요.</p>
        <p>준비시간은 키오스크 주문이 접수된 뒤 매장이 완료를 누를 때까지의 예측이에요. 조리 유형은 메뉴 이름으로 분류한 값이라 실제와 다를 수 있어요.</p>
        <p>수령 카운터 위치는 확인 전이라 표시하지 않아요.</p>
      </div>
    </div>
  );
}
