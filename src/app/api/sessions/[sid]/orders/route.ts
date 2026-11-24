import { z } from "zod";
import { toStaff } from "@/core/orders/types";
import { SCENARIOS } from "@/core/sim/simulator";
import { service } from "@/server/orders";
import { body, fail, json, limited, noStore } from "@/server/http";

export const dynamic = "force-dynamic";

const PlaceBody = z.object({
  kioskId: z.string(),
  scenario: z.enum(Object.keys(SCENARIOS) as [string, ...string[]]).default("peak"),
  lines: z.array(z.object({ menuId: z.string().max(40), qty: z.number().int().min(1).max(9) })).min(1).max(20),
});

export async function POST(req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const blocked = noStore() ?? limited(req);
  if (blocked) return blocked;
  const { sid } = await ctx.params;
  const parsed = PlaceBody.safeParse(await body(req));
  if (!parsed.success) return json({ error: "INVALID_INPUT", message: "주문 정보가 올바르지 않아요." }, 400);
  try {
    const svc = service(parsed.data.scenario as keyof typeof SCENARIOS);
    return json(await svc.placeOrder({ sessionId: sid, kioskId: parsed.data.kioskId, lines: parsed.data.lines }), 201);
  } catch (e) {
    return fail(e);
  }
}

/** Staff & monitor feed. Long-poll: ?since=<seq>&wait=<ms> returns on change or timeout. */
export async function GET(req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const blocked = noStore();
  if (blocked) return blocked;
  const { sid } = await ctx.params;
  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since") ?? -1);
  const wait = Math.min(25_000, Math.max(0, Number(url.searchParams.get("wait") ?? 0)));
  try {
    const r = await service().waitSession(sid, Number.isFinite(since) ? since : -1, wait);
    return json({ seq: r.seq, orders: r.orders.map(toStaff), serverNow: Date.now() });
  } catch (e) {
    return fail(e);
  }
}
