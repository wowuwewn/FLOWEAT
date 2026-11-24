import { storeMode } from "@/server/orders";
import { json } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET() {
  const store = storeMode();
  return json({ ok: true, store, sharedAcrossDevices: store !== "none", now: Date.now() });
}
