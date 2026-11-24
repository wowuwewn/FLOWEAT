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
          <Link href="/scan" className="flex items-center gap-1.5 rounded-full bg-navy px-4 py-2 text-[14px] font-semibold text-white">
            <IconScan className="size-5" />
            QR 스캔
          </Link>
        }
      />

      <NotifyRow perm={perm} onAsk={async () => setPerm((await Notification.requestPermission()) as Perm)} />

      {tracked === null && refs.length > 0 ? (
        <p className="px-5 py-10 text-center text-ink-3">주문 상태를 불러오는 중…</p>
      ) : active.length === 0 && ended.length === 0 ? (
        <div className="mx-3 mt-2 rounded-[var(--radius-card)] bg-surface px-6 py-10 text-center">
          <p className="text-[19px] font-bold">따라가는 주문이 없어요</p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
            키오스크에서 주문한 뒤 번호표의 QR을 찍으면, 음식이 준비됐을 때 여기에서 알려 드려요. 친구 번호표도 같이 찍어 두면 한 화면에서 볼 수 있어요.
          </p>
          <Link href="/scan" className="mt-5 inline-block rounded-2xl bg-navy px-6 py-3.5 font-semibold text-white">
            QR 스캔하기
          </Link>
        </div>
      ) : (
        <div className="space-y-3 px-3">
          {active.map((r) => (
            <OrderCard key={r.token} r={r} onClose={() => backend?.close(r.token)} onForget={() => removeMyOrder(r.token)} />
          ))}
          {ended.length > 0 && (
            <details className="rounded-[var(--radius-card)] bg-surface px-5 py-3">
              <summary className="cursor-pointer py-1 text-[15px] font-semibold text-ink-2">끝난 주문 {ended.length}건</summary>
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
    granted: "다른 탭을 보고 있어도 브라우저 알림을 보내요. 화면을 완전히 닫으면 알림이 오지 않아요.",
    default: "준비되면 소리·진동과 화면 알림으로 알려 드려요. 브라우저 알림도 받으려면 허용해 주세요.",
    denied: "브라우저 알림이 꺼져 있어요. 이 화면을 켜 두면 소리와 진동으로 알려 드려요.",
    unsupported: "이 브라우저는 알림을 지원하지 않아요. 이 화면을 켜 두면 소리와 진동으로 알려 드려요.",
  };
  return (
    <div className="mx-3 mb-3 flex items-start gap-3 rounded-[var(--radius-card)] bg-ice px-4 py-3">
      <IconBell className="mt-0.5 size-5 shrink-0 text-blue-ink" />
      <p className="flex-1 text-[13.5px] leading-relaxed text-ink-2">{text[perm]}</p>
      {perm === "default" && (
        <button onClick={onAsk} className="shrink-0 rounded-full bg-blue px-3.5 py-1.5 text-[13px] font-semibold text-white">
          허용
        </button>
      )}
    </div>
  );
}
