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
            ? "지금은 한 기기 체험 모드라서, 주문한 브라우저에서만 QR이 연결돼요. 키오스크를 연 같은 브라우저에서 열어 주세요. 기기 간 연동은 공용 저장소를 연결한 뒤에 가능해요."
            : "시연 세션이 초기화됐거나 다른 서버의 주문이에요. 키오스크에서 새로 주문해 주세요."
        }
      />
    );
  }
  if (live.state === "invalid") return <Problem title="QR을 읽지 못했어요" body="번호표의 QR을 다시 찍어 주세요." />;

  return (
    <div className="pb-6">
      <PageHeader title="내 주문" back="/app/orders" />
      {added !== null && live.state === "ok" && (
        <p role="status" className="mx-5 mb-3 text-[14px] text-ink-2">
          {added ? "이 휴대폰에 주문을 연결했어요. 준비되면 알려 드릴게요." : "이미 연결된 주문이에요."}
        </p>
      )}
      <div className="px-3">
        <OrderCard r={live} large onForget={() => removeMyOrder(token)} onClose={() => backend?.close(token)} />
      </div>
      <p className="mx-5 mt-4 text-[13px] leading-relaxed text-ink-3">
        이 화면을 켜 두면 준비됐을 때 배너로 알려 드려요. 소리·진동은 기기에 따라 안 될 수 있고(iPhone은 진동 없음), 화면을 닫거나 잠그면 알림이 오지 않아요.{" "}
        <Link href="/app/orders" className="font-semibold text-ink-2 underline underline-offset-2">
          알림 설정
        </Link>
      </p>
    </div>
  );
}

function Problem({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-5 pt-10">
      <h1 className="text-[22px] font-bold">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
      <div className="mt-6 flex gap-2">
        <Link href="/app/scan" className="flex-1 rounded-2xl bg-navy py-3.5 text-center font-semibold text-white">
          QR 다시 찍기
        </Link>
        <Link href="/app" className="flex-1 rounded-2xl bg-surface py-3.5 text-center font-semibold">
          홈으로
        </Link>
      </div>
    </div>
  );
}
