import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Roles on the laptop demo server (FLOWEAT_STORE=memory). Vercel runs without a shared store, so
 * every write API there is disabled (one-device mode keeps orders inside each browser).
 *
 *   student  — holds a QR token: may read / close THAT order only (token = bearer secret)
 *   kiosk    — may place orders in a session (mock payment), rate limited and capped per session
 *   staff    — per-session staff key: may complete / undo orders and see order details
 *   operator — operator key: may reset a session and issue staff keys
 *
 * Keys are derived from a server secret (FLOWEAT_SECRET, or random per process). The operator key is
 * FLOWEAT_OPERATOR_KEY if set, otherwise derived and printed to the server console at start-up.
 * A session code alone (e.g. "DEMO") no longer grants staff or operator actions.
 */
interface G {
  __floweatSecret?: Buffer;
}
const g = globalThis as G;
function secret(): Buffer {
  if (process.env.FLOWEAT_SECRET) return Buffer.from(process.env.FLOWEAT_SECRET);
  return (g.__floweatSecret ??= randomBytes(32));
}
const mac = (label: string) => createHmac("sha256", secret()).update(label).digest("base64url");

export function operatorKey(): string {
  return process.env.FLOWEAT_OPERATOR_KEY?.trim() || mac("operator").slice(0, 12);
}
export function staffKey(sessionId: string): string {
  return mac(`staff:${sessionId}`).slice(0, 16);
}

function same(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const STAFF_HEADER = "x-floweat-staff";
export const OPERATOR_HEADER = "x-floweat-operator";

export function isOperator(req: Request): boolean {
  return same(req.headers.get(OPERATOR_HEADER), operatorKey());
}
export function isStaff(req: Request, sessionId: string): boolean {
  return isOperator(req) || same(req.headers.get(STAFF_HEADER), staffKey(sessionId));
}
