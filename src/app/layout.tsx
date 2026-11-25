import type { Metadata, Viewport } from "next";
import "./globals.css";

// Absolute base for link previews: production domain on production, the stable branch URL on previews.
const host =
  process.env.VERCEL_ENV === "production"
    ? process.env.VERCEL_PROJECT_PRODUCTION_URL
    : (process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL);
const siteUrl = host ? `https://${host}` : "http://localhost:3000";
const DESCRIPTION =
  "단국대학교 죽전캠퍼스 혜당관 1947 COMMONS의 키오스크 대기, 좌석 혼잡, 브랜드별 준비시간과 내 주문 완료를 한 화면에서. 학생 팀의 공모전 시제품입니다.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "FLOWEAT — 1947 COMMONS 학식 내비게이션", template: "%s · FLOWEAT" },
  description: DESCRIPTION,
  applicationName: "FLOWEAT",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }] },
  appleWebApp: { capable: true, title: "FLOWEAT", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "FLOWEAT",
    title: "FLOWEAT — 1947 COMMONS 학식 내비게이션",
    description: "학식 줄과 자리를 미리 보고, 음식이 나오면 알려 줘요. 단국대 죽전 1947 COMMONS 대상 AI 기반 학생 팀 공모전 시제품.",
    url: "/",
  },
  twitter: { card: "summary_large_image", title: "FLOWEAT — 1947 COMMONS 학식 내비게이션", description: "학식 줄과 자리를 미리 보고, 음식이 나오면 알려 줘요." },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b1f4d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard (SIL OFL 1.1), self-hosted dynamic subset */}
        <link rel="stylesheet" href="/fonts/pretendardvariable-dynamic-subset.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
