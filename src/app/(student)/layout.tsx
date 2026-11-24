import { OrderIsland, TabBar } from "@/components/student/Chrome";
import { StudentProvider } from "@/components/student/StudentProvider";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudentProvider>
      <a href="#main" className="sr-only-focusable fixed top-2 left-2 z-50 rounded-lg bg-navy px-3 py-2 text-white">
        본문으로 건너뛰기
      </a>
      <div className="relative mx-auto min-h-dvh max-w-[480px] bg-floor pb-28 sm:shadow-[0_0_0_1px_var(--color-line)]">
        <OrderIsland />
        <main id="main">{children}</main>
      </div>
      <TabBar />
    </StudentProvider>
  );
}
