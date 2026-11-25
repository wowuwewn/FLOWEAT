"use client";
import { notFound } from "next/navigation";
import { use } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { PageHeader } from "@/components/student/Chrome";
import { useStudent } from "@/components/student/StudentProvider";
import { COOK_TYPE_LABEL, getBrand, menusOf, priceProvenance } from "@/core/catalog";
import { prepForMenu } from "@/core/world";
import { won, prepText } from "@/lib/format";

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
      <section className="mx-3 rounded-[var(--radius-sheet)] bg-surface px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <BrandMark brandId={brand.id} name={brand.name} size={52} />
          <div className="min-w-0">
            <p className="text-[14px] text-ink-2">{brand.cuisine}</p>
            <p className="text-[13px] text-ink-3">메인 {mains.length}개{sides.length ? ` · 사이드 ${sides.length}개` : ""}</p>
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-floor px-4 py-3">
          <p className="text-[13.5px] font-semibold text-ink-2">주문 후 준비까지 보통</p>
          <p className="num text-[36px] leading-tight font-[800] tracking-[-0.03em]">{view ? prepText(view.p50, view.p80) : "–"}</p>
          {view && (
            <p className="num text-[13px] text-ink-3">
              지금 밀린 주문 {view.backlog}건 반영{view.liveOrders ? ` · 이 체험의 실제 주문 ${view.liveOrders}건 포함` : " · 시뮬레이션 기준"}
            </p>
          )}
        </div>
        <p className="mt-3 text-[13px] text-ink-3">{brand.verificationNote}</p>
      </section>

      <section className="mx-3 mt-3 rounded-[var(--radius-card)] bg-surface py-1" aria-label="메뉴">
        <h2 className="px-5 pt-3 pb-1 text-[13px] font-bold text-ink-3">메뉴</h2>
        <ul className="divide-y divide-line/70">
          {mains.map((m) => {
            const e = engine && world ? prepForMenu(engine, world.clock, m.id, view?.liveOrders ?? 0) : null;
            const ok = e && Number.isFinite(e.p50);
            return (
              <li key={m.id} id={m.id} className="flex items-center gap-3 px-5 py-3 target:bg-ice">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] font-semibold">{m.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-3">
                    <span className="num font-semibold text-ink-2">{won(m.listedPriceKrw)}</span>
                    <span className={m.priceBasis === "reference" ? "text-[11.5px] text-ink-3" : "text-[11.5px] font-semibold text-free"}>{priceProvenance(m)}</span>
                    <span className="rounded-full bg-floor px-2 py-0.5 text-[11.5px] font-semibold">{COOK_TYPE_LABEL[m.cookType]}</span>
                    {m.field?.badge && <span className="rounded bg-[#fff1c2] px-1.5 py-0.5 text-[10.5px] font-[800] text-[#6b4a00]">{m.field.badge}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num block text-[16px] font-bold">{ok ? prepText(e.p50, e.p80) : "정보 부족"}</span>
                  {ok && <span className="block text-[11.5px] text-ink-3">준비 예상</span>}
                </span>
              </li>
            );
          })}
        </ul>
        {sides.length > 0 && (
          <>
            <h2 className="border-t border-line px-5 pt-3 pb-1 text-[13px] font-bold text-ink-3">사이드</h2>
            <ul>
              {sides.map((m) => (
                <li key={m.id} id={m.id} className="flex items-center justify-between px-5 py-2.5 text-[15px]">
                  <span>{m.name}</span>
                  <span className="num text-right text-ink-2">
                    {won(m.listedPriceKrw)}
                    <span className={`block text-[11px] ${m.priceBasis === "reference" ? "text-ink-3" : "font-semibold text-free"}`}>{priceProvenance(m)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <div className="mx-5 mt-4 space-y-1.5 text-[12.5px] leading-relaxed text-ink-3">
        <p>‘현장 확인’ 가격은 2026-11-25 실제 키오스크 화면에서 읽은 값이고, ‘참고 가격’은 게시일을 모르는 제3자 목록 값이에요. 어느 쪽이든 오늘 판매 여부는 알 수 없어요. NEW·BEST 표시도 그날 화면 기준이에요.</p>
        <p>준비시간은 키오스크 주문이 접수된 뒤 매장이 번호를 호출할 때까지의 예측이에요. 조리 유형은 메뉴 이름으로 분류한 값이라 실제와 다를 수 있어요.</p>
        <p>수령은 이 매장 카운터에서 해요. 카운터 위치는 혜당관 1층 안내도와 현장 사진을 바탕으로 학생 앱 지도 ‘수령’ 탭에 대략 표시했어요(실측 아님).</p>
      </div>
    </div>
  );
}
