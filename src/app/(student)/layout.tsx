import { DesktopMapPane } from "@/components/student/DesktopMapPane";
import { OrderIsland, TabBar } from "@/components/student/Chrome";
import { StudentProvider } from "@/components/student/StudentProvider";

/**
 * Mobile: one 480px column. Desktop (lg): the map stays on the left like a maps app,
 * every student screen lives in the right-hand panel.
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudentProvider>
      <a href="#main" className="sr-only-focusable fixed top-2 left-2 z-50 rounded-lg bg-navy px-3 py-2 text-white">
        본문으로 건너뛰기
      </a>
      <DesktopMapPane />
      <div className="relative mx-auto min-h-dvh max-w-[480px] bg-floor pb-28 lg:mr-0 lg:ml-auto lg:w-[460px] lg:max-w-none lg:border-l lg:border-line">
        <OrderIsland />
        <main id="main">{children}</main>
      </div>
      <TabBar />
    </StudentProvider>
  );
}
