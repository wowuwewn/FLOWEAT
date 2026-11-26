import { z } from "zod";
import { service } from "@/server/orders";
import { body, fail, json, limited, noStore } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const blocked = noStore() ?? limited(req);
  if (blocked) return blocked;
  const parsed = z.object({ token: z.string().max(64) }).safeParse(await body(req));
  if (!parsed.success) return json({ error: "INVALID_INPUT", message: "요청 형식이 올바르지 않아요." }, 400);
  try {
    return json(await service().closeByToken(parsed.data.token));
  } catch (e) {
    return fail(e);
  }
}
