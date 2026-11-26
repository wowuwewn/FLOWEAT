"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CommonsMap } from "@/components/map/CommonsMap";
import { VRButton } from "@/components/map/VRButton";
import { Wordmark } from "@/components/brand/Logo";
import { useStudent } from "./StudentProvider";

/** Desktop-only persistent map (left side), synced with the panel selection. */
export function DesktopMapPane() {
  const { world, selected, setSelected, layer, active, brandFocus } = useStudent();
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
    <div className="fixed inset-y-0 right-[460px] left-0 hidden bg-canvas lg:block" aria-label="식당 지도">
      <div className="absolute top-5 left-6 z-10 flex items-center gap-3">
        <Wordmark size={19} />
        <span className="t-sub font-medium text-ink-2">1947 COMMONS · 혜당관 1층</span>
      </div>
      <div ref={box} className="absolute inset-0">
        {world && size.w > 0 && (
          <CommonsMap
            kiosks={world.kiosks}
            selected={selected}
            layer={layer}
            width={size.w}
            height={size.h}
            padBottom={56}
            noticeTop={80}
            highlightBrands={active.map((r) => r.order!.brandId)}
            focusBrand={brandFocus}
            zones={world.zones}
            extra={<VRButton kiosks={world.kiosks} zones={world.zones} highlightBrands={active.map((r) => r.order!.brandId)} highlightLabels={Object.fromEntries(active.map((r) => [r.order!.brandId, String(r.order!.displayNumber)]))} />}
            highlightLabels={Object.fromEntries(active.map((r) => [r.order!.brandId, String(r.order!.displayNumber)]))}
            onSelect={(id) => {
              setSelected(id);
              if (id && path !== "/app") router.push("/app");
            }}
          />
        )}
      </div>
    </div>
  );
}
