"use client";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** Real, scannable QR (SVG). */
export function Qr({ value, size = 168, label, dark = "#0e2b63" }: { value: string; size?: number; label: string; dark?: string }) {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark, light: "#ffffff" } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(""));
    return () => {
      alive = false;
    };
  }, [value, dark]);
  return (
    <div
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
      className="bg-white [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
