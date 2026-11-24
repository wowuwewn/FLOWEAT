import { getBrand, getMenu } from "../catalog";
import type { ChangeFeed, Clock, OrderRepository } from "./ports";
import { hashToken, isWellFormedToken, newId, newToken } from "./token";
import type {
  Order, OrderBatch, OrderItem, OrderView, PlaceOrderInput, PlaceOrderResult, PrepEstimate, SessionOrders,
} from "./types";
import { toView } from "./types";

export const ORDER_POLICY = {
  /** QR link lifetime after acceptance */
  tokenTtlMs: 3 * 60 * 60 * 1000,
  /** after ready, keep the link usable for this long */
  readyTtlMs: 90 * 60 * 1000,
  /** monitor keeps a ready number on screen for this long */
  monitorWindowMs: 15 * 60 * 1000,
  maxLinesPerOrder: 20,
  maxQtyPerLine: 9,
};

export const SESSION_PATTERN = /^[A-Z0-9]{4,8}$/;

export type PrepEstimator = (brandId: string, items: OrderItem[], at: number, extraBacklog: number) => PrepEstimate | null;

export class OrderError extends Error {
  constructor(public code: "INVALID_INPUT" | "NOT_FOUND" | "EXPIRED" | "INVALID_TOKEN", message: string) {
    super(message);
  }
}

export interface TrackResult {
  token: string;
  state: "ok" | "closed" | "expired" | "not_found" | "invalid";
  order: OrderView | null;
}

/** Deterministic brand-wise starting number per session so sessions look distinct. */
function startingNumber(sessionId: string, brandId: string): number {
  let h = 2166136261;
  for (const ch of sessionId + brandId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return 100 + (Math.abs(h) % 60);
}

export class OrderService {
  constructor(
    private repo: OrderRepository,
    private feed: ChangeFeed,
    private clock: Clock,
    private estimatePrep: PrepEstimator = () => null,
  ) {}

  static firstDisplayNumber = startingNumber;

  async placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
    const { sessionId, kioskId, lines } = input;
    if (!SESSION_PATTERN.test(sessionId)) throw new OrderError("INVALID_INPUT", "세션 코드 형식이 올바르지 않아요.");
    if (!/^[LR][1-3]$/.test(kioskId)) throw new OrderError("INVALID_INPUT", "키오스크 위치가 올바르지 않아요.");
    if (!Array.isArray(lines) || lines.length === 0 || lines.length > ORDER_POLICY.maxLinesPerOrder) {
      throw new OrderError("INVALID_INPUT", "장바구니가 비어 있거나 너무 많아요.");
    }
    // group lines by brand → one order per brand (mirrors brand-wise paper tickets)
    const byBrand = new Map<string, OrderItem[]>();
    let totalKrw = 0;
    for (const line of lines) {
      const menu = getMenu(line.menuId);
      const qty = Math.floor(Number(line.qty));
      if (!menu || !(qty >= 1 && qty <= ORDER_POLICY.maxQtyPerLine)) {
        throw new OrderError("INVALID_INPUT", "메뉴 정보가 올바르지 않아요.");
      }
      const list = byBrand.get(menu.brandId) ?? [];
      const existing = list.find((i) => i.menuId === menu.id);
      if (existing) existing.qty = Math.min(ORDER_POLICY.maxQtyPerLine, existing.qty + qty);
      else list.push({ menuId: menu.id, name: menu.name, qty, unitPriceKrw: menu.listedPriceKrw });
      byBrand.set(menu.brandId, list);
      totalKrw += (menu.listedPriceKrw ?? 0) * qty;
    }

    const now = this.clock.now();
    const batchId = newId("b");
    const sessionOrders = await this.repo.listOrders(sessionId);
    const orders: Order[] = [];
    const tickets: { order: Order; token: string }[] = [];
    for (const [brandId, items] of byBrand) {
      if (!getBrand(brandId)) throw new OrderError("INVALID_INPUT", "브랜드 정보가 올바르지 않아요.");
      const token = newToken();
      const openForBrand = sessionOrders.filter((o) => o.brandId === brandId && o.status === "accepted").length;
      const order: Order = {
        id: newId("o"),
        sessionId,
        batchId,
        brandId,
        displayNumber: await this.repo.nextDisplayNumber(sessionId, brandId),
        kioskId,
        items,
        status: "accepted",
        acceptedAt: now,
        readyAt: null,
        closedAt: null,
        closeReason: null,
        prepEstimate: this.estimatePrep(brandId, items, now, openForBrand),
        tokenHash: await hashToken(token),
        tokenExpiresAt: now + ORDER_POLICY.tokenTtlMs,
        version: 1,
      };
      orders.push(order);
      tickets.push({ order, token });
    }
    const batch: OrderBatch = {
      id: batchId, sessionId, kioskId, createdAt: now, orderIds: orders.map((o) => o.id), totalKrw, payment: "mock",
    };
    const events = await this.repo.insertBatch(batch, orders);
    this.feed.publish(sessionId, events.at(-1)?.seq ?? (await this.repo.latestSeq(sessionId)));
    return { batch, tickets: tickets.map((t) => ({ order: toView(t.order), token: t.token })) };
  }

  /** Staff "완료" — idempotent. Returns the current order either way. */
  async markReady(sessionId: string, orderId: string, idempotencyKey: string): Promise<{ order: Order; changed: boolean }> {
    const existing = await this.repo.getOrder(orderId);
    if (!existing || existing.sessionId !== sessionId) throw new OrderError("NOT_FOUND", "주문을 찾을 수 없어요.");
    const now = this.clock.now();
    const res = await this.repo.transition(
      orderId,
      ["accepted"],
      { status: "ready", readyAt: now },
      { type: "ready", at: now, idempotencyKey: idempotencyKey || `ready:${orderId}` },
    );
    const order = res.order ?? existing;
    if (res.changed) this.feed.publish(sessionId, await this.repo.latestSeq(sessionId));
    return { order, changed: res.changed };
  }

  /** Staff undo within the grace window: ready → accepted. */
  async undoReady(sessionId: string, orderId: string, idempotencyKey: string): Promise<{ order: Order; changed: boolean }> {
    const existing = await this.repo.getOrder(orderId);
    if (!existing || existing.sessionId !== sessionId) throw new OrderError("NOT_FOUND", "주문을 찾을 수 없어요.");
    const now = this.clock.now();
    if (existing.status !== "ready" || !existing.readyAt || now - existing.readyAt > 10_000) {
      return { order: existing, changed: false };
    }
    const res = await this.repo.transition(
      orderId, ["ready"], { status: "accepted", readyAt: null },
      { type: "accepted", at: now, idempotencyKey: idempotencyKey || `undo:${orderId}:${existing.version}` },
    );
    if (res.changed) this.feed.publish(sessionId, await this.repo.latestSeq(sessionId));
    return { order: res.order ?? existing, changed: res.changed };
  }

  private effectiveExpiry(o: Order): number {
    return o.readyAt ? Math.max(o.tokenExpiresAt, o.readyAt + ORDER_POLICY.readyTtlMs) : o.tokenExpiresAt;
  }

  async track(tokens: string[]): Promise<TrackResult[]> {
    const now = this.clock.now();
    const unique = Array.from(new Set(tokens)).slice(0, 12);
    return Promise.all(
      unique.map(async (token): Promise<TrackResult> => {
        if (!isWellFormedToken(token)) return { token, state: "invalid", order: null };
        const o = await this.repo.findByTokenHash(await hashToken(token));
        if (!o) return { token, state: "not_found", order: null };
        const expiry = this.effectiveExpiry(o);
        if (now > expiry && o.status !== "closed") {
          return { token, state: "expired", order: { ...toView(o), status: "expired", expiresAt: expiry } };
        }
        return { token, state: o.status === "closed" ? "closed" : "ok", order: { ...toView(o), expiresAt: expiry } };
      }),
    );
  }

  /** Student "받았어요" — ends tracking for this order. */
  async closeByToken(token: string): Promise<TrackResult> {
    if (!isWellFormedToken(token)) return { token, state: "invalid", order: null };
    const o = await this.repo.findByTokenHash(await hashToken(token));
    if (!o) return { token, state: "not_found", order: null };
    const now = this.clock.now();
    const res = await this.repo.transition(
      o.id, ["accepted", "ready"], { status: "closed", closedAt: now, closeReason: "user_closed" },
      { type: "closed", at: now, idempotencyKey: `close:${o.id}` },
    );
    if (res.changed) this.feed.publish(o.sessionId, await this.repo.latestSeq(o.sessionId));
    const cur = res.order ?? o;
    return { token, state: "closed", order: toView(cur) };
  }

  async sessionOrders(sessionId: string): Promise<SessionOrders> {
    if (!SESSION_PATTERN.test(sessionId)) throw new OrderError("INVALID_INPUT", "세션 코드 형식이 올바르지 않아요.");
    const [orders, seq] = await Promise.all([this.repo.listOrders(sessionId), this.repo.latestSeq(sessionId)]);
    return { orders, seq };
  }

  async waitSession(sessionId: string, sinceSeq: number, timeoutMs: number): Promise<SessionOrders> {
    const cur = await this.repo.latestSeq(sessionId);
    if (cur <= sinceSeq && timeoutMs > 0) await this.feed.waitForChange(sessionId, sinceSeq, timeoutMs);
    return this.sessionOrders(sessionId);
  }
}

/** Orders visible on the public pickup monitor: ready, within the display window. */
export function monitorOrders<T extends Pick<Order, "status" | "readyAt">>(orders: T[], now: number): T[] {
  return orders
    .filter((o) => o.status === "ready" && o.readyAt !== null && now - o.readyAt < ORDER_POLICY.monitorWindowMs)
    .sort((a, b) => (b.readyAt ?? 0) - (a.readyAt ?? 0));
}
