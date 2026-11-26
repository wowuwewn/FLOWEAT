import { SESSION_PATTERN } from "@/core/orders/service";
import { feed, repo } from "@/server/orders";
import { isOperator } from "@/server/auth";
import { forbidden, json, limited, noStore } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const { sid } = await ctx.params;
  const blocked = noStore() ?? limited(req, sid);
  if (blocked) return blocked;
  if (!isOperator(req)) return forbidden("operator");
  if (!SESSION_PATTERN.test(sid)) return json({ error: "INVALID_INPUT", message: "세션 코드가 올바르지 않아요." }, 400);
  const r = repo();
  await r.resetSession(sid);
  feed().publish(sid, await r.latestSeq(sid));
  return json({ ok: true });
}
