import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FLOWEAT — 1947 COMMONS 학식 내비게이션", template: "%s · FLOWEAT" },
  description:
    "단국대학교 죽전캠퍼스 혜당관 1947 COMMONS의 키오스크 대기, 좌석 혼잡, 브랜드별 준비시간과 내 주문 완료를 한 화면에서. 학생 팀의 공모전 시제품입니다.",
  applicationName: "FLOWEAT",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0e2b63",
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
