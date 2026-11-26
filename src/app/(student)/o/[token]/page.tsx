"use client";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { isWellFormedToken } from "@/core/orders/token";
import type { TrackResult } from "@/core/orders/service";
import { addMyOrder, removeMyOrder } from "@/client/my-orders";
import { PageHeader } from "@/components/student/Chrome";
import { OrderCard } from "@/components/student/OrderCard";
import { useStudent } from "@/components/student/StudentProvider";

/** QR landing: links this order to the device (no sign-up), then shows it. */
export default function OrderLandingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { backend, tracked, info } = useStudent();
  const [first, setFirst] = useState<TrackResult | null>(null);
  const [added, setAdded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!backend || !isWellFormedToken(token)) return;
    let alive = true;
    backend.track([token]).then(([r]) => {
      if (!alive) return;
      setFirst(r);
      if (r.state === "ok") setAdded(addMyOrder(token));
    });
    return () => {
      alive = false;
    };
  }, [backend, token]);

  const live = tracked?.find((r) => r.token === token) ?? first;

  if (!isWellFormedToken(token)) {
    return <Problem title="QR을 읽지 못했어요" body="번호표의 QR을 다시 찍어 주세요. 주소가 잘렸을 수 있어요." />;
  }
  if (!live) {
    return (
      <div className="px-5 pt-16 text-center text-ink-2" aria-busy="true">
        주문을 찾는 중…
      </div>
    );
  }
  if (live.state === "not_found") {
    return (
      <Problem
        title="이 주문을 찾을 수 없어요"
        body={
          info?.kind === "device"
            ? "한 기기 체험에서는 주문한 브라우저에서만 열려요. 키오스크를 연 브라우저에서 열어 주세요."
            : "시연이 초기화됐거나 다른 서버의 주문이에요."
        }
      />
    );
  }
  if (live.state === "invalid") return <Problem title="QR을 읽지 못했어요" body="영수증의 QR을 다시 찍어 주세요." />;

  return (
    <div className="pb-6">
      <PageHeader title="내 주문" back="/app/orders" />
      {added !== null && live.state === "ok" && (
        <p role="status" className="t-sub mx-5 mb-3 text-ink-3">
          {added ? "이 휴대폰에 주문을 연결했어요" : "이미 연결된 주문이에요."}
        </p>
      )}
      <div className="px-4">
        <OrderCard r={live} large onForget={() => removeMyOrder(token)} onClose={() => backend?.close(token)} />
      </div>
      <p className="t-sub mx-5 mt-4 text-ink-3">
        화면을 열어 두면 알려 드려요.{" "}
        <Link href="/app/orders" className="font-medium text-ink-2 underline underline-offset-2">
          알림 설정
        </Link>
      </p>
    </div>
  );
}

function Problem({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-5 pt-10">
      <h1 className="t-title">{title}</h1>
      <p className="t-body mt-1.5 text-ink-2">{body}</p>
      <div className="mt-6 flex gap-2">
        <Link href="/app/scan" className="flex h-12 flex-1 items-center justify-center rounded-[var(--radius-tile)] bg-blue text-[16px] font-semibold text-white">
          QR 다시 찍기
        </Link>
        <Link href="/app" className="flex h-12 flex-1 items-center justify-center rounded-[var(--radius-tile)] bg-floor text-[16px] font-semibold">
          홈으로
        </Link>
      </div>
    </div>
  );
}
