import { z } from "zod";
import { toStaff } from "@/core/orders/types";
import { service } from "@/server/orders";
import { isStaff } from "@/server/auth";
import { body, fail, forbidden, json, limited, noStore } from "@/server/http";

export const dynamic = "force-dynamic";

const ReadyBody = z.object({ idempotencyKey: z.string().min(4).max(80), undo: z.boolean().optional() });

export async function POST(req: Request, ctx: { params: Promise<{ sid: string; orderId: string }> }) {
  const { sid, orderId } = await ctx.params;
  const blocked = noStore() ?? limited(req, sid);
  if (blocked) return blocked;
  if (!isStaff(req, sid)) return forbidden("staff");
  const parsed = ReadyBody.safeParse(await body(req));
  if (!parsed.success) return json({ error: "INVALID_INPUT", message: "요청 형식이 올바르지 않아요." }, 400);
  try {
    const svc = service();
    const r = parsed.data.undo
      ? await svc.undoReady(sid, orderId, parsed.data.idempotencyKey)
      : await svc.markReady(sid, orderId, parsed.data.idempotencyKey);
    return json({ changed: r.changed, order: toStaff(r.order) });
  } catch (e) {
    return fail(e);
  }
}
