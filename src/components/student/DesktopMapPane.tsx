"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CommonsMap } from "@/components/map/CommonsMap";
import { Wordmark } from "@/components/brand/Logo";
import { useStudent } from "./StudentProvider";

/** Desktop-only persistent map (left side), synced with the panel selection. */
export function DesktopMapPane() {
  const { world, selected, setSelected, layer } = useStudent();
  const router = useRouter();
  const path = usePathname();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 700 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="fixed inset-y-0 right-[460px] left-0 hidden bg-floor lg:block" aria-label="식당 개념 지도">
      <div className="absolute top-5 left-6 z-10 flex items-center gap-3">
        <Wordmark size={19} />
        <span className="rounded-full bg-white/90 px-3 py-1 text-[12.5px] font-semibold text-ink-2 shadow-sm">1947 COMMONS, 혜당관 1층</span>
      </div>
      <div ref={box} className="absolute inset-0">
        {world && size.w > 0 && (
          <CommonsMap
            kiosks={world.kiosks}
            selected={selected}
            layer={layer}
            width={size.w}
            height={size.h}
            onSelect={(id) => {
              setSelected(id);
              if (id && path !== "/app") router.push("/app");
            }}
          />
        )}
      </div>
      <p className="absolute bottom-4 left-6 rounded-full bg-white/90 px-3 py-1 text-[12px] text-ink-3 shadow-sm">개념 배치예요. 거리와 크기는 실측이 아니에요. 확대: 두 번 클릭 또는 Ctrl+스크롤</p>
    </div>
  );
}
