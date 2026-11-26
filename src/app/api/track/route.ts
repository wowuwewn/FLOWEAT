import { z } from "zod";
import { feed, service } from "@/server/orders";
import { body, fail, json, noStore } from "@/server/http";

export const dynamic = "force-dynamic";

const TrackBody = z.object({
  tokens: z.array(z.string().max(64)).min(1).max(12),
  /** known versions by token; if nothing changed, the request waits (long-poll) */
  versions: z.record(z.string(), z.number()).optional(),
  wait: z.number().int().min(0).max(25_000).optional(),
});

export async function POST(req: Request) {
  const blocked = noStore();
  if (blocked) return blocked;
  const parsed = TrackBody.safeParse(await body(req));
  if (!parsed.success) return json({ error: "INVALID_INPUT", message: "요청 형식이 올바르지 않아요." }, 400);
  const { tokens, versions, wait = 0 } = parsed.data;
  try {
    const svc = service();
    const deadline = Date.now() + wait;
    for (;;) {
      const results = await svc.track(tokens);
      const changed = !versions || results.some((r) => versions[r.token] === undefined || (r.order?.version ?? -1) !== versions[r.token]);
      const left = deadline - Date.now();
      if (changed || left <= 0) return json({ results, serverNow: Date.now() });
      await feed().waitForChange("*", 0, left);
    }
  } catch (e) {
    return fail(e);
  }
}
