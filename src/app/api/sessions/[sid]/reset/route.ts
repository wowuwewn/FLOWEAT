import { SESSION_PATTERN } from "@/core/orders/service";
import { feed, repo } from "@/server/orders";
import { json, limited, noStore } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const blocked = noStore() ?? limited(req);
  if (blocked) return blocked;
  const { sid } = await ctx.params;
  if (!SESSION_PATTERN.test(sid)) return json({ error: "INVALID_INPUT", message: "세션 코드가 올바르지 않아요." }, 400);
  const r = repo();
  await r.resetSession(sid);
  feed().publish(sid, await r.latestSeq(sid));
  return json({ ok: true });
}
