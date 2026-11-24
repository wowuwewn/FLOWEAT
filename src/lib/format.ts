import type { WaitLevel } from "@/core/predict/eta";
import type { TableLevel } from "@/core/world";

/** "3–5분" style range from seconds. Never claims precision below a minute. */
export function minuteRange(lo: number, hi: number): string {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return "정보 부족";
  const a = Math.max(0, Math.floor(lo / 60));
  const b = Math.max(1, Math.ceil(hi / 60));
  if (b <= 1) return "1분 안";
  if (a === 0) return `${b}분 안`;
  if (a >= b) return `약 ${b}분`;
  return `${a}–${b}분`;
}

/** Split range into number + unit for typographic layouts. */
export function minuteRangeParts(lo: number, hi: number): { value: string; unit: string } {
  const s = minuteRange(lo, hi);
  if (s === "정보 부족") return { value: "–", unit: "" };
  if (s.endsWith("분 안")) return { value: s.replace("분 안", ""), unit: "분 안" };
  return { value: s.replace("약 ", "").replace("분", ""), unit: "분" };
}

export function minutes(sec: number): number {
  return Math.max(0, Math.round(sec / 60));
}

export function won(n: number | null): string {
  return n == null ? "가격 미표기" : `${n.toLocaleString("ko-KR")}원`;
}

export function percent(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function since(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "방금";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}분 전`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분 전`;
}

export function elapsed(ms: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  const m = Math.floor(s / 60);
  return m === 0 ? `${s}초` : `${m}분 ${String(s % 60).padStart(2, "0")}초`;
}

export function clockKst(ms: number): string {
  return new Date(ms).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" });
}

export const WAIT_LEVEL: Record<WaitLevel, { label: string; text: string; dot: string; bg: string }> = {
  free: { label: "여유", text: "text-free", dot: "bg-free", bg: "bg-free-bg" },
  normal: { label: "보통", text: "text-normal", dot: "bg-normal-dot", bg: "bg-normal-bg" },
  busy: { label: "붐빔", text: "text-busy", dot: "bg-busy-dot", bg: "bg-busy-bg" },
  very_busy: { label: "매우 붐빔", text: "text-very", dot: "bg-very-dot", bg: "bg-very-bg" },
};

export const WAIT_LEVEL_HEX: Record<WaitLevel, string> = {
  free: "#1f9d6c",
  normal: "#e0a21b",
  busy: "#ef6a23",
  very_busy: "#d8343a",
};

export const TABLE_LEVEL: Record<TableLevel, { label: string; text: string; dot: string; bg: string }> = {
  free: { label: "여유", text: "text-free", dot: "bg-free", bg: "bg-free-bg" },
  normal: { label: "보통", text: "text-normal", dot: "bg-normal-dot", bg: "bg-normal-bg" },
  busy: { label: "붐빔", text: "text-busy", dot: "bg-busy-dot", bg: "bg-busy-bg" },
  full: { label: "거의 만석", text: "text-very", dot: "bg-very-dot", bg: "bg-very-bg" },
};

export function josaI(word: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return `${word}이`;
  return (c - 0xac00) % 28 ? `${word}이` : `${word}가`;
}
