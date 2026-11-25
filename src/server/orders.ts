import "server-only";
import { emptyState, MapRepository, type OrderState } from "@/core/orders/memory-repo";
import type { ChangeFeed } from "@/core/orders/ports";
import { systemClock } from "@/core/orders/ports";
import { OrderService } from "@/core/orders/service";
import type { ScenarioId } from "@/core/sim/simulator";
import { demoClock, getEngine, prepForOrder } from "@/core/world";

export type StoreMode = "memory" | "none";

/**
 * memory: one Node process holds all sessions → real multi-device demo on a laptop / LAN.
 * none:   no shared store (e.g. Vercel serverless) → clients fall back to one-device mode.
 * A Redis/Postgres adapter would slot in here behind the same OrderRepository port.
 */
export function storeMode(): StoreMode {
  const v = process.env.FLOWEAT_STORE?.trim();
  if (v === "memory" || v === "none") return v;
  return process.env.VERCEL ? "none" : "memory";
}

class MemoryFeed implements ChangeFeed {
  private waiters = new Map<string, Set<() => void>>();
  private global = 0;
  publish(sessionId: string, _seq: number) {
    this.global++;
    for (const key of [sessionId, "*"]) {
      const set = this.waiters.get(key);
      if (!set) continue;
      this.waiters.delete(key);
      set.forEach((fn) => fn());
    }
  }
  get globalSeq() {
    return this.global;
  }
  waitForChange(sessionId: string, _sinceSeq: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const set = this.waiters.get(sessionId) ?? new Set();
      const done = () => {
        clearTimeout(timer);
        set.delete(done);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      set.add(done);
      this.waiters.set(sessionId, set);
    });
  }
}

interface Globals {
  __floweatState?: OrderState;
  __floweatFeed?: MemoryFeed;
}
const g = globalThis as Globals;

export function feed(): MemoryFeed {
  return (g.__floweatFeed ??= new MemoryFeed());
}

export function repo(): MapRepository {
  g.__floweatState ??= emptyState();
  return new MapRepository({ read: () => g.__floweatState!, write: (s) => (g.__floweatState = s) });
}

export function service(scenario: ScenarioId = "peak"): OrderService {
  return new OrderService(repo(), feed(), systemClock, (brandId, items, at, extra) => {
    const clock = demoClock(at);
    return prepForOrder(getEngine(clock.dateKey, scenario), clock, brandId, items, extra);
  });
}

// --- rate limits for write endpoints -----------------------------------------
/**
 * `next start` passes a client-supplied X-Forwarded-For through unchanged (it only fills it in when
 * absent), so on the laptop server the claimed IP cannot be trusted. Three buckets apply together:
 *   claimed client (fairness for honest clients) · whole server (a spoofer can't exceed it) ·
 *   per session (one session can't be flooded with orders/completions)
 * Behind a proxy you control, FLOWEAT_TRUST_PROXY=1 uses the proxy-appended (last) X-Forwarded-For hop.
 */
const buckets = new Map<string, { n: number; reset: number }>();
function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return false;
  }
  b.n++;
  return b.n > limit;
}

export function clientId(req: Request): string {
  if (process.env.VERCEL) return req.headers.get("x-real-ip") ?? "vercel"; // set by Vercel's edge
  const xff = req.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  if (process.env.FLOWEAT_TRUST_PROXY === "1") return xff.at(-1) ?? "direct";
  return `claimed:${xff[0] ?? "direct"}`;
}

// FLOWEAT_RATE_PER_CLIENT only exists so the E2E suite (every browser is 127.0.0.1) can run its ~60 writes a minute
export const LIMITS = { perClient: Number(process.env.FLOWEAT_RATE_PER_CLIENT) || 40, global: 400, perSession: 120, windowMs: 60_000 };

export function rateLimited(req: Request, sessionId?: string): boolean {
  const w = LIMITS.windowMs;
  // evaluate all buckets so each counts the request
  const a = hit(`c:${clientId(req)}`, LIMITS.perClient, w);
  const b = hit("global", LIMITS.global, w);
  const c = sessionId ? hit(`s:${sessionId}`, LIMITS.perSession, w) : false;
  return a || b || c;
}

/** tests only */
export function resetRateLimits() {
  buckets.clear();
}
