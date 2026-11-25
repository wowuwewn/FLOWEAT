import Link from "next/link";
import { Wordmark } from "@/components/brand/Logo";

export const metadata = { title: "페이지를 찾을 수 없어요" };

/** Unmatched routes (and notFound()) — keep people inside the demo with clear next steps. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col bg-[#f3f4f7] px-5 py-6 text-ink">
      <Link href="/" aria-label="FLOWEAT 체험 홈" className="w-fit">
        <Wordmark size={19} />
      </Link>
      <div className="m-auto w-full max-w-[440px] py-10 text-center">
        <svg viewBox="0 0 160 96" className="mx-auto h-24 w-40" aria-hidden>
          <rect x="6" y="70" width="148" height="10" rx="5" fill="#dfe3ea" />
          <path d="M62 70V40a18 18 0 0 1 36 0v30" fill="none" stroke="#2448db" strokeWidth="9" strokeLinecap="round" />
          <path d="M24 34h18M24 50h18M118 34h18M118 50h18" stroke="#c9cfda" strokeWidth="7" strokeLinecap="round" />
        </svg>
        <p className="num mt-4 text-[13px] font-bold tracking-[0.12em] text-blue-ink">404</p>
        <h1 className="mt-1 text-[26px] leading-tight font-[800] tracking-[-0.03em]">이 주소에는 화면이 없어요</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">주소가 바뀌었거나 잘못 입력됐을 수 있어요. 아래에서 원하는 화면으로 바로 가세요.</p>
        <div className="mt-6 grid gap-2">
          <Link href="/" className="flex h-13 items-center justify-center rounded-2xl bg-blue text-[16px] font-bold text-white">
            체험 홈으로
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/app" className="flex h-12 items-center justify-center rounded-2xl bg-white text-[15px] font-semibold shadow-[0_1px_0_var(--color-line)]">
              학생 앱
            </Link>
            <Link href="/demo/split" className="flex h-12 items-center justify-center rounded-2xl bg-white text-[15px] font-semibold shadow-[0_1px_0_var(--color-line)]">
              전체 체험
            </Link>
          </div>
        </div>
        <p className="mt-6 text-[12.5px] text-ink-3">주문 번호표의 QR 주소라면, 주문한 브라우저에서 열어야 연결돼요.</p>
      </div>
    </main>
  );
}
