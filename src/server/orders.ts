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

// --- naive per-IP rate limit for write endpoints (demo hardening) -------------
const buckets = new Map<string, { n: number; reset: number }>();
export function rateLimited(ip: string, limit = 40, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.reset < now) {
    buckets.set(ip, { n: 1, reset: now + windowMs });
    return false;
  }
  b.n++;
  return b.n > limit;
}
