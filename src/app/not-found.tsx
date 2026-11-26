import Link from "next/link";
import { Wordmark } from "@/components/brand/Logo";

export const metadata = { title: "페이지를 찾을 수 없어요" };

/** Unmatched routes (and notFound()) — a plain way back. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col bg-white px-5 py-6 text-ink">
      <Link href="/" aria-label="FLOWEAT 체험 홈" className="w-fit">
        <Wordmark size={18} />
      </Link>
      <div className="m-auto w-full max-w-[400px] py-10">
        <p className="t-sub num text-ink-3">404</p>
        <h1 className="t-title mt-1">이 주소에는 화면이 없어요</h1>
        <p className="t-body mt-2 text-ink-2">주소를 다시 확인하거나 아래에서 이동하세요.</p>
        <div className="mt-7 grid gap-2">
          <Link href="/" className="flex h-12 items-center justify-center rounded-[var(--radius-tile)] bg-blue text-[16px] font-semibold text-white">
            체험 홈으로
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/app" className="flex h-12 items-center justify-center rounded-[var(--radius-tile)] bg-floor text-[15px] font-semibold">
              학생 앱
            </Link>
            <Link href="/demo/split" className="flex h-12 items-center justify-center rounded-[var(--radius-tile)] bg-floor text-[15px] font-semibold">
              전체 체험
            </Link>
          </div>
        </div>
        <p className="t-sub mt-6 text-ink-3">영수증 QR 주소라면 주문한 브라우저에서 열어 주세요.</p>
      </div>
    </main>
  );
}
