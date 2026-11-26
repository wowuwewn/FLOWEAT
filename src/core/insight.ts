/**
 * Short situation line built ONLY from computed numbers (template NLG).
 * Replaces a runtime LLM call (0-cost policy). Wording drafted with generative AI during
 * development; every number comes from the world model.
 */
import type { World } from "./world";

function joinKo(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  const head = items.slice(0, -1).join(", ");
  return `${josa(head, "과", "와")} ${items.at(-1)}`;
}

function josa(word: string, withBatchim: string, without: string) {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return word + withBatchim;
  return word + ((c - 0xac00) % 28 ? withBatchim : without);
}

export function queueInsight(w: World): string {
  const ks = w.kiosks;
  if (ks.every((k) => k.people === 0)) return "지금은 줄이 거의 없어요. 가까운 키오스크를 쓰세요.";
  const similar = ks.filter((k) => k.similar);
  if (similar.length >= 5) return "여섯 줄이 거의 비슷해요. 가까운 줄에 서도 괜찮아요.";
  const fastest = ks.find((k) => k.isFastest)!;
  // a line that looks shorter than the fastest but is expected to be slower
  const deceptive = ks
    .filter((k) => !k.similar && k.people <= fastest.people)
    .sort((a, b) => b.p50 - a.p50)[0];
  const names = similar.map((k) => k.label);
  const head = similar.length === 1 ? `${josa(fastest.label, "이", "가")} 가장 빨라요.` : `${josa(joinKo(names), "이", "가")} 비슷하게 빨라요.`;
  if (deceptive) return `${head} ${josa(deceptive.label, "은", "는")} 줄이 짧아도 더 오래 걸려요.`;
  return head;
}

export function seatInsight(w: World): string {
  const lvl = w.overall.tableLevel;
  const best = [...w.zones].filter((z) => z.observed).sort((a, b) => a.rateHigh - b.rateHigh)[0];
  if (lvl === "full") return "관측 중인 자리는 거의 다 찼어요. 빈자리가 나도 금방 채워져요.";
  if (lvl === "busy") return `자리가 붐벼요. ${josa(best.name, "이", "가")} 상대적으로 여유 있어 보여요.`;
  if (lvl === "normal") return `자리는 보통이에요. ${josa(best.name, "이", "가")} 가장 여유 있어 보여요.`;
  return "자리는 여유 있어 보여요.";
}

export function trendWord(now: number, next: number, scale: number): "늘어요" | "줄어요" | "비슷해요" {
  const d = next - now;
  if (Math.abs(d) < scale) return "비슷해요";
  return d > 0 ? "늘어요" : "줄어요";
}
