import type { Order, OrderBatch, OrderEvent, OrderStatus } from "./types";

/**
 * Persistence port. Implemented by:
 *  - server/store/memory.ts  (single Node process; local & laptop multi-device demo)
 *  - client/device-store.ts  (browser localStorage; Vercel one-device mode)
 *  - future: redis / postgres adapter — same contract, no domain changes.
 *
 * Every method must be atomic with respect to a single order.
 */
export interface OrderRepository {
  /** Allocates the next brand-wise display number inside a session. */
  nextDisplayNumber(sessionId: string, brandId: string): Promise<number>;
  insertBatch(batch: OrderBatch, orders: Order[]): Promise<OrderEvent[]>;
  getOrder(orderId: string): Promise<Order | null>;
  findByTokenHash(tokenHash: string): Promise<Order | null>;
  listOrders(sessionId: string): Promise<Order[]>;
  /**
   * Conditional state change (compare-and-set). Returns changed=false when the order
   * is not in one of `from` — callers treat that as an idempotent no-op.
   * The idempotency key must be unique per logical action.
   */
  transition(
    orderId: string,
    from: OrderStatus[],
    patch: Partial<Pick<Order, "status" | "readyAt" | "closedAt" | "closeReason">>,
    event: { type: OrderEvent["type"]; at: number; idempotencyKey: string },
  ): Promise<{ order: Order | null; changed: boolean }>;
  latestSeq(sessionId: string): Promise<number>;
}

/** Change notification port (long-poll friendly). */
export interface ChangeFeed {
  /** Resolves when the session sequence exceeds `sinceSeq` or after `timeoutMs`. */
  waitForChange(sessionId: string, sinceSeq: number, timeoutMs: number): Promise<void>;
  publish(sessionId: string, seq: number): void;
}

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };
