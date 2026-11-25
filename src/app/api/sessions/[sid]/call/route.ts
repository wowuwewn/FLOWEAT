import { z } from "zod";
import { toStaff } from "@/core/orders/types";
import { service } from "@/server/orders";
import { isStaff } from "@/server/auth";
import { body, fail, forbidden, json, limited, noStore } from "@/server/http";

export const dynamic = "force-dynamic";

/** Number-entry completion device: staff type the ticket number of a brand to call it. */
const CallBody = z.object({
  brandId: z.string().min(2).max(40),
  number: z.number().int().min(1).max(9999),
  idempotencyKey: z.string().min(4).max(80),
});

export async function POST(req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const { sid } = await ctx.params;
  const blocked = noStore() ?? limited(req, sid);
  if (blocked) return blocked;
  if (!isStaff(req, sid)) return forbidden("staff");
  const parsed = CallBody.safeParse(await body(req));
  if (!parsed.success) return json({ error: "INVALID_INPUT", message: "요청 형식이 올바르지 않아요." }, 400);
  try {
    const r = await service().callNumber(sid, parsed.data.brandId, parsed.data.number, parsed.data.idempotencyKey);
    return json({ outcome: r.outcome, order: r.order ? toStaff(r.order) : null });
  } catch (e) {
    return fail(e);
  }
}
