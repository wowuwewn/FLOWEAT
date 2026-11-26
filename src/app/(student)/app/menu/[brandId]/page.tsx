"use client";
import { notFound } from "next/navigation";
import { use } from "react";
import { PageHeader } from "@/components/student/Chrome";
import { useStudent } from "@/components/student/StudentProvider";
import { getBrand, menusOf, type Menu } from "@/core/catalog";
import { pickupShort } from "@/core/layout";
import { prepForMenu } from "@/core/world";
import { prepText } from "@/lib/format";

export default function BrandPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = use(params);
  const brand = getBrand(brandId);
  const { world, engine } = useStudent();
  if (!brand) notFound();
  const view = world?.brands.find((b) => b.id === brandId);
  const items = menusOf(brandId);
  const mains = items.filter((m) => !m.isSide);
  const sides = items.filter((m) => m.isSide);
  const loc = pickupShort(brandId);

  return (
    <div className="pb-8">
      <PageHeader title={brand.name} back="/app/menu" />
      <section className="px-5 pt-1 pb-5">
        <p className="t-sub text-ink-3">주문 후 조리</p>
        <p className="t-display num">{view ? prepText(view.p50, view.p80) : "–"}</p>
        <dl className="mt-4 divide-y divide-line border-y border-line">
          <Row k="수령 위치" v={loc ? `${loc.text}${loc.sure ? "" : " (추정)"}` : "미확인"} muted={!loc} />
          <Row k="호출 모니터" v={brand.monitor ? `${brand.monitor.screen === "A" ? 1 : 2}번 화면` : "–"} />
          {view && <Row k="밀린 주문" v={`${view.backlog}건`} />}
        </dl>
      </section>

      <section aria-label="메뉴">
        <h2 className="t-head px-5 pb-1">메뉴</h2>
        <ul>
          {mains.map((m) => {
            const e = engine && world ? prepForMenu(engine, world.clock, m.id, view?.liveOrders ?? 0) : null;
            return <MenuRow key={m.id} m={m} right={e && Number.isFinite(e.p50) ? prepText(e.p50, e.p80) : null} />;
          })}
        </ul>
        {sides.length > 0 && (
          <>
            <h2 className="t-head mt-6 px-5 pb-1">사이드</h2>
            <ul>
              {sides.map((m) => (
                <MenuRow key={m.id} m={m} right={null} />
              ))}
            </ul>
          </>
        )}
      </section>
      <p className="t-micro mx-5 mt-5 text-ink-3">가격은 2026년 11월 현장 키오스크 기준이고, 회색 가격은 확인 전이에요. 판매 여부는 실시간이 아니에요.</p>
    </div>
  );
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="t-body text-ink-3">{k}</dt>
      <dd className={`t-body num text-right ${muted ? "text-ink-3" : "font-medium"}`}>{v}</dd>
    </div>
  );
}

function MenuRow({ m, right }: { m: Menu; right: string | null }) {
  const unconfirmed = m.priceBasis === "reference";
  return (
    <li id={m.id} className="flex items-center gap-3 px-5 py-3 target:bg-ice">
      <span className="min-w-0 flex-1">
        <span className="t-row flex items-center gap-1.5">
          <span className="truncate">{m.name}</span>
          {m.field?.badge && <span className={`shrink-0 text-[11px] font-bold ${m.field.badge === "BEST" ? "text-very" : "text-normal"}`}>{m.field.badge}</span>}
        </span>
        <span className={`t-sub num block ${unconfirmed ? "text-ink-3" : "text-ink-2"}`}>{m.listedPriceKrw == null ? "가격 미정" : `${m.listedPriceKrw.toLocaleString("ko-KR")}원`}</span>
      </span>
      {right && <span className="num shrink-0 text-[15px] font-semibold text-ink-2">{right}</span>}
    </li>
  );
}
