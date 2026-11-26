"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { createPortal } from "react-dom";
import type { KioskView, ZoneView } from "@/core/world";

// three.js is only downloaded when someone opens the preview
const CommonsVR = dynamic(() => import("./CommonsVR"), { ssr: false });

/** "360° 둘러보기" pill for the map; opens the KORAIL-Talk-style in-room preview. */
export function VRButton(props: { kiosks: KioskView[]; zones: ZoneView[]; highlightBrands?: string[]; highlightLabels?: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-[13px] font-semibold text-ink shadow-[0_1px_4px_rgba(16,24,40,.16)]"
      >
        <svg viewBox="0 0 20 20" className="size-4 text-blue" aria-hidden>
          <path d="M3 8.5C3 6.6 6.1 5 10 5s7 1.6 7 3.5v3C17 13.4 13.9 15 10 15S3 13.4 3 11.5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12.5 15.2 10.8 13.6l1.7-1.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        360° 둘러보기
      </button>
      {/* portal: the map sits in its own stacking context, the viewer must cover the whole app */}
      {open && createPortal(<CommonsVR {...props} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
