import { SESSION_PATTERN } from "@/core/orders/service";
import { isOperator, staffKey } from "@/server/auth";
import { forbidden, json, limited, noStore } from "@/server/http";

export const dynamic = "force-dynamic";

/** Operator issues the staff key for one session (shown as a pairing link / QR for the staff device). */
export async function POST(req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const { sid } = await ctx.params;
  const blocked = noStore() ?? limited(req);
  if (blocked) return blocked;
  if (!isOperator(req)) return forbidden("operator");
  if (!SESSION_PATTERN.test(sid)) return json({ error: "INVALID_INPUT", message: "세션 코드가 올바르지 않아요." }, 400);
  return json({ sessionId: sid, staffKey: staffKey(sid) });
}
