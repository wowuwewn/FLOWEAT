/**
 * FLOWEAT mark: an entrance arch with three short "flows" on each side —
 * the six kiosk lines meeting at the main door. Own drawing, no school assets.
 */
export function Logo({ size = 28, tone = "blue", className }: { size?: number; tone?: "blue" | "white"; className?: string }) {
  const fg = tone === "white" ? "#ffffff" : "#2448db";
  const ink = tone === "white" ? "#2448db" : "#ffffff";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="9" fill={fg} />
      <path d="M11.5 25V15.5a4.5 4.5 0 0 1 9 0V25" fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M4.8 12.5h3.6M4.8 17h3.6M4.8 21.5h3.6M23.6 12.5h3.6M23.6 17h3.6M23.6 21.5h3.6" stroke={ink} strokeWidth="2.2" strokeLinecap="round" opacity=".9" />
    </svg>
  );
}

export function Wordmark({ tone = "ink", size = 20 }: { tone?: "ink" | "white"; size?: number }) {
  return (
    <span className="flex items-center gap-2">
      <Logo size={Math.round(size * 1.35)} tone={tone === "white" ? "white" : "blue"} />
      <span style={{ fontSize: size, letterSpacing: "-0.045em" }} className={`leading-none font-[820] ${tone === "white" ? "text-white" : "text-[#0b1f4d]"}`}>
        FLOWEAT
      </span>
    </span>
  );
}
