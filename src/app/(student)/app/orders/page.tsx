"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { removeMyOrder } from "@/client/my-orders";
import { IconBell, IconScan } from "@/components/icons";
import { PageHeader } from "@/components/student/Chrome";
import { OrderCard } from "@/components/student/OrderCard";
import { useStudent } from "@/components/student/StudentProvider";

type Perm = "unsupported" | "default" | "granted" | "denied";

export default function MyOrdersPage() {
  const { tracked, refs, backend } = useStudent();
  const [perm, setPerm] = useState<Perm>("default");
  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : (Notification.permission as Perm));
  }, []);

  const results = tracked ?? [];
  const active = results.filter((r) => r.state === "ok" && r.order && (r.order.status === "accepted" || r.order.status === "ready"));
  const ended = results.filter((r) => !active.includes(r) && r.order);
  // ready first, then by acceptance
  active.sort((a, b) => (a.order!.status === "ready" ? -1 : 0) - (b.order!.status === "ready" ? -1 : 0) || a.order!.acceptedAt - b.order!.acceptedAt);

  return (
    <div className="pb-6">
      <PageHeader
        title="내 주문"
        right={
          <Link href="/app/scan" className="flex h-9 items-center gap-1.5 rounded-full bg-floor px-3.5 text-[14px] font-semibold text-ink">
            <IconScan className="size-[18px]" />
            QR 스캔
          </Link>
        }
      />

      <NotifyRow perm={perm} onAsk={async () => setPerm((await Notification.requestPermission()) as Perm)} />

      {tracked === null && refs.length > 0 ? (
        <p className="t-body px-5 py-12 text-center text-ink-3">불러오는 중…</p>
      ) : active.length === 0 && ended.length === 0 ? (
        <div className="px-5 pt-16 text-center">
          <p className="t-head">추적 중인 주문이 없어요</p>
          <p className="t-body mt-1 text-ink-3">영수증의 QR을 찍으면 준비됐을 때 알려 드려요</p>
          <Link href="/app/scan" className="mt-6 inline-flex h-12 items-center rounded-[var(--radius-tile)] bg-blue px-6 text-[16px] font-semibold text-white">
            QR 스캔
          </Link>
        </div>
      ) : (
        <div className="space-y-3 px-4">
          {active.map((r) => (
            <OrderCard key={r.token} r={r} onClose={() => backend?.close(r.token)} onForget={() => removeMyOrder(r.token)} />
          ))}
          {ended.length > 0 && (
            <details className="pt-2">
              <summary className="t-body cursor-pointer px-1 py-2 font-medium text-ink-3">끝난 주문 {ended.length}건</summary>
              <div className="mt-3 space-y-3 pb-2">
                {ended.map((r) => (
                  <OrderCard key={r.token} r={r} onForget={() => removeMyOrder(r.token)} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function NotifyRow({ perm, onAsk }: { perm: Perm; onAsk: () => void }) {
  const text: Record<Perm, string> = {
    granted: "다른 탭에 있어도 알려 드려요",
    default: "다른 탭에서도 알림 받기",
    denied: "브라우저 알림 꺼짐 · 이 화면에서 알려 드려요",
    unsupported: "이 화면을 열어 두면 알려 드려요",
  };
  return (
    <div className="mx-5 mb-4 flex min-h-11 items-center gap-2.5 border-b border-line pb-3">
      <IconBell className="size-[18px] shrink-0 text-ink-3" />
      <p className="t-sub flex-1 text-ink-2">{text[perm]}</p>
      {perm === "default" && (
        <button onClick={onAsk} className="h-8 shrink-0 rounded-full bg-ink px-3 text-[13px] font-semibold text-white">
          켜기
        </button>
      )}
    </div>
  );
}
