"use client";
import jsQR from "jsqr";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { tokenFromScan } from "@/client/scan";
import { PageHeader } from "@/components/student/Chrome";

type BarcodeDetectorLike = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };

export default function ScanPage() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"starting" | "scanning" | "denied" | "unsupported" | "wrong">("starting");
  const [pasted, setPasted] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;

    const handle = (text: string) => {
      const t = tokenFromScan(text);
      if (t) {
        stopped = true;
        try {
          navigator.vibrate?.(60);
        } catch {
          /* ignore */
        }
        router.push(`/o/${t}`);
      } else setState("wrong");
    };

    const loop = async () => {
      if (stopped || !video.current || video.current.readyState < 2) {
        if (!stopped) raf = requestAnimationFrame(loop);
        return;
      }
      const v = video.current;
      try {
        if (detector) {
          const codes = await detector.detect(v);
          if (codes[0]) return handle(codes[0].rawValue);
        } else if (ctx) {
          const w = 480;
          const h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
          if (code?.data) return handle(code.data);
        }
      } catch {
        /* keep scanning */
      }
      raf = requestAnimationFrame(loop);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return;
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play().catch(() => {});
        }
        setState("scanning");
        raf = requestAnimationFrame(loop);
      } catch {
        setState("denied");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [router]);

  return (
    <div className="pb-6">
      <PageHeader title="번호표 QR 스캔" back="/app/orders" />
      <div className="relative mx-3 aspect-square overflow-hidden rounded-[var(--radius-sheet)] bg-[#0b1630]">
        <video ref={video} className="size-full object-cover" playsInline muted aria-label="카메라 미리보기" />
        <div className="pointer-events-none absolute inset-[18%] rounded-3xl border-[3px] border-white/85" aria-hidden />
        {state !== "scanning" && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center text-[15px] text-white/90">
            {state === "starting" && "카메라를 켜는 중…"}
            {state === "denied" && "카메라 권한이 없어요. 휴대폰 기본 카메라로 번호표 QR을 찍어도 돼요."}
            {state === "unsupported" && "이 브라우저에서는 카메라를 쓸 수 없어요. 휴대폰 기본 카메라로 QR을 찍어 주세요."}
            {state === "wrong" && "FLOWEAT 번호표 QR이 아니에요. 번호표의 QR을 찍어 주세요."}
          </div>
        )}
      </div>
      <p className="mx-5 mt-4 text-[14px] leading-relaxed text-ink-2">
        번호표 QR을 네모 안에 맞춰 주세요. 휴대폰 기본 카메라로 찍어도 같은 화면이 열려요. 회원가입은 필요 없어요.
      </p>
      <form
        className="mx-3 mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const t = tokenFromScan(pasted);
          if (t) router.push(`/o/${t}`);
          else setState("wrong");
        }}
      >
        <label htmlFor="paste" className="sr-only">
          QR 주소 붙여넣기
        </label>
        <input
          id="paste"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="QR 주소를 붙여 넣어도 돼요"
          className="min-w-0 flex-1 rounded-2xl border border-line bg-surface px-4 py-3 text-[15px]"
        />
        <button className="rounded-2xl bg-navy px-5 font-semibold text-white">열기</button>
      </form>
    </div>
  );
}
