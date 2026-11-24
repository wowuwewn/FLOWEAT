import type { OrderRepository } from "./ports";
import { OrderService } from "./service";
import type { Order, OrderBatch, OrderEvent, OrderStatus } from "./types";

export interface OrderState {
  orders: Record<string, Order>;
  batches: Record<string, OrderBatch>;
  events: OrderEvent[];
  counters: Record<string, number>;
  seq: Record<string, number>;
  idem: Record<string, number>;
  tokenIndex: Record<string, string>;
}

export function emptyState(): OrderState {
  return { orders: {}, batches: {}, events: [], counters: {}, seq: {}, idem: {}, tokenIndex: {} };
}

/** Where a MapRepository keeps its state: a process-global object or browser storage. */
export interface StateBackend {
  read(): OrderState;
  write(state: OrderState): void;
}

const MAX_EVENTS = 2000;

/**
 * Key-value implementation of the repository port. Used by the server memory store
 * and the browser one-device store. A Redis adapter would mirror these same keys.
 */
export class MapRepository implements OrderRepository {
  constructor(private backend: StateBackend) {}

  private mutate<T>(fn: (s: OrderState) => T): T {
    const s = this.backend.read();
    const out = fn(s);
    if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
    this.backend.write(s);
    return out;
  }

  private pushEvent(s: OrderState, e: Omit<OrderEvent, "seq">): OrderEvent {
    const seq = (s.seq[e.sessionId] ?? 0) + 1;
    s.seq[e.sessionId] = seq;
    const ev = { ...e, seq };
    s.events.push(ev);
    s.idem[e.idempotencyKey] = seq;
    return ev;
  }

  async nextDisplayNumber(sessionId: string, brandId: string): Promise<number> {
    return this.mutate((s) => {
      const key = `${sessionId}|${brandId}`;
      const next = s.counters[key] ?? OrderService.firstDisplayNumber(sessionId, brandId);
      s.counters[key] = next + 1;
      return next;
    });
  }

  async insertBatch(batch: OrderBatch, orders: Order[]): Promise<OrderEvent[]> {
    return this.mutate((s) => {
      s.batches[batch.id] = batch;
      return orders.map((o) => {
        s.orders[o.id] = o;
        s.tokenIndex[o.tokenHash] = o.id;
        return this.pushEvent(s, {
          sessionId: o.sessionId, orderId: o.id, type: "accepted", at: o.acceptedAt, idempotencyKey: `accept:${o.id}`,
        });
      });
    });
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.backend.read().orders[orderId] ?? null;
  }

  async findByTokenHash(tokenHash: string): Promise<Order | null> {
    const s = this.backend.read();
    const id = s.tokenIndex[tokenHash];
    return id ? s.orders[id] ?? null : null;
  }

  async listOrders(sessionId: string): Promise<Order[]> {
    return Object.values(this.backend.read().orders)
      .filter((o) => o.sessionId === sessionId)
      .sort((a, b) => a.acceptedAt - b.acceptedAt);
  }

  async transition(
    orderId: string,
    from: OrderStatus[],
    patch: Partial<Pick<Order, "status" | "readyAt" | "closedAt" | "closeReason">>,
    event: { type: OrderEvent["type"]; at: number; idempotencyKey: string },
  ): Promise<{ order: Order | null; changed: boolean }> {
    return this.mutate((s) => {
      const o = s.orders[orderId];
      if (!o) return { order: null, changed: false };
      if (s.idem[event.idempotencyKey] !== undefined) return { order: o, changed: false };
      if (!from.includes(o.status)) return { order: o, changed: false };
      const next: Order = { ...o, ...patch, version: o.version + 1 };
      s.orders[orderId] = next;
      this.pushEvent(s, { sessionId: o.sessionId, orderId, type: event.type, at: event.at, idempotencyKey: event.idempotencyKey });
      return { order: next, changed: true };
    });
  }

  async latestSeq(sessionId: string): Promise<number> {
    return this.backend.read().seq[sessionId] ?? 0;
  }

  /** Demo reset: removes one session's data. */
  async resetSession(sessionId: string): Promise<void> {
    this.mutate((s) => {
      for (const [id, o] of Object.entries(s.orders)) {
        if (o.sessionId === sessionId) {
          delete s.tokenIndex[o.tokenHash];
          delete s.orders[id];
        }
      }
      for (const [id, b] of Object.entries(s.batches)) if (b.sessionId === sessionId) delete s.batches[id];
      for (const k of Object.keys(s.counters)) if (k.startsWith(`${sessionId}|`)) delete s.counters[k];
      s.events = s.events.filter((e) => e.sessionId !== sessionId);
      // keep seq monotonic so long-pollers notice the reset
      s.seq[sessionId] = (s.seq[sessionId] ?? 0) + 1;
    });
  }
}
